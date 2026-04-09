ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS output_format text DEFAULT '',
  ADD COLUMN IF NOT EXISTS requested_aspect_ratio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS requested_width integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_height integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_width integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_height integer DEFAULT 0;