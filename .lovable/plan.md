
Goal: make aspect ratio handling generic and reliable for every brand, not NAM:TECH-specific.

What I found
- The generation backend already sends strong format signals in `supabase/functions/generate-creative/index.ts`: provider `aspect_ratio`, `size`, `image_size`, plus repeated prompt instructions.
- That means this is probably not a NAM:TECH brand-setup problem.
- The bigger gaps are:
  1. No post-generation validation: whatever the model returns gets saved.
  2. QC does not check aspect ratio at all.
  3. The UI can visually misrepresent correct outputs:
     - `src/pages/History.tsx` and `src/pages/AdminHistory.tsx` hardcode `aspect-[4/3]` and use `object-cover`
     - `src/pages/Studio.tsx` uses landscape-style containers for the reference preview and loading state
- This can look “NAM:TECH-only” because NAM:TECH layouts have strong framed compositions, so cropping/distortion is easier to notice.

Recommended fix
1. Treat output format as stored metadata
- Add format fields to `generations`: `output_format`, `requested_width`, `requested_height`, `requested_aspect_ratio`, `actual_width`, `actual_height`.
- Save the requested format before generation and actual dimensions after generation.

2. Add hard validation in the generation function
- In `supabase/functions/generate-creative/index.ts`, inspect the returned image bytes and extract real width/height from the file header.
- Compare actual dimensions with the selected format spec.
- If they do not match:
  - retry once with the same format spec,
  - if still wrong, return a clear error instead of silently saving the wrong size.
- Do not “fix” this by cropping/resizing after generation; that can break composition and text.

3. Use one canonical aspect-ratio language everywhere
- Keep the provider-native `aspect_ratio` parameter as the main source of truth.
- Standardize all prompt references to only these canonical values: `16:9`, `1:1`, `9:16`, `4:5`.
- Remove ambiguous wording like `1920:1080 LANDSCAPE` from fallback prompts.

4. Extend QC to check ratio compliance
- Add expected format + actual dimensions to the QC review inputs.
- Save aspect-ratio mismatches in QC issues so they become visible in history/debugging.

5. Fix the UI previews
- `src/pages/Studio.tsx`
  - make the loading skeleton match the selected output format
  - stop forcing the uploaded reference into a landscape preview
  - preserve the chosen aspect in the output preview
- `src/pages/History.tsx` and `src/pages/AdminHistory.tsx`
  - remove the hardcoded `4:3` thumbnail wrapper
  - render each image using saved format metadata
  - use format-matched containers or `object-contain` so previews do not fake a ratio issue
  - show a small format badge

Why this is the best approach
- Generic: improves the whole system, not one brand.
- Accurate: enforces ratio at request time and verifies it after generation.
- Debbugable: stores requested vs actual size.
- User-safe: prevents preview cropping from being mistaken for generation failure.

Technical details
- Main backend file: `supabase/functions/generate-creative/index.ts`
- UI files: `src/pages/Studio.tsx`, `src/pages/History.tsx`, `src/pages/AdminHistory.tsx`
- Database: add generation format/dimension columns via migration

Expected result
- If the model returns the correct size, the UI will display it correctly everywhere.
- If the model returns the wrong size, the system will catch it immediately.
- This will tell us clearly whether the issue is true generation non-compliance or just preview distortion.
