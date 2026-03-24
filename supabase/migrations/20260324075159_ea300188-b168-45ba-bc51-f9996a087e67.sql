
-- Admin can update brand_assets (needed for brand transfer)
CREATE POLICY "Admins can update all brand_assets"
  ON public.brand_assets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete brand_assets
CREATE POLICY "Admins can delete all brand_assets"
  ON public.brand_assets FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update all generations (for brand transfer)
CREATE POLICY "Admins can update all generations"
  ON public.generations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can insert credits (for credit management)
CREATE POLICY "Admins can insert credits"
  ON public.user_credits FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
