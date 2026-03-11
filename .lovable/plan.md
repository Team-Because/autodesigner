
# BrandAdapt AI — Implementation Plan

## Overview
A professional, agency-focused dashboard for one-click AI creative generation. Users set up Brand Profiles once, then upload reference images to generate brand-aligned creatives via a simulated AI pipeline.

## App Structure

### Layout
- Persistent sidebar with logo, navigation (Dashboard, Brand Hub, Studio), and collapse toggle
- Clean, dark-accented sidebar with light content area
- Fully responsive — sidebar collapses to icons on mobile

### Pages & Routes
1. **`/` — Dashboard**: Recent generations grid with thumbnails, brand name, timestamp, and status badges. Summary stats cards (total brands, generations this month, success rate)
2. **`/brands` — Brand Hub**: Card grid of saved brands showing logo, name, and color swatches. "Add Brand" button opens a full-page form/dialog
3. **`/brands/:id/edit` — Edit Brand**: Same form as add, pre-populated
4. **`/studio` — The Studio**: Split-panel layout — left for inputs, right for output/loading/result

## Brand Hub — Data Model & UI

### Mock Data Schema (Supabase-ready)
```
brands {
  id: uuid
  name: string
  logo_url: string
  primary_color: string (hex)
  secondary_color: string (hex)
  brand_voice_rules: string (text)
  negative_prompts: string (text)
  created_at: timestamp
  updated_at: timestamp
}

generations {
  id: uuid
  brand_id: uuid (FK)
  reference_image_url: string
  output_image_url: string
  status: 'processing' | 'completed' | 'failed'
  created_at: timestamp
}
```

### Brand Form Fields
- Brand Name (text input)
- Logo upload (drag-and-drop zone with preview)
- Primary & Secondary color pickers (hex input + visual picker)
- Brand Voice & Subject Rules (textarea with placeholder examples)
- "Never" List / Negative Prompts (textarea with placeholder examples)

## The Studio — One-Click Generation UI

### Input Section (left panel)
- Brand selector dropdown (populated from saved brands, shows logo + name)
- Reference image drag-and-drop upload zone with preview
- Large "Generate Creative" button (gradient/primary styled)

### Loading State (center/right panel)
- Animated progress sequence with rotating status messages:
  1. "Analyzing reference structure..." 
  2. "Enforcing brand guardrails..."
  3. "Generating structural composition..."
  4. "Running automated quality QA..."
  5. "Compositing final assets..."
- Progress bar + subtle pulse/shimmer animations
- ~15 second simulated duration

### Output Section (right panel)
- Generated image display (placeholder)
- "Download" and "Regenerate" action buttons
- No AI prompts or technical details shown to user

## API Preparation
- `lib/ai-pipeline.ts` with `generateBrandCreative(referenceImage, brandId)` — simulated 15s async function returning a placeholder image URL, with clear comments for future real API integration
- `lib/mock-data.ts` for sample brands and generations

## Design & Polish
- Professional, minimalist color scheme — neutral grays with a bold accent color
- Smooth page transitions, hover micro-interactions on cards/buttons
- Skeleton loaders for data-fetching states
- Toast notifications for save/generate success/error
- Fully responsive across desktop, tablet, and mobile
