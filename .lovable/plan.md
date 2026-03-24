

# Analysis: What's Working, What's Broken, and How to Fix It

## What's Actually Working

1. **Credit system** — Just implemented. Check + deduction on success only. Working correctly.
2. **Framework sanitization** — Strips reference content (names, prices, locations) from the structural analysis. Working.
3. **Content isolation prompting** — Multiple layers of "never copy from reference" instructions. Working at the prompt level.
4. **Model cascade** — Tries 3 models with fallback (Gemini 3.1 Flash → 2.5 Flash → 3 Pro). Working.
5. **Logo force-inclusion** — If the Adapt step forgets the logo, it's force-added. Working (regex broadened in last change).

## What's Broken or Suboptimal

### Critical Issue 1: Adapt Step is BLIND to Brand Assets

The Adapt step (Step 2) receives the brand assets as **text-only** — just labels and URLs:
```
[0] "Logo" — https://storage.example.com/abc.png
[1] "Architecture" — https://storage.example.com/xyz.png
```

The AI **cannot see** these images. It picks assets by label alone, guessing which one fits the reference layout. If you have 3 architecture renders, it can't tell which one matches the reference's composition. This is the **#1 reason** assets aren't used well.

**Fix**: Send brand asset images as actual image inputs to the Adapt step, so it can visually evaluate which ones best match the reference layout.

### Critical Issue 2: Generation Prompt is Too Long

The final prompt sent to the image model is enormous — 150+ lines of instructions, rules, checklists, framework JSON, brand context, negative prompts, asset rules, color rules, typography rules, deduplication rules, and compliance notes. Image generation models (Gemini Flash/Pro) are **not** instruction-following text models — they're creative models. Overloading them with rules causes:
- Important instructions (like "use this exact logo") getting buried
- Contradictory rules creating confusion
- The model ignoring later sections entirely

**Fix**: Drastically simplify the generation prompt to ~30 lines max. Move complex decision-making to the Adapt step (which uses a text model good at reasoning) and give the image model a simple, clear directive.

### Critical Issue 3: Asset Categories Don't Map to Generation Roles

The Brand Form offers these categories: Logo, Hero Image, Architecture, Lifestyle, Masterplan, Product, Mascot, Pattern/Texture, Icon, Other.

But the edge function only has special handling for:
- **Logo**: Force-inclusion + fidelity rules ✅
- **Architecture** (`/architect|3d|render|building|elevation|facade/i`): 3D render preservation rules ✅
- Everything else: Generic "reproduce with fidelity" ❌

Assets tagged "Lifestyle", "Masterplan", "Product", or "Mascot" get no role-specific instructions. The image model doesn't know whether to use a lifestyle shot as a background, a hero visual, or a supporting element.

**Fix**: Map each category to explicit generation roles with clear instructions for each.

### Issue 4: Brand Brief Structure is Unenforced

The Best Practices guide *suggests* using `## VISUAL DNA`, `## MANDATORY ELEMENTS`, etc., but the textarea accepts anything. Most users paste unstructured paragraphs. The AI then gets a wall of text with no clear hierarchy, causing it to miss mandatory elements (RERA numbers, contact info, specific locations).

**Fix**: Replace the single textarea with a structured multi-section form that maps directly to the fields the AI actually uses.

### Issue 5: logo_url Uses Exact String Match

Line 183 in BrandForm: `assets.find((a) => a.label === "Logo")` — this works because labels come from a dropdown. But `brands.logo_url` is set from this and is only used as a thumbnail, not in generation. The edge function reads `brand_assets` directly. So `logo_url` is fine for its purpose.

---

## Proposed Fix Plan

### Step 1: Make Adapt Step See Brand Assets (Edge Function)

Send brand asset images as actual `image_url` inputs to the Adapt step alongside the reference image. This lets the AI visually match assets to reference layout zones.

**Trade-off**: More tokens/cost per generation, but dramatically better asset selection.

### Step 2: Simplify Generation Prompt (Edge Function)

Restructure the image model prompt to be concise:
- 1 line: output dimensions
- 3 lines: exact text to render (headline, subcopy, CTA)  
- 5 lines: asset placement instructions (from Adapt)
- 3 lines: color palette
- 3 lines: critical constraints (no reference content, logo fidelity, text on clean backgrounds)

Move all the verbose rules, checklists, framework JSON, and compliance notes into the Adapt step's system prompt (where the text model can actually process them).

### Step 3: Add Role-Specific Asset Handling (Edge Function)

Map each asset category to explicit image-model instructions:
- **Lifestyle/Hero Image** → "Use as background/atmospheric element"
- **Product** → "Feature prominently, preserve details"
- **Masterplan** → "Include in dedicated zone, maintain readability"
- **Mascot** → "Place as character element, preserve design"
- **Pattern/Texture** → "Use as background texture or accent"
- **Icon** → "Small element, use at specified position"

### Step 4: Structured Brand Brief Form (BrandForm.tsx)

Replace the single giant textarea with 4 focused sections that map directly to the AI fields:

| Section | Maps To | Max Chars |
|---|---|---|
| **Brand Identity** (project name, location, developer, USP) | `brand_brief` top section | 800 |
| **Mandatory Elements** (RERA, contact, tagline, legal text) | `brand_brief` middle | 500 |
| **Visual Direction** (mood, lighting, photography style, layout preferences) | `brand_brief` bottom | 600 |
| **Example Copy** (sample headlines, CTAs, taglines) | `brand_brief` end | 600 |

These get concatenated with markdown headers before saving to `brand_brief`. Existing briefs are parsed back into sections on edit. The "Tone & Audience" and "Never List" fields stay separate (they already map to `brand_voice_rules` and `negative_prompts`).

### Step 5: Brand Brief Template Suggestion

When creating a new brand, pre-populate the structured sections with placeholder examples relevant to the brand's industry (if detectable from name/assets).

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Send asset images to Adapt step, simplify generation prompt, add role-specific asset handling |
| `src/pages/BrandForm.tsx` | Replace single brief textarea with structured multi-section form, parse existing briefs back into sections |

## What This Does NOT Change

- No database schema changes — `brand_brief` stays as a text field (sections concatenated with markdown headers)
- No changes to Step 1 (Analyze) — framework extraction works well
- No changes to model cascade or error handling
- Credit system unchanged
- Asset categories dropdown unchanged (they're already good)

