-- Migration: Add 6 missing blueprint indexes + move sync_requests to wa_intel schema
-- Spec: 701 (P0 — Critical)
-- Date: 2026-02-08

-- ============================================
-- PART 1: Missing Blueprint Indexes
-- ============================================

-- messages: sender lookup (19,351 rows)
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON wa_intel.messages(sender_jid);

-- messages: Hendra filter (partial index)
CREATE INDEX IF NOT EXISTS idx_messages_from_hendra
  ON wa_intel.messages(is_from_hendra)
  WHERE is_from_hendra = true;

-- classified_items: classification type filter
CREATE INDEX IF NOT EXISTS idx_classified_type
  ON wa_intel.classified_items(classification);

-- classified_items: time-based sort
CREATE INDEX IF NOT EXISTS idx_classified_time
  ON wa_intel.classified_items(classified_at DESC);

-- tasks: assignee filter
CREATE INDEX IF NOT EXISTS idx_tasks_assigned
  ON wa_intel.tasks(assigned_to);

-- directions: topic filter
CREATE INDEX IF NOT EXISTS idx_directions_topic
  ON wa_intel.directions(topic);

-- ============================================
-- PART 2: Move sync_requests from public to wa_intel
-- Table is confirmed empty (0 rows) as of 2026-02-08
-- ============================================

-- Drop old table and its policies in public schema
DROP TABLE IF EXISTS public.sync_requests;

-- Recreate in wa_intel schema with identical structure
CREATE TABLE IF NOT EXISTS wa_intel.sync_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  groups_synced INTEGER DEFAULT 0,
  error TEXT
);

-- Enable RLS
ALTER TABLE wa_intel.sync_requests ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Authenticated users can view sync_requests"
  ON wa_intel.sync_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sync_requests"
  ON wa_intel.sync_requests FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sync_requests"
  ON wa_intel.sync_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON wa_intel.sync_requests TO authenticated;
GRANT ALL ON wa_intel.sync_requests TO service_role;
