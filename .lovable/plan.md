

# Brand Setup Guide — Built Into the App

## What We're Building

A dedicated **Brand Setup Guide** page accessible from the sidebar (or as a help link from the Brand Form). This will be a comprehensive, well-structured reference page that walks users through every field in the brand form with examples, tips, and a ready-to-copy template — all styled consistently with the app.

## Current State

The Brand Form already has a collapsible "Best Practices" card at the top with 5 bullet tips. This is helpful but brief. The new guide will be a full standalone page with detailed, section-by-section instructions.

## Plan

### 1. Create `/brand-guide` page (`src/pages/BrandGuide.tsx`)

A clean, editorial-style page with these sections:

**Overview** — What the brand profile powers and why completeness matters

**Section-by-Section Walkthrough:**

| Form Section | Guide Content |
|---|---|
| **Brand Name** | Naming conventions, short-form rules |
| **Brand Assets** | What to upload, how to tag (Logo, Hero, Architecture, Product, etc.), why tagging matters |
| **Color Palette** | Primary vs Secondary vs Extra colors, naming conventions, usage rules |
| **Brand Brief — Identity** | What goes here: project name, location, developer, USPs, differentiators. Template provided |
| **Brand Brief — Must-Include** | Mandatory text elements: RERA, contact, tagline, legal disclaimers. Template provided |
| **Brand Brief — Visual Direction** | Mood, lighting, photography style, layout preferences, textures. Template provided |
| **Brand Brief — Example Copy** | Sample headlines, CTAs, taglines for AI to reference |
| **Tone & Target Audience** | Voice traits, demographic targeting, desired emotional response |
| **The "Never" List** | Visual Nevers vs Content Nevers separation, examples |

**Ready-to-Copy Template** — A complete fillable template users can copy-paste into each field, covering both real estate and general brand archetypes.

**Pro Tips** — Data budget limits (2500/1500/1000 chars), markdown formatting, front-loading critical info.

### 2. Add route in `src/App.tsx`

Add `/brand-guide` route pointing to the new page.

### 3. Add navigation entry

- Add a subtle "Setup Guide" link in the sidebar under Brands (or as a secondary nav item)
- Add a "View full guide →" link inside the existing Best Practices collapsible on the Brand Form

### 4. Styling

- Use the existing card/typography system
- Collapsible sections for each form field so the page isn't overwhelming
- Code blocks for template text that users can copy
- Consistent with the app's dark theme and font system

### Technical Details

- Single new file: `src/pages/BrandGuide.tsx` (~300-400 lines)
- Minor edits to `src/App.tsx` (add route)
- Minor edits to `src/components/AppSidebar.tsx` (add nav link)
- Minor edit to `src/pages/BrandForm.tsx` (add "View full guide" link in the Best Practices card)
- No database changes needed

