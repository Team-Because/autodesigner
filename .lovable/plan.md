

# Fix: Logo Not Appearing — Root Cause & Solution

## The Problem

Three distinct failure modes happening:

1. **Model writes the word "LOGO"** instead of rendering the actual logo image
2. **Model copies the reference image's logo** instead of using the brand's logo asset
3. **Model ignores the logo entirely**

## Root Cause

The image generation model (Gemini Flash Image Preview) is a **generative** model, not a **compositing** tool. When you pass it a logo as an `image_url` and say "place this exactly as-is," it tries to **redraw** the logo from scratch. It often fails because:

- It doesn't understand "reproduce this image pixel-perfectly" — it generates new pixels
- The prompt says "NEVER redraw" but the model literally can only redraw
- With multiple images (reference + 2-4 assets), the model gets confused about which image to prioritize
- The reference image's logo is visually prominent and the model latches onto it

## The Fix — Two Changes

### 1. Strengthen logo instructions in the system prompt

The current prompt says "use EXACTLY as provided" — but doesn't give the model enough visual anchoring. Change to:

- Tell the model to **reproduce the logo's exact shape, colors, letterforms, and proportions** from the labeled logo image
- Add explicit instruction: "The logo is IMAGE N. Study its exact visual appearance — every letter, shape, color, symbol. Reproduce it faithfully in the output."
- Remove generic "NEVER redraw" (contradictory — it HAS to redraw, it's generative) and replace with "faithfully reproduce"

### 2. Reduce image overload — pass logo as the FIRST asset image (right after reference)

Currently the order is: reference → assets in directive order. The model gives more attention to images earlier in the sequence. Ensure the logo is always IMAGE 2 (immediately after reference) regardless of directive ordering. This is already partially done by the force-inclusion at index 0, but the `userContent` building loop iterates `directive.selected_assets` in order — which may not put logo first if the directive ordered it differently.

**Change in `generateCreative()`** (~line 874-907):
- Sort `directive.selected_assets` so `role === "logo"` comes first before building `userContent`
- In the label text, for logo specifically: "Study this logo carefully — reproduce its exact letterforms, colors, shapes, and proportions in the final output"

### 3. In `buildDirectivePrompt` — rewrite LOGO RULES section

Replace the current logo rules (lines 646-655) which focus on contrast/backing with rules that focus on **visual fidelity**:

```
LOGO RULES:
- The logo is provided as a separate image. Study it carefully.
- Reproduce the logo's EXACT letterforms, icon shapes, colors, and proportions
- Place it at the specified location with appropriate sizing
- Ensure contrast: on dark backgrounds add a light backing panel, on light backgrounds use as-is
- The logo from the REFERENCE image is NOT your brand's logo — ignore it completely
```

## File Changed

| File | Change |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Reorder assets to put logo first in userContent; strengthen logo label text; rewrite LOGO RULES in directive prompt; same treatment in fallback prompt |

## What This Does NOT Change

- No layout templates or constraints
- No changes to Analyze or Adapt steps
- No model changes
- Asset selection logic stays the same

