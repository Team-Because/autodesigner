CREATE POLICY "Admins can view all campaigns"
ON public.campaigns FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));