ALTER TABLE public.brands ADD COLUMN brand_kit_url text DEFAULT ''::text;
ALTER TABLE public.generations ADD COLUMN campaign_message text DEFAULT ''::text;
ALTER TABLE public.generations ADD COLUMN target_audience text DEFAULT ''::text;
ALTER TABLE public.generations ADD COLUMN layout_guide text DEFAULT ''::text;
ALTER TABLE public.generations ADD COLUMN copywriting jsonb DEFAULT '{}'::jsonb;