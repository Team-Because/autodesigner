-- Add archived flag to brands so deletion can be a soft archive that preserves
-- generation history (generations still reference the brand_id and we can keep
-- showing the brand name in History even after the brand is "removed").
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Index for fast filtering of active brands per user.
CREATE INDEX IF NOT EXISTS idx_brands_user_archived
  ON public.brands (user_id, archived);