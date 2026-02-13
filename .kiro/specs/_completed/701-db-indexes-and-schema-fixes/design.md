# Spec 701: Database Indexes & Schema Fixes — Design

**Priority:** P0 — Critical
**Domain:** 700-799 (Infrastructure & Edge Functions)

---

## Overview

Single migration file that:
1. Creates 6 missing blueprint indexes
2. Moves `sync_requests` from `public` to `wa_intel` schema with its RLS policies

---

## Part 1: Missing Indexes

All indexes use `CREATE INDEX IF NOT EXISTS` for idempotency per CLAUDE.md conventions.

```sql
-- messages: sender lookup (19,351 rows)
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON wa_intel.messages(sender_jid);

-- messages: Hendra filter (partial index)
CREATE INDEX IF NOT EXISTS idx_messages_from_hendra
  ON wa_intel.messages(is_from_hendra)
  WHERE is_from_hendra = true;

-- classified_items: classification type filter (30 rows, will grow)
CREATE INDEX IF NOT EXISTS idx_classified_type
  ON wa_intel.classified_items(classification);

-- classified_items: time-based sort
CREATE INDEX IF NOT EXISTS idx_classified_time
  ON wa_intel.classified_items(classified_at DESC);

-- tasks: assignee filter (1 row, will grow)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned
  ON wa_intel.tasks(assigned_to);

-- directions: topic filter (2 rows, will grow)
CREATE INDEX IF NOT EXISTS idx_directions_topic
  ON wa_intel.directions(topic);
```

**Impact:** Zero downtime. `CREATE INDEX` does not lock reads. Tables are small enough that index creation is near-instant.

---

## Part 2: Move `sync_requests` to `wa_intel`

### Current State (verified 2026-02-08)
- Table: `public.sync_requests`
- Rows: 0 (empty)
- RLS: Enabled with 3 policies
- Columns: `id`, `requested_at`, `status`, `started_at`, `completed_at`, `groups_synced`, `error`

### Strategy

Since the table is **empty**, the simplest approach is:
1. Drop the old table in `public`
2. Recreate in `wa_intel` with identical structure + RLS

### Why not `ALTER TABLE SET SCHEMA`?

`ALTER TABLE public.sync_requests SET SCHEMA wa_intel` would work, but RLS policies reference `public.sync_requests` internally and may need recreation anyway. Since the table is empty, a clean recreate is safer and more explicit.

```sql
-- Drop old table
DROP TABLE IF EXISTS public.sync_requests;

-- Recreate in wa_intel
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

-- Recreate policies
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
```

---

## Code Changes Required

### Listener (`listener/src/index.ts`)
**No changes needed.** The listener's Supabase client is already scoped to `wa_intel` schema. Once `sync_requests` moves to `wa_intel`, the existing `.from('sync_requests')` calls will resolve correctly.

### Dashboard (`src/pages/OverviewPage.tsx` or wherever sync is triggered)
**Verify:** Check if the dashboard creates sync requests. If it uses `waIntel.from('sync_requests')`, no changes needed. If it uses `supabase.from('sync_requests')` (public-scoped), it needs to switch to `waIntel`.

---

## Migration File

**Filename:** `supabase/migrations/20260208150000_add_missing_indexes_and_move_sync_requests.sql`

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Index creation locks table | Very Low | Tables are small; concurrent index not needed |
| Listener breaks after move | Low | Listener already uses `wa_intel`-scoped client |
| Dashboard breaks after move | Low | Verify dashboard code path before applying |
| Data loss from drop | None | Table is confirmed empty (0 rows) |
