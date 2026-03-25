

# Quality Audit: 10+ Generations Reviewed + Improvement Plan

## What I Found Across 15+ Generations

### Pattern 1: Reference Text Leaking Into Framework (Critical)

The Step 1 framework extraction captures **exact reference text** — "AEON & TRISL", "ESTD 2008", "Imtiaz Sales Centre, Dubai Hills Estate", "Saturday 1st November 2025", "RANKED NO.1 AGENCY OF DUBAI". While `sanitizeFramework()` tries to clean this, it's incomplete:

- `text_elements[].content_description` gets replaced with generic labels like "headline text" — this works
- `composition_notes` still leaks reference brand names (only strips quoted text, not inline mentions)
- Zone descriptions like "IMTIAZ DEVELOPMENTS logo" become "brand logo zone" — this works
- BUT the sanitized framework still includes structural references to reference-specific elements like "event_details_card" and "secondary_logo" zones — these reference concepts (an open house event with date/time/location) bleed through as structural expectations

**Impact**: The image model sometimes recreates reference-specific UI elements (event cards, date boxes) even though the text is changed to brand content.

### Pattern 2: Copy is Repetitive Across Generations (Moderate)

All 15 Kalrav Treasure generations produced variations of the same 4-5 headlines:
- "Own Space. Refined Living."
- "Where Future Addresses Begin"
- "Prime Location. Proven Potential."
- "Own Your Treasure"
- "Space Near Ahmedabad's Finest"

The Adapt step always sources from the same brand brief, producing similar copy regardless of reference style. A lifestyle-focused reference and a formal corporate reference both get the same "premium plots" messaging.

### Pattern 3: Reference Structural Concepts Override Brand Context (Critical)

When the reference is a luxury real estate "Open House" invitation (dark blue, sunset, yacht), the framework captures zones like `event_details_card`, `secondary_logo`, and `footer_bar`. The Adapt step tries to map these to brand content, but the image model still generates event-card-like UI elements, date boxes, or partner logo zones that don't belong in the brand's creative.

The framework is too reference-specific — it describes WHAT the reference IS rather than extracting reusable DESIGN PRINCIPLES.

### Pattern 4: Failed Generations Show QC Was Working (Informational)

The Meevaa Foods failures reveal a QC step was catching real issues: wrong aspect ratio, wrong product shown, missing CTAs, stock-looking imagery. These are legitimate quality issues the image model produces. The QC step appears to have been removed or bypassed — generations now just pass through without validation.

### Pattern 5: Same Reference Used Repeatedly

Multiple generations use the exact same reference image (the AEON & TRISL open house ad was used 10+ times). This suggests the user is testing with limited references, but also means the system should produce MORE variety from the same reference.

---

## Root Causes

1. **Framework is too literal** — It describes reference content ("AEON & TRISL logo", "event with date/time"), not abstract design principles ("brand mark zone at top-center", "information card with 3 data points")
2. **Sanitization happens too late** — Framework is extracted with content, then partially cleaned. Better to instruct the analyzer to extract content-agnostic structure from the start
3. **No copy variation mechanism** — Each generation independently produces copy from the same brief, with no seed/variation prompt
4. **No structural abstraction** — Zone names like `event_details_card` and `secondary_logo` carry semantic meaning that biases the image model toward recreating reference-specific elements

## Improvement Plan

### Fix 1: Rewrite Analyze Step Prompt for Abstract Extraction

Change the Step 1 system prompt to explicitly instruct: "Describe layout zones by their DESIGN ROLE (hero visual, text block, information strip, accent element), NOT by their content. Never mention brand names, locations, dates, or product types from the reference."

Add to the tool schema: a `zone_type` enum (hero_visual, text_block, accent_strip, brand_mark, information_grid, footer_bar, background) so zones are categorized abstractly.

### Fix 2: Stronger Sanitization as Safety Net

Even with better extraction, sanitize more aggressively:
- Strip ALL proper nouns from `composition_notes` (not just quoted text)
- Replace zone names that contain reference-specific concepts (`event_details_card` → `info_grid`, `secondary_logo` → `partner_mark`)
- Remove `text_elements[].content_description` entirely (the Adapt step generates its own copy anyway)

### Fix 3: Add Copy Variation to Adapt Step

Add a `variation_seed` instruction to the Adapt step:
- "Generate copy that matches the MOOD of the reference (formal/playful/bold/minimalist), not just brand USPs"
- Include a random variation hint: "Creative direction: [energetic/contemplative/bold/sophisticated]" — rotated per generation
- This produces different copy angles from the same brief

### Fix 4: Zone Name Normalization

Before passing framework to Steps 2 and 3, normalize all zone names to a fixed vocabulary:
```
background, brand_mark, headline, subcopy, hero_visual, 
supporting_visual, info_strip, cta, footer, accent
```
This prevents reference-specific zone semantics from leaking through.

### Fix 5: Re-enable QC as Warning (Not Blocker)

The QC step caught real issues but was probably removed because it caused too many failures. Re-add it as a non-blocking quality check that:
- Stores QC score + issues in `copywriting` JSON alongside the caption
- Never blocks generation (always saves the output)
- Surfaces quality warnings in the History detail dialog so users know what to watch for

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Rewrite analyzeFramework prompt for abstract extraction, stronger sanitization, zone normalization, copy variation seed, optional QC step |
| `src/pages/History.tsx` | Show QC score/warnings in generation detail dialog (if present) |

## What This Does NOT Change

- No database schema changes
- No changes to model selection or cascade
- Credit system unchanged
- Brand brief structure unchanged
- Asset selection logic unchanged (the multimodal adapt step from last change stays)

