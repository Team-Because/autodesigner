export interface Brand {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  brand_voice_rules: string;
  negative_prompts: string;
  created_at: string;
  updated_at: string;
}

export interface Generation {
  id: string;
  brand_id: string;
  reference_image_url: string;
  output_image_url: string;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

export type GenerationStep =
  | "analyzing"
  | "enforcing"
  | "generating"
  | "qa"
  | "compositing"
  | "complete";
