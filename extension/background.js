// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "brandtonic-generate",
    title: "Generate Creative with BrandTonic",
    contexts: ["image"]
  });
});

// Handle context menu click — store the image URL and open popup
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "brandtonic-generate" && info.srcUrl) {
    chrome.storage.local.set({ selectedImageUrl: info.srcUrl, selectedPageUrl: tab?.url || "" }, () => {
      chrome.action.openPopup();
    });
  }
});
