export interface Brand {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  brand_voice_rules: string;
  negative_prompts: string;
  brand_kit_url: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignDetails {
  message: string;
  targetAudience: string;
}

export interface Copywriting {
  headline: string;
  subline: string;
  cta: string;
}

export interface CreativeOutput {
  imageUrl: string;
  promptUsed: string;
  copywriting: Copywriting;
  layoutGuide: string;
}

export interface Generation {
  id: string;
  brand_id: string;
  reference_image_url: string;
  output_image_url: string;
  status: "processing" | "completed" | "failed";
  campaign_message: string;
  target_audience: string;
  layout_guide: string;
  copywriting: Copywriting;
  created_at: string;
}

export type GenerationStep =
  | "analyzing"
  | "mapping"
  | "writing"
  | "generating"
  | "complete";
