-- Repurpose campaigns table: drop unused columns, keep it as a simple group table
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS campaign_brief;
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS target_audience;
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS mandatory_elements;
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS negative_prompts;
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS brand_id;
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS status;

-- Add campaign_id (group) to brands table
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;