-- Table to store shared third-party integration credentials (one row per provider)
CREATE TABLE public.app_integrations (
  provider TEXT PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  scopes TEXT,
  connected_by UUID,
  connected_account TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_integrations ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can view integrations"
ON public.app_integrations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert
CREATE POLICY "Admins can insert integrations"
ON public.app_integrations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update integrations"
ON public.app_integrations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete integrations"
ON public.app_integrations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_app_integrations_updated_at
BEFORE UPDATE ON public.app_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Optional columns on generations for "already sent to Canva" tracking
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS canva_design_id TEXT,
  ADD COLUMN IF NOT EXISTS canva_design_url TEXT;