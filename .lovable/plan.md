

# BrandCraft Studio — Rebrand & Feature Enhancement Plan

## Summary
Rebrand from "BrandAdapt AI" to "BrandCraft Studio" and enhance the Studio with campaign inputs and structured output (copywriting + layout guide). Replace `ai-pipeline.ts` with `creative-engine.ts` returning richer structured data.

## Changes

### 1. New file: `src/lib/creative-engine.ts`
- Export `generateBrandCreative(referenceImage, brandId, campaignDetails)` with `campaignDetails: { message: string; targetAudience: string }`
- Simulate 15s with 4 steps matching new labels:
  1. "Analyzing reference creative & extracting design framework..."
  2. "Mapping brand system (colors, logo, typography)..."
  3. "Writing final layout guide and copy..."
  4. "Generating final brand creative..."
- Return structured response: `{ imageUrl, promptUsed, copywriting: { headline, subline, cta }, layoutGuide }`
- Delete old `src/lib/ai-pipeline.ts`

### 2. Update `src/lib/types.ts`
- Update `GenerationStep` to match new 4-step sequence
- Add `CreativeOutput` type for structured response
- Add `CampaignDetails` type

### 3. Update `src/pages/Studio.tsx`
- Add "Campaign Message" and "Target Audience" text inputs to the input section
- Pass campaign details to `generateBrandCreative`
- Output section: below the image, display layout guide text and copywriting (headline, subline, CTA) in clean cards
- Update loading labels to match new step names
- Add "Download Assets" button

### 4. Rebrand across app
- `AppSidebar.tsx`: "BrandAdapt AI" → "BrandCraft Studio"
- `Login.tsx`: Same rename + tagline update
- `Dashboard.tsx`: Update heading text
- `index.html`: Update `<title>`

### 5. Update `src/pages/BrandForm.tsx`
- Add a "Brand Kit PDF" upload field (uploads to existing `brand-assets` bucket)
- Label changes: "Brand Voice & Subject Rules" → "Communication Rules", keep "Never List"

### 6. Database migration
- Add `brand_kit_url` text column (nullable, default `''`) to `brands` table for PDF storage

### 7. No changes needed
- Auth, RLS policies, storage bucket, profiles — all remain as-is
- No new tables required

