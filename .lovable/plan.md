

# Optimize All Brand Briefs to Best Structure

## Analysis: How the Engine Reads Brand Data

The generation engine reads three separate fields with character limits:
- `brand_brief` → truncated to **2500 chars** (Adapt step) / 3000 chars (fallback)
- `brand_voice_rules` → truncated to **1500 chars**
- `negative_prompts` → truncated to **1000–2000 chars**

These are passed to the AI as separate labeled blocks:
```
Brand Brief: [brand_brief content]
Voice/Audience: [brand_voice_rules content]
NEVER include: [negative_prompts content]
```

This means: **content duplicated across fields wastes token budget.** And any brief over ~2500 chars gets cut off — the AI never sees the rest.

## Optimal Structure (based on what works best)

**Kalrav Treasure** and **Venus Deshna** are the gold standard — clean markdown, front-loaded critical info, no duplication. Here's the template:

```text
brand_brief (≤2500 chars):
  ## BRAND IDENTITY        ← what the project IS (1-2 lines)
  ## MUST-INCLUDE ELEMENTS  ← mandatory text for every creative
  ## VISUAL DIRECTION       ← mood, photography, key visuals
  ## COPY STRUCTURE         ← headline examples, subtext, CTA
  ## DO'S                   ← reinforcement of direction
  ## COLOR NOTES            ← palette usage rules (if not covered by DB colors)

brand_voice_rules (≤1500 chars):
  Tone, audience, emotional message, messaging pillars

negative_prompts (≤1000 chars):
  Visual nevers + Content nevers (combined, concise)
```

**Rules:**
- NO voice/tone in brand_brief (it's in `brand_voice_rules`)
- NO nevers/don'ts in brand_brief (it's in `negative_prompts`)
- NO color hex values that duplicate `primary_color`/`secondary_color`/`extra_colors` DB fields
- Front-load: Identity → Must-Include → Visual Direction (most critical info first)
- Meevaa's JSON `_structured` format wastes ~40% of chars on JSON overhead — convert to plain markdown

## Brands That Need Changes

### Already optimal (no changes needed)
- **Kalrav Treasure** — perfect 8-section format, correct colors
- **Venus Deshna** — perfect format, correct colors
- **Venus The Planet** — perfect format, correct colors
- **Kalrav Nest** — good format, correct colors

### Need restructuring + color fixes

| Brand | Brief Issue | Color Issue | Voice/Neg Issue |
|---|---|---|---|
| **Amansara** | Unstructured numbered text, voice+nevers mixed in | primary=#2563EB (should be #2E4A3B), secondary=#DBEAFE (should be #EFE8DA), no extra_colors | Voice is good, negatives are good |
| **Kalrav Trails** | Unstructured, voice+nevers mixed in brief | primary=#2563EB (should be #7D5A45), secondary=#DBEAFE (should be #EDE6D8), no extra_colors | Voice is good, negatives are good |
| **Wynn** | Unstructured with `*` markers, nevers in brief | primary=#006A4E (should be #333333), secondary=#D3AF37 (should be #A7A7A7), no extra_colors | Voice is good, negatives are good |
| **SWS School** | `---SECTION---` markers, campaign mixed in | Colors OK | Voice OK, negatives OK |
| **Shanti Juniors** | Plain paragraph, everything mixed together | Colors OK | Voice OK but brief has tone info too |
| **Meevaa Foods** | JSON format wastes chars, ~5800 chars (gets truncated) | Colors OK, extra_colors OK | Voice OK, negatives OK |
| **Meevaa Navratri** | JSON format wastes chars, ~5400 chars (gets truncated) | Colors OK | Voice OK, negatives OK |
| **The Creek** | Good structure but uses `###` instead of `##`, slightly verbose | Colors OK | Voice OK, negatives OK |

## Implementation Steps

### Step 1 — Fix color mismatches (3 DB updates)
Update `primary_color`, `secondary_color`, and `extra_colors` for Amansara, Kalrav Trails, and Wynn to match their actual brand palettes.

### Step 2 — Restructure 8 brand briefs (8 DB updates)
Rewrite `brand_brief` for the 8 brands listed above into the optimal markdown format. Key actions:
- **Remove** voice/tone content from brand_brief (already in `brand_voice_rules`)
- **Remove** nevers/don'ts from brand_brief (already in `negative_prompts`)  
- **Remove** color hex definitions that duplicate DB color fields
- **Convert** Meevaa JSON to plain markdown (saves ~40% chars)
- **Front-load** identity and must-include elements
- **Keep under 2500 chars** so nothing gets truncated

### Step 3 — Deduplicate voice_rules and negative_prompts where needed
For brands where voice/negatives are currently split across fields, consolidate into the correct field.

## What does NOT change
- No code changes — this is purely database content optimization
- No changes to the edge function or how it reads the fields
- All existing brand information is preserved — just reorganized into the right fields
- The 4 brands that are already optimal stay untouched

