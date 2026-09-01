const button = document.getElementById("grant-button");
const statusNode = document.getElementById("status");

button.addEventListener("click", async () => {
  const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
  if (granted) {
    statusNode.textContent = "Screenshot permission granted. You can return to Windchill and click Screenshot again.";
    button.disabled = true;
    return;
  }

  statusNode.textContent = "Permission was not granted. You can click the button again if needed.";
});
