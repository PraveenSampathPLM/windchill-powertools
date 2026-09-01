(async () => {
  if (window.__windchillPowerToolsLoaded) {
    return;
  }

  window.__windchillPowerToolsLoaded = true;

  const loadModule = async (file) => import(chrome.runtime.getURL(file));
  const [{ createOverlay }, { scanJcaDebug, correlateHoverTarget, formatParsedDetails, resolveCustomizationPoints }, { extractVisibleLogText, extractErrorStackTrace }] = await Promise.all([
    loadModule("uiOverlay.js"),
    loadModule("customizationScanner.js"),
    loadModule("logAnalyzer.js")
  ]);

  const state = {
    debugBlocks: [],
    lastParsedDetails: null,
    lastResolvedDetails: null,
    bookmarks: [],
    highlightedElement: null,
    resolverMode: false,
    lastStackTrace: "",
    lastApiResponse: null,
    tamSearchResults: [],
    tamSearchRunId: 0,
    tamNodeCache: new Map(),
    overlayState: null,
    theme: "dark"
  };
  const TAM_BRIDGE_SOURCE = "windchill-powertools-tam-bridge";
  const TAM_BRIDGE_TARGET = "windchill-powertools-content";

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

  const PTC_SUPPORT_URL = "https://www.ptc.com/en/support";
  const BOOKMARKS_KEY = "windchillPowertoolsBookmarks";
  const API_PRESETS = [
    {
      id: "parts-list",
      label: "Parts: List top 10",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ProdMgmt/Parts?$top=10",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "part-current",
      label: "Part: Current object",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ProdMgmt/Parts('${oid}')",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "part-current-uses",
      label: "Part: Current object with Uses",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ProdMgmt/Parts('${oid}')?$expand=Uses",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "part-describe-links",
      label: "Part: Describe links",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ProdMgmt/Parts('${oid}')/DescribedBy?$expand=Describes",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "part-related-changes",
      label: "Part: Related change links",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/Changeables('${oid}')/ChangeRecords",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "documents-list",
      label: "Documents: List top 10",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/DocMgmt/Documents?$top=10",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "document-current",
      label: "Document: Current object",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/DocMgmt/Documents('${oid}')",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "document-structure",
      label: "Document: Current object structure",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/DocMgmt/Documents('${oid}')/DocUsageLinks?$expand=DocUsedBy,DocUses",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "document-attachments",
      label: "Document: Attachments / contents",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/DocMgmt/Documents('${oid}')/Attachments",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "cad-list",
      label: "CAD Documents: List top 10",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/CADDocumentMgmt/CADDocuments?$top=10",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "cad-current",
      label: "CAD Document: Current object",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/CADDocumentMgmt/CADDocuments('${oid}')",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "cad-current-uses",
      label: "CAD Document: Current object with Uses",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/CADDocumentMgmt/CADDocuments('${oid}')?$expand=Uses",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "cad-related-parts",
      label: "CAD Document: Related parts",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/CADDocumentMgmt/CADDocuments('${oid}')/PartDocAssociations?$expand=AssociatedPart",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "change-notices-list",
      label: "Change Notices: List top 10",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ChangeNotices?$top=10",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "change-notice-current",
      label: "Change Notice: Current object",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ChangeNotices('${oid}')",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "change-notice-affected",
      label: "Change Notice: Current object affected objects",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ChangeNotices('${oid}')/CNAffectLinks?$expand=AffectedObjects",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "change-notice-resulting",
      label: "Change Notice: Resulting objects",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ChangeNotices('${oid}')/CNResultingLinks?$expand=ResultingObjects",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "change-requests-list",
      label: "Change Requests: List top 10",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ChangeRequests?$top=10",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "change-request-current",
      label: "Change Request: Current object",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ChangeRequests('${oid}')",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "change-request-affected",
      label: "Change Request: Affected objects",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ChangeRequests('${oid}')/CRAffectLinks?$expand=AffectedObjects",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "problem-reports-list",
      label: "Problem Reports: List top 10",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ProblemReports?$top=10",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "problem-report-current",
      label: "Problem Report: Current object",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/ChangeMgmt/ProblemReports('${oid}')",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "containers-products",
      label: "Containers: Products",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/NavCriteria/Products?$top=25",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "containers-libraries",
      label: "Containers: Libraries",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/NavCriteria/Libraries?$top=25",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "workflow-workitems",
      label: "Workflow: My work items",
      method: "GET",
      endpoint: "/Windchill/servlet/odata/Workflow/WorkItems",
      headers: '{"Accept":"application/json"}',
      body: ""
    },
    {
      id: "write-patch-name-sample",
      label: "Write Sample: PATCH current object name",
      method: "PATCH",
      endpoint: "/Windchill/servlet/odata/ProdMgmt/Parts('${oid}')",
      headers: '{"Accept":"application/json","Content-Type":"application/json","If-Match":"*"}',
      body: '{\n  "Name": "Updated from Windchill PowerTools"\n}'
    },
    {
      id: "write-put-sample",
      label: "Write Sample: PUT current object payload",
      method: "PUT",
      endpoint: "/Windchill/servlet/odata/ProdMgmt/Parts('${oid}')",
      headers: '{"Accept":"application/json","Content-Type":"application/json","If-Match":"*"}',
      body: '{\n  "Name": "Updated from Windchill PowerTools"\n}'
    }
  ];

  const overlay = createOverlay({
    onAction: handleAction,
    onCopyResolvedDetails: copyResolvedDetails,
    onTakeScreenshot: takeScreenshot,
    onCopyOid: copyOid,
    onAddBookmark: addBookmark,
    onOpenBookmark: openBookmark,
    onDeleteBookmark: deleteBookmark,
    onRunApiRequest: runApiRequest,
    onCopyApiResponse: copyApiResponse,
    onApplyApiPreset: applyApiPreset,
    onRunTamSearch: runTamSearch,
    onClearTamSearch: clearTamSearch,
    onCancelTamSearch: cancelTamSearch,
    onExportTamReport: exportTamReport,
    onExportDataModel: exportDataModel,
    onJumpTamResult: jumpToTamResult,
    onOpenShortcut: openShortcut,
    onCopyStackTrace: copyVisibleStackTrace,
    onOpenPtcSupport: () => openShortcut(PTC_SUPPORT_URL),
    onOverlayStateChange: persistOverlayState,
    onThemeChange: persistTheme
  });

  initialize();

  async function initialize() {
    ensureTamBridge();
    window.addEventListener("message", handleTamBridgeMessage);
    state.theme = await loadTheme();
    overlay.setTheme(state.theme);
    state.overlayState = await loadOverlayState();
    overlay.restoreState(state.overlayState);
    state.bookmarks = await loadBookmarks();
    refreshDebugBlocks();
    overlay.updateShortcuts(buildShortcutPayload());
    overlay.updateBookmarks(state.bookmarks);
    overlay.updateLogTools(null, isLogViewerPage());
    overlay.updateResolverDetails(state.lastResolvedDetails);
    overlay.updateApiPresets(API_PRESETS, API_PRESETS[0]?.id || "");
    overlay.applyApiPreset(resolveApiPreset(API_PRESETS[0]));
    overlay.updateApiResponse(state.lastApiResponse);
    overlay.updateTamSearch(buildTamSearchPayload());

    // refreshDebugBlocks() walks every comment node plus a broad element
    // selector across the whole document, which is expensive to run on every
    // single mutation batch. Windchill's ExtJS widgets (grids, trees) mutate
    // the DOM constantly during normal use — and heavily during a TAM search,
    // since that clicks through many nodes — so this is debounced to run once
    // after mutations settle rather than synchronously on each one.
    let refreshTimer = null;
    const observer = new MutationObserver(() => {
      if (refreshTimer) {
        return;
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refreshDebugBlocks();
        overlay.updateLogTools(state.lastStackTrace, isLogViewerPage());
      }, 300);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    document.addEventListener("mouseover", handleHover, true);
    document.addEventListener("click", handleResolverClick, true);
  }

  function handleAction(action) {
    switch (action) {
      case "toggle-jca-debug":
        toggleUrlFlag("jcaDebug");
        break;
      case "toggle-js-debug":
        toggleUrlFlag("jsDebug");
        break;
      case "toggle-resolver-mode":
        toggleResolverMode();
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
      "Resolver Mode": state.resolverMode ? "On" : "Off",
      "Parsed Debug Blocks": result.count,
      "Stack Trace Copy Available": isLogViewerPage() ? "Yes" : "No",
      "TAM Search Available": isTypeAndAttributeManagerPage() ? "Yes" : "No"
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
    if (!state.resolverMode && !state.lastResolvedDetails) {
      overlay.updateResolverDetails(state.lastParsedDetails);
    }
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

  function detectObjectNumber() {
    const params = new URLSearchParams(window.location.search);
    const known = params.get("number") || params.get("partNumber") || params.get("docNumber") || params.get("objectNumber");
    if (known) {
      return known;
    }

    const candidates = [
      document.querySelector("[data-object-number]")?.getAttribute("data-object-number"),
      document.querySelector("[name='number']")?.getAttribute("value"),
      document.querySelector("[id*='number' i]")?.textContent,
      document.title
    ].filter(Boolean);

    for (const candidate of candidates) {
      const match = String(candidate).match(/\b[A-Z0-9][A-Z0-9._-]{2,}\b/);
      if (match) {
        return match[0];
      }
    }

    return "windchill-page";
  }

  function detectOid() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const direct = params.get("oid") || params.get("pboOid") || params.get("soid") || params.get("coid");
    if (direct) {
      return direct;
    }

    const hash = url.hash || "";
    const hashMatch = hash.match(/(?:^|[?&])(oid|pboOid|soid|coid)=([^&]+)/i);
    if (hashMatch?.[2]) {
      try {
        return decodeURIComponent(hashMatch[2]);
      } catch {
        return hashMatch[2];
      }
    }

    return "";
  }

  function detectObjectType() {
    const oid = detectOid();
    const text = `${document.title} ${window.location.pathname} ${window.location.href} ${oid}`.toLowerCase();

    if (/(epmdocument|cad document|caddocument|workspace object|epm)/.test(text)) {
      return "CAD Document (EPM)";
    }
    if (/(wtpart|part master|part structure|part details|\bpart\b)/.test(text)) {
      return "Part";
    }
    if (/(wtdocument|reference document|specification document|\bdocument\b)/.test(text)) {
      return "Document";
    }
    if (/(wtchangeorder2|change notice|changenotice|change order)/.test(text)) {
      return "Change Notice";
    }
    if (/(wtchangerequest2|change request|changerequest)/.test(text)) {
      return "Change Request";
    }
    if (/(wtchangeactivity2|change task|change activity|changeactivity)/.test(text)) {
      return "Change Task";
    }
    if (/(wtproblemreport|problem report|problemreport)/.test(text)) {
      return "Problem Report";
    }
    if (/(promotion notice|promotion request|promotionnotice)/.test(text)) {
      return "Promotion Request";
    }
    if (/(variance|deviation)/.test(text)) {
      return "Variance";
    }
    if (/(baselin[e]?)/.test(text)) {
      return "Baseline";
    }
    if (/(package|deliverable)/.test(text)) {
      return "Package";
    }
    if (/(folder)/.test(text)) {
      return "Folder";
    }
    if (/(library)/.test(text)) {
      return "Library Object";
    }
    if (/(product)/.test(text)) {
      return "Product Object";
    }
    if (oid) {
      return "Object";
    }
    return "Page";
  }

  function buildBookmarkRecord() {
    const objectNumber = detectObjectNumber();
    const oid = detectOid();
    const objectType = detectObjectType();
    const label = `${objectType}: ${objectNumber || oid || document.title || "Windchill Page"}`;

    return {
      id: oid || window.location.href,
      oid,
      objectNumber,
      objectType,
      label,
      title: document.title || label,
      url: window.location.href,
      savedAt: new Date().toISOString()
    };
  }

  function formatScreenshotTimestamp(date = new Date()) {
    const parts = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      "-",
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0")
    ];
    return parts.join("");
  }

  function getOverlayHost() {
    return document.getElementById("windchill-powertools-root");
  }

  async function withOverlayHidden(task) {
    const host = getOverlayHost();
    const previousVisibility = host?.style.visibility || "";

    if (host) {
      host.style.visibility = "hidden";
    }

    await new Promise((resolve) => window.setTimeout(resolve, 80));

    try {
      return await task();
    } finally {
      if (host) {
        host.style.visibility = previousVisibility;
      }
    }
  }

  function handleResolverClick(event) {
    if (!state.resolverMode) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get("jcaDebug") !== "true") {
      overlay.log("Enable jcaDebug first so resolver mode can map the component.");
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || target.closest("#windchill-powertools-root")) {
      return;
    }

    const correlation = correlateHoverTarget(target, state.debugBlocks);
    if (!correlation.matchedBlock) {
      overlay.log("No customization point match found for that component.");
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    state.lastResolvedDetails = resolveCustomizationPoints(correlation.container, correlation.matchedBlock, correlation.score);
    overlay.updateResolverDetails(state.lastResolvedDetails);
    state.resolverMode = false;
    refreshDebugBlocks();
    overlay.log("Customization points resolved for the selected component.");
  }

  function toggleResolverMode() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("jcaDebug") !== "true") {
      overlay.log("Enable jcaDebug first, then use Resolver Mode.");
      return;
    }

    state.resolverMode = !state.resolverMode;
    refreshDebugBlocks();
    if (state.resolverMode) {
      overlay.log("Resolver Mode enabled. Hover to preview, then click a component to freeze its customization points.");
    } else {
      overlay.log("Resolver Mode disabled.");
    }
  }

  async function copyResolvedDetails() {
    const payload = state.lastResolvedDetails || state.lastParsedDetails;
    if (!payload) {
      overlay.log("Enable Resolver Mode and click a component first.");
      return;
    }

    const text = JSON.stringify(payload, null, 2);
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

    overlay.log("Resolved details copied.");
  }

  async function takeScreenshot() {
    const objectNumber = detectObjectNumber();
    const timestamp = formatScreenshotTimestamp();

    let response = await withOverlayHidden(() =>
      chrome.runtime.sendMessage({
        type: "windchill-powertools-capture-screenshot",
        objectNumber,
        timestamp
      })
    );

    if (!response?.ok && /permission/i.test(response?.error || "")) {
      await chrome.runtime.sendMessage({
        type: "windchill-powertools-open-screenshot-permission"
      });
      overlay.log("Opened screenshot permission page. Grant access there, then click Screenshot again.");
      return;
    }

    if (!response?.ok) {
      overlay.log(`Screenshot failed: ${response?.error || "unknown error"}`);
      return;
    }

    overlay.log(`Screenshot saved as ${response.result.filename}.`);
  }

  async function copyOid() {
    const oid = detectOid();
    if (!oid) {
      overlay.log("No OID found on the current page.");
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(oid);
    } else {
      const input = document.createElement("textarea");
      input.value = oid;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    overlay.log(`OID copied: ${oid}`);
  }

  async function loadBookmarks() {
    const result = await chrome.storage.local.get(BOOKMARKS_KEY);
    return Array.isArray(result[BOOKMARKS_KEY]) ? result[BOOKMARKS_KEY] : [];
  }

  async function persistBookmarks() {
    await chrome.storage.local.set({
      [BOOKMARKS_KEY]: state.bookmarks
    });
    overlay.updateBookmarks(state.bookmarks);
  }

  async function addBookmark() {
    const bookmark = buildBookmarkRecord();
    state.bookmarks = [
      bookmark,
      ...state.bookmarks.filter((item) => item.id !== bookmark.id)
    ].slice(0, 50);
    await persistBookmarks();
    overlay.log(`Bookmarked ${bookmark.label}.`);
  }

  function openBookmark(bookmarkId) {
    const bookmark = state.bookmarks.find((item) => item.id === bookmarkId);
    if (!bookmark?.url) {
      overlay.log("Bookmark not found.");
      return;
    }
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  }

  async function deleteBookmark(bookmarkId) {
    const before = state.bookmarks.length;
    state.bookmarks = state.bookmarks.filter((item) => item.id !== bookmarkId);
    if (state.bookmarks.length === before) {
      overlay.log("Bookmark not found.");
      return;
    }
    await persistBookmarks();
    overlay.log("Bookmark removed.");
  }

  async function runApiRequest(input) {
    const method = String(input?.method || "GET").toUpperCase();
    const endpoint = String(input?.endpoint || "").trim();
    if (!endpoint) {
      overlay.log("Enter an endpoint path first.");
      return;
    }

    let url;
    try {
      url = new URL(endpoint, window.location.origin);
    } catch {
      overlay.log("Endpoint URL could not be parsed.");
      return;
    }

    if (url.origin !== window.location.origin) {
      overlay.log("API Tester only supports same-origin Windchill endpoints.");
      return;
    }

    let headers = {};
    if (String(input?.headers || "").trim()) {
      try {
        headers = JSON.parse(input.headers);
      } catch {
        overlay.log("Headers must be valid JSON.");
        return;
      }
    }

    let body;
    if (method !== "GET" && method !== "HEAD") {
      const rawBody = String(input?.body || "").trim();
      if (rawBody) {
        body = rawBody;
        if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const writeMethod = !["GET", "HEAD", "OPTIONS"].includes(method);
    let csrfNonce = "";
    let csrfHeaderName = "";
    if (writeMethod) {
      const csrf = findCsrfNonce();
      csrfNonce = csrf.value;
      csrfHeaderName = csrf.headerName;
      if (csrfNonce && !hasCsrfHeader(headers)) {
        headers[csrfHeaderName] = csrfNonce;
      }
      if (csrfNonce) {
        overlay.log(`Using CSRF nonce via header ${csrfHeaderName}.`);
      } else {
        overlay.log("No CSRF nonce detected on the page. Write requests may fail if Windchill requires one.");
      }
    }

    overlay.log(`Running ${method} ${url.pathname}${url.search}`);
    const start = performance.now();

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        credentials: "include"
      });

      const responseText = await response.text();
      state.lastApiResponse = {
        method,
        url: url.toString(),
        status: response.status,
        statusText: response.statusText,
        durationMs: Math.round(performance.now() - start),
        csrfNonceUsed: Boolean(csrfNonce),
        csrfHeaderName: csrfNonce ? csrfHeaderName : "",
        body: prettifyApiResponse(responseText, response.headers.get("content-type"))
      };

      overlay.updateApiResponse(state.lastApiResponse);
      overlay.log(`API response received: ${response.status} ${response.statusText}`);
    } catch (error) {
      state.lastApiResponse = {
        method,
        url: url.toString(),
        status: "Request Failed",
        statusText: "",
        durationMs: Math.round(performance.now() - start),
        csrfNonceUsed: Boolean(csrfNonce),
        csrfHeaderName: csrfNonce ? csrfHeaderName : "",
        body: String(error?.message || error)
      };
      overlay.updateApiResponse(state.lastApiResponse);
      overlay.log(`API request failed: ${String(error?.message || error)}`);
    }
  }

  async function copyApiResponse() {
    if (!state.lastApiResponse) {
      overlay.log("Run an API request first.");
      return;
    }

    const payload = formatApiResponseForClipboard(state.lastApiResponse);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
    } else {
      const input = document.createElement("textarea");
      input.value = payload;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    overlay.log("API response copied.");
  }

  function formatApiResponseForClipboard(response) {
    const structured = {
      method: response.method,
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      durationMs: response.durationMs,
      csrfNonceUsed: Boolean(response.csrfNonceUsed)
    };

    if (response.csrfHeaderName) {
      structured.csrfHeaderName = response.csrfHeaderName;
    }

    const parsedBody = tryParseJson(response.body);
    if (parsedBody !== null) {
      structured.body = parsedBody;
      return JSON.stringify(structured, null, 2);
    }

    return `${JSON.stringify(structured, null, 2)}\n\nbody:\n${response.body || ""}`;
  }

  function tryParseJson(value) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  function prettifyApiResponse(text, contentType) {
    const normalized = String(text || "");
    if ((contentType || "").includes("json")) {
      try {
        return JSON.stringify(JSON.parse(normalized), null, 2);
      } catch {
        return normalized;
      }
    }

    try {
      return JSON.stringify(JSON.parse(normalized), null, 2);
    } catch {
      return normalized;
    }
  }

  function applyApiPreset(presetId) {
    const preset = resolveApiPreset(API_PRESETS.find((item) => item.id === presetId) || API_PRESETS[0]);
    overlay.applyApiPreset(preset);
    overlay.log(`Loaded API preset: ${preset.label}`);
  }

  function resolveApiPreset(preset) {
    const oid = detectOid();
    const objectNumber = detectObjectNumber();
    const csrf = findCsrfNonce();

    return {
      ...preset,
      endpoint: String(preset.endpoint || "")
        .replaceAll("${oid}", oid || "OR:wt.fc.Persistable:000000")
        .replaceAll("${objectNumber}", objectNumber || "OBJECT-NUMBER"),
      headers: String(preset.headers || "")
        .replaceAll("${csrfNonce}", csrf.value || "AUTO-DETECTED-AT-RUNTIME"),
      body: String(preset.body || "")
        .replaceAll("${oid}", oid || "OR:wt.fc.Persistable:000000")
        .replaceAll("${objectNumber}", objectNumber || "OBJECT-NUMBER")
    };
  }

  function hasCsrfHeader(headers) {
    return Object.keys(headers || {}).some((key) => /csrf|nonce/i.test(key));
  }

  function findCsrfNonce() {
    const metaNonce = document.querySelector(
      'meta[name="csrfNonce"], meta[name="CSRF_NONCE"], meta[name="csrf-nonce"], meta[name="nonce"], meta[name="x-csrf-nonce"]'
    )?.getAttribute("content");
    if (metaNonce) {
      return {
        value: metaNonce.trim(),
        headerName: "CSRF_NONCE",
        source: "meta"
      };
    }

    const inputNonce = document.querySelector(
      'input[type="hidden"][name="CSRF_NONCE"], input[type="hidden"][name="csrfNonce"], input[type="hidden"][name="csrf-nonce"], input[type="hidden"][name="nonce"]'
    )?.value;
    if (inputNonce) {
      return {
        value: inputNonce.trim(),
        headerName: "CSRF_NONCE",
        source: "hidden-input"
      };
    }

    const scriptNonce = extractCsrfNonceFromScripts();
    if (scriptNonce) {
      return {
        value: scriptNonce,
        headerName: "CSRF_NONCE",
        source: "script"
      };
    }

    const globalNonce = extractCsrfNonceFromGlobals();
    if (globalNonce) {
      return {
        value: globalNonce,
        headerName: "CSRF_NONCE",
        source: "global"
      };
    }

    return {
      value: "",
      headerName: "CSRF_NONCE",
      source: ""
    };
  }

  function extractCsrfNonceFromScripts() {
    const scripts = Array.from(document.scripts || []);
    for (const script of scripts) {
      const text = script.textContent || "";
      if (!text || !/csrf|nonce/i.test(text)) {
        continue;
      }
      const patterns = [
        /\bCSRF_NONCE\b["']?\s*[:=]\s*["']([^"']+)["']/i,
        /\bcsrfNonce\b["']?\s*[:=]\s*["']([^"']+)["']/i,
        /\bcsrf-nonce\b["']?\s*[:=]\s*["']([^"']+)["']/i,
        /\bnonce\b["']?\s*[:=]\s*["']([^"']{8,})["']/i
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
    }
    return "";
  }

  function extractCsrfNonceFromGlobals() {
    const sources = [window, window?.PTC, window?.wt];
    const keys = ["CSRF_NONCE", "csrfNonce", "csrf_nonce", "nonce"];

    for (const source of sources) {
      if (!source || typeof source !== "object") {
        continue;
      }
      for (const key of keys) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }

    return "";
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

  function isTypeAndAttributeManagerPage() {
    const text = `${document.title} ${window.location.pathname} ${window.location.href}`.toLowerCase();
    return /(type and attribute|type manager|attribute manager|typeadmin|manage types|manage attributes)/.test(text);
  }

  async function runTamSearch(input) {
    const query = String(typeof input === "string" ? input : input?.query || "").trim();
    const mode = String(typeof input === "object" ? input?.mode || "loaded" : "loaded");
    resetTamSearchState(false);
    if (!query) {
      overlay.updateTamSearch(buildTamSearchPayload({
        available: true,
        query: "",
        mode,
        results: [],
        count: 0,
        emptyMessage: "Enter a type or attribute name first."
      }));
      overlay.log("Enter a type or attribute name first.");
      return;
    }

    const runId = ++state.tamSearchRunId;
    overlay.updateTamSearch(buildTamSearchPayload({
      available: true,
      query,
      mode,
      results: [],
      count: 0,
      scope: mode === "deep" ? "Loaded + lazy branches" : "Loaded tree nodes",
      progress: mode === "deep" ? "Starting deep crawl..." : "Searching loaded nodes..."
    }));

    postTamBridgeCommand("search", { query, mode, runId });
  }

  function clearTamSearch() {
    resetTamSearchState(true);
    overlay.log("Type and Attribute Manager search cleared.");
  }

  function cancelTamSearch() {
    state.tamSearchRunId += 1;
    postTamBridgeCommand("cancel", { runId: state.tamSearchRunId });
    overlay.updateTamSearch(buildTamSearchPayload({
      available: isTypeAndAttributeManagerPage(),
      query: "",
      mode: "loaded",
      results: [],
      count: 0,
      scope: "Cancelled",
      progress: "Cancelled",
      emptyMessage: "Type and Attribute Manager search cancelled."
    }));
    overlay.log("Type and Attribute Manager search cancelled.");
  }

  function exportTamReport() {
    overlay.log("Preparing Type and Attribute Manager export...");
    postTamBridgeCommand("export-report", {});
  }

  function exportDataModel(mode) {
    const normalizedMode = mode === "loaded" ? "loaded" : "deep";
    const runId = ++state.tamSearchRunId;
    overlay.log(normalizedMode === "loaded"
      ? "Starting data model export for currently loaded types..."
      : "Starting full data model export. Large trees can take several minutes; use Cancel to stop.");
    postTamBridgeCommand("export-data-model", { mode: normalizedMode, runId });
  }

  function resetTamSearchState(updateOverlay) {
    state.tamSearchResults = [];

    if (updateOverlay) {
      overlay.updateTamSearch(buildTamSearchPayload({
        available: isTypeAndAttributeManagerPage(),
        query: "",
        mode: "loaded",
        results: [],
        count: 0,
        emptyMessage: isTypeAndAttributeManagerPage()
          ? "Enter a type or attribute name to search the current TAM page."
          : "Open the Type and Attribute Manager page to use this search."
      }));
    }
  }

  function buildTamSearchPayload(overrides = {}) {
    const available = overrides.available ?? true;
    const results = overrides.results ?? [];
    const count = overrides.count ?? results.length;
    return {
      available,
      query: overrides.query ?? "",
      mode: overrides.mode ?? "loaded",
      scope: overrides.scope ?? "Loaded tree nodes",
      progress: overrides.progress ?? "Idle",
      count,
      results,
      emptyMessage: overrides.emptyMessage ?? (available
        ? "Enter a type or attribute name to search the current TAM page."
        : "Open the Type and Attribute Manager page to use this search.")
    };
  }

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  async function jumpToTamResult(resultId) {
    const result = state.tamSearchResults.find((item) => item.id === resultId);
    if (!result) {
      overlay.log("That Type and Attribute Manager search result is no longer available.");
      return;
    }
    postTamBridgeCommand("jump", {
      resultId,
      nodeId: result.nodeId
    });
  }

  function ensureTamBridge() {
    if (document.getElementById("windchill-powertools-tam-bridge-script")) {
      return;
    }
    const script = document.createElement("script");
    script.id = "windchill-powertools-tam-bridge-script";
    script.src = chrome.runtime.getURL("tamBridge.js");
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
  }

  function postTamBridgeCommand(command, payload) {
    window.postMessage({
      source: TAM_BRIDGE_TARGET,
      command,
      payload
    }, window.location.origin);
  }

  function handleTamBridgeMessage(event) {
    if (event.source !== window) {
      return;
    }
    const message = event.data;
    if (!message || message.source !== TAM_BRIDGE_SOURCE) {
      return;
    }

    const { type, payload } = message;
    if (type === "tam-search-progress") {
      state.tamSearchResults = Array.isArray(payload?.results) ? payload.results : [];
      overlay.updateTamSearch(buildTamSearchPayload(payload));
      return;
    }

    if (type === "tam-search-results") {
      if (payload?.runId !== state.tamSearchRunId) {
        return;
      }
      state.tamSearchResults = Array.isArray(payload.results) ? payload.results : [];
      overlay.updateTamSearch(buildTamSearchPayload(payload));
      return;
    }

    if (type === "tam-search-error") {
      overlay.updateTamSearch(buildTamSearchPayload({
        available: false,
        query: payload?.query || "",
        mode: payload?.mode || "loaded",
        results: [],
        count: 0,
        scope: payload?.scope || "Unavailable",
        progress: "Error",
        emptyMessage: payload?.message || "Type and Attribute Manager search failed."
      }));
      overlay.log(payload?.message || "Type and Attribute Manager search failed.");
      return;
    }

    if (type === "tam-jump-result") {
      overlay.log(payload?.ok ? "Jumped to the selected Type and Attribute Manager match." : (payload?.message || "Could not jump to the selected Type and Attribute Manager match."));
      return;
    }

    if (type === "tam-datamodel-progress") {
      if (payload?.runId !== state.tamSearchRunId) {
        return;
      }
      const processed = Number(payload.processed) || 0;
      // Log discovery milestones and every 10th type read, so long crawls stay
      // visible without flooding the activity log with one line per type.
      if (payload.phase === "discover" || processed % 10 === 0 || processed === Number(payload.total)) {
        overlay.log(payload.message || `Data model export progress: ${processed}`);
      }
      return;
    }

    if (type === "tam-export-report") {
      downloadTamReport(payload);
      return;
    }

    if (type === "tam-export-error") {
      overlay.log(payload?.message || "Could not export the Type and Attribute Manager report.");
    }
  }

  function downloadTamReport(payload) {
    if (!payload?.html || !payload?.fileName) {
      overlay.log("The Type and Attribute Manager export payload was incomplete.");
      return;
    }

    const blob = new Blob([payload.html], {
      type: "application/vnd.ms-excel;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    overlay.log(payload.summary ? `${payload.summary} Saved as ${payload.fileName}.` : `Exported ${payload.fileName}.`);
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

  async function copyVisibleStackTrace() {
    if (!isLogViewerPage()) {
      overlay.log("Stack trace copy is available on the Log File Viewer page.");
      return;
    }

    const visibleLogText = extractVisibleLogText(document);
    if (!visibleLogText) {
      overlay.log("No visible log text found.");
      overlay.updateLogTools(null, true, "No visible log text found. If the log is in a frame, click inside the log area and try again.");
      return;
    }

    const stackTrace = extractErrorStackTrace(visibleLogText);
    if (!stackTrace) {
      overlay.updateLogTools(null, true, `Read ${visibleLogText.length} characters, but no obvious error stack trace was found. Select the error text manually and click again.`);
      overlay.log("No obvious error stack trace found in the visible log.");
      return;
    }

    state.lastStackTrace = stackTrace;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(stackTrace);
    } else {
      const input = document.createElement("textarea");
      input.value = stackTrace;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    overlay.updateLogTools(stackTrace, true);
    overlay.log("Error stack trace copied.");
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
