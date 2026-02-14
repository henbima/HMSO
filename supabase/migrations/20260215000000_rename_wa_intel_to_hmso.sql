-- Migration: Rename wa_intel schema to hmso
-- Date: 2026-02-15
-- Spec: 002-wa-intel-to-hmso-rename
--
-- This migration renames the wa_intel schema to hmso and updates all
-- internal references in functions, views, cron jobs, and the object registry.
--
-- IMPORTANT: Apply via MCP execute_sql in chunks (marked with -- CHUNK N comments).
-- Do NOT use dollar-quoting ($) — single-quote escaping only.

-- CHUNK 1: Schema Rename
ALTER SCHEMA wa_intel RENAME TO hmso;

-- CHUNK 2: PostgREST Config
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, hmso';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- CHUNK 3: Recreate triage_message() function
CREATE OR REPLACE FUNCTION hmso.triage_message()
RETURNS TRIGGER AS '
DECLARE
    msg_text TEXT;
    msg_lower TEXT;
    is_hendra BOOLEAN;
BEGIN
    msg_text := NEW.message_text;
    IF msg_text IS NULL OR msg_text = '''' THEN
        RETURN NEW;
    END IF;

    msg_lower := lower(msg_text);
    is_hendra := COALESCE(NEW.is_from_hendra, false);

    -- Urgent keywords (Bahasa Indonesia + English)
    IF msg_lower ~ ''(urgent|darurat|segera|asap|kebakaran|emergency|gawat|bahaya)''
    THEN
        INSERT INTO hmso.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, ''urgent'', 1.0);
    END IF;

    -- Hendra instruction (long message from Hendra = likely direction/task)
    IF is_hendra AND length(msg_text) > 50 THEN
        INSERT INTO hmso.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, ''hendra_instruction'', 0.8);
    END IF;

    -- Question detection (ends with ? or starts with question words)
    IF msg_text ~ ''\?\s*$''
       OR msg_lower ~ ''^(apa|kapan|dimana|di mana|bagaimana|kenapa|mengapa|siapa|berapa|gimana|mana|bisa|boleh|ada|apakah|bisakah)\s''
    THEN
        INSERT INTO hmso.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, ''question'', 0.9);
    END IF;

    -- Low stock detection
    IF msg_lower ~ ''(stok habis|stok kosong|tinggal \d|out of stock|barang habis|persediaan habis|stock habis|stock kosong)''
    THEN
        INSERT INTO hmso.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, ''low_stock'', 0.9);
    END IF;

    -- Complaint detection
    IF msg_lower ~ ''(komplain|complaint|marah|kecewa|rusak|expired|cacat|kadaluarsa|kadaluwarsa|basi|busuk)''
    THEN
        INSERT INTO hmso.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, ''complaint'', 0.85);
    END IF;

    RETURN NEW;
END;
' LANGUAGE plpgsql SECURITY DEFINER;

-- CHUNK 4: Drop old search function and create renamed one
DROP FUNCTION IF EXISTS hmso.wa_intel__search_messages(text, int);

CREATE OR REPLACE FUNCTION hmso.search_messages(query text, limit_count int DEFAULT 50)
RETURNS TABLE(
    id uuid,
    message_text text,
    sender_name text,
    group_name text,
    "timestamp" timestamptz,
    relevance real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS '
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.message_text,
        m.sender_name,
        g.name AS group_name,
        m.timestamp,
        ts_rank(m.search_vector, websearch_to_tsquery(''indonesian'', query)) AS relevance
    FROM hmso.messages m
    LEFT JOIN hmso.groups g ON m.group_id = g.id
    WHERE m.search_vector @@ websearch_to_tsquery(''indonesian'', query)
    ORDER BY relevance DESC
    LIMIT limit_count;
END;
';

GRANT EXECUTE ON FUNCTION hmso.search_messages(text, int) TO authenticated, anon, service_role;

-- CHUNK 5: Recreate get_groups_with_today_stats()
CREATE OR REPLACE FUNCTION hmso.get_groups_with_today_stats()
RETURNS TABLE(id uuid, wa_group_id text, name text, description text, participant_count integer, is_active boolean, is_starred boolean, category_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, today_message_count bigint, total_message_count bigint, flagged_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS '
WITH today_messages AS (
SELECT
m.wa_group_id,
COUNT(*) as msg_count
FROM hmso.messages m
WHERE m.timestamp >= CURRENT_DATE
GROUP BY m.wa_group_id
),
total_messages AS (
SELECT
m.wa_group_id,
COUNT(*) as msg_count
FROM hmso.messages m
GROUP BY m.wa_group_id
),
flagged_messages AS (
SELECT
m.wa_group_id,
COUNT(*) as flagged_count
FROM hmso.messages m
JOIN hmso.classified_items ci ON ci.message_id = m.id
WHERE m.timestamp >= CURRENT_DATE
AND ci.classification IN (''task'', ''direction'', ''report'', ''question'')
GROUP BY m.wa_group_id
)
SELECT
g.id,
g.wa_group_id,
g.name,
g.description,
g.participant_count,
g.is_active,
COALESCE(g.is_starred, false) as is_starred,
g.category_id,
g.created_at,
g.updated_at,
COALESCE(tm.msg_count, 0) as today_message_count,
COALESCE(ttl.msg_count, 0) as total_message_count,
COALESCE(fm.flagged_count, 0) as flagged_count
FROM hmso.groups g
LEFT JOIN today_messages tm ON tm.wa_group_id = g.wa_group_id
LEFT JOIN total_messages ttl ON ttl.wa_group_id = g.wa_group_id
LEFT JOIN flagged_messages fm ON fm.wa_group_id = g.wa_group_id
WHERE g.is_active = true
ORDER BY g.name;
';

-- CHUNK 6: Recreate views
CREATE OR REPLACE VIEW hmso.overdue_tasks AS
SELECT
    t.*,
    m.message_text AS original_message,
    EXTRACT(DAY FROM now() - t.created_at) AS days_open
FROM hmso.tasks t
LEFT JOIN hmso.messages m ON m.id = t.source_message_id
WHERE t.status NOT IN ('done', 'cancelled')
AND t.created_at < now() - INTERVAL '3 days';

CREATE OR REPLACE VIEW hmso.today_summary AS
SELECT g.name AS group_name,
    g.wa_group_id,
    count(m.id) AS total_messages,
    count(ci.id) FILTER (WHERE ci.classification = 'task') AS task_count,
    count(ci.id) FILTER (WHERE ci.classification = 'direction') AS direction_count,
    count(ci.id) FILTER (WHERE ci.classification = 'report') AS report_count
FROM hmso.groups g
    LEFT JOIN hmso.messages m
      ON m.wa_group_id = g.wa_group_id
      AND m."timestamp" >= CURRENT_DATE
      AND m.conversation_type = 'group'
    LEFT JOIN hmso.classified_items ci ON ci.message_id = m.id
GROUP BY g.name, g.wa_group_id;

-- CHUNK 7: Cron jobs — unschedule old, schedule new
SELECT cron.unschedule('wa_intel_analyze-daily');
SELECT cron.unschedule('wa_intel_daily-briefing');

SELECT cron.schedule(
  'hmso_analyze-daily',
  '*/10 18-19 * * *',
  'SELECT net.http_post(
    url := ''https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/analyze-daily'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''SERVICE_ROLE_KEY'' LIMIT 1)
    ),
    body := ''{}''::jsonb
  );'
);

SELECT cron.schedule(
  'hmso_daily-briefing',
  '0 22 * * *',
  'SELECT net.http_post(
    url := ''https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/daily-briefing'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''SERVICE_ROLE_KEY'' LIMIT 1)
    ),
    body := ''{}''::jsonb
  );'
);

-- CHUNK 8: Object registry update
UPDATE hm_core.object_registry
SET owner_app = 'hmso'
WHERE owner_app = 'wa_intel';

-- Also update the function name in registry
UPDATE hm_core.object_registry
SET object_name = 'search_messages'
WHERE object_name = 'wa_intel__search_messages' AND owner_app = 'hmso';

-- Update cron job names in registry
UPDATE hm_core.object_registry
SET object_name = 'hmso_analyze-daily'
WHERE object_name = 'wa_intel_analyze-daily' AND owner_app = 'hmso';

UPDATE hm_core.object_registry
SET object_name = 'hmso_daily-briefing'
WHERE object_name = 'wa_intel_daily-briefing' AND owner_app = 'hmso';
