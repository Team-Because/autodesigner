

# Fix: Reference Content Leaking via Framework + Logo Reliability

## Root Cause Found

The 3-step pipeline is architecturally correct, but there's a critical data leak: **the raw framework JSON from Step 1 is passed directly to Step 3** (line 644 in `buildDirectivePrompt`, line 738 in `buildFallbackPrompt`).

The framework contains reference-specific content like:
- `text_elements[].content_description`: "Text says AED 1.2M starting price"  
- `zones[].description`: "Shows Abu Dhabi skyline with luxury villa"

The image model sees BOTH the directive (brand content) AND the raw framework (reference content) — and gets confused, sometimes rendering the reference's text.

## Two Changes

### 1. Sanitize framework before passing to Step 3

Create a `sanitizeFramework()` function that strips content descriptions while preserving structural/design info:

- `zones[].description` → replaced with generic role (e.g., "hero visual zone", "text zone")
- `text_elements[].content_description` → replaced with role label (e.g., "headline text", "CTA text") 
- Keep: `position`, `size`, `font_style`, `approximate_size`, `style.*`, `composition_notes` (structural)
- Strip: any field that describes WHAT the reference shows content-wise

This means the generation model sees "there's a headline at top-center, bold, extra-large" but NOT "the headline says Luxury Villa in Abu Dhabi."

### 2. Strengthen logo handling in the Adapt step

The Adapt prompt says "Always include ONE logo if available" but doesn't enforce it strongly enough. Add:
- If brand has a logo asset, the Adapt step MUST select it as index 0
- Add a post-processing check: if no logo was selected but one exists in assets, force-add it

## File changed

| File | Change |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Add `sanitizeFramework()`, apply it before `buildDirectivePrompt` and `buildFallbackPrompt`; add logo force-inclusion in Adapt post-processing |

## What this preserves

- No layout templates or constraints
- The AI still derives layouts organically from the reference
- All design language (fonts, styles, composition) flows through from reference
- The Adapt step still makes all creative decisions

