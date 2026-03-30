CREATE POLICY "Admins can update all campaigns"
ON public.campaigns
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (true);