
-- Drop old user-based SELECT policy
DROP POLICY IF EXISTS "Users can view their own generations" ON public.generations;

-- New policy: users can see generations for brands they own
CREATE POLICY "Users can view generations for their brands"
ON public.generations
FOR SELECT
TO public
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.id = generations.brand_id
    AND brands.user_id = auth.uid()
  )
);
