/*
  # Create New Cron Jobs for Spec 202
  
  Replaces the old broken cron jobs (disabled in 20260211_disable_broken_crons.sql)
  with new ones that use Vault for secure authentication.
  
  Prerequisites:
    - SERVICE_ROLE_KEY must be stored in Supabase Vault
    - pg_cron and pg_net extensions must be enabled
    - analyze-daily and daily-briefing Edge Functions must be deployed
  
  Schedule (all times WIB / UTC+7):
    - analyze-daily:  1 AM WIB (18:00 UTC) — analyzes yesterday's messages
    - daily-briefing: 5 AM WIB (22:00 UTC) — generates briefing from analysis
*/

-- Schedule analyze-daily: runs at 1 AM WIB (18:00 UTC) daily
SELECT cron.schedule(
  'analyze-daily',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/analyze-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule daily-briefing: runs at 5 AM WIB (22:00 UTC) daily
SELECT cron.schedule(
  'daily-briefing',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/daily-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
