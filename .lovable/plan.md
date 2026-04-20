

# Plan: Send Generated Creatives to Canva

Connect a single shared Canva account to the app so any generated creative can be pushed into Canva — either as a brand new design or uploaded into an existing folder/project.

## What you'll see in the app

On the **Studio** output card and on each completed item in **History**, two new buttons appear next to Download:

- **Open in Canva** — creates a new Canva design containing the image and opens it in a new tab, ready to edit.
- **Save to Canva folder…** — opens a small picker showing your Canva folders (projects). Pick one, hit Save, and the image lands in that folder as an asset you can drop into any existing Canva file.

A small "Connected to Canva" indicator with the account name appears in the sidebar/account menu so you always know it's wired up.

## How the integration works

Since Canva isn't an available Lovable connector, we'll set up a custom Canva Connect integration using OAuth 2.0 with PKCE. Because you chose a **single shared Canva account**, the OAuth flow runs once (by you, the admin) and the resulting refresh token is stored as a secret. All users' "Send to Canva" actions go to that one account.

```text
[Studio/History "Send to Canva"]
        │
        ▼
[Edge function: canva-send]
   ├── refresh access token (from stored refresh_token)
   ├── upload image via "Create URL asset upload job" (uses our public image URL)
   ├── poll job until asset_id ready
   ├── if "Open in Canva":  create design with that asset → return edit_url
   └── if "Save to folder": move asset to chosen folder_id → return folder URL
```

### Setup steps (one-time, by admin)

1. **Create a Canva Developer integration** at canva.com/developers — register an app, set the redirect URL to a new edge function `canva-oauth-callback`, request scopes: `asset:read asset:write design:content:read design:content:write folder:read folder:write`.
2. You'll get a **Client ID** and **Client Secret**. Add both as secrets (`CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`).
3. Visit a new in-app `/admin/canva-connect` page (admin-only) → click "Connect Canva" → complete OAuth → the refresh token is saved to a new `app_integrations` table.

### New edge functions

| Function | Purpose |
|----------|---------|
| `canva-oauth-start` | Builds Canva authorize URL with PKCE, redirects browser. |
| `canva-oauth-callback` | Exchanges code for tokens, stores refresh_token in `app_integrations`. |
| `canva-list-folders` | Returns the shared account's folders for the picker. |
| `canva-send` | Body: `{ generation_id, mode: "design" \| "folder", folder_id? }`. Refreshes access token, uploads asset via URL, optionally creates design or moves to folder, returns `canva_url`. |

All four are deployed with `verify_jwt = true` (only the OAuth callback is public). Access tokens are refreshed on every call (they expire in ~4h) and never stored long-term.

### Database changes

One new table:

```text
app_integrations
  provider           text  PK         -- "canva"
  refresh_token      text             -- encrypted at rest by Postgres
  scopes             text
  connected_by       uuid             -- admin user_id
  connected_account  text             -- Canva display name, for UI
  updated_at         timestamptz
```

RLS: only admins can read/write. Service role (edge functions) reads it for token refresh.

Optional: add `canva_design_id text` and `canva_design_url text` columns to `generations` so we can show "Already in Canva ↗" instead of re-sending the same image.

### Where image data comes from

Your `output_image_url` already lives in the public `brand-assets` bucket, so Canva's "Create URL asset upload job" endpoint can fetch it directly — no need to stream bytes through the edge function.

## Out of scope (for now)

- Per-user Canva accounts (you picked single shared account — easy to switch later by moving tokens into a per-user table).
- Editing existing Canva designs in place (Canva Connect doesn't expose a "drop image into design X at coords Y" API; the closest is creating a new design from the asset).
- Canva brand kits / template-based generation.

## Files touched

- **New**: `supabase/functions/canva-oauth-start/index.ts`, `canva-oauth-callback/index.ts`, `canva-list-folders/index.ts`, `canva-send/index.ts`
- **New**: `src/pages/AdminCanvaConnect.tsx` + route in `App.tsx` + sidebar entry in `AppSidebar.tsx`
- **New**: `src/components/SendToCanvaButton.tsx` (reusable: handles both modes + folder picker dialog)
- **Modified**: `src/pages/Studio.tsx` (add button next to Download)
- **Modified**: `src/pages/History.tsx` (add button in the detail dialog)
- **Migration**: create `app_integrations` table + RLS

