

# Fix: Logo Reliability, Content Isolation, Image Sizing — Without Layout Templates

## Philosophy change from previous plan

No predefined layout templates. The AI already receives a detailed framework from the Analyze step (zones, positions, sizes) and the Adapt step's placement decisions. The problem isn't missing templates — it's that the image model doesn't know WHICH image is the logo, WHICH is the hero, and what role each serves. The fix is better **image labeling** and **prompt clarity**, not layout constraints.

## What stays the same
- Content isolation (reference text bleeding) — same fix
- Image size enforcement — same fix  
- Asset mapping bug fix — already done in last deploy

## What changes from previous plan

**Remove**: `getLayoutTemplate()` function and all hardcoded zone percentages ("left 35%", "top 55%"). These constrain the AI and produce repetitive designs.

**Replace with**: Explicit image labeling in the user content array so the model knows exactly what each image IS, plus cleaner prompt structure that tells the model to follow the reference layout organically.

## Three concrete changes (single file)

### 1. Label each image in the user content array (~line 867-887)

Currently all images are passed as unlabeled `image_url` entries. The model has to guess which is the logo. Fix: add a text label before each image.

```
Current:
  [text instruction]
  [reference image]        ← model doesn't know this is reference
  [asset image]            ← model doesn't know this is a logo
  [asset image]            ← model doesn't know this is a hero render

Fixed:
  [text instruction]
  [text: "IMAGE 1 — REFERENCE (style/layout only, ignore all text in it):"]
  [reference image]
  [text: "IMAGE 2 — BRAND LOGO (must appear in final output, use exactly as-is):"]
  [logo image]
  [text: "IMAGE 3 — HERO VISUAL (main visual element, preserve architecture):"]
  [hero image]
```

Each asset gets labeled with its role from the directive's `selected_assets[].role` field. This is the single biggest fix for missing logos — the model now explicitly sees "this is the logo, use it."

### 2. Simplify the system prompt — remove redundant warnings (~lines 607-714)

The current `buildDirectivePrompt` has ~110 lines with heavy repetition. The content isolation warning appears 4+ times, the size requirement appears 5+ times. This noise drowns out the actual creative direction.

Restructure to:
- **One** content isolation block (5 lines, top of prompt)
- **One** size requirement block (3 lines)
- **Creative Directive** section with copy, colors, asset placements (from Adapt step)
- **Design Direction** section: "Follow the reference image's layout, composition, and visual energy. Adapt it to the brand assets and colors specified above. The reference shows the DESIGN APPROACH — use the same spatial relationships, visual weight distribution, and compositional style."
- **Quality Rules** section: logo fidelity, 3D render preservation, text legibility, deduplication (kept as-is, these are good)
- **Checklist** (condensed to 6 items, not 12)

Total: ~80 lines instead of 110. Not shorter for the sake of shorter — shorter because redundancy is removed.

### 3. Same treatment for `buildFallbackPrompt` (~lines 717-828)

Apply identical labeling and deduplication. The fallback currently has even weaker image role identification.

## What this does NOT change

- No layout templates or zone percentages
- No changes to the Adapt step (it already decides placements organically based on reference)
- No changes to the Analyze step
- No changes to model cascade or API parameters
- The Adapt step's `placement` field (e.g., "top-left corner") still guides placement, but it's decided per-reference, not from a template

## File changed

| File | Change |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Add per-image role labels in user content array; deduplicate system prompt; simplify fallback prompt |

