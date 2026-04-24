---
name: Paste & Parse + Setup Guide brand setup
description: Brand setup is intentionally minimal — Paste & Parse wizard plus the editable form on the brand page, and a separate /brand-guide page that hosts the Master Prompt for external LLMs. Autofill panel, mood pool, brand-health badge, best-practices guide, auto-detect industry and re-tag-assets buttons stay removed.
type: feature
---

The Brand Setup form (`src/pages/BrandForm.tsx`) is intentionally simple:

1. `PasteParseWizard` (`src/components/PasteParseWizard.tsx`) at the top — the canonical bulk-fill path.
2. The editable form below: name, industry select, color palette, brand brief sections, voice rules, visual/content nevers, asset gallery.

The `/brand-guide` page (`src/pages/BrandGuide.tsx`) is the OTHER half of the workflow — it hosts the **Master Prompt** users paste into Claude/ChatGPT to convert raw notes into the structured output that Paste & Parse consumes. It is linked from the sidebar as "Setup Guide".

## Removed (do not re-add unless asked)
- `BrandAutofillPanel` (multimodal AI autofill from logo + refs + URL)
- "Brand Setup Best Practices" collapsible guide on the form
- Mood Pool Preview card on the form
- Brand Health badge on the form (still shown on BrandHub cards)
- "Auto-detect industry" button next to Industry select
- "Re-tag all assets with X vocabulary" button under Industry

**Why:** The user wants the brand setup form to be paste-and-parse only — autofill/mood/health were perceived as clutter. The Master Prompt itself lives on its own page so it doesn't bloat the form.

## Master Prompt schema (MUST stay aligned with parser)
The prompt outputs these `## SECTION` headers in this exact order, and `src/lib/brandParser.ts → parseMasterOutput` keys on them:
`## INDUSTRY`, `## BRAND NAME`, `## COLOR PALETTE`, `## ASSET TAGS`, `## BRAND IDENTITY`, `## MUST-INCLUDE ELEMENTS`, `## VISUAL DIRECTION`, `## EXAMPLE COPY`, `## TONE & VOICE`, `## TARGET AUDIENCE`, `## VISUAL NEVERS`, `## CONTENT NEVERS`.
Asset tag bullets must start with "Asset N (Label): tag" (1-based). If you change the prompt headers, update the parser too.

## Paste & Parse pipeline (unchanged)
- Parser at `src/lib/brandParser.ts` extracts industry, brand name, palette (hex), per-asset tags by 1-based index, all brief sections, and split nevers from a Master-Prompt-formatted blob.
- Non-destructive merge in `applyPasteParse`: only fills empty fields and untagged assets.
- Split nevers stored in `negative_prompts` as `## VISUAL NEVERS` / `## CONTENT NEVERS`; `readNevers`/`writeNevers` round-trip them. Legacy plain-text rows go to `general` and feed BOTH pipelines.
