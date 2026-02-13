-- Remove duplicate daily-briefing cron job 12 (which exposed anon key)
-- Job 10 (with proper service_role_key) remains active

SELECT cron.unschedule(12);
