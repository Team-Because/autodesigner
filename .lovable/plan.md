

## Plan: Multi-Asset Brand Images + Remove PDF Upload

### Summary
Replace the single logo upload with a multi-image asset gallery per brand, remove the PDF upload option, and pass all brand assets to the AI generation engine.

### Database Changes

**New table: `brand_assets`**
```sql
CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  label text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as brands)
CREATE POLICY "Users can view their own brand assets" ON public.brand_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own brand assets" ON public.brand_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brand assets" ON public.brand_assets FOR DELETE USING (auth.uid() = user_id);
```

Also remove the `brand_kit_url` column from `brands` since PDF upload is being removed:
```sql
ALTER TABLE public.brands DROP COLUMN IF EXISTS brand_kit_url;
```

### BrandForm.tsx Changes
1. **Remove** the entire Brand Kit PDF upload section and related state (`brandKitUrl`, `brandKitName`, `handleBrandKitUpload`).
2. **Replace** single logo upload with a multi-image uploader:
   - Show a grid of uploaded asset thumbnails with optional label and delete button.
   - "Add Image" button uploads to `brand-assets` storage and inserts a row into `brand_assets` table.
   - On edit, fetch existing assets from `brand_assets` where `brand_id = id`.
   - Keep `logo_url` on the `brands` table — the first uploaded image (or user-designated) serves as the logo/thumbnail shown in Brand Hub cards.
3. Update `handleSubmit` to no longer include `brand_kit_url` in the payload.
4. Update the brief section helper text to remove mention of "replaces or supplements a brand kit PDF".

### Edge Function Changes (`generate-creative/index.ts`)
1. After fetching the brand, also query `brand_assets` for all images belonging to that brand:
   ```ts
   const { data: assets } = await supabase
     .from("brand_assets")
     .select("image_url, label")
     .eq("brand_id", brandId);
   ```
2. Include ALL asset images in the `userContent` array sent to the AI model, each as an `image_url` content part.
3. Update the system prompt to describe the role of each image:
   - First image = reference ad to analyze for layout
   - Remaining images = brand assets (logo, product photos, building shots, mascots, etc.) to incorporate into the creative
4. Remove the single `logo_url` image logic; the logo is now just one of the brand assets.

### Studio.tsx Changes
- No structural changes needed — the Studio already sends `brandId` to the edge function, which will now automatically fetch all assets.

### Types Update (`src/lib/types.ts`)
- Remove `brand_kit_url` from the `Brand` interface.
- Add a `BrandAsset` interface: `{ id, brand_id, image_url, label, created_at }`.

