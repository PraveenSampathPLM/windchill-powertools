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
        width: 58px;
        height: 58px;
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
        position: absolute;
        right: 0;
        bottom: 68px;
        width: min(420px, calc(100vw - 24px));
        max-height: min(82vh, calc(100vh - 24px));
        display: none;
        flex-direction: column;
        background: var(--wpt-bg);
        color: var(--wpt-text);
        border: 1px solid var(--wpt-border);
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
        overflow: hidden;
      }
      .wpt-root[data-wide="true"] .wpt-panel {
        width: min(760px, calc(100vw - 24px));
      }
      .wpt-root[data-panel-y="below"] .wpt-panel {
        top: 68px;
        bottom: auto;
      }
      .wpt-root[data-panel-x="right"] .wpt-panel {
        left: 0;
        right: auto;
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
        min-width: 0;
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
        min-width: 0;
        flex-wrap: nowrap;
      }
      .wpt-ghost-button {
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        font-size: 11px;
        padding: 6px 10px;
        cursor: pointer;
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
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow: hidden;
        min-height: 0;
        min-width: 0;
        flex: 1;
      }
      .wpt-main {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
        min-width: 0;
        width: 100%;
        max-width: 100%;
      }
      .wpt-main > * {
        min-width: 0;
        max-width: 100%;
      }
      .wpt-toolbar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }
      .wpt-toolbar > * {
        width: 100%;
        min-width: 0;
      }
      .wpt-button {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--wpt-button-border);
        background: var(--wpt-button-bg);
        color: inherit;
        font: inherit;
        cursor: pointer;
        min-width: 0;
      }
      .wpt-button:hover { background: rgba(255, 255, 255, 0.12); }
      .wpt-card {
        padding: 12px;
        background: var(--wpt-card-bg);
        border: 1px solid var(--wpt-card-border);
        border-radius: 14px;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
      }
      .wpt-card-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .wpt-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        min-width: 0;
      }
      .wpt-card-header .wpt-card-title {
        margin-bottom: 0;
      }
      .wpt-meta {
        display: grid;
        gap: 6px;
        font-size: 12px;
        line-height: 1.45;
        min-width: 0;
      }
      .wpt-meta-row {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 8px;
        align-items: start;
        min-width: 0;
      }
      .wpt-label { color: var(--wpt-label); font-weight: 600; }
      .wpt-meta-value {
        min-width: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
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
      .wpt-bookmarks {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }
      .wpt-help-center {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }
      .wpt-api-form {
        display: grid;
        gap: 8px;
        min-width: 0;
      }
      .wpt-tam-form {
        display: grid;
        gap: 8px;
        min-width: 0;
      }
      .wpt-tam-results {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }
      .wpt-tam-result {
        padding: 8px 10px;
        background: var(--wpt-muted-bg);
        border: 1px solid var(--wpt-card-border);
        border-radius: 10px;
      }
      .wpt-tam-result-text {
        font-size: 11px;
        line-height: 1.4;
        margin-bottom: 8px;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .wpt-api-preset-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        min-width: 0;
        max-width: 100%;
      }
      .wpt-api-row {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 8px;
        align-items: center;
        min-width: 0;
        max-width: 100%;
      }
      .wpt-select,
      .wpt-input,
      .wpt-textarea {
        width: 100%;
        max-width: 100%;
        border-radius: 10px;
        border: 1px solid var(--wpt-button-border);
        background: var(--wpt-button-bg);
        color: inherit;
        font: inherit;
        padding: 9px 10px;
        box-sizing: border-box;
        min-width: 0;
      }
      .wpt-textarea {
        min-height: 84px;
        resize: vertical;
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-size: 11px;
      }
      .wpt-response {
        background: var(--wpt-log-bg);
        padding: 10px;
        border-radius: 12px;
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-size: 11px;
        max-height: 180px;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        overflow-x: auto;
        overflow-y: auto;
        white-space: pre;
        word-break: normal;
      }
      .wpt-accordion-panel {
        display: none;
      }
      .wpt-accordion.is-open .wpt-accordion-panel {
        display: block;
      }
      .wpt-shortcut,
      .wpt-help-item,
      .wpt-bookmark-item {
        padding: 8px 10px;
        background: var(--wpt-muted-bg);
        border: 1px solid var(--wpt-card-border);
        border-radius: 10px;
      }
      .wpt-shortcut-title,
      .wpt-help-title,
      .wpt-bookmark-title {
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .wpt-bookmark-subtitle {
        font-size: 11px;
        opacity: 0.75;
        margin-bottom: 8px;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .wpt-shortcut-desc {
        font-size: 11px;
        opacity: 0.8;
        margin-bottom: 8px;
        line-height: 1.4;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .wpt-inline-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
        min-width: 0;
        max-width: 100%;
      }
      .wpt-log {
        background: var(--wpt-log-bg);
        padding: 10px;
        border-radius: 12px;
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-size: 11px;
        max-height: 120px;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        overflow-x: auto;
        overflow-y: auto;
        white-space: pre;
      }
      .wpt-log-card {
        flex: 0 0 auto;
      }
      .wpt-log-card,
      .wpt-shortcuts,
      .wpt-bookmarks,
      .wpt-help-center {
        min-width: 0;
        max-width: 100%;
      }
      .wpt-empty { opacity: 0.7; font-size: 12px; }
      .wpt-help-links {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .wpt-response,
      .wpt-bookmark-subtitle {
        overflow-wrap: normal;
      }
      .wpt-modal-backdrop {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(3, 10, 18, 0.72);
        z-index: 2147483647;
      }
      .wpt-modal-backdrop.is-open {
        display: flex;
      }
      .wpt-modal {
        width: min(1040px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        display: flex;
        flex-direction: column;
        background: var(--wpt-bg);
        color: var(--wpt-text);
        border: 1px solid var(--wpt-border);
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
        overflow: hidden;
      }
      .wpt-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        background: var(--wpt-header-bg);
      }
      .wpt-modal-body {
        padding: 16px;
        overflow: auto;
        min-height: 0;
      }
      .wpt-modal-content {
        margin: 0;
        font: inherit;
        color: inherit;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .wpt-modal-content.is-code {
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-size: 12px;
        white-space: pre;
        overflow-wrap: normal;
      }
      .wpt-modal-content.is-code-wrap {
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-size: 12px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      @media (max-width: 640px) {
        .wpt-root {
          right: 12px;
          bottom: 12px;
          width: 58px;
          height: 58px;
        }
        .wpt-panel {
          width: min(92vw, 420px);
          max-height: 74vh;
        }
        .wpt-root[data-wide="true"] .wpt-panel {
          width: min(96vw, 760px);
        }
        .wpt-api-preset-row {
          grid-template-columns: 1fr;
        }
        .wpt-api-row {
          grid-template-columns: 1fr;
          gap: 6px;
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
            <div class="wpt-subtitle">JCA debug, stack trace copy, and shortcuts</div>
          </div>
          <div class="wpt-header-actions">
            <button class="wpt-ghost-button" id="toggle-wide-mode" title="Toggle wide mode">Wide</button>
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
          <div class="wpt-main">
            <div class="wpt-toolbar">
            <button class="wpt-button" data-action="toggle-jca-debug">🐞 JCA Debug</button>
            <button class="wpt-button" data-action="toggle-js-debug">🐞 JS Debug</button>
            <button class="wpt-button" data-action="toggle-resolver-mode">🧩 Resolver Mode</button>
            <button class="wpt-button" id="take-screenshot">📸 Screenshot</button>
            <button class="wpt-button" id="copy-oid">🆔 Copy OID</button>
            <button class="wpt-button" id="add-bookmark">⭐ Bookmark</button>
          </div>
            <section class="wpt-card">
              <div class="wpt-card-title">Status</div>
              <div class="wpt-meta" id="status"></div>
            </section>
            <section class="wpt-card">
              <div class="wpt-card-header">
                <div class="wpt-card-title">Customization Point Resolver</div>
                <button class="wpt-ghost-button" id="expand-resolver">Expand</button>
              </div>
              <div class="wpt-inline-actions">
                <button class="wpt-button" id="copy-resolved-details">Copy Resolved Details</button>
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
              <div class="wpt-card-header">
                <div class="wpt-card-title">API Tester</div>
                <button class="wpt-ghost-button" id="expand-api-tester">Expand</button>
              </div>
              <div class="wpt-api-form">
                <div class="wpt-api-row">
                  <div class="wpt-label">Preset</div>
                  <div class="wpt-api-preset-row">
                    <select class="wpt-select" id="api-preset"></select>
                    <button class="wpt-button" id="apply-api-preset">Apply</button>
                  </div>
                </div>
                <div class="wpt-api-row">
                  <div class="wpt-label">Method</div>
                  <select class="wpt-select" id="api-method">
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>PATCH</option>
                    <option>DELETE</option>
                  </select>
                </div>
                <div class="wpt-api-row">
                  <div class="wpt-label">Endpoint</div>
                  <input class="wpt-input" id="api-endpoint" placeholder="/Windchill/servlet/odata/..." />
                </div>
                <div class="wpt-api-row">
                  <div class="wpt-label">Headers</div>
                  <textarea class="wpt-textarea" id="api-headers" placeholder='{"Accept":"application/json"}'></textarea>
                </div>
                <div class="wpt-api-row">
                  <div class="wpt-label">Body</div>
                  <textarea class="wpt-textarea" id="api-body" placeholder='{"example":"value"}'></textarea>
                </div>
              </div>
              <div class="wpt-inline-actions">
                <button class="wpt-button" id="run-api-request">Run Request</button>
                <button class="wpt-button" id="copy-api-response">Copy Response</button>
              </div>
              <div class="wpt-meta" id="api-response-meta"></div>
              <div class="wpt-response" id="api-response-body">No API response yet.</div>
            </section>
            <section class="wpt-card">
              <div class="wpt-card-title">Type and Attribute Manager Search</div>
              <div class="wpt-tam-form">
                <input class="wpt-input" id="tam-search-query" placeholder="Search visible types or attributes on the current TAM page" />
                <div class="wpt-api-row">
                  <div class="wpt-label">Mode</div>
                  <select class="wpt-select" id="tam-search-mode">
                    <option value="loaded">Loaded Only</option>
                    <option value="deep">Deep Crawl</option>
                  </select>
                </div>
                <div class="wpt-inline-actions">
                  <button class="wpt-button" id="run-tam-search">Search</button>
                  <button class="wpt-button" id="clear-tam-search">Clear</button>
                  <button class="wpt-button" id="cancel-tam-search">Cancel</button>
                  <button class="wpt-button" id="export-tam-report">Export Report</button>
                  <button class="wpt-button" id="export-data-model" title="Export every type and attribute in the tree to one Excel workbook">Export Data Model</button>
                </div>
              </div>
              <div class="wpt-meta" id="tam-search-meta"></div>
              <div class="wpt-tam-results" id="tam-search-results"></div>
            </section>
            <section class="wpt-card">
              <div class="wpt-accordion" id="bookmarks-accordion">
                <button class="wpt-section-toggle" id="bookmarks-toggle" type="button">
                  <span>Quick Bookmarks</span>
                  <span class="wpt-section-arrow">›</span>
                </button>
                <div class="wpt-accordion-panel">
                  <div class="wpt-bookmarks" id="bookmarks"></div>
                </div>
              </div>
            </section>
            <section class="wpt-card">
              <div class="wpt-accordion" id="help-accordion">
                <button class="wpt-section-toggle" id="help-toggle" type="button">
                  <span>Help Center</span>
                  <span class="wpt-section-arrow">›</span>
                </button>
                <div class="wpt-accordion-panel">
                  <div class="wpt-help-center" id="help-center"></div>
                </div>
              </div>
            </section>
            <section class="wpt-card">
              <div class="wpt-card-title">Log Tools</div>
              <div class="wpt-inline-actions">
                <button class="wpt-button" id="copy-stack-trace">Copy Error Stack Trace</button>
                <button class="wpt-button" id="open-ptc-support">PTC Support</button>
              </div>
              <div class="wpt-meta" id="log-analysis"></div>
            </section>
            <section class="wpt-card">
              <div class="wpt-card-title">Need Help?</div>
              <div class="wpt-shortcut-desc">Free tool by Praveen Sampath. If you need help with Windchill debugging or log analysis, reach out directly by email.</div>
              <div class="wpt-help-links">
                <button class="wpt-button" id="contact-email">Email Praveen Sampath</button>
              </div>
            </section>
          </div>
          <section class="wpt-card wpt-log-card">
            <div class="wpt-card-header">
              <div class="wpt-card-title">Activity Log</div>
              <button class="wpt-ghost-button" id="expand-activity-log">Expand</button>
            </div>
            <div class="wpt-log" id="activity-log"></div>
          </section>
        </div>
      </section>
    </div>
    <div class="wpt-modal-backdrop" id="wpt-modal-backdrop">
      <section class="wpt-modal" aria-modal="true" role="dialog" aria-labelledby="wpt-modal-title">
        <header class="wpt-modal-header">
          <div class="wpt-title" id="wpt-modal-title">Expanded View</div>
          <button class="wpt-close" id="wpt-modal-close" title="Close">×</button>
        </header>
        <div class="wpt-modal-body">
          <pre class="wpt-modal-content" id="wpt-modal-content"></pre>
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
  const wideModeButton = shadow.getElementById("toggle-wide-mode");
  const shortcutsAccordion = shadow.getElementById("shortcuts-accordion");
  const shortcutsToggle = shadow.getElementById("shortcuts-toggle");
  const bookmarksAccordion = shadow.getElementById("bookmarks-accordion");
  const bookmarksToggle = shadow.getElementById("bookmarks-toggle");
  const helpAccordion = shadow.getElementById("help-accordion");
  const helpToggle = shadow.getElementById("help-toggle");
  const status = shadow.getElementById("status");
  const parsedDetails = shadow.getElementById("parsed-details");
  const shortcuts = shadow.getElementById("system-health-shortcuts");
  const bookmarks = shadow.getElementById("bookmarks");
  const helpCenter = shadow.getElementById("help-center");
  const logAnalysis = shadow.getElementById("log-analysis");
  const apiResponseMeta = shadow.getElementById("api-response-meta");
  const apiResponseBody = shadow.getElementById("api-response-body");
  const apiPreset = shadow.getElementById("api-preset");
  const tamSearchQuery = shadow.getElementById("tam-search-query");
  const tamSearchMode = shadow.getElementById("tam-search-mode");
  const tamSearchMeta = shadow.getElementById("tam-search-meta");
  const tamSearchResults = shadow.getElementById("tam-search-results");
  const activityLog = shadow.getElementById("activity-log");
  const modalBackdrop = shadow.getElementById("wpt-modal-backdrop");
  const modalTitle = shadow.getElementById("wpt-modal-title");
  const modalContent = shadow.getElementById("wpt-modal-content");

  let isOpen = false;
  let dragState = null;
  let suppressLauncherClick = false;
  let isWide = false;
  let lastResolverPayload = null;
  let lastApiResponsePayload = null;

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
  wideModeButton.addEventListener("click", () => {
    toggleWideMode();
  });

  shortcutsToggle.addEventListener("click", () => {
    shortcutsAccordion.classList.toggle("is-open");
  });

  bookmarksToggle.addEventListener("click", () => {
    bookmarksAccordion.classList.toggle("is-open");
  });

  helpToggle.addEventListener("click", () => {
    helpAccordion.classList.toggle("is-open");
  });

  shadow.getElementById("copy-resolved-details").addEventListener("click", () => {
    callbacks.onCopyResolvedDetails();
  });
  shadow.getElementById("expand-resolver").addEventListener("click", () => {
    openModal("Customization Point Resolver", formatExpandedContent(lastResolverPayload, parsedDetails.textContent), "wrapped-code");
  });

  shadow.getElementById("take-screenshot").addEventListener("click", () => {
    callbacks.onTakeScreenshot();
  });

  shadow.getElementById("copy-oid").addEventListener("click", () => {
    callbacks.onCopyOid();
  });

  shadow.getElementById("add-bookmark").addEventListener("click", () => {
    callbacks.onAddBookmark();
  });

  shadow.getElementById("run-api-request").addEventListener("click", () => {
    callbacks.onRunApiRequest({
      method: shadow.getElementById("api-method").value,
      endpoint: shadow.getElementById("api-endpoint").value,
      headers: shadow.getElementById("api-headers").value,
      body: shadow.getElementById("api-body").value
    });
  });

  shadow.getElementById("copy-api-response").addEventListener("click", () => {
    callbacks.onCopyApiResponse();
  });
  shadow.getElementById("expand-api-tester").addEventListener("click", () => {
    openModal("API Tester", formatExpandedContent(lastApiResponsePayload, apiResponseBody.textContent), "code");
  });

  shadow.getElementById("apply-api-preset").addEventListener("click", () => {
    callbacks.onApplyApiPreset(apiPreset.value);
  });
  shadow.getElementById("run-tam-search").addEventListener("click", () => {
    callbacks.onRunTamSearch({
      query: tamSearchQuery.value,
      mode: tamSearchMode.value
    });
  });
  shadow.getElementById("clear-tam-search").addEventListener("click", () => {
    tamSearchQuery.value = "";
    callbacks.onClearTamSearch();
  });
  shadow.getElementById("cancel-tam-search").addEventListener("click", () => {
    callbacks.onCancelTamSearch?.();
  });
  shadow.getElementById("export-tam-report").addEventListener("click", () => {
    callbacks.onExportTamReport?.();
  });
  shadow.getElementById("export-data-model").addEventListener("click", () => {
    callbacks.onExportDataModel?.(tamSearchMode.value);
  });
  tamSearchQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      callbacks.onRunTamSearch({
        query: tamSearchQuery.value,
        mode: tamSearchMode.value
      });
    }
  });

  shadow.getElementById("copy-stack-trace").addEventListener("click", () => {
    callbacks.onCopyStackTrace();
  });

  shadow.getElementById("open-ptc-support").addEventListener("click", () => {
    callbacks.onOpenPtcSupport();
  });
  shadow.getElementById("contact-email").addEventListener("click", () => {
    callbacks.onOpenShortcut("mailto:pravincee@gmail.com");
  });
  shadow.getElementById("expand-activity-log").addEventListener("click", () => {
    openModal("Activity Log", activityLog.textContent || "No activity yet.", "code");
  });
  shadow.getElementById("wpt-modal-close").addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) {
      closeModal();
    }
  });

  shadow.querySelectorAll("input, textarea, select").forEach((control) => {
    ["keydown", "keypress", "keyup"].forEach((eventName) => {
      control.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });
  });

  startDrag(launcher);
  startDrag(header);
  window.addEventListener("resize", clampPosition);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalBackdrop.classList.contains("is-open")) {
      closeModal();
    }
  });

  log("Windchill PowerTools loaded.");
  renderHelpCenter();

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
    updateResolverDetails(payload) {
      lastResolverPayload = payload || null;
      renderMeta(parsedDetails, payload || {}, "Enable Resolver Mode, then click a JCA debug-marked component to resolve its customization points.");
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
    updateBookmarks(items) {
      bookmarks.innerHTML = "";
      if (!items.length) {
        bookmarks.innerHTML = '<div class="wpt-empty">No bookmarks saved yet.</div>';
        return;
      }

      items.forEach((item) => {
        const container = document.createElement("div");
        container.className = "wpt-bookmark-item";
        container.innerHTML = `
          <div class="wpt-bookmark-title">${escapeHtml(item.label || item.objectNumber || "Bookmark")}</div>
          <div class="wpt-bookmark-subtitle">${escapeHtml(item.url || "")}</div>
        `;

        const actions = document.createElement("div");
        actions.className = "wpt-inline-actions";

        const openButton = document.createElement("button");
        openButton.className = "wpt-button";
        openButton.textContent = "Open";
        openButton.addEventListener("click", () => callbacks.onOpenBookmark(item.id));
        actions.appendChild(openButton);

        const deleteButton = document.createElement("button");
        deleteButton.className = "wpt-button";
        deleteButton.textContent = "Remove";
        deleteButton.addEventListener("click", () => callbacks.onDeleteBookmark(item.id));
        actions.appendChild(deleteButton);

        container.appendChild(actions);
        bookmarks.appendChild(container);
      });
    },
    updateApiResponse(payload) {
      lastApiResponsePayload = payload || null;
      if (!payload) {
        renderMeta(apiResponseMeta, null, "Run a same-origin Windchill API request to see the response.");
        apiResponseBody.textContent = "No API response yet.";
        return;
      }

      renderMeta(apiResponseMeta, {
        Method: payload.method,
        URL: payload.url,
        Status: `${payload.status} ${payload.statusText || ""}`.trim(),
        Time: `${payload.durationMs} ms`,
        "CSRF Nonce": payload.csrfNonceUsed ? `Auto header: ${payload.csrfHeaderName || "CSRF_NONCE"}` : "Not used"
      }, "No API response yet.");
      apiResponseBody.textContent = payload.body || "";
    },
    updateTamSearch(payload) {
      const searchState = payload || {};
      if (typeof searchState.query === "string") {
        tamSearchQuery.value = searchState.query;
      }
      if (typeof searchState.mode === "string") {
        tamSearchMode.value = searchState.mode;
      }

      renderMeta(tamSearchMeta, searchState.available === false ? {
        Status: "Open the Type and Attribute Manager page first",
        Hint: "This search works against the ExtJS Type and Attribute Manager tree on the current tab."
      } : {
        Query: searchState.query || "None",
        Mode: searchState.mode === "deep" ? "Deep Crawl" : "Loaded Only",
        Matches: Number.isFinite(searchState.count) ? String(searchState.count) : "0",
        Scope: searchState.scope || "Loaded current tree",
        Progress: searchState.progress || "Idle"
      }, "Search the Type and Attribute Manager tree to find types and attributes.");

      tamSearchResults.innerHTML = "";
      const items = Array.isArray(searchState.results) ? searchState.results : [];
      if (!items.length) {
        tamSearchResults.innerHTML = `<div class="wpt-empty">${escapeHtml(searchState.emptyMessage || "No search results yet.")}</div>`;
        return;
      }

      items.forEach((item) => {
        const container = document.createElement("div");
        container.className = "wpt-tam-result";

        const text = document.createElement("div");
        text.className = "wpt-tam-result-text";
        text.textContent = item.text || "Match";
        container.appendChild(text);

        const button = document.createElement("button");
        button.className = "wpt-button";
        button.textContent = "Jump";
        button.addEventListener("click", () => callbacks.onJumpTamResult(item.id));
        container.appendChild(button);

        tamSearchResults.appendChild(container);
      });
    },
    updateApiPresets(items, selectedId = "") {
      apiPreset.innerHTML = "";
      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.label;
        if (item.id === selectedId) {
          option.selected = true;
        }
        apiPreset.appendChild(option);
      });
    },
    applyApiPreset(preset) {
      if (!preset) {
        return;
      }
      shadow.getElementById("api-preset").value = preset.id;
      shadow.getElementById("api-method").value = preset.method;
      shadow.getElementById("api-endpoint").value = preset.endpoint;
      shadow.getElementById("api-headers").value = preset.headers || "";
      shadow.getElementById("api-body").value = preset.body || "";
    },
    updateLogTools(stackTrace, available, emptyMessage) {
      if (!available) {
        renderMeta(logAnalysis, null, "Open Log File Viewer to copy an error stack trace.");
        return;
      }

      if (!stackTrace) {
        renderMeta(logAnalysis, null, emptyMessage || "Click Copy Error Stack Trace on a log viewer page.");
        return;
      }

      renderMeta(logAnalysis, {
        Status: "Copied",
        Lines: String(stackTrace.split(/\r?\n/).length)
      }, "No stack trace copied yet.");
    },
    log
  };

  function setOpen(nextOpen, persist = true) {
    isOpen = nextOpen;
    panel.classList.toggle("is-open", isOpen);
    updatePanelPlacement();
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

  function toggleWideMode() {
    isWide = !isWide;
    root.dataset.wide = isWide ? "true" : "false";
    wideModeButton.textContent = isWide ? "Normal" : "Wide";
    updatePanelPlacement();
    clampPosition();
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
        moved: false,
        didMove: false
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
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        dragState.moved = true;
      }

      const nextLeft = dragState.originLeft + deltaX;
      const nextTop = dragState.originTop + deltaY;
      applyPosition(nextLeft, nextTop);
      dragState.didMove = true;
      event.preventDefault();
    });

    handle.addEventListener("pointerup", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      handle.releasePointerCapture?.(event.pointerId);
      if (handle === launcher && (dragState.moved || dragState.didMove)) {
        suppressLauncherClick = true;
        window.setTimeout(() => {
          suppressLauncherClick = false;
        }, 250);
      }
      emitStateChange();
      dragState = null;
    });

    handle.addEventListener("pointercancel", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      if (handle === launcher && (dragState.moved || dragState.didMove)) {
        suppressLauncherClick = true;
        window.setTimeout(() => {
          suppressLauncherClick = false;
        }, 250);
      }
      dragState = null;
    });
  }

  function applyPosition(left, top) {
    const margin = 12;
    const launcherRect = launcher.getBoundingClientRect();
    const launcherWidth = launcherRect.width || 58;
    const launcherHeight = launcherRect.height || 58;
    const maxLeft = Math.max(margin, window.innerWidth - launcherWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - launcherHeight - margin);
    root.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
    root.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    updatePanelPlacement();
  }

  function clampPosition() {
    const launcherRect = launcher.getBoundingClientRect();
    if (!launcherRect.width || !launcherRect.height) {
      return;
    }
    applyPosition(launcherRect.left, launcherRect.top);
  }

  function updatePanelPlacement() {
    if (!isOpen) {
      return;
    }

    const margin = 12;
    const launcherRect = launcher.getBoundingClientRect();
    const panelWidth = Math.min(isWide ? 760 : 420, window.innerWidth - margin * 2);
    const panelHeight = Math.min(window.innerHeight * 0.82, window.innerHeight - margin * 2);
    const hasRoomAbove = launcherRect.top >= panelHeight + margin;
    const hasRoomLeft = launcherRect.right >= panelWidth;

    root.dataset.panelY = hasRoomAbove ? "above" : "below";
    root.dataset.panelX = hasRoomLeft ? "left" : "right";
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

  function openModal(title, content, mode = "text") {
    modalTitle.textContent = title;
    modalContent.textContent = content || "No content available.";
    modalContent.className = "wpt-modal-content";
    if (mode === "code") {
      modalContent.classList.add("is-code");
    } else if (mode === "wrapped-code") {
      modalContent.classList.add("is-code-wrap");
    }
    modalBackdrop.classList.add("is-open");
  }

  function closeModal() {
    modalBackdrop.classList.remove("is-open");
  }

  function formatExpandedContent(payload, fallbackText) {
    if (payload && typeof payload === "object") {
      try {
        return JSON.stringify(payload, null, 2);
      } catch {
        return fallbackText || "";
      }
    }
    return fallbackText || "";
  }

  function renderHelpCenter() {
    const items = [
      {
        title: "JCA Debug",
        body: "Adds or removes jcaDebug=true from the current Windchill URL so component metadata becomes visible."
      },
      {
        title: "JS Debug",
        body: "Adds or removes jsDebug=true from the current Windchill URL for JavaScript-side debugging when supported."
      },
      {
        title: "Resolver Mode",
        body: "Turn this on after enabling JCA Debug, then click a component to freeze likely builders, validators, JSPs, and other customization points."
      },
      {
        title: "Copy Resolved Details",
        body: "Copies the currently resolved customization report as JSON so you can share it with developers or attach it to a ticket."
      },
      {
        title: "System Health Shortcuts",
        body: "Opens common Windchill JMX tools like Server Status, Cache Statistics, Log File Viewer, Top SQL, and Cluster Stack Traces."
      },
      {
        title: "Screenshot",
        body: "Captures the current Windchill page and saves it using the detected object number plus a timestamp."
      },
      {
        title: "Log Tools",
        body: "Copies the visible error stack trace from Windchill log viewer pages and gives quick access to PTC Support."
      },
      {
        title: "API Tester",
        body: "Runs same-origin Windchill REST or servlet requests in your current logged-in session and shows status, timing, and response body."
      },
      {
        title: "Type and Attribute Search",
        body: "Searches every type's own fields and its full attribute grid (Name, Internal Name, Filterable, and more) for a match, so you can answer \"which types have attribute X\" across the whole tree, not just the one currently selected. Deep Crawl expands the full tree first; Loaded Only searches what's already expanded. Jump flashes the matched type in the tree."
      },
      {
        title: "Export Data Model",
        body: "Documents your Windchill data model in one click: crawls the Type and Attribute Manager tree and exports every type with its metadata plus a flat, filterable table of all attributes into one Excel workbook. The Mode select controls scope (Deep Crawl = whole tree, Loaded Only = what's expanded). Large trees can take several minutes; progress shows in the Activity Log and Cancel stops it."
      }
    ];

    helpCenter.innerHTML = "";
    items.forEach((item) => {
      const container = document.createElement("div");
      container.className = "wpt-help-item";
      container.innerHTML = `
        <div class="wpt-help-title">${escapeHtml(item.title)}</div>
        <div class="wpt-shortcut-desc">${escapeHtml(item.body)}</div>
      `;
      helpCenter.appendChild(container);
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
    row.innerHTML = `<div class="wpt-label">${escapeHtml(label)}</div><div class="wpt-meta-value">${escapeHtml(String(value))}</div>`;
    node.appendChild(row);
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
