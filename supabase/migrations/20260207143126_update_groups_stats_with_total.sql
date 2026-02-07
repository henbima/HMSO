/*
  # Update Groups Stats Function with Total Messages

  1. Changes
    - Add `total_message_count` to return total messages per group
    - Add `is_starred` column to the returned data
    - Allows dashboard to show both today's messages and total historical messages
*/

DROP FUNCTION IF EXISTS wa_intel.get_groups_with_today_stats();

CREATE FUNCTION wa_intel.get_groups_with_today_stats()
RETURNS TABLE (
  id uuid,
  wa_group_id text,
  name text,
  description text,
  participant_count integer,
  is_active boolean,
  is_starred boolean,
  created_at timestamptz,
  updated_at timestamptz,
  today_message_count bigint,
  total_message_count bigint,
  flagged_count bigint
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH today_messages AS (
  SELECT 
    m.wa_group_id,
    COUNT(*) as msg_count
  FROM wa_intel.messages m
  WHERE m.timestamp >= CURRENT_DATE
  GROUP BY m.wa_group_id
),
total_messages AS (
  SELECT 
    m.wa_group_id,
    COUNT(*) as msg_count
  FROM wa_intel.messages m
  GROUP BY m.wa_group_id
),
flagged_messages AS (
  SELECT 
    m.wa_group_id,
    COUNT(*) as flagged_count
  FROM wa_intel.messages m
  JOIN wa_intel.classified_items ci ON ci.message_id = m.id
  WHERE m.timestamp >= CURRENT_DATE
  AND ci.classification IN ('task', 'direction', 'report', 'question')
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
  g.created_at,
  g.updated_at,
  COALESCE(tm.msg_count, 0) as today_message_count,
  COALESCE(ttl.msg_count, 0) as total_message_count,
  COALESCE(fm.flagged_count, 0) as flagged_count
FROM wa_intel.groups g
LEFT JOIN today_messages tm ON tm.wa_group_id = g.wa_group_id
LEFT JOIN total_messages ttl ON ttl.wa_group_id = g.wa_group_id
LEFT JOIN flagged_messages fm ON fm.wa_group_id = g.wa_group_id
WHERE g.is_active = true
ORDER BY g.name;
$$;