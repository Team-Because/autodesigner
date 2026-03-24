CREATE OR REPLACE FUNCTION public.deduct_credit(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_credits
  SET credits_remaining = GREATEST(credits_remaining - 1, 0),
      credits_used = credits_used + 1,
      updated_at = now()
  WHERE user_id = _user_id;
END;
$$;