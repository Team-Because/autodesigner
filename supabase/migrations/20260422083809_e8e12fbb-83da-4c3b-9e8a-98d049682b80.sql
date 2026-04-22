-- Schedule the sweep-stuck-generations function every 5 minutes.
-- Marks any generation row stuck in transient states for >15min as 'failed'.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any prior schedule with this name
DO $$
BEGIN
  PERFORM cron.unschedule('sweep-stuck-generations');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'sweep-stuck-generations',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jibbeetyogbfkjvazysy.supabase.co/functions/v1/sweep-stuck-generations',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYmJlZXR5b2diZmtqdmF6eXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzUwNzYsImV4cCI6MjA4ODgxMTA3Nn0.C20BJLWyo9A3c2ouT097uddJrrJJwM-K09RhEQ3bf0E"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);