

# Refined Pipeline: Adapt Step + Smart Asset Selection + Focused Generation

## What I found re-reading the full 799-line edge function

Three concrete problems that directly hurt output quality:

1. **Blind asset selection** (line 310): `brandAssets.slice(0, 5)` — takes the first 5 assets regardless of relevance. If a brand has 2 logos, 3 architecture renders, 2 lifestyle photos, and 1 pattern, it just grabs the first 5. The image model then tries to use ALL of them, cluttering the creative. Real designers pick 2-3 assets per ad, not dump everything in.

2. **Image model invents copy while rendering** — Gemini image models (3.1 Flash, 2.5 Flash, 3 Pro) are visual rendering engines. Asking them to simultaneously invent brand-aligned headlines, sub-copy, and CTAs while also composing a layout produces generic text. Pre-writing copy in a text model is the single highest-impact change.

3. **450-line system prompt** — not that long prompts are inherently bad, but this prompt contains DECISION-MAKING instructions ("figure out what copy to write", "decide which color for what", "determine if the logo needs light or dark version"). The image model should receive DECISIONS, not decision-making frameworks.

## What this plan does differently from the previous version

**Previous concern**: "Making things smaller will make output worse."

The prompt doesn't get smaller for the sake of being smaller. It gets RESTRUCTURED: decision-making moves to the Adapt step (a text model that's good at decisions), and the image model receives a prompt that's ~200 lines of CLEAR INSTRUCTIONS (not 450 lines of "figure it out"). The instructions remain detailed — composition rules, typography standards, quality checklist — but every variable (copy, colors, assets) is pre-resolved.

**Asset intelligence**: The Adapt step decides which 2-4 assets to use and WHY, based on the reference layout. A landscape ad with a big hero zone gets the architecture render + logo. A story ad gets a lifestyle photo + logo. Pattern textures only appear when the reference has a textured background. This mirrors how real designers work.

## Changes

### 1. New `adaptDirective()` function

Text-only call to **Gemini 2.5 Flash** (strong reasoning, fast, cheap for text). Receives:
- Reference image (to understand the ad's concept/energy/layout)
- Framework JSON from Step 1
- Full brand data (name, colors, voice, brief, negative prompts)
- Complete asset list with labels
- Output format/dimensions

Outputs a `CreativeDirective` via tool calling:

```text
{
  // Pre-written copy (the #1 quality improvement)
  headline: "Admissions Open 2026-27",        // exact text, ≤8 words
  subcopy: "Future-ready CBSE education...",   // exact text, ≤20 words
  cta_text: "Enquire Now",                    // exact CTA

  // Asset selection (which assets to use AND why)
  selected_assets: [
    { index: 0, role: "logo", placement: "top-left, dark version", reason: "Brand mark" },
    { index: 3, role: "hero", placement: "left 60% of canvas", reason: "Architecture render matches reference hero zone" }
  ],

  // Color decisions (not "figure it out" — specific hex values)
  color_usage: {
    background: "#F1F1EE",
    headline_color: "#6366F1",
    subcopy_color: "#57534E",
    cta_background: "#FAB040",
    cta_text: "#FFFFFF"
  },

  // Concept mapping (how reference zones translate to this brand)
  concept_adaptation: "Reference shows a car in dramatic lighting with price overlay. For this school brand: replace car with campus architecture in warm lighting, replace price with CTA, keep the dramatic composition energy.",

  // Logo treatment
  logo_treatment: "Dark logo on light background — sufficient contrast, no backing panel needed",

  // Compliance check
  compliance_notes: "No school crest per brand rules. CBSE mentioned only via affiliated logo."
}
```

This takes ~5-8 seconds. The model does ONE job: translate reference + brand into specific creative decisions.

**Why this won't make things worse**: The Adapt model receives the SAME information the image model currently receives (brand brief, assets, framework, reference). It just processes it as a text reasoning task, which text models excel at. The image model then receives pre-made decisions, which image models excel at executing.

### 2. Smart asset selection logic

The Adapt step's `selected_assets` field replaces the current `brandAssets.slice(0, 5)`. Rules the Adapt model follows:

- **Always include**: One logo asset (if available)
- **Hero visual**: Pick ONE hero/architecture/lifestyle asset that best matches the reference's hero zone
- **Supporting**: Optionally one more asset if the reference layout has multiple visual zones
- **Skip**: Assets that don't fit the layout (e.g., skip "Pattern/Texture" unless reference has a textured background, skip "Masterplan" in a story ad)
- **Maximum 4 assets** passed to image model (reference image + up to 3 brand assets)

This means the image model sees fewer, more relevant images — which directly improves output quality because the model isn't trying to force-fit irrelevant assets.

### 3. Restructured generation prompt (~200 lines)

The prompt keeps ALL quality standards but removes decision-making:

```text
Section 1: FORMAT (10 lines)
  → Exact dimensions, aspect ratio enforcement (unchanged from current)

Section 2: CREATIVE DIRECTIVE (40-50 lines)
  → The pre-decided JSON: exact headline, subcopy, CTA, colors, asset placements
  → "Render EXACTLY this text. Use EXACTLY these colors. Place assets as specified."

Section 3: ASSET RULES (20-30 lines, conditional)
  → Only include rules for asset types actually selected
  → Logo present? Include logo contrast rules
  → Architecture render present? Include 3D creative freedom rules
  → No architecture? Skip those 15 lines entirely

Section 4: COMPOSITION & TYPOGRAPHY (40 lines)
  → Visual hierarchy, rule of thirds, negative space (kept from current)
  → Typography standards (kept from current)
  → Deduplication rules (kept from current)

Section 5: FRAMEWORK (variable)
  → The layout zones from analysis (kept from current)

Section 6: QUALITY CHECKLIST (15 lines)
  → Same checklist as current, but with resolved values
```

**Key difference from previous plan**: This is ~200 lines, not 120. The composition rules, typography standards, and quality checklist remain in full. What's removed is the "figure out what copy to write" and "decide which colors to use" sections — because those decisions are already made.

### 4. Reference image stays in generation

The user content array becomes:
1. Text instruction referencing the directive
2. Reference image (for style/layout/energy context)
3. Only the SELECTED brand assets (2-3, not all 5)

The reference image provides the visual "feel" that text alone can't convey. The directive provides the specific decisions.

### 5. Fallback safety

If `adaptDirective()` fails (timeout, model error), the function falls back to the current behavior — full 450-line prompt with all assets. This ensures the system can never produce WORSE results than today; the Adapt step is purely additive.

### 6. Add Portrait 4:5 format (1080×1350)

Add to `FORMAT_SPECS` in edge function and `FORMAT_OPTIONS` in Studio.tsx.

## Edge cases handled

| Scenario | How the Adapt step handles it |
|---|---|
| Brand has only a logo, no other assets | `selected_assets` returns just the logo; directive notes "text-prominent layout, use brand colors for visual impact" |
| Brand has 10+ assets | Adapt picks the 2-3 most relevant to the reference layout; the rest are skipped |
| Reference is a car ad, brand is a school | `concept_adaptation` maps: car → campus, price tag → CTA, dealer info → contact |
| Reference has pricing, brand doesn't do pricing | Directive replaces price zone with CTA or tagline |
| Story format (9:16) | Adapt adjusts: stacks elements vertically, hero gets 50-60% top, text zones below |
| Brand brief says "never show school crest" | `compliance_notes` flags this; image model's negative prompt includes it |
| Logo is dark but background is dark | `logo_treatment` specifies "use light version" or "add light backing panel" |
| 3D architecture render as hero | Asset gets `role: "hero"` with note that creative enhancement of lighting/angle is allowed |

## Pipeline flow

```text
Reference Image + Brand Data + All Assets
        │
        ▼
┌──────────────┐
│  1. ANALYZE   │  Gemini 2.5 Flash (vision + tool calling)
│  ~8 seconds   │  → Framework JSON (layout zones, style, mood)
│               │  (skipped on retry if cached)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  2. ADAPT     │  Gemini 2.5 Flash (text + reference image)
│  ~5-8 seconds │  → CreativeDirective:
│               │    • Pre-written copy (headline, subcopy, CTA)
│               │    • Selected assets (2-3 of N) with roles
│               │    • Color decisions (specific hex values)
│               │    • Concept adaptation notes
│               │    • Logo treatment + compliance
│               │  (fallback: skip and use current full prompt)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  3. GENERATE  │  Image model cascade (3.1 Flash → 2.5 Flash → 3 Pro)
│  ~25-35 sec   │  Input: reference image + 2-3 selected assets
│               │  Prompt: ~200 lines (decisions resolved, rules kept)
└──────────────┘

Total: ~40-50 seconds
```

## Files modified

| File | Change |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Add `adaptDirective()` with tool calling schema; refactor `generateCreative()` to accept directive + selected assets; restructure system prompt; add fallback; add portrait 4:5 format |
| `src/pages/Studio.tsx` | Add Portrait 4:5 format option; update progress phases to show "Adapting to brand..." between analyze and generate |

No database changes needed. No BrandForm.tsx changes needed — the existing structured brand brief + asset tagging + multi-color system provides sufficient data.

