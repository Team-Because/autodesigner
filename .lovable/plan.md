

# Full System Audit & Improvement Plan

I went end-to-end through the brand setup, generation pipeline, history, admin tools, and live database. Here's what I found and what we should fix.

---

## 1. What's working well

- **Generation pipeline is healthy.** ~1,338 of 1,602 generations completed (84%). Last 7 days: 264 completed vs 1 failed. Aspect-ratio retry, multi-model fallback, and credit deduction all behave correctly.
- **3-step Adapt pipeline** (Analyze → Adapt → Generate) is logging cleanly. Mood derivation is firing per brand with the right pool.
- **Brand ownership preservation** (admin no longer steals brands on edit) is in place.
- **No hard char limits** anywhere — long briefs flow through Form → Parser → Edge functions → LLM caps at safe ceilings (8000/4000/3000).
- **Visual/Content Nevers split** is implemented end-to-end (form, parser, generator).
- **Industry tagging** drives correct asset-tag vocabulary.

---

## 2. Real bugs / regressions to fix (priority order)

### P0 — Adapt step intermittently fails ("No directive extracted")
Logs from the last 24 hours show 2 generations where the Adapt LLM call returned content (visible in logs) but the JSON extractor failed both attempts, falling back to a worse direct-generation path. Root cause: `extractDirectiveFromContent` regex `/\{[\s\S]*"headline"[\s\S]*\}/` is greedy and grabs trailing markdown text, breaking JSON.parse.
**Fix:** add a balanced-brace scanner that walks from the first `{` and matches braces with quote-awareness; try in order: ```json fence → balanced object → loose JSON.parse.

### P0 — 54 generations stuck in "processing" status forever
54 rows have `status='processing'` but were created days ago. The function fails outside the try/catch that sets `status='failed'`, or the user closed the tab mid-flight. History page hides them after 10 minutes (good for users), but credits aren't refunded and admin sees noise.
**Fix:** (a) sweeper that marks `processing|analyzing|adapting|generating` rows older than 15 minutes as `failed`; (b) ensure the OUTER catch at line 1764 marks failed (already does — issue is when no error is thrown but the request is aborted client-side). Add a heartbeat or a single `status='failed'` write triggered when the response promise is closed unexpectedly via `req.signal.aborted`.

### P1 — 3 rows already store `## VISUAL NEVERS` headers; 12 don't (mixed state)
The DB shows half the brands are split, half are still single-blob. The generator handles both, but the form's "Legacy Nevers" surface stays visible forever on those brands.
**Fix:** background migration script that runs once: for any `negative_prompts` not containing `##` headers, attempt to auto-classify lines (lines containing words like "logo", "image", "color", "style" → visual; everything else → content), then prepend `## CONTENT NEVERS\n` so the form stops showing "Legacy". Optional admin button "Auto-split nevers" per brand.

### P1 — 3 brands have no industry set (Venus Deshna, Venus The Planet, etc.)
These are real, active brands generating regularly. Without industry, the asset-tag dropdown falls back to BASE_CATEGORIES instead of Real Estate vocab.
**Fix:** soft warning chip on BrandForm header: "Industry not set — asset tags are generic". Auto-suggest industry on save if blank using a 1-line LLM check, OR seed from majority asset labels.

### P1 — BrandForm best-practices guide references the OLD schema
Lines 634-639 still mention `## VISUAL DNA`, `## MANDATORY ELEMENTS`, `## COLOUR PALETTE`, `## MESSAGING PILLARS`. These were the v1 names; v3 Master Prompt uses `## VISUAL DIRECTION`, `## MUST-INCLUDE ELEMENTS`, `## COLOR PALETTE`. Users following the in-form guide produce briefs that don't round-trip cleanly.
**Fix:** update the BrandForm guide to mirror v3 section names exactly.

### P2 — BrandHub card preview is misleading
Line 265 shows `brand.brand_voice_rules || "No voice rules set"` — but most brands have voice rules and what users actually want is "is the brief complete?". Currently you can't tell from the hub which brands are well-set-up.
**Fix:** replace that line with a small "Brand Health" chip (filled / partial / sparse) computed from: has logo? ≥2 tagged assets? brief ≥500 chars? voice rules ≥100 chars? Industry set?

### P2 — Studio pre-flight warnings fire AFTER setStudioState, can't recover
Lines 153-166: brand-quality warnings show but the user has already committed and can't go fix the brand without losing context.
**Fix:** Move warnings BEFORE `setStudioState("generating")`; if assets=0 or no brief, prompt with a confirm dialog "This brand is sparse — generate anyway?".

### P3 — `parseBrief` in BrandForm and `parseMasterOutput` in brandParser.ts duplicate logic
Two parsers, slightly different behavior. The form's `parseBrief` reads existing DB rows; the wizard's parser reads pasted Claude output. Maintenance hazard.
**Fix:** consolidate to a single `parseStructuredBrief` exported from `lib/brandParser.ts`, used by both code paths.

---

## 3. Strategic improvements (not bugs — quality multipliers)

### A. Brand Health Score (form header + hub card)
A 0-100 chip computed from 6 signals: logo present (15), ≥3 tagged assets (20), brief identity ≥300 chars (15), brief visual ≥400 chars (20), voice rules ≥150 chars (15), nevers populated (10), industry set (5). Color-coded chip on `/brands` cards and `/brands/:id/edit` header. Soft block in Studio if score <30.

### B. Mood Pool Preview in BrandForm
Port `deriveBrandMoods` to the client (it's pure JS), run it whenever voice/nevers change, show:
> **Allowed moods for this brand:** Sophisticated & Premium · Aspirational & Dreamy · Warm & Inviting
> *Add more tone signals to expand the pool.*

This is the #1 transparency win — users immediately see whether their brief is doing real work.

### C. "Auto-detect industry" button in BrandForm
One-click LLM call that reads existing brief + asset labels and proposes the industry, with reasoning. Removes the silent "Other" fallback for the 5 brands missing industry.

### D. "Re-tag all assets" admin action
For brands whose industry was set AFTER assets were uploaded (so they got generic tags), one button calls a small LLM that re-assigns each asset's `label` to the new industry vocabulary. Already-correct tags stay.

### E. Consolidate the brand-form layout
Current ordering: Autofill → Paste-Parse → Best-Practices guide → Identity → Assets → Colors → Brief → Communication. Two AI-fill panels stacked at the top is heavy.
**Proposal:** put both into a single tabbed card "Quick fill: 🪄 From assets · 📋 From Claude paste · ✍️ Manual" — cleaner first impression.

### F. History page misses an "include failed" toggle for power users
Today, failed generations are hidden by default (good UX). Add a single muted toggle "Show failed/incomplete" so users can self-debug.

### G. Master Prompt: tighten the asset-tag mapping example
The prompt tells Claude to produce `Asset 1 (Logo): Logo` but doesn't show what to do when there are 12 assets. Add a brief example with 5–6 assets so Claude doesn't truncate at 3.

---

## 4. Recommended execution order (when you say go)

**Phase 1 — Bug fixes (low risk, immediate wins)**
1. Patch `extractDirectiveFromContent` brace-balanced JSON extractor
2. Add stuck-generation sweeper (one SQL function + cron, OR run inside a lightweight scheduled edge function)
3. Update BrandForm best-practices guide to v3 section names
4. Move Studio pre-flight warnings before `setStudioState`

**Phase 2 — Quality multipliers (~half day each)**
5. Brand Health Score chip (form + hub)
6. Mood Pool preview in form
7. Auto-detect industry button
8. Re-tag assets admin action

**Phase 3 — Polish**
9. Consolidate form layout (tabs)
10. History "show failed" toggle
11. One-time DB sweep to back-fill `## CONTENT NEVERS` headers on 12 unsplit brands
12. Consolidate `parseBrief` and `parseMasterOutput`

---

## 5. What I checked that needs no action

- RLS policies (admin + user policies look correct on every table)
- Credit deduction (fires correctly after success only)
- Aspect ratio enforcement (retry loop works; 1024×1024 → matches square)
- Auto-fill panel default-open for new brands (already in place)
- Brand ownership preservation on admin edit (already fixed)
- Logo force-inclusion regex (working in both Adapt success and fallback paths)

---

**Tell me which phases to execute.** I'd recommend Phase 1 + Phase 2 in one go — that's where the user-visible quality jump lives. Phase 3 can wait.
