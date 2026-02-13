/*
  # Fix Cron Job Authentication
  
  1. Problem
    - Both cron jobs (classify-messages and daily-briefing) are failing
    - Error: function http_header(unknown, text) does not exist
    - Root cause: Using anon key instead of service role key
    
  2. Solution
    - Update cron jobs to use service role key from Supabase vault
    - Service role key must be stored in vault as 'SERVICE_ROLE_KEY'
    
  3. Prerequisites
    - Store service role key in Supabase vault:
      Dashboard → Project Settings → Vault → New Secret
      Name: SERVICE_ROLE_KEY
      Value: <your-service-role-key>
*/

-- Remove existing broken cron jobs
SELECT cron.unschedule('daily-briefing')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-briefing');

SELECT cron.unschedule('classify-messages')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'classify-messages');

-- Schedule classify-messages to run every 15 minutes
-- Uses service role key from vault for authentication
SELECT cron.schedule(
  'classify-messages',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/classify-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule daily-briefing to run daily at midnight UTC (7 AM WIB)
-- Uses service role key from vault for authentication
SELECT cron.schedule(
  'daily-briefing',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/daily-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Set the service role key configuration
-- IMPORTANT: Replace this with actual service role key via Supabase Dashboard
-- Dashboard → Settings → Database → Custom Postgres Configuration
-- Add: app.settings.service_role_key = <your-service-role-key>
-- OR use Supabase Vault to store it securely
