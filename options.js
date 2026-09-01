const STORAGE_KEY = "windchillPowertoolsAllowedOrigins";

const siteInput = document.getElementById("site-input");
const statusNode = document.getElementById("status");
const siteList = document.getElementById("site-list");
const saveButton = document.getElementById("save-button");
const refreshButton = document.getElementById("refresh-button");

saveButton.addEventListener("click", saveSites);
refreshButton.addEventListener("click", loadState);

loadState();

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const patterns = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  siteInput.value = patterns.map(patternToDisplay).join("\n");
  renderSites(patterns);
  statusNode.textContent = patterns.length
    ? "Configured Windchill sites are shown below."
    : "No configured Windchill URLs yet.";
}

async function saveSites() {
  const rawLines = siteInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedEntries = rawLines.map((line) => ({
    input: line,
    pattern: normalizeWindchillPattern(line)
  }));
  const invalidEntries = normalizedEntries.filter((entry) => !entry.pattern).map((entry) => entry.input);
  if (invalidEntries.length) {
    statusNode.textContent = `These entries could not be understood as Windchill URLs: ${invalidEntries.join(", ")}`;
    return;
  }

  const normalizedPatterns = [...new Set(normalizedEntries.map((entry) => entry.pattern).filter(Boolean))];
  if (!normalizedPatterns.length) {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    await chrome.runtime.sendMessage({ type: "windchill-powertools-sync" });
    renderSites([]);
    statusNode.textContent = "Cleared all configured Windchill sites.";
    return;
  }

  const current = await chrome.storage.local.get(STORAGE_KEY);
  const previousPatterns = Array.isArray(current[STORAGE_KEY]) ? current[STORAGE_KEY] : [];
  const removedPatterns = previousPatterns.filter((pattern) => !normalizedPatterns.includes(pattern));
  const newPatterns = normalizedPatterns.filter((pattern) => !previousPatterns.includes(pattern));

  if (newPatterns.length) {
    const granted = await chrome.permissions.request({ origins: newPatterns });
    if (!granted) {
      statusNode.textContent = "Permission request was canceled. No changes were saved.";
      return;
    }
  }

  if (removedPatterns.length) {
    await chrome.permissions.remove({ origins: removedPatterns }).catch(() => {});
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: normalizedPatterns });
  const syncResponse = await chrome.runtime.sendMessage({ type: "windchill-powertools-sync" });

  renderSites(normalizedPatterns);
  statusNode.textContent = syncResponse?.ok
    ? "Windchill sites saved and extension access updated."
    : `Saved sites, but background sync reported: ${syncResponse?.error || "unknown issue"}`;
}

function normalizeWindchillPattern(value) {
  let input = String(value || "").trim();
  if (!input) {
    return "";
  }

  if (!/^[a-z]+:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  try {
    const url = new URL(input);
    return `${url.protocol}//${url.host}/Windchill/*`;
  } catch {
    return "";
  }
}

function patternToDisplay(pattern) {
  return String(pattern || "").replace(/\/\*$/, "/");
}

function renderSites(patterns) {
  siteList.innerHTML = "";
  if (!patterns.length) {
    siteList.innerHTML = '<div class="item">No granted Windchill sites yet.</div>';
    return;
  }

  patterns.forEach((pattern) => {
    const item = document.createElement("div");
    item.className = "item";
    item.textContent = pattern;
    siteList.appendChild(item);
  });
}
