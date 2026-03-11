

## Plan: Two-Step AI Pipeline — Analyze Framework, Then Generate

### Problem
Currently, the system does everything in a single AI call: analyze the reference image AND generate the brand creative. This makes the prompt overloaded and the AI often invents logos/assets instead of faithfully using the provided ones. Splitting into two steps gives better results.

### Approach

**Step 1 — Analyze** (text-only model, fast): Use `google/gemini-2.5-flash` to analyze the reference image and produce a structured design framework (JSON) describing layout zones, text placements, color regions, CTA position, visual style, and composition.

**Step 2 — Generate** (image model): Use `google/gemini-3-pro-image-preview` with the structured framework + brand identity + brand assets to generate the final creative. The framework constrains the output so the image model focuses on faithful brand asset placement rather than creative interpretation.

### Edge Function Changes (`generate-creative/index.ts`)

**Step 1 — Framework extraction** (new AI call):
- Send the reference image to `gemini-2.5-flash` with a prompt asking for a structured JSON breakdown:
  - Layout grid (header zone, hero zone, CTA zone, logo placement zone)
  - Text elements (headline position, subtext position, CTA text position)
  - Visual style (photography style, gradient usage, overlay type)
  - Color distribution percentages
  - Composition notes (symmetry, focal point)
- Use tool calling to enforce structured JSON output.

**Step 2 — Brand creative generation** (existing AI call, improved):
- Pass the extracted framework as detailed text instructions to the image generation model.
- Include all brand assets as image inputs (unchanged).
- The system prompt now says: "Follow this EXACT layout framework" + the JSON, rather than "analyze the reference image" — removing ambiguity.
- The reference image is still passed for visual style reference, but the framework text drives the structure.

### Updated Generation Flow
```text
Reference Image
      │
      ▼
┌─────────────────────┐
│  Step 1: Analyze     │  gemini-2.5-flash (text)
│  → JSON Framework    │  ~5 seconds
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Step 2: Generate    │  gemini-3-pro-image-preview
│  Framework + Brand   │  ~30 seconds
│  Assets + Colors     │
└─────────┬───────────┘
          │
          ▼
   Brand Creative
```

### Framework Schema (extracted in Step 1)
```json
{
  "layout": {
    "orientation": "landscape",
    "zones": [
      { "name": "logo", "position": "top-left", "size": "small" },
      { "name": "headline", "position": "center", "size": "large" },
      { "name": "hero_image", "position": "right-half", "size": "half" },
      { "name": "cta_button", "position": "bottom-center", "size": "medium" }
    ]
  },
  "style": {
    "background_type": "gradient",
    "photography_style": "lifestyle",
    "overlay": "dark-gradient-bottom",
    "mood": "professional and energetic"
  },
  "text_elements": [
    { "type": "headline", "content_description": "Main value proposition", "font_style": "bold sans-serif" },
    { "type": "subtext", "content_description": "Supporting detail", "font_style": "light" },
    { "type": "cta", "content_description": "Action button text", "font_style": "bold uppercase" }
  ]
}
```

### Studio.tsx Changes
- Update progress steps to reflect the two-phase process:
  - 10-40%: "Analyzing reference layout..."
  - 40-100%: "Generating brand creative..."
- Optionally show the extracted framework as a collapsible detail in the output section.
- Store the framework JSON in the `layout_guide` column of the `generations` table.

### Database Changes
None required — `layout_guide` column already exists on `generations` and can store the framework text.

### Benefits
- The image model gets precise structural instructions instead of trying to simultaneously analyze and create.
- Brand assets (logos, product photos) are more faithfully placed because the model knows exactly WHERE each element should go.
- The framework can be reused: generate multiple format variations from the same analysis

<lov-plan>

## Plan: Two-Step AI Pipeline — Analyze Framework, Then Generate

### Problem
Currently, the system does everything in a single AI call: analyze the reference image AND generate the brand creative. This overloads the prompt and the AI often invents logos/assets instead of faithfully using the provided ones. Splitting into two steps produces better results.

### Approach

**Step 1 — Analyze** (text-only model, fast): Use `google/gemini-2.5-flash` to analyze the reference image and produce a structured design framework describing layout zones, text placements, visual style, and composition.

**Step 2 — Generate** (image model): Use `google/gemini-3-pro-image-preview` with the structured framework + brand identity + brand assets. The framework constrains the output so the image model focuses on faithful brand asset placement.

### Updated Flow
```text
Reference Image
      │
      ▼
┌─────────────────────┐
│  Step 1: Analyze     │  gemini-2.5-flash (text-only)
│  → Design Framework  │  ~5 seconds
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Step 2: Generate    │  gemini-3-pro-image-preview
│  Framework + Brand   │  ~30 seconds
│  Assets + Colors     │
└─────────┬───────────┘
          │
          ▼
   Final Brand Creative
```

### Edge Function Changes (`generate-creative/index.ts`)

**New Step 1 — Framework extraction:**
- Call `gemini-2.5-flash` with the reference image and a prompt to return a structured design breakdown using tool calling:
  - Layout zones (logo position, headline zone, hero image zone, CTA zone)
  - Visual style (background type, photography style, overlays, mood)
  - Text elements (headline, subtext, CTA — their positions and font styles)
  - Composition notes (symmetry, focal point, whitespace usage)

**Modified Step 2 — Generation with framework:**
- The system prompt now says "Follow this EXACT layout framework" + the extracted framework, instead of "analyze the reference image."
- The reference image is still passed for visual style context, but the framework text drives structure.
- All brand assets passed as image inputs (unchanged).
- Explicit instructions: "Place the logo EXACTLY as provided in the logo zone. Do NOT redraw or reimagine any brand asset."

### Studio.tsx Changes
- Update the progress indicator to show two phases:
  - 10–40%: "Analyzing reference layout..."
  - 40–100%: "Generating brand creative..."
- Store the framework in the `layout_guide` column (already exists on `generations` table).

### No Database Changes Required
The existing `layout_guide` text column on `generations` will store the framework output.

