

# Remove Character Limits Across Brand Setup

Different brands need different amounts of detail. Hard limits cause silent truncation in `parseMaster`, the autofill edge function, and form `maxLength` props. We'll remove the user-facing caps everywhere and apply only soft compaction inside the AI generation prompt (where token cost actually matters).

## Strategy

**Remove all hard limits on user input.** Keep only generous internal compaction *inside the generator's LLM calls* — and even those are raised significantly so longer briefs survive intact.

```text
USER FORM      → no limit (just live char counter for awareness)
DB STORAGE     → already TEXT (no schema change needed)
PARSER         → no .slice() truncation
AUTOFILL EDGE  → no clamp() truncation; updated tool descriptions
GENERATOR      → soft caps raised: brief 8000, voice 4000, nevers 2000
MASTER PROMPT  → "char hard limit" labels removed; replaced with priority guidance
```

## Changes

### 1. `src/pages/BrandForm.tsx` — drop `maxLength` and inline length checks
- Remove `maxLength={...}` from: `briefIdentity` (1000), `briefMandatory` (600), `briefVisual` (800), `briefCopy` (600), `voiceRules` (1800), `visualNevers` (600), `contentNevers` (600), `legacyNevers`.
- Remove the `if (e.target.value.length <= N)` guards in those `onChange` handlers — let users type freely.
- Replace `{x}/N — …` counters with simple `{x} chars — …` (no denominator, no amber threshold).
- Keep `Brand Name` (100) and `Color Name` (30) caps — those are legitimate UI constraints, not content.

### 2. `src/lib/brandParser.ts` — drop `.slice()` calls
- In `parseMasterPromptOutput` return object: remove all `.slice(0, N)` on `briefIdentity`, `briefMandatory`, `briefVisual`, `briefCopy`, `voiceRules`, `visualNevers`, `contentNevers`. Keep only `extras.slice(0, 8)` (UI swatch limit).

### 3. `supabase/functions/brand-autofill/index.ts` — drop clamping
- Remove the `clamp(v, max)` helper and use raw strings.
- Update tool schema descriptions: remove "Max N chars" phrases; instead say "Be thorough but focused — quality over length."
- Drop the `.slice(0, 2500)` / `.slice(0, 3500)` on website extracts (or raise to 10000) so site-derived context isn't truncated before reaching the LLM.

### 4. `supabase/functions/generate-creative/index.ts` — raise compaction caps generously
The generator must still bound prompt size for cost/latency, but current caps (1800/3000) are too tight for rich brands. New caps:
- `brand_brief` → **8000** (was 3000) in both `buildPromptParts` and `buildFallbackPrompt`
- `brand_voice_rules` → **4000** (was 1800/2000)
- `nevers.visual` / `nevers.content` → **2000** each (was 600)
- `nevers.general` → **3000** (was 1200)
- `negativePrompts` combined in image prompt → **3000** (was 800/2000)

These are still safety nets — typical brands stay under them — but they no longer cut off legitimate content.

### 5. `src/pages/BrandGuide.tsx` — Master Prompt v3
Rewrite the `MASTER_PROMPT` constant to remove all "← N char hard limit" annotations. Replace with priority guidance:

```text
## BRAND IDENTITY            ← Be thorough; cover what makes the brand unique
## VISUAL DIRECTION          ← MOST CRITICAL — describe in as much detail as you need
## EXAMPLE COPY              ← 3-5 strong headlines beat 10 mediocre ones
…
```

Also update the "SYSTEM AWARENESS" footer:
- Remove rule #6 ("Character limits are enforced — stay under budget").
- Add: "Length is flexible — write what the brand actually needs. Specificity beats brevity."
- Keep the 8-word headline / 20-word subcopy / 2-3 word CTA caps (those are real downstream constraints).

### 6. Memory update
Update `mem://features/brand-hub/brief-structure` to reflect the removal of hard limits and the new generous compaction policy.

## What stays the same

- Database columns are already `TEXT` — no migration needed.
- 8-word headline / 20-word subcopy caps remain (real generator constraints).
- Brand name (100), Color name (30), Asset label (50) keep their caps — pure UI hygiene.
- Compaction inside the generator stays as a *safety ceiling*, not a content limit.

## Why this works

Soft caps far above realistic brand-brief size mean: (a) users never see truncation in the form, (b) the parser preserves full Claude output, (c) the edge function passes everything through, and (d) the generator only trims if a brand is truly enormous (8000+ char brief is ~2000 words — most aren't close).

