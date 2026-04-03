const SUPABASE_URL = "https://jibbeetyogbfkjvazysy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYmJlZXR5b2diZmtqdmF6eXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzUwNzYsImV4cCI6MjA4ODgxMTA3Nn0.C20BJLWyo9A3c2ouT097uddJrrJJwM-K09RhEQ3bf0E";

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

// Listen for generate requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "generate") {
    handleGenerate(message.payload);
    sendResponse({ status: "started" });
  }
  return true;
});

async function handleGenerate({ brandId, imageUrl, format, session }) {
  // Set generating state
  await chrome.storage.local.set({
    bt_lastResult: { status: "generating", timestamp: Date.now() }
  });

  try {
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-creative`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        brandId,
        referenceImageUrl: imageUrl,
        outputFormat: format,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Generation failed (${res.status})`);
    }

    if (data.imageUrl) {
      const result = {
        status: "complete",
        imageUrl: data.imageUrl,
        timestamp: Date.now()
      };
      await chrome.storage.local.set({ bt_lastResult: result });

      // Notify popup if open
      chrome.runtime.sendMessage({ type: "generation_complete", result }).catch(() => {});

      // Chrome notification
      chrome.notifications.create("bt-creative-ready", {
        type: "basic",
        iconUrl: "icon.png",
        title: "Creative Ready! 🎨",
        message: "Your BrandTonic creative has been generated. Click to view and download.",
        priority: 2
      });
    } else {
      throw new Error("No image returned");
    }
  } catch (err) {
    const result = {
      status: "error",
      error: err.message,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ bt_lastResult: result });

    // Notify popup if open
    chrome.runtime.sendMessage({ type: "generation_complete", result }).catch(() => {});

    chrome.notifications.create("bt-creative-error", {
      type: "basic",
      iconUrl: "icon.png",
      title: "Generation Failed",
      message: err.message,
      priority: 1
    });
  }
}

// Handle notification click — open popup
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("bt-")) {
    chrome.action.openPopup();
  }
});
