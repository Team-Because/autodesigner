-- Drop the broken trigger on generations table
DROP TRIGGER IF EXISTS update_generations_updated_at ON public.generations;
-- Also check for any trigger with common naming patterns
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.generations'::regclass AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.generations', t.tgname);
  END LOOP;
END $$;