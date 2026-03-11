
CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  label text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brand assets" ON public.brand_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own brand assets" ON public.brand_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brand assets" ON public.brand_assets FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.brands DROP COLUMN IF EXISTS brand_kit_url;
