

## Diagnosis

Looking at the edge function logs, the **Adapt step is working well** — it produces correct directives (right headline, colors, product, CTA). The problem is downstream: the **image generation model ignores most of the directive**. The QC then correctly reports all the mismatches, producing low scores.

Root causes:
1. **Generation prompt is too long and rule-heavy** (~35 lines of system prompt). Image models respond better to short, visual descriptions — not numbered rule lists.
2. **Too many competing instructions** — aspect ratio enforcement, color hex codes, text rendering rules, asset handling, warnings — the model picks up some and drops others.
3. **Brand context is dumped as raw text** in the adapt step, which then tries to compress it into a directive. The rendered brief format works, but the generation prompt reassembles it poorly.

## Plan: Simplify Generation, Strengthen Adapt

### 1. Rewrite the generation prompt (biggest impact)

Replace the current ~35-line system prompt with a **short, visual-first prompt** (~12 lines). Key changes:
- Lead with the visual description (hero, mood, composition) — this is what image models are best at
- Put text elements (headline, CTA) as simple overlay instructions at the end
- Remove numbered rules — fold critical constraints into natural language
- Remove warnings section from the prompt entirely

### 2. Give the Adapt step the reference image directly

Currently, adapt only sees the extracted framework JSON. Give it the **actual reference image** too, so it can make better visual decisions (e.g., "the reference has warm lighting and a close-up food shot — keep that approach but swap the product").

### 3. Make QC skippable (default: skip)

Add `skipQC: true` as the default. QC only runs if explicitly requested. This saves one API call per generation (~5-8 seconds) and removes the score anxiety. The QC code stays for when you want it.

### 4. Streamline brand context in the adapt prompt

Instead of dumping the full rendered brief as a wall of text, structure the brand context into clearly labeled short blocks: `IDENTITY:`, `MUST-INCLUDE:`, `VISUAL:`, `VOICE:`, `DO:`, `DON'T:`, `COLORS:`. This maps directly to the BrandProfileSections fields and is easier for the model to parse.

## Files Changed

**`supabase/functions/generate-creative/index.ts`:**
- Rewrite `generateCreative()` system prompt — short, visual-first, ~12 lines
- Update `adaptToBrand()` to accept and pass the reference image
- Update `adaptToBrand()` to format brand context as labeled short blocks
- Default `skipQC = true` in main handler, skip the QC call unless overridden
- Remove QC from response payload (already hidden from UI)

**`src/pages/Studio.tsx`:**
- Remove the `quality_checking` status from progress display (since QC is skipped by default)

