

# Quality Optimization Plan — Practical & Cost-Effective

## Current State

The pipeline has 4 steps (Analyze → Adapt → Generate → QC), all routed through kie.ai's chat and image APIs. However, **the kie.ai code hasn't been deployed yet** — logs still show Lovable AI with 429 errors. First priority is getting kie.ai working, then optimizing each step.

## What Changes

### 1. Deploy kie.ai integration & set resolution to 2K
The current code already has kie.ai integration written but isn't deployed. Deploy it and change image resolution from `"1K"` to `"2K"` for sharper outputs. Keep Nano Banana 2 as primary, Nano Banana Pro as fallback — no need for GPT or Ideogram.

### 2. Use the right model tier per step

| Step | Current | Proposed | Why |
|------|---------|----------|-----|
| Analyze (extract layout) | kie.ai Gemini 3 Flash (chat) | Same — keep it | Layout extraction is structural, flash-tier is fine |
| Adapt (map brand to layout) | kie.ai Gemini 3 Flash (chat) | Same — keep it | Works well for asset selection + copy generation |
| Generate (render image) | Nano Banana 2 → Pro → Original | Nano Banana Pro → Nano Banana 2 (lead with quality) | Pro produces better compositions; 2 is fast fallback |
| QC (score output) | kie.ai Gemini 3 Flash (chat) | **Remove entirely** | See below |

### 3. Remove QC step

**Why remove it:**
- QC is purely advisory — it scores the image but never triggers a retry or blocks bad output
- It adds latency (extra API call + image download) to every generation
- The score is buried in JSON and rarely surfaced meaningfully to users
- Making QC "actionable" (auto-retry on low scores) would double generation costs and time for marginal benefit
- The aspect ratio validation already catches the most critical quality issue

**What replaces it:**
- Keep the existing aspect ratio mismatch detection + retry (already implemented)
- Users can visually judge quality and regenerate if unsatisfied (costs 1 credit either way)

### 4. Verify kie.ai image fetching works end-to-end
The async polling pattern (createTask → poll recordInfo → download resultUrl) is written but untested. Ensure:
- Task creation succeeds with proper model names (`nano-banana-pro`, `nano-banana-2`)
- Polling handles all states correctly
- Downloaded images are valid PNG/JPEG with correct dimensions
- Image URLs from kie.ai are accessible for download

## Technical Changes

**File: `supabase/functions/generate-creative/index.ts`**

1. Reorder model fallback: `nano-banana-pro` first, then `nano-banana-2`, then `nano-banana`
2. Change resolution from `"1K"` to `"2K"` in `kieGenerateImage`
3. Remove the entire `advisoryQC` function and all QC-related code (lines 890-963, QC call at lines 1378-1383, QC data in copywriting at lines 1387-1398, QC in response at line 1440)
4. Deploy the edge function

**No database changes needed** — QC data is already stored in the `copywriting` JSON column, removing it just means that field won't have `qc_score`/`qc_issues` anymore.

**No UI changes needed** — QC badges in history are already graceful (they just won't appear if no QC data exists).

## Expected Outcome
- Generations use kie.ai instead of rate-limited Lovable AI → no more 429 errors
- 2K resolution → sharper text and edges
- Pro model first → better compositions
- No QC step → ~15-20% faster generation time
- System still catches aspect ratio mismatches via dimension validation

