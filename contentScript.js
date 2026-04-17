(async () => {
  if (window.__windchillPowerToolsLoaded) {
    return;
  }

  window.__windchillPowerToolsLoaded = true;

  const loadModule = async (file) => import(chrome.runtime.getURL(file));
  const [{ createOverlay }, { scanJcaDebug, correlateHoverTarget, formatParsedDetails }, { analyzeLogText, extractVisibleLogText, buildResolutionSearches }] = await Promise.all([
    loadModule("uiOverlay.js"),
    loadModule("customizationScanner.js"),
    loadModule("logAnalyzer.js")
  ]);

  const state = {
    debugBlocks: [],
    lastParsedDetails: null,
    highlightedElement: null,
    logAnalysis: null,
    logSearches: [],
    overlayState: null,
    theme: "dark"
  };

  const JMX_SHORTCUTS = [
    ["Server Status Page", "serverStatus.jsp", "An overview of the status of key server processes"],
    ["Windchill Cache Statistics", "cacheStatistics.jsp", "Statistics for Windchill caches"],
    ["Performance Feedback Settings", "settings.jsp", "Quick on-the-fly performance feedback settings"],
    ["Log Levels", "logLevel.jsp", "Get and set log levels"],
    ["Log Comment", "logComment.jsp", "Log a comment to server log files"],
    ["Log File Viewer", "logFiles.jsp", "Find, search, and view log files"],
    ["Persisted Log Events", "logEvents.jsp", "Persisted log events"],
    ["Log Event Histogram", "logEventsHistogram.jsp", "Histogram of persisted log events"],
    ["Method Context and Servlet Request Samples", "listSamples.jsp", "Persisted method context and request sampling data"],
    ["Cluster-wide Stack Traces", "clusterStacks.jsp", "Full stack traces for the cluster"],
    ["Top SQL Sample Intervals", "viewTopSQL.jsp", "Information on most expensive SQL statements"],
    ["Java Process Information", "javaProcesses.jsp", "Information on Java server processes"],
    ["Client User-Agent Usage", "userAgents.jsp", "Statistics on client user-agent usage"],
    ["Export System Health/Performance Tables to Client", "exportPerfTablesToClient.jsp", "Export performance tables to client"],
    ["Export System Health/Performance Tables to Support", "exportPerfTables.jsp", "Export performance tables to support"]
  ];

  const overlay = createOverlay({
    onAction: handleAction,
    onCopyParsedDetails: copyParsedDetails,
    onOpenShortcut: openShortcut,
    onAnalyzeLog: analyzeVisibleLog,
    onCopyLogAnalysis: copyLogAnalysis,
    onOpenResolutionSearch: openResolutionSearch,
    onOpenAllResolutionSearches: openAllResolutionSearches,
    onOverlayStateChange: persistOverlayState,
    onThemeChange: persistTheme
  });

  initialize();

  async function initialize() {
    state.theme = await loadTheme();
    overlay.setTheme(state.theme);
    state.overlayState = await loadOverlayState();
    overlay.restoreState(state.overlayState);
    refreshDebugBlocks();
    overlay.updateShortcuts(buildShortcutPayload());
    overlay.updateLogAnalysis(null, isLogViewerPage());
    overlay.updateResolutionSearches([]);

    const observer = new MutationObserver(() => {
      refreshDebugBlocks();
      overlay.updateLogAnalysis(state.logAnalysis, isLogViewerPage());
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    document.addEventListener("mouseover", handleHover, true);
  }

  function handleAction(action) {
    switch (action) {
      case "toggle-jca-debug":
        toggleUrlFlag("jcaDebug");
        break;
      case "toggle-js-debug":
        toggleUrlFlag("jsDebug");
        break;
      default:
        overlay.log(`Unknown action: ${action}`);
    }
  }

  function refreshDebugBlocks() {
    const result = scanJcaDebug(document);
    state.debugBlocks = result.blocks;

    const url = new URL(window.location.href);
    overlay.updateStatus({
      "jcaDebug Enabled": url.searchParams.get("jcaDebug") === "true" ? "Yes" : "No",
      "jsDebug Enabled": url.searchParams.get("jsDebug") === "true" ? "Yes" : "No",
      "Parsed Debug Blocks": result.count,
      "Log Analysis Available": isLogViewerPage() ? "Yes" : "No"
    });
  }

  function handleHover(event) {
    const url = new URL(window.location.href);
    if (url.searchParams.get("jcaDebug") !== "true") {
      clearHighlight();
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || target.closest("#windchill-powertools-root")) {
      return;
    }

    const correlation = correlateHoverTarget(target, state.debugBlocks);
    if (!correlation.matchedBlock) {
      return;
    }

    if (state.highlightedElement !== correlation.container) {
      clearHighlight();
      state.highlightedElement = correlation.container;
      state.highlightedElement.dataset.wptOutlineBackup = state.highlightedElement.style.outline || "";
      state.highlightedElement.style.outline = "2px solid #48d1a2";
      state.highlightedElement.style.outlineOffset = "2px";
    }

    state.lastParsedDetails = formatParsedDetails(correlation.matchedBlock, correlation.score);
    overlay.updateParsedDetails(state.lastParsedDetails);
  }

  function clearHighlight() {
    if (!state.highlightedElement) {
      return;
    }

    state.highlightedElement.style.outline = state.highlightedElement.dataset.wptOutlineBackup || "";
    delete state.highlightedElement.dataset.wptOutlineBackup;
    state.highlightedElement = null;
  }

  function toggleUrlFlag(flagName) {
    const url = new URL(window.location.href);
    const enabled = url.searchParams.get(flagName) === "true";

    if (enabled) {
      url.searchParams.delete(flagName);
    } else {
      url.searchParams.set(flagName, "true");
    }

    window.location.href = url.toString();
  }

  async function copyParsedDetails() {
    if (!state.lastParsedDetails) {
      overlay.log("Hover a parsed JCA debug item first.");
      return;
    }

    const text = JSON.stringify(state.lastParsedDetails, null, 2);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    overlay.log("Parsed details copied.");
  }

  function buildShortcutPayload() {
    const base = getJmxBaseUrl();
    return JMX_SHORTCUTS.map(([label, relativePath, description]) => ({
      label,
      description,
      url: new URL(relativePath, base).toString()
    }));
  }

  function getJmxBaseUrl() {
    const href = window.location.href;
    const marker = "/Windchill/wtcore/jsp/jmx/";
    const index = href.indexOf(marker);
    if (index >= 0) {
      return `${href.slice(0, index + marker.length)}`;
    }
    return new URL("/Windchill/wtcore/jsp/jmx/", window.location.origin).toString();
  }

  function openShortcut(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function isLogViewerPage() {
    const href = window.location.href.toLowerCase();
    return (
      href.includes("/windchill/wtcore/jsp/jmx/logfiles.jsp") ||
      href.includes("/windchill/wtcore/jsp/jmx/viewlogfile.jsp") ||
      href.includes("logfiles.jsp") ||
      href.includes("viewlogfile.jsp")
    );
  }

  async function analyzeVisibleLog() {
    if (!isLogViewerPage()) {
      overlay.log("Log analysis is available on the Log File Viewer page.");
      return;
    }

    const visibleLogText = extractVisibleLogText(document);
    if (!visibleLogText) {
      overlay.log("No visible log text found to analyze.");
      return;
    }

    overlay.log("Analyzing visible log text...");
    state.logAnalysis = await analyzeLogText(visibleLogText);
    state.logSearches = buildResolutionSearches(visibleLogText, state.logAnalysis);
    overlay.updateLogAnalysis(state.logAnalysis, true);
    overlay.updateResolutionSearches(state.logSearches);
    overlay.log("Log analysis completed using local categorization.");
  }

  async function copyLogAnalysis() {
    if (!state.logAnalysis) {
      overlay.log("Run log analysis first.");
      return;
    }

    const text = JSON.stringify(state.logAnalysis, null, 2);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    overlay.log("Log analysis copied.");
  }

  function openResolutionSearch(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openAllResolutionSearches() {
    if (!state.logSearches.length) {
      overlay.log("Run log analysis first.");
      return;
    }

    state.logSearches.slice(0, 3).forEach((group) => {
      group.searches.slice(0, 2).forEach((search) => {
        window.open(search.url, "_blank", "noopener,noreferrer");
      });
    });
    overlay.log("Opened online resolution searches.");
  }

  async function persistOverlayState(nextState) {
    state.overlayState = nextState;
    await chrome.storage.local.set({
      windchillPowertoolsOverlayState: {
        open: Boolean(nextState?.open),
        left: Number.isFinite(nextState?.left) ? nextState.left : null,
        top: Number.isFinite(nextState?.top) ? nextState.top : null
      }
    });
  }

  async function loadOverlayState() {
    const stored = await chrome.storage.local.get("windchillPowertoolsOverlayState");
    return stored.windchillPowertoolsOverlayState || null;
  }

  async function persistTheme(nextTheme) {
    state.theme = nextTheme === "light" ? "light" : "dark";
    await chrome.storage.local.set({
      windchillPowertoolsTheme: state.theme
    });
  }

  async function loadTheme() {
    const stored = await chrome.storage.local.get("windchillPowertoolsTheme");
    return stored.windchillPowertoolsTheme === "light" ? "light" : "dark";
  }
})();
