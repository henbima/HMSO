/*
  # Schedule Daily Briefing Cron Job

  1. Purpose
    - Automatically generate daily briefing every day at 7:00 AM WIB (00:00 UTC)
    - Uses pg_cron + pg_net to call the daily-briefing edge function

  2. Schedule
    - Runs at 00:00 UTC daily (which is 07:00 WIB)
    - Calls the daily-briefing edge function via HTTP

  3. Notes
    - pg_cron and pg_net extensions are already enabled
    - The edge function saves the briefing to wa_intel.daily_briefings table
*/

-- Remove existing job if it exists (to allow re-running this migration)
SELECT cron.unschedule('daily-briefing-7am-wib')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-briefing-7am-wib'
);

-- Schedule daily briefing at 7:00 AM WIB (00:00 UTC)
SELECT cron.schedule(
  'daily-briefing-7am-wib',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);