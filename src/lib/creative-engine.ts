import { GenerationStep, CreativeOutput, CampaignDetails } from "./types";

/**
 * Simulated AI creative generation pipeline.
 *
 * In production, replace with real API calls to:
 * 1. A Vision Language Model for reference analysis & framework extraction
 * 2. A brand mapping service for colors, logo, typography enforcement
 * 3. A copywriting LLM for layout guide + copy generation
 * 4. A ComfyUI / Stable Diffusion pipeline for final image generation
 */

const STEP_DURATIONS: Record<GenerationStep, number> = {
  analyzing: 4000,
  mapping: 4000,
  writing: 4000,
  generating: 5000,
  complete: 0,
};

const STEPS: GenerationStep[] = [
  "analyzing",
  "mapping",
  "writing",
  "generating",
  "complete",
];

export const STEP_LABELS: Record<GenerationStep, string> = {
  analyzing: "Analyzing reference creative & extracting design framework...",
  mapping: "Mapping brand system (colors, logo, typography)...",
  writing: "Writing final layout guide and copy...",
  generating: "Generating final brand creative...",
  complete: "Generation complete!",
};

export async function generateBrandCreative(
  _referenceImage: File,
  _brandId: string,
  _campaignDetails: CampaignDetails,
  onStepChange?: (step: GenerationStep, progress: number) => void
): Promise<CreativeOutput> {
  let totalElapsed = 0;
  const totalDuration = Object.values(STEP_DURATIONS).reduce((a, b) => a + b, 0);

  for (const step of STEPS) {
    const duration = STEP_DURATIONS[step];
    onStepChange?.(step, Math.round((totalElapsed / totalDuration) * 100));

    if (duration > 0) {
      await new Promise((resolve) => setTimeout(resolve, duration));
    }
    totalElapsed += duration;
  }

  onStepChange?.("complete", 100);

  // Mock structured response — replace with real pipeline output
  return {
    imageUrl:
      "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=1024&h=1024&fit=crop",
    promptUsed: `[Internal] Brand-aligned creative for "${_campaignDetails.message}" targeting ${_campaignDetails.targetAudience}. Structural framework extracted from reference. Brand palette and logo enforced. Negative constraints applied.`,
    copywriting: {
      headline: _campaignDetails.message || "Your Brand, Perfected",
      subline: `Designed for ${_campaignDetails.targetAudience || "your audience"} — every detail on-brand.`,
      cta: "Learn More →",
    },
    layoutGuide:
      "Hero image with brand logo top-left. Primary color gradient overlay at 40% opacity on bottom third. Headline in brand display font (48px, white) centered on the overlay. Subline below at 18px. CTA button bottom-right using secondary brand color with rounded corners.",
  };
}
