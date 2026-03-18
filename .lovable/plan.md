

## Problem Analysis

The current pipeline is: **Analyze Reference → Generate Image → QC → Retry (up to 3x)**

This is wasteful — each retry burns an expensive image generation call, and the root cause is that the generation prompt itself may be poorly assembled. Adding more retries won't fix a fundamentally weak prompt.

## Proposed Solution: Pre-Generation "Creative Brief Review" Step

Insert a new **Step 1.5 — Prompt Refinement** between framework analysis and image generation. A fast text model (Gemini 2.5 Flash) acts as a senior creative director who reviews the assembled prompt, brand context, and framework, then outputs an **optimized generation brief** — catching problems before any image is generated.

### New Pipeline

```text
Step 1: Analyze Reference (existing — extract framework)
     ↓
Step 1.5: Creative Brief Review (NEW — text-only, fast)
  • Input: framework + brand context + assets + format spec
  • AI reviews for: conflicting instructions, missing mandatory elements,
    weak headline/CTA suggestions, color/layout mismatches
  • Output: refined system prompt with specific, actionable directives
     ↓
Step 2: Generate Image (existing — but now uses the refined brief)
     ↓
Step 3: QC (existing — but should need fewer retries)
```

### What the Creative Brief Review Does

1. **Validates brand alignment** — checks that mandatory elements (from `mustInclude`) are explicitly called out in the prompt
2. **Pre-writes headline and CTA copy** — instead of letting the image model improvise text (its weakest skill), the text model drafts specific copy that the image model must render verbatim
3. **Resolves conflicts** — e.g., if the framework says "dark background" but brand guidelines say "light, airy feel", the review resolves this
4. **Strengthens negative constraints** — rewrites vague don'ts into precise, enforceable image directives
5. **Outputs a focused creative direction** — a compact, unambiguous set of instructions replacing the current sprawling system prompt

### Technical Changes

**`supabase/functions/generate-creative/index.ts`**:

1. **New function `refineBrief()`** — Takes framework, brand context, format spec, and asset descriptions. Calls Gemini 2.5 Flash with structured output (tool calling) to return:
   - `headline` (exact text, ≤8 words)
   - `subCopy` (exact text, ≤20 words)  
   - `ctaText` (exact CTA text)
   - `visualDirection` (refined, specific visual instructions)
   - `colorStrategy` (which brand colors go where)
   - `layoutNotes` (how to adapt the framework for this brand)
   - `warnings` (any conflicts or risks identified)

2. **Update `generateCreative()`** — Replace the massive system prompt with a more focused one that incorporates the refined brief's outputs. The headline/subCopy/CTA become **verbatim text requirements** rather than guidelines, dramatically reducing text errors.

3. **Update status flow** — Add a `"refining"` status between `"analyzing"` and `"generating"` so the UI can show progress.

4. **Reduce `MAX_QC_RETRIES` to 1** — With better initial prompts, one retry should suffice for edge cases.

**`src/pages/Studio.tsx`**:
- Add `"refining"` to the progress display (e.g., "Refining creative brief...").

### Cost/Performance Impact

- Adds ~3-5 seconds and one cheap text API call (~$0.001)
- Saves 2-3 expensive image generation retries ($0.02-0.06 each)
- Net result: faster, cheaper, better output

