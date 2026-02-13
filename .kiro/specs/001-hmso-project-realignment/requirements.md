# Spec 001: HMSO Project Realignment — Requirements

**Status:** Planned
**Phase:** Foundation
**Complexity:** High
**Assignable to:** Opus only
**Depends on:** None (this is the foundation spec)
**Created:** 2026-02-13 22:00 WITA

## Overview

Realign the HMWAIntel project to the new HMSO (HollyMart Signal Operations) north star blueprint. This spec covers: evaluating and cleaning up existing specs, updating project identity and context files, database schema migrations for multi-source support (WhatsApp + meetings + future channels), classification pipeline preparation, dashboard source-type awareness, file structure alignment, and blueprint integration. The goal is to transform the project foundation from WhatsApp-specific to source-agnostic while preserving all existing operational functionality.

## User Stories

- As Hendra, I want all existing uncompleted specs evaluated against the new HMSO blueprint, so I know which to keep, update, or discard
- As Hendra, I want CLAUDE.md and project-context.md updated to reflect HMSO identity, so all AI assistants have accurate context
- As Hendra, I want the database extended with multi-source columns and a meetings table, so the system is ready for meeting transcript ingestion
- As Hendra, I want full-text search added to messages, so Chat-with-Data can be built later
- As Hendra, I want the dashboard to show source indicators on messages, so I can distinguish WhatsApp messages from meeting chunks
- As Hendra, I want the HMSO blueprint properly referenced as the north star across all documentation

## Key Requirements

### 1. Spec Evaluation
- Assess all 6 active specs (101, 201, 202, 401, 601, 701) against HMSO blueprint
- Recommend Keep, Update, or Delete for each with rationale
- Identify new capabilities from blueprint that need new specs
- Present findings for approval before modifying any spec files

### 2. Project Identity Updates
- Update CLAUDE.md: project name → HMSO, role → source-agnostic signal operations, add multi-source architecture, two-tier AI strategy, blueprint reference
- Update project-context.md: one-liner, tech stack (add n8n, OpenRouter, tsvector), ecosystem positioning
- Update steering files: main-project-context.md and database-boundary-governance.md descriptions (keep wa_intel as app identity)
- Preserve ALL existing safety rules, boundary governance, and code conventions unchanged

### 3. Database Migrations
- Create `wa_intel.meetings` table per blueprint Section 5
- Add `source_type`, `meeting_id`, `meeting_metadata` columns to `wa_intel.messages`
- Add full-text search (tsvector + GIN index + search function)
- Register all new objects in `hm_core.object_registry`
- All migrations: idempotent, no dollar-quoting, comment headers, RLS, grants

### 4. Classification Pipeline
- Verify pg_cron scheduling status
- Document cron job status and any auth issues
- Add source_type awareness to classifier prompt
- Document batch classification plan for 23k+ accumulated messages

### 5. Dashboard Source-Type Awareness
- Update TypeScript types with source_type, meeting_id, meeting_metadata
- Create SourceBadge component (WhatsApp icon, Meeting icon, generic fallback)
- Add source_type display to message lists
- Backward compatible with existing WhatsApp-only data

### 6. File Structure & Blueprint Integration
- Create placeholder directories: `meetings/`, `chat/` with README files
- Reference HMSO blueprint as north star in all documentation
- Propose renaming blueprint file for cleaner referencing

## Data Source

- `wa_intel.messages` (modified — add 3 columns)
- `wa_intel.meetings` (new table)
- `hm_core.object_registry` (register new objects)

## Acceptance Criteria

- [ ] All 6 active specs evaluated with Keep/Update/Delete recommendation
- [ ] CLAUDE.md reflects HMSO identity with multi-source architecture
- [ ] project-context.md reflects HMSO identity with ecosystem positioning
- [ ] Steering files updated where needed, safety rules preserved
- [ ] `wa_intel.meetings` table created with RLS and grants
- [ ] `source_type`, `meeting_id`, `meeting_metadata` columns added to messages
- [ ] Full-text search index and function created
- [ ] All new DB objects registered in `hm_core.object_registry`
- [ ] TypeScript types updated with new fields and Meeting interface
- [ ] SourceBadge component renders correctly for all source types
- [ ] Dashboard backward compatible with existing WhatsApp data
- [ ] Classifier cron status documented
- [ ] Placeholder directories created with README files
- [ ] Blueprint referenced as north star in documentation
- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run build` succeeds

## Out of Scope

- Building the meeting transcript ingestion module (n8n workflow) — future spec
- Building the Chat-with-Data page — future spec
- Building the Meetings dashboard page — future spec
- HMCS integration — future spec
- Knowledge base / onboarding pack — future spec
- Batch classification execution (this spec documents the plan, doesn't execute it)
- pgvector / semantic search — future, only if full-text search insufficient
