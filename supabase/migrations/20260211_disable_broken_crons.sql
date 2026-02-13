-- Spec 202, Task A.1: Disable all broken cron jobs
-- Jobs 9 (classify-messages) and 10 (daily-briefing) use broken http_header() syntax
-- Jobs 1 (generate-daily-tasks-cron) and 3 (generate_daily _task_cronsql) are also broken/insecure
-- All will be replaced by new analyze-daily + daily-briefing crons in Phase E

SELECT cron.unschedule(9);   -- classify-messages (broken http_header syntax)
SELECT cron.unschedule(10);  -- daily-briefing (broken http_header syntax)
SELECT cron.unschedule(1);   -- generate-daily-tasks-cron (no auth headers)
SELECT cron.unschedule(3);   -- generate_daily _task_cronsql (hardcoded service role key exposed)
