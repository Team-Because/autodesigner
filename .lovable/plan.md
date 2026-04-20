

# Master Prompt Audit + Brand Setup Improvement Strategy

## What I reviewed

The Master Prompt at `src/pages/BrandGuide.tsx` (the one users paste into Claude), the `BrandForm` schema it must map into, the `brand-autofill` edge function, and how `generate-creative` actually consumes brand data.

The audit is split into two parts: **(A) concrete bugs/mismatches in the current Master Prompt**, and **(B) a strategic redesign** of how brand setup should work end-to-end.

---

## A. Issues found in the current Master Prompt

### A1. Schema drift between Prompt → Form → Generator (HIGH)
The Master Prompt outputs **8 sections** (Brand Name, Brand Assets Guide, Color Palette, Brand Brief – Identity, Must-Include, Visual Direction, Example Copy, Tone & Audience, Never List). But the form has **only 4 brief textareas + 2 separate fields** (voice/negative). Mapping today:

| Master Prompt section | Where it lands |
|---|---|
| BRAND NAME | Name field ✅ |
| BRAND ASSETS GUIDE | **Nowhere** — silently dropped, only useful as Q&A guidance |
| COLOR PALETTE | Primary/Secondary/Extra ✅ but "color relationships" prose has no home |
| BRAND IDENTITY | briefIdentity ✅ |
| MUST-INCLUDE | briefMandatory ✅ |
| VISUAL DIRECTION | briefVisual ✅ |
| EXAMPLE COPY | briefCopy ✅ |
| TONE & TARGET AUDIENCE | voiceRules ✅ |
| THE NEVER LIST | negativePrompts (mixed visual+content) ⚠️ |

**Issue**: The "Where to Paste" table in BrandGuide.tsx is misleading — it claims TONE → "Brand Voice Rules" but doesn't tell users to paste both Tone AND Target Audience together, and doesn't mention Industry, Logo upload, or asset tagging at all.

### A2. Industry field is invisible to the prompt (HIGH)
The form has an **Industry dropdown** (10 industries) that drives asset tag vocabulary downstream. The Master Prompt never asks the LLM to declare an industry, so users land on the form with an empty Industry → wrong/generic asset tags get suggested.

### A3. Asset tag vocabulary mismatch (HIGH)
The Prompt's "BRAND ASSETS GUIDE" uses generic categories (Hero Image, Product, Lifestyle, Pattern/Texture, Banner, Infographic, Style Reference). The actual app uses **industry-specific** vocab (Real Estate → Elevation/Interior/RERA QR; Fashion → Lookbook/On-Model/Flat Lay; etc.). A user pasting Claude's output sees tag names that don't exist in the dropdown, then has to re-tag everything manually.

### A4. The Never List is one bucket, not two (MEDIUM)
The Prompt cleanly splits VISUAL NEVERS vs CONTENT NEVERS (good!). The form collapses both into a single `negative_prompts` text field. The downstream `deriveBrandMoods` and the image prompt both treat negatives as one blob — losing the visual/content distinction and weakening mood filtering.

### A5. No mention of "the rest of the system" (MEDIUM)
The Prompt produces an excellent profile but doesn't tell the LLM about behaviors that exist in the generator:
- Reference images = layout-only (Image Isolation policy)
- Logo is force-included via regex
- Headlines capped at 8 words, subcopy at 20
- Per-brand mood derivation
- Allowed output formats (1:1, 16:9, 9:16, 4:5)

Result: LLMs sometimes propose taglines >8 words or "we'll generate matching photography from references" — instructions the system can't honor.

### A6. Character limits are aspirational, not enforced (LOW)
The Prompt says "HARD LIMIT: 1,000 chars" for Identity etc. — the form actually enforces these via `maxLength`, but Claude routinely overshoots and the form silently truncates on paste. Users don't know what was lost.

### A7. The Q&A intro creates an unnecessary roundtrip (LOW)
"Ask 10-15 clarifying questions FIRST" works for power users, but most users don't have answers ready. They abandon mid-flow. This step should be optional / opt-in, not mandatory.

### A8. Missing "Brand Voice Vocabulary" guidance (LOW)
Multiple memory files (LION, Belrosa, RFL) rely on **"words to use vs words to avoid"** lists. The Prompt's TONE section asks for "Language Rules" but doesn't enforce a use/avoid list structure → form ends up with prose that's hard for the AI to act on.

---

## B. Strategic redesign — make brand setup easy, not painful

The fundamental problem: brand setup is a **3-headed beast** today (Master Prompt → Claude → manual paste, AI Autofill panel, manual form). Three paths, different vocabularies, no single source of truth.

### B1. Unify the schema first
Make the Master Prompt, BrandForm fields, and `brand-autofill` tool schema all emit the **exact same section names and limits**. The parser already handles synonyms, but the canonical shape should be:

```
## BRAND IDENTITY            (1000)
## INDUSTRY                  (1 line, from fixed list)
## COLOR PALETTE             (structured: primary/secondary/extras with names)
## ASSET TAGS                (per-asset, from industry vocab)
## VISUAL DIRECTION          (800)
## TONE & VOICE              (use-words + avoid-words + audience)
## EXAMPLE COPY              (600)
## MUST-INCLUDE ELEMENTS     (600)
## VISUAL NEVERS             (separated)
## CONTENT NEVERS            (separated)
```

### B2. Rewrite the Master Prompt to match
- Add a step that asks Claude to **declare the industry first** from the 10 allowed values.
- Replace the generic asset categories with the industry-specific vocab (insert dynamically based on chosen industry).
- Split Never List into two sections.
- Add "TONE & VOICE" with explicit `Use words:` / `Avoid words:` lists.
- Add a "SYSTEM AWARENESS" footer telling Claude: 8-word headlines, 20-word subcopy, layout-only references, logo always preserved, etc.
- Make the Q&A step **optional** ("If you want a deeper interview, ask me 5-8 questions first; otherwise proceed.").

### B3. Add a "Paste & Parse" wizard inside the app
Instead of pasting into 4 separate textareas, give users **one big textarea** + a **"Parse Master Prompt Output"** button. The parser already exists (`parseBrief`). Extend it to also extract Industry, Color Palette (with hexes), Asset Tags. Show a **visual diff** of what was extracted before saving — so users can see "we caught Industry=Real Estate, 3 colors, 5 asset tags".

### B4. Split Visual vs Content Nevers in the form + DB
Either two new columns (`visual_nevers`, `content_nevers`) or a JSON shape `{visual: [...], content: [...]}` in the existing `negative_prompts`. Update `deriveBrandMoods` to weight **content nevers** when filtering moods, and `buildDirectivePrompt` to inject **visual nevers** into the image prompt only.

### B5. Add Brand Health Score on save
Compute a 0-100 score based on: has logo? ≥3 tagged assets? brief sections filled? colors set? voice rules present? Show it as a chip on the BrandForm header and Brand Hub card. Soft-blocks generation below ~40 with a "Your brand is thin — generations will be generic" warning.

### B6. Make Autofill the default new-brand experience
Today, the AI Autofill panel sits collapsed at the top of BrandForm — most users miss it. Promote it: when "New Brand" is clicked with zero data, open in autofill mode by default with the panel expanded and the manual form hidden until autofill completes (or user clicks "Skip — fill manually").

### B7. Per-industry brief templates
For each industry, ship a 1-click "Insert Template" button that pre-fills the brief textareas with industry-appropriate scaffolding (e.g., Real Estate gets a brief that mentions RERA, location, configuration, possession date placeholders). Cuts setup from blank-page-anxiety to fill-in-the-blanks.

### B8. Surface the auto-derived mood pool in the form
After voice/negatives are filled, run `deriveBrandMoods` client-side (port the function) and show "**Allowed moods for this brand:** Minimal & Elegant, Sophisticated & Premium, Aspirational & Dreamy". Confirms to the user that their brief is being read correctly. If pool is too small or too generic, they know the brief needs more signal.

---

## Recommended priority order

1. **B1 + B2** — unify schema and rewrite Master Prompt (highest leverage, fixes A1/A2/A3/A5/A8 in one shot)
2. **B4** — split Visual/Content Nevers (fixes A4, improves mood derivation quality)
3. **B3** — Paste & Parse wizard with diff (removes friction for Claude flow)
4. **B6** — Autofill-first new-brand UX
5. **B5 + B8** — Health Score and Mood Pool preview (transparency / quality signals)
6. **B7** — Industry templates (last; nice-to-have, not a fix)

Items 1–4 alone would eliminate ~80% of setup friction and the silent data drops we have today.

---

## Technical notes

- `src/pages/BrandGuide.tsx` — rewrite `MASTER_PROMPT` constant, update the `mapping` table, add the industry vocab inline.
- `src/pages/BrandForm.tsx` — extend `parseBrief` to also extract industry, color palette, asset tags; add "Paste Full Output" textarea + parse button + diff modal.
- `supabase/functions/brand-autofill/index.ts` — already aligned; just needs `visual_nevers` / `content_nevers` split if B4 is approved.
- `supabase/functions/generate-creative/index.ts` — `deriveBrandMoods` weighting + `buildDirectivePrompt` negative injection updates if B4 is approved.
- Migration needed only if B4 chooses the column-split approach over JSON-in-existing-field.

