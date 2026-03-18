

## Plan: Add 4:5 Ratio, Enforce Exact Ratio Output, and Add QC Step

### Three changes:

---

### 1. Add 4:5 (Portrait) format option

**Studio UI (`src/pages/Studio.tsx`):**
- Add `"portrait"` to the `OutputFormat` type
- Add a new entry to `FORMAT_OPTIONS`: `{ value: "portrait", label: "Portrait", description: "1080×1350 · Instagram Feed, Pinterest", icon: RectangleVertical, aspect: "aspect-[4/5]" }`
- Import `RectangleVertical` from lucide-react
- Change the grid from `grid-cols-3` to `grid-cols-4` (or `grid-cols-2 sm:grid-cols-4`) to fit 4 options

**Edge function (`supabase/functions/generate-creative/index.ts`):**
- Add `portrait: { width: 1080, height: 1350, label: "portrait (1080×1350, 4:5)" }` to `FORMAT_SPECS`

---

### 2. Enforce exact ratio in generated output

The prompt already has strong ratio enforcement text. To make it even stricter:

**Edge function — strengthen the system prompt:**
- Add an explicit `ASPECT RATIO: 4:5` (or whichever) label alongside the pixel dimensions
- Add to the generation checklist: "The canvas aspect ratio is exactly X:Y — verify by checking that width/height = X/Y"
- Pass `aspect_ratio` parameter in the AI request body alongside `size` and `image_size` for models that support it

---

### 3. Add QC (Quality Check) step after generation

Add a **post-generation AI QC pass** that analyzes the generated image and checks it against brand rules before returning it to the user.

**Edge function — new `qualityCheck()` function:**
- After `generateCreative()` returns an image, call a fast model (gemini-2.5-flash) to analyze the output
- The QC prompt checks:
  - Correct aspect ratio (is it actually the requested ratio?)
  - Logo visibility and contrast
  - Text legibility and no duplication
  - Brand color usage
  - Mandatory elements present
  - No banned elements from negative prompts
  - Overall composition quality
- Returns a structured JSON: `{ passed: boolean, issues: string[], score: number }`
- If QC fails with critical issues (wrong ratio, missing logo, unreadable text), auto-retry generation once with the QC feedback appended to the prompt
- Store QC results in the `copywriting` JSON field alongside the caption (e.g., `{ caption: "...", qc: { passed: true, score: 92, issues: [] } }`)

**Studio UI (`src/pages/Studio.tsx`):**
- Add a "Quality Checking..." progress phase after generation
- Show QC badge (pass/fail) on the result card

**History page (`src/pages/History.tsx`):**
- Show QC score/badge in generation cards and detail dialog

---

### File changes summary

| File | Change |
|------|--------|
| `src/pages/Studio.tsx` | Add 4:5 format option, QC progress phase, QC badge on result |
| `supabase/functions/generate-creative/index.ts` | Add portrait to FORMAT_SPECS, add `qualityCheck()` function called after generation, strengthen ratio enforcement in prompt, auto-retry on QC fail |
| `src/pages/History.tsx` | Show QC score/badge in cards and detail dialog |

