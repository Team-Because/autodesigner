

# Chrome Extension for BrandTonic Studio

## What We're Building

A Chrome extension that lets you right-click any image on the web, select a brand from your account, pick an output format, and trigger creative generation — all without leaving the page you're browsing.

## How It Works

```text
User right-clicks image → Context menu "Generate Creative" →
Popup opens with brand selector + format picker →
User clicks "Generate" → Extension sends image URL to edge function →
Result shown in popup with download option
```

## Architecture

### 1. Extension Files (in `extension/` directory)

- **manifest.json** — Manifest V3 with `contextMenus`, `activeTab`, `storage` permissions
- **background.js** — Service worker that creates the right-click context menu item ("Generate Creative with BrandTonic"), captures the clicked image URL, and opens the popup
- **popup.html / popup.js / popup.css** — UI for:
  - Login form (email + password, authenticates against your backend)
  - Brand selector (fetches brands from the database using the user's session)
  - Output format picker (Landscape / Square / Portrait / Story)
  - Generate button + progress indicator
  - Result display with download button
- **icon.png** — Extension icon (48px and 128px variants)

### 2. Authentication Flow

The extension stores the user's session token in `chrome.storage.local` after login. All API calls use this token. No secrets are hardcoded.

### 3. Generation Flow

1. User right-clicks an image → context menu fires → image URL is stored
2. Popup opens, loads brands from the database via REST API
3. User selects brand + format, clicks Generate
4. Extension calls the existing `generate-creative` edge function with the image URL as `referenceImageUrl`
5. Progress and result are shown in the popup

### 4. Edge Function — Minor Update

The existing `generate-creative` function already accepts a `referenceImageUrl`. No changes needed if the image URL is publicly accessible. If the image requires fetching (e.g., behind auth), we'll add a small path to download and re-upload the image to the storage bucket first.

### 5. Packaging

The extension is zipped and placed in `public/` for download from the app. A download link will be added to the Dashboard or Settings page.

## Files to Create/Modify

| File | Action |
|------|--------|
| `extension/manifest.json` | Create — MV3 config |
| `extension/background.js` | Create — Context menu + message handling |
| `extension/popup.html` | Create — Login, brand picker, generate UI |
| `extension/popup.js` | Create — All popup logic |
| `extension/popup.css` | Create — Styling matching app theme |
| `extension/icon.png` | Create — Generated icon |
| Build script | Zip extension to `public/brandtonic-extension.zip` |
| `src/pages/Dashboard.tsx` or Settings | Add download link for the extension |

## Key Technical Decisions

- **Auth**: Email/password login stored in `chrome.storage.local` — the extension authenticates directly against the backend auth API
- **API calls**: Direct REST calls to the database (using the anon key + auth token) for fetching brands, and `supabase.functions.invoke` equivalent via fetch for generation
- **Image handling**: If the right-clicked image URL is publicly accessible, it's passed directly. Otherwise, the extension fetches the image as a blob, uploads it to the `brand-assets` bucket, then passes the public URL
- **No new edge functions needed** — reuses the existing `generate-creative` function entirely

