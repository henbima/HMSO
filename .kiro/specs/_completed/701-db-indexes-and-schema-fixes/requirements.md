# Spec 701: Database Indexes & Schema Fixes — Requirements

**Priority:** P0 — Critical
**Domain:** 700-799 (Infrastructure & Edge Functions)
**Status:** Planned

---

## Problem Statement

The blueprint (`WA_INTEL_BLUEPRINT.md` Section 5) specifies critical database indexes that are missing from the live Supabase database. Additionally, the `sync_requests` table was created in the `public` schema, violating the blueprint's rule that all wa-intel tables must reside in `wa_intel` schema.

### Verified Data (Supabase MCP, 2026-02-08)

**Missing indexes (0 of 6 exist):**
| Blueprint Index | Table | Column(s) | Purpose |
|---|---|---|---|
| `idx_messages_sender` | messages | `sender_jid` | Filter messages by sender |
| `idx_messages_from_hendra` | messages | `is_from_hendra` (partial) | Fast lookup of Hendra's messages |
| `idx_classified_type` | classified_items | `classification` | Filter by classification type |
| `idx_classified_time` | classified_items | `classified_at DESC` | Sort by classification time |
| `idx_tasks_assigned` | tasks | `assigned_to` | Filter tasks by assignee |
| `idx_directions_topic` | directions | `topic` | Filter directions by topic |

**`sync_requests` table:**
- Currently in `public` schema (should be `wa_intel`)
- 0 rows, 7 columns: `id`, `requested_at`, `status`, `started_at`, `completed_at`, `groups_synced`, `error`
- 3 RLS policies exist (INSERT/SELECT/UPDATE for `authenticated`)
- Referenced by `listener/src/index.ts` via the `wa_intel`-scoped Supabase client

---

## User Stories

### US-1: Missing Indexes
**As** a system operator,
**I want** all blueprint-specified indexes to exist in the database,
**So that** queries filtering by sender, classification type, assignee, and topic perform efficiently as the data grows (19,351 messages and counting).

### US-2: Schema Consolidation
**As** a developer,
**I want** the `sync_requests` table in the `wa_intel` schema,
**So that** all wa-intel tables are consolidated and the blueprint's schema isolation rule is respected.

---

## Acceptance Criteria

- [ ] All 6 missing indexes are created in `wa_intel` schema
- [ ] `sync_requests` table is moved from `public` to `wa_intel` schema
- [ ] Existing RLS policies on `sync_requests` are recreated in the new schema
- [ ] Listener code continues to work (uses `wa_intel`-scoped client, which will now find `sync_requests`)
- [ ] Dashboard group refresh (which inserts into `sync_requests`) continues to work
- [ ] Migration SQL file saved to `supabase/migrations/`
- [ ] No downtime or data loss during migration (table is currently empty)

---

## Out of Scope

- Adding non-blueprint indexes (extras already exist and are fine)
- Modifying any `public` schema tables belonging to HMCS
- Changing RLS policy logic (current permissive approach is acceptable for now)
