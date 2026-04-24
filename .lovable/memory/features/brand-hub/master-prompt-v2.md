---
name: Paste & Parse only brand setup
description: Brand setup UI is intentionally minimal — only the Paste & Parse wizard plus the editable form. AI autofill panel, mood pool, brand-health badge, best-practices guide, /brand-guide page, auto-detect industry and re-tag-assets buttons are all removed.
type: feature
---

The Brand Setup form (`src/pages/BrandForm.tsx`) is intentionally simple:

1. `PasteParseWizard` (`src/components/PasteParseWizard.tsx`) at the top — the canonical bulk-fill path.
2. The editable form below: name, industry select, color palette, brand brief sections, voice rules, visual/content nevers, asset gallery.

## Removed (do not re-add unless asked)
- `BrandAutofillPanel` (multimodal AI autofill from logo + refs + URL)
- `/brand-guide` route + `BrandGuide` page (Master Prompt onboarding) and the sidebar "Setup Guide" link
- "Brand Setup Best Practices" collapsible guide on the form
- Mood Pool Preview card on the form
- Brand Health badge on the form (still shown on BrandHub cards)
- "Auto-detect industry" button next to Industry select
- "Re-tag all assets with X vocabulary" button under Industry

**Why:** The user wants the brand setup to be paste-and-parse only — everything else was perceived as clutter.

## Paste & Parse pipeline (unchanged)
- Parser at `src/lib/brandParser.ts` extracts industry, brand name, palette (hex), per-asset tags by 1-based index, all brief sections, and split nevers from a Master-Prompt-formatted blob.
- Non-destructive merge in `applyPasteParse`: only fills empty fields and untagged assets.
- Split nevers stored in `negative_prompts` as `## VISUAL NEVERS` / `## CONTENT NEVERS`; `readNevers`/`writeNevers` round-trip them. Legacy plain-text rows go to `general` and feed BOTH pipelines.
