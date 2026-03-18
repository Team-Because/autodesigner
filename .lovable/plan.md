

## Current vs Proposed Pipeline

**Current (3 steps):**
Analyze → Generate → Advisory QC (post-generation, non-blocking)

**Problem:** The generation prompt is assembled mechanically — framework JSON + brand context dumped together. No "thinking" happens. QC runs after the image exists, so it can only report problems, not prevent them.

**Proposed (4 steps):**

```text
1. Analyze    — Extract framework from reference (unchanged)
2. Adapt      — Text model "thinks": maps framework zones to brand elements,
                 writes exact copy, resolves conflicts, picks color strategy
3. Pre-flight — Validate the adapted brief covers all mandatory elements
                 (same call as step 2, structured output includes warnings)
4. Generate   — Image model receives a clean, specific creative directive
```

Steps 2+3 happen in a single fast text-model call (~3s). The key difference from the old "Creative Director" approach: this is simpler — one call that outputs a **creative directive** (not a "refined brief" with product extraction heuristics).

## What the Adapt Step Does

A single Gemini 2.5 Flash call that takes:
- The framework (layout zones, style, text elements)
- The full brand context (brief, colors, assets, voice, do's/don'ts)
- The output format spec

And returns a structured **Creative Directive**:
- `headline` — exact text to render (≤8 words)
- `subCopy` — exact supporting text (≤15 words)  
- `ctaText` — exact CTA text
- `logoPlacement` — where and how big
- `colorMap` — which brand color goes where (background, accents, text)
- `heroDescription` — what the main visual should show
- `layoutAdaptation` — how to recompose the reference zones for the target ratio
- `warnings` — any conflicts found (e.g., reference is landscape but output is portrait)

This becomes the generation prompt — specific, unambiguous instructions rather than dumping raw JSON.

## What Changes

**`supabase/functions/generate-creative/index.ts`:**
1. New `adaptToB rand()` function — single text-model call with structured output
2. Updated `generateCreative()` — receives the creative directive instead of raw framework + brand dump; system prompt becomes ~50% shorter and more specific
3. Advisory QC stays as-is (post-generation, non-blocking) but should trigger less often since the input is better
4. New `"adapting"` status between analyzing and generating

**`src/pages/Studio.tsx`:**
- Add `"adapting"` to progress display ("Adapting to your brand...")

## Why This Is Different From the Old "Creative Director"

The previous version had: product extraction heuristics, brief mutation on retry, QC-driven blocking loops, and multiple competing prompt sections. This version is one clean function call that outputs a structured directive — no heuristics, no loops, no blocking.

