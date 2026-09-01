const STORAGE_KEY = "windchillPowertoolsAllowedOrigins";
const SCRIPT_ID = "windchill-powertools-content";

chrome.runtime.onInstalled.addListener(() => {
  syncRegisteredContentScript().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  syncRegisteredContentScript().catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "windchill-powertools-sync") {
    syncRegisteredContentScript()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "windchill-powertools-get-state") {
    getStoredPatterns()
      .then((patterns) => sendResponse({ ok: true, patterns }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "windchill-powertools-capture-screenshot") {
    captureScreenshot(message, _sender)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "windchill-powertools-open-screenshot-permission") {
    openScreenshotPermissionPage()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function syncRegisteredContentScript() {
  const storedPatterns = await getStoredPatterns();
  const grantedPatterns = [];

  for (const pattern of storedPatterns) {
    const contains = await chrome.permissions.contains({ origins: [pattern] });
    if (contains) {
      grantedPatterns.push(pattern);
    }
  }

  await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }).catch(() => {});

  if (!grantedPatterns.length) {
    return { registered: [] };
  }

  await chrome.scripting.registerContentScripts([
    {
      id: SCRIPT_ID,
      js: ["contentScript.js"],
      matches: grantedPatterns,
      runAt: "document_idle",
      persistAcrossSessions: true
    }
  ]);

  return { registered: grantedPatterns };
}

async function getStoredPatterns() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

async function captureScreenshot(message, sender) {
  const hasAllUrls = await chrome.permissions.contains({ origins: ["<all_urls>"] });
  if (!hasAllUrls) {
    throw new Error("Screenshot permission is required. Click the screenshot button again and grant access in the permission page.");
  }

  const windowId = sender?.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: "png"
  });

  const filename = buildScreenshotFilename(message?.objectNumber, message?.timestamp);
  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: false
  });

  return { downloadId, filename };
}

async function openScreenshotPermissionPage() {
  const url = chrome.runtime.getURL("screenshot-permission.html");
  await chrome.tabs.create({ url });
}

function buildScreenshotFilename(objectNumber, timestamp) {
  const safeObjectNumber = sanitizeFilenamePart(objectNumber || "windchill-page");
  const safeTimestamp = sanitizeFilenamePart(timestamp || new Date().toISOString());
  return `WindchillPowerTools/${safeObjectNumber}_${safeTimestamp}.png`;
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .replace(/[:.]/g, "-")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "windchill";
}
