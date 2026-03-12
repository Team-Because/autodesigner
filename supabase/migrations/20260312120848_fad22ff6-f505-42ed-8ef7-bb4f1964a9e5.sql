CREATE POLICY "Users can update their own brand assets"
ON public.brand_assets
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);