const OVERLAY_ROOT_ID = "windchill-powertools-root";

export function createOverlay(callbacks) {
  const host = document.createElement("div");
  host.id = OVERLAY_ROOT_ID;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wpt-root {
        --wpt-bg: linear-gradient(180deg, #112033 0%, #09111b 100%);
        --wpt-header-bg: linear-gradient(135deg, #15467a 0%, #0d6a5d 100%);
        --wpt-text: #eef6ff;
        --wpt-border: rgba(140, 180, 210, 0.35);
        --wpt-card-bg: rgba(255, 255, 255, 0.05);
        --wpt-card-border: rgba(155, 195, 225, 0.16);
        --wpt-button-bg: rgba(255, 255, 255, 0.07);
        --wpt-button-border: rgba(155, 195, 225, 0.25);
        --wpt-label: #8bc5ff;
        --wpt-muted-bg: rgba(255, 255, 255, 0.04);
        --wpt-log-bg: rgba(0, 0, 0, 0.24);
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wpt-root[data-theme="light"] {
        --wpt-bg: linear-gradient(180deg, #f7fbff 0%, #e9f2f8 100%);
        --wpt-header-bg: linear-gradient(135deg, #d9ecff 0%, #cdeee6 100%);
        --wpt-text: #0f2033;
        --wpt-border: rgba(74, 112, 148, 0.28);
        --wpt-card-bg: rgba(255, 255, 255, 0.8);
        --wpt-card-border: rgba(74, 112, 148, 0.15);
        --wpt-button-bg: rgba(255, 255, 255, 0.9);
        --wpt-button-border: rgba(74, 112, 148, 0.22);
        --wpt-label: #1d5f98;
        --wpt-muted-bg: rgba(18, 35, 52, 0.04);
        --wpt-log-bg: rgba(18, 35, 52, 0.06);
      }
      .wpt-launcher {
        width: 58px;
        height: 58px;
        border-radius: 999px;
        border: 1px solid var(--wpt-border);
        background: var(--wpt-header-bg);
        color: var(--wpt-text);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
        display: grid;
        place-items: center;
        cursor: grab;
        user-select: none;
        font-size: 28px;
      }
      .wpt-launcher:active { cursor: grabbing; }
      .wpt-panel {
        width: min(420px, calc(100vw - 24px));
        max-height: min(82vh, calc(100vh - 24px));
        margin-top: 10px;
        display: none;
        flex-direction: column;
        background: var(--wpt-bg);
        color: var(--wpt-text);
        border: 1px solid var(--wpt-border);
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
        overflow: hidden;
      }
      .wpt-panel.is-open { display: flex; }
      .wpt-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        background: var(--wpt-header-bg);
        cursor: grab;
        user-select: none;
      }
      .wpt-header:active { cursor: grabbing; }
      .wpt-title { font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .wpt-subtitle { font-size: 11px; opacity: 0.85; margin-top: 2px; }
      .wpt-close {
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .wpt-header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .wpt-theme-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        font-size: 11px;
      }
      .wpt-theme-switch {
        position: relative;
        width: 46px;
        height: 26px;
        display: inline-block;
      }
      .wpt-theme-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .wpt-theme-slider {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.22);
        transition: background 140ms ease;
      }
      .wpt-theme-slider::before {
        content: "";
        position: absolute;
        width: 18px;
        height: 18px;
        left: 4px;
        top: 4px;
        border-radius: 999px;
        background: #ffffff;
        transition: transform 140ms ease;
      }
      .wpt-theme-switch input:checked + .wpt-theme-slider {
        background: rgba(10, 111, 91, 0.7);
      }
      .wpt-theme-switch input:checked + .wpt-theme-slider::before {
        transform: translateX(20px);
      }
      .wpt-body {
        overflow: auto;
        padding: 14px 16px 16px;
        display: grid;
        gap: 10px;
      }
      .wpt-toolbar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .wpt-button {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--wpt-button-border);
        background: var(--wpt-button-bg);
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .wpt-button:hover { background: rgba(255, 255, 255, 0.12); }
      .wpt-card {
        padding: 12px;
        background: var(--wpt-card-bg);
        border: 1px solid var(--wpt-card-border);
        border-radius: 14px;
      }
      .wpt-card-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .wpt-meta {
        display: grid;
        gap: 6px;
        font-size: 12px;
        line-height: 1.45;
      }
      .wpt-meta-row {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 8px;
        align-items: start;
      }
      .wpt-label { color: var(--wpt-label); font-weight: 600; }
      .wpt-section-toggle {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .wpt-section-arrow {
        font-size: 13px;
        transition: transform 140ms ease;
      }
      .wpt-accordion.is-open .wpt-section-arrow {
        transform: rotate(90deg);
      }
      .wpt-shortcuts,
      .wpt-findings {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }
      .wpt-accordion-panel {
        display: none;
      }
      .wpt-accordion.is-open .wpt-accordion-panel {
        display: block;
      }
      .wpt-shortcut,
      .wpt-finding,
      .wpt-resolution-group {
        padding: 8px 10px;
        background: var(--wpt-muted-bg);
        border: 1px solid var(--wpt-card-border);
        border-radius: 10px;
      }
      .wpt-shortcut-title,
      .wpt-finding-title,
      .wpt-resolution-title {
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .wpt-shortcut-desc {
        font-size: 11px;
        opacity: 0.8;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      .wpt-finding-meta {
        font-size: 11px;
        color: var(--wpt-label);
        margin-bottom: 4px;
      }
      .wpt-resolution-links,
      .wpt-inline-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .wpt-log {
        background: var(--wpt-log-bg);
        padding: 10px;
        border-radius: 12px;
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-size: 11px;
        max-height: 120px;
        overflow: auto;
        white-space: pre-wrap;
      }
      .wpt-empty { opacity: 0.7; font-size: 12px; }
      .wpt-help-links {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      @media (max-width: 640px) {
        .wpt-root {
          right: 12px;
          bottom: 12px;
        }
        .wpt-panel {
          width: min(92vw, 420px);
          max-height: 74vh;
        }
        .wpt-meta-row {
          grid-template-columns: 1fr;
          gap: 2px;
        }
      }
    </style>
    <div class="wpt-root">
      <button class="wpt-launcher" id="wpt-launcher" title="Open Windchill PowerTools">🛠</button>
      <section class="wpt-panel" id="wpt-panel">
        <header class="wpt-header" id="wpt-header">
          <div>
            <div class="wpt-title">Windchill PowerTools</div>
            <div class="wpt-subtitle">JCA debug, log analysis, and shortcuts</div>
          </div>
          <div class="wpt-header-actions">
            <label class="wpt-theme-toggle" title="Toggle theme">
              <span>Light</span>
              <span class="wpt-theme-switch">
                <input id="wpt-theme" type="checkbox" />
                <span class="wpt-theme-slider"></span>
              </span>
            </label>
            <button class="wpt-close" id="wpt-close" title="Close">×</button>
          </div>
        </header>
        <div class="wpt-body">
          <div class="wpt-toolbar">
            <button class="wpt-button" data-action="toggle-jca-debug">🐞 JCA Debug</button>
            <button class="wpt-button" data-action="toggle-js-debug">🐞 JS Debug</button>
          </div>
          <section class="wpt-card">
            <div class="wpt-card-title">Status</div>
            <div class="wpt-meta" id="status"></div>
          </section>
          <section class="wpt-card">
            <div class="wpt-card-title">Parsed JCA Details</div>
            <div class="wpt-inline-actions">
              <button class="wpt-button" id="copy-parsed-details">Copy Parsed Details</button>
            </div>
            <div class="wpt-meta" id="parsed-details"></div>
          </section>
          <section class="wpt-card">
            <div class="wpt-accordion" id="shortcuts-accordion">
              <button class="wpt-section-toggle" id="shortcuts-toggle" type="button">
                <span>System Health Shortcuts</span>
                <span class="wpt-section-arrow">›</span>
              </button>
              <div class="wpt-accordion-panel">
                <div class="wpt-shortcuts" id="system-health-shortcuts"></div>
              </div>
            </div>
          </section>
          <section class="wpt-card">
            <div class="wpt-card-title">Need Help?</div>
            <div class="wpt-shortcut-desc">Free tool by Praveen Sampath. If you need help with Windchill debugging or log analysis, reach out directly by email.</div>
            <div class="wpt-help-links">
              <button class="wpt-button" id="contact-email">Email Praveen Sampath</button>
            </div>
          </section>
          <section class="wpt-card">
            <div class="wpt-card-title">Log Analysis</div>
            <div class="wpt-inline-actions">
              <button class="wpt-button" id="analyze-log">Analyze Visible Log</button>
              <button class="wpt-button" id="copy-log-analysis">Copy Analysis</button>
              <button class="wpt-button" id="open-all-resolution-searches">Search Resolutions</button>
            </div>
            <div class="wpt-meta" id="log-analysis"></div>
            <div class="wpt-findings" id="log-findings"></div>
            <div class="wpt-findings" id="resolution-searches"></div>
          </section>
          <section class="wpt-card">
            <div class="wpt-card-title">Activity Log</div>
            <div class="wpt-log" id="activity-log"></div>
          </section>
        </div>
      </section>
    </div>
  `;

  const root = shadow.querySelector(".wpt-root");
  const launcher = shadow.getElementById("wpt-launcher");
  const panel = shadow.getElementById("wpt-panel");
  const header = shadow.getElementById("wpt-header");
  const closeButton = shadow.getElementById("wpt-close");
  const themeToggle = shadow.getElementById("wpt-theme");
  const shortcutsAccordion = shadow.getElementById("shortcuts-accordion");
  const shortcutsToggle = shadow.getElementById("shortcuts-toggle");
  const status = shadow.getElementById("status");
  const parsedDetails = shadow.getElementById("parsed-details");
  const shortcuts = shadow.getElementById("system-health-shortcuts");
  const logAnalysis = shadow.getElementById("log-analysis");
  const logFindings = shadow.getElementById("log-findings");
  const resolutionSearches = shadow.getElementById("resolution-searches");
  const activityLog = shadow.getElementById("activity-log");

  let isOpen = false;
  let dragState = null;
  let suppressLauncherClick = false;

  shadow.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onAction(button.dataset.action));
  });

  launcher.addEventListener("click", () => {
    if (suppressLauncherClick) {
      suppressLauncherClick = false;
      return;
    }
    setOpen(!isOpen);
  });

  closeButton.addEventListener("click", () => {
    setOpen(false);
  });

  shadow.querySelector(".wpt-header-actions").addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  shadow.querySelector(".wpt-header-actions").addEventListener("click", (event) => {
    event.stopPropagation();
  });

  themeToggle.addEventListener("change", () => {
    setTheme(themeToggle.checked ? "light" : "dark", true);
  });

  shortcutsToggle.addEventListener("click", () => {
    shortcutsAccordion.classList.toggle("is-open");
  });

  shadow.getElementById("copy-parsed-details").addEventListener("click", () => {
    callbacks.onCopyParsedDetails();
  });

  shadow.getElementById("analyze-log").addEventListener("click", () => {
    callbacks.onAnalyzeLog();
  });

  shadow.getElementById("copy-log-analysis").addEventListener("click", () => {
    callbacks.onCopyLogAnalysis();
  });

  shadow.getElementById("open-all-resolution-searches").addEventListener("click", () => {
    callbacks.onOpenAllResolutionSearches();
  });
  shadow.getElementById("contact-email").addEventListener("click", () => {
    callbacks.onOpenShortcut("mailto:pravincee@gmail.com");
  });

  startDrag(launcher);
  startDrag(header);
  window.addEventListener("resize", clampPosition);

  log("Windchill PowerTools loaded.");

  return {
    setTheme(theme, persist = false) {
      setTheme(theme, persist);
    },
    restoreState(savedState) {
      if (savedState && Number.isFinite(savedState.left) && Number.isFinite(savedState.top)) {
        applyPosition(savedState.left, savedState.top);
      } else {
        clampPosition();
      }
      setOpen(Boolean(savedState?.open), false);
    },
    updateStatus(payload) {
      renderMeta(status, payload || {}, "No status yet.");
    },
    updateParsedDetails(payload) {
      renderMeta(parsedDetails, payload || {}, "Enable jcaDebug, then hover a debug-marked item to parse details.");
    },
    updateShortcuts(items) {
      shortcuts.innerHTML = "";
      items.forEach((item) => {
        const container = document.createElement("div");
        container.className = "wpt-shortcut";

        const title = document.createElement("div");
        title.className = "wpt-shortcut-title";
        title.textContent = item.label;
        container.appendChild(title);

        const desc = document.createElement("div");
        desc.className = "wpt-shortcut-desc";
        desc.textContent = item.description;
        container.appendChild(desc);

        const button = document.createElement("button");
        button.className = "wpt-button";
        button.textContent = "Open";
        button.addEventListener("click", () => callbacks.onOpenShortcut(item.url));
        container.appendChild(button);

        shortcuts.appendChild(container);
      });
    },
    updateLogAnalysis(payload, available) {
      if (!available) {
        renderMeta(logAnalysis, null, "Open Log File Viewer to enable log analysis.");
        logFindings.innerHTML = "";
        resolutionSearches.innerHTML = "";
        return;
      }

      if (!payload) {
        renderMeta(logAnalysis, null, "Run Analyze Visible Log on a log viewer page.");
        logFindings.innerHTML = "";
        resolutionSearches.innerHTML = "";
        return;
      }

      renderMeta(logAnalysis, {
        Mode: payload.mode,
        Summary: payload.summary,
        "Next Steps": (payload.nextSteps || []).join(" | ")
      }, "No analysis yet.");
      renderFindings(logFindings, payload.findings || []);
    },
    updateResolutionSearches(groups) {
      resolutionSearches.innerHTML = "";
      if (!groups.length) {
        resolutionSearches.innerHTML = '<div class="wpt-empty">No online resolution searches yet.</div>';
        return;
      }

      groups.forEach((group) => {
        const container = document.createElement("div");
        container.className = "wpt-resolution-group";

        const title = document.createElement("div");
        title.className = "wpt-resolution-title";
        title.textContent = group.label;
        container.appendChild(title);

        const links = document.createElement("div");
        links.className = "wpt-resolution-links";

        group.searches.forEach((search) => {
          const button = document.createElement("button");
          button.className = "wpt-button";
          button.textContent = search.name;
          button.addEventListener("click", () => callbacks.onOpenResolutionSearch(search.url));
          links.appendChild(button);
        });

        container.appendChild(links);
        resolutionSearches.appendChild(container);
      });
    },
    log
  };

  function setOpen(nextOpen, persist = true) {
    isOpen = nextOpen;
    panel.classList.toggle("is-open", isOpen);
    clampPosition();
    if (persist) {
      emitStateChange();
    }
  }

  function setTheme(theme, persist) {
    root.dataset.theme = theme === "light" ? "light" : "dark";
    themeToggle.checked = root.dataset.theme === "light";
    if (persist) {
      callbacks.onThemeChange?.(root.dataset.theme);
    }
  }

  function startDrag(handle) {
    handle.addEventListener("pointerdown", (event) => {
      if (handle === header && event.target === closeButton) {
        return;
      }
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: root.getBoundingClientRect().left,
        originTop: root.getBoundingClientRect().top,
        moved: false
      };
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragState.moved = true;
      }

      const nextLeft = dragState.originLeft + deltaX;
      const nextTop = dragState.originTop + deltaY;
      applyPosition(nextLeft, nextTop);
      event.preventDefault();
    });

    handle.addEventListener("pointerup", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      handle.releasePointerCapture?.(event.pointerId);
      if (handle === launcher && dragState.moved) {
        suppressLauncherClick = true;
      }
      emitStateChange();
      dragState = null;
    });
  }

  function applyPosition(left, top) {
    const margin = 12;
    const rect = root.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    root.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
    root.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  }

  function clampPosition() {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    applyPosition(rect.left, rect.top);
  }

  function log(message) {
    const stamp = new Date().toLocaleTimeString();
    activityLog.textContent = `[${stamp}] ${message}\n${activityLog.textContent}`.trim();
  }

  function emitStateChange() {
    const rect = root.getBoundingClientRect();
    callbacks.onOverlayStateChange?.({
      open: isOpen,
      left: Math.round(rect.left),
      top: Math.round(rect.top)
    });
  }
}

function renderMeta(node, data, emptyMessage) {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
  node.innerHTML = "";

  if (!entries.length) {
    node.innerHTML = `<div class="wpt-empty">${emptyMessage}</div>`;
    return;
  }

  entries.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "wpt-meta-row";
    row.innerHTML = `<div class="wpt-label">${escapeHtml(label)}</div><div>${escapeHtml(String(value))}</div>`;
    node.appendChild(row);
  });
}

function renderFindings(node, findings) {
  node.innerHTML = "";
  if (!findings.length) {
    node.innerHTML = '<div class="wpt-empty">No categorical findings yet.</div>';
    return;
  }

  findings.forEach((finding) => {
    const container = document.createElement("div");
    container.className = "wpt-finding";
    container.innerHTML = `
      <div class="wpt-finding-title">${escapeHtml(finding.title || "Finding")}</div>
      <div class="wpt-finding-meta">${escapeHtml(String(finding.category || "General"))} | ${escapeHtml(String(finding.severity || "info"))}</div>
      <div>${escapeHtml(String(finding.explanation || ""))}</div>
      <div class="wpt-finding-meta">Evidence: ${escapeHtml(String(finding.evidence || ""))}</div>
    `;
    node.appendChild(container);
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
