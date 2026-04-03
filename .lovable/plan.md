

# Simplify Brand Setup Guide + Update Master Prompt

## Two Changes

### 1. Master Prompt Update (small)

Line 84 currently says: *"Do NOT ask me questions. Analyze everything I've provided and generate the complete profile in one shot."*

Change to instruct Claude to **ask 10-15 clarifying questions first** before generating the profile. Add a short paragraph after the task description explaining this requirement — ask about gaps in brand data, visual preferences, tone ambiguities, etc. Then generate the profile after the user answers.

### 2. Page Redesign (big) — Simplify Everything

**Remove entirely:**
- Animated walkthrough section (lines 369-478) + its CSS keyframes in `index.css`
- Collapsible `Section` component — replace with simple flat content
- Pro Tips section (6 tips is too much)
- Step 3 "Upload & Generate in Claude" as a separate section (merge into flow)

**New simplified structure (~200 lines):**

```text
┌─────────────────────────────────┐
│ ← Back                         │
│ Brand Setup Guide               │
│ Create your brand in 3 steps    │
├─────────────────────────────────┤
│                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │  📄  │ │  ✨  │ │  🎨  │   │
│  │Gather│ │Paste │ │Setup │   │
│  │ raw  │ │prompt│ │brand │   │
│  │ data │ │+ run │ │here  │   │
│  └──────┘ └──────┘ └──────┘   │
│                                 │
├─────────────────────────────────┤
│ Master Prompt         [Copy]   │
│ ┌─────────────────────────┐    │
│ │ # Brand Setup Master... │    │
│ │ (scrollable code block) │    │
│ └─────────────────────────┘    │
│              [Open Claude →]   │
├─────────────────────────────────┤
│ Where to Paste                  │
│                                 │
│ Claude Output    →  BrandTonic │
│ BRAND NAME       →  Brand Name │
│ COLOR PALETTE    →  Colors     │
│ BRAND BRIEF      →  Brief     │
│ TONE             →  Voice     │
│ NEVER LIST       →  Negatives │
├─────────────────────────────────┤
│  [Copy Prompt]  [Create Brand] │
└─────────────────────────────────┘
```

- 3 steps shown as a simple horizontal icon row (no cards, no descriptions)
- Master prompt block with copy button + Claude link
- Compact mapping table (5 rows, not 7)
- Bottom CTA buttons
- No collapsibles, no verbose explanations, no walkthrough animation

### Files Changed

- `src/pages/BrandGuide.tsx` — rewrite with simplified layout
- `src/index.css` — remove walkthrough animation keyframes (~30 lines)

