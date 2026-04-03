

# Fix Chrome Extension UX — Persist Generation Across Popup Close

## The Problem

Chrome extension popups close the moment you click outside them. Since generation takes ~60 seconds, the popup closes mid-generation and the result is lost forever.

## Solution

Move the generation logic into the **background service worker** so it runs independently of the popup. Use **Chrome notifications** to alert when done. Store results in `chrome.storage.local` so reopening the popup shows the latest result.

## How It Will Work

```text
User clicks Generate → popup sends message to background.js →
popup can close safely → background.js calls edge function →
on completion: Chrome notification "Creative ready!" →
user clicks notification OR reopens popup → sees result with download
```

## Changes

### 1. `extension/background.js` — Handle generation in background

- Listen for a `"generate"` message from popup with `{brandId, imageUrl, format, session}`
- Call the `generate-creative` edge function
- Store the result (image URL, status, timestamp) in `chrome.storage.local` under `bt_lastResult`
- Fire a Chrome notification: "Your creative is ready! Click to view."
- On notification click, open the popup via `chrome.action.openPopup()`
- Add `"notifications"` permission to manifest

### 2. `extension/manifest.json` — Add notifications permission

- Add `"notifications"` to the permissions array

### 3. `extension/popup.js` — Delegate generation, restore state on open

- Instead of calling the edge function directly, send a message to background: `chrome.runtime.sendMessage({type: "generate", ...})`
- Show the spinner, but also show a message: "You can close this — we'll notify you when it's ready"
- On popup boot, check `chrome.storage.local` for `bt_lastResult` — if present and recent, show the result state immediately
- Listen for `chrome.runtime.onMessage` for a `"generation_complete"` event so if the popup is still open, it updates live
- Add a "View in History" link that opens the main app's History page

### 4. `extension/popup.html` — Minor UI additions

- Add a dismissible hint below the spinner: "Feel free to close — you'll get a notification when ready"
- Add a "View in History →" link in the result section
- Add a "Last Creative" section visible when reopening popup with a stored result

### 5. `extension/popup.css` — Style new elements

- Style the "safe to close" hint text
- Style the "View in History" link
- Style the notification/success banner

## Summary of UX Improvements

| Before | After |
|--------|-------|
| Generation dies if popup closes | Generation runs in background, survives close |
| No notification when done | Chrome notification: "Creative ready!" |
| Result lost on close | Result persisted, shown when popup reopens |
| No way to find result later | "View in History" link opens main app |
| Anxious wait — must keep popup open | Clear message: "You can close this" |

