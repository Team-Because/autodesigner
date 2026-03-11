export interface Brand {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  brand_voice_rules: string;
  negative_prompts: string;
  brand_brief: string;
  created_at: string;
  updated_at: string;
}

export interface BrandAsset {
  id: string;
  brand_id: string;
  user_id: string;
  image_url: string;
  label: string;
  created_at: string;
}
