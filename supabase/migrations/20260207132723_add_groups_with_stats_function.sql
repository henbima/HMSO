/*
  # Add efficient groups with stats function

  1. New Function
    - `get_groups_with_today_stats()` - Returns all active groups with today's message counts and flagged counts in a single query
    - Uses CTEs to aggregate message counts efficiently
    - Avoids N+1 query problem

  2. Purpose
    - Replaces multiple per-group queries with a single aggregated query
    - Improves Groups page load time from minutes to milliseconds
*/

CREATE OR REPLACE FUNCTION wa_intel.get_groups_with_today_stats()
RETURNS TABLE (
  id uuid,
  wa_group_id text,
  name text,
  description text,
  participant_count integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  today_message_count bigint,
  flagged_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH today_messages AS (
    SELECT 
      m.wa_group_id,
      COUNT(*) as msg_count
    FROM wa_intel.messages m
    WHERE m.timestamp >= CURRENT_DATE
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
    g.created_at,
    g.updated_at,
    COALESCE(tm.msg_count, 0) as today_message_count,
    COALESCE(fm.flagged_count, 0) as flagged_count
  FROM wa_intel.groups g
  LEFT JOIN today_messages tm ON tm.wa_group_id = g.wa_group_id
  LEFT JOIN flagged_messages fm ON fm.wa_group_id = g.wa_group_id
  WHERE g.is_active = true
  ORDER BY g.name;
$$;

GRANT EXECUTE ON FUNCTION wa_intel.get_groups_with_today_stats() TO authenticated;
