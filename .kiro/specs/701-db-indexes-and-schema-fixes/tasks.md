# Spec 701: Database Indexes & Schema Fixes — Tasks

**Status:** Done
**Priority:** P0 — Critical

---

### Phase 1: Create Migration & Apply

#### - [x] Task 1.1: Create migration SQL file
**File:** `supabase/migrations/20260208150000_add_missing_indexes_and_move_sync_requests.sql`

**Acceptance Criteria:**
- [x] 6 missing indexes created with `IF NOT EXISTS`
- [x] `public.sync_requests` dropped
- [x] `wa_intel.sync_requests` created with identical schema
- [x] RLS enabled + 3 policies recreated
- [x] Grants for `authenticated` and `service_role`

**Commit:** `fix(db): add 6 missing blueprint indexes and move sync_requests to wa_intel`

#### - [x] Task 1.2: Apply migration via Supabase MCP
**File:** N/A (Supabase MCP `apply_migration`)

**Acceptance Criteria:**
- [x] Migration applied successfully
- [x] All 6 indexes visible in `pg_indexes`
- [x] `wa_intel.sync_requests` exists with RLS enabled
- [x] `public.sync_requests` no longer exists

#### - [x] Task 1.3: Verify dashboard sync_requests code path
**File:** `src/pages/OverviewPage.tsx` (or wherever sync is triggered)

**Acceptance Criteria:**
- [x] Confirm dashboard uses `waIntel.from('sync_requests')` — verified in `OverviewPage.tsx` lines 112, 173, 196
- [x] Listener uses `wa_intel`-scoped client — verified in `listener/src/index.ts` line 92
- [x] No code changes needed — both already target `wa_intel` schema

---

## Completion Checklist
- [x] Verify via SQL: `SELECT indexname FROM pg_indexes WHERE schemaname = 'wa_intel'` — all 6 new indexes confirmed
- [x] Verify via SQL: `SELECT schemaname FROM pg_tables WHERE tablename = 'sync_requests'` — returns `wa_intel` only
- [x] Verify via SQL: RLS policies — 3 policies (SELECT/INSERT/UPDATE) confirmed on `wa_intel.sync_requests`
