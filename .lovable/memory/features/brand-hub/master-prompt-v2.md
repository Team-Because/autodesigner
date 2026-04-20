---
name: Master Prompt v2 + Paste & Parse
description: Brand setup unified schema — Master Prompt outputs ## INDUSTRY / ## ASSET TAGS / split VISUAL NEVERS + CONTENT NEVERS, parsed in one shot via Paste & Parse wizard
type: feature
---

The Brand Setup Master Prompt (`src/pages/BrandGuide.tsx`) and BrandForm share one canonical schema:

```
## INDUSTRY              (1 of 10 fixed values)
## BRAND NAME
## COLOR PALETTE         (Primary/Secondary/Extras with hex)
## ASSET TAGS            (1-based, industry-specific vocab)
## BRAND IDENTITY        (1000)
## MUST-INCLUDE ELEMENTS (600)
## VISUAL DIRECTION      (800)
## EXAMPLE COPY          (600)
## TONE & VOICE + ## TARGET AUDIENCE  → voiceRules (1800)
## VISUAL NEVERS         (image prompt only)
## CONTENT NEVERS        (mood derivation + copy only)
```

## Paste & Parse wizard
- `src/components/PasteParseWizard.tsx` — single textarea + Parse button + diff preview.
- Parser at `src/lib/brandParser.ts` extracts industry, brand name, palette (hex), per-asset tags by 1-based index, all brief sections, and split nevers.
- Non-destructive merge: only fills empty fields and untagged assets.

## Split nevers (no migration)
Stored in existing `negative_prompts` text column as:
```
## VISUAL NEVERS
- …
## CONTENT NEVERS
- …
```
- `readNevers` / `writeNevers` in `brandParser.ts` handle round-trip.
- Legacy plain-text rows → `general` bucket, fed to BOTH pipelines (back-compat).
- `splitNevers` in `generate-creative/index.ts` mirrors the read.
- **Image prompt** (`buildDirectivePrompt`, `buildFallbackPrompt`) gets `visual + general`.
- **Mood derivation** (`deriveBrandMoods`) gets `content + general` — so visual rules like "never use stock photography" can't accidentally disqualify the Playful mood.

## Autofill-first UX
`BrandAutofillPanel` accepts `defaultOpen` prop. `BrandForm` passes `defaultOpen={!isEditing}` so new brands land with the AI panel expanded.

## System awareness in Master Prompt
The prompt now tells Claude about: 8-word headline cap, 20-word subcopy cap, layout-only references, force-included logos, allowed output formats, mood-from-tone derivation. Prevents Claude from suggesting things the system can't honor.
