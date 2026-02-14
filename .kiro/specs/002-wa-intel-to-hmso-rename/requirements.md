# Spec 002: wa_intel → hmso Complete Rename — Requirements

## Overview

Complete the partial rebrand from `wa_intel`/`HMWAIntel` to `hmso`/`HMSO` across the entire codebase — database schema, backend code, frontend code, configuration, and documentation. The project was partially rebranded but ~600+ references across 115 files still use the old naming.

## Why

- **Clarity:** AI coders and future developers are confused by mixed naming
- **Multi-app safety:** The shared Supabase DB has other HM apps; `wa_intel` name implies WhatsApp-only, but HMSO now handles meetings and future channels
- **Consistency:** Documentation says HMSO, but code still says wa_intel

## User Stories

### US-1: Database Schema Rename
**As** a developer, **I want** the database schema renamed from `wa_intel` to `hmso` **so that** all code consistently references one schema name.

**Acceptance Criteria:**
- Schema `hmso` exists and all tables/functions/views are accessible
- All functions and views have updated internal references (no `wa_intel.table` in bodies)
- Cron jobs renamed from `wa_intel_*` to `hmso_*`
- `hm_core.object_registry` updated to `owner_app = 'hmso'`
- PostgREST config updated to expose `hmso` schema

### US-2: Backend Code Update
**As** a developer, **I want** all edge functions and listener code to use `schema: "hmso"` **so that** they connect to the renamed schema.

**Acceptance Criteria:**
- All 5 edge functions use `schema: "hmso"`
- Listener uses `schema: 'hmso'` in supabase client
- Listener package name changed to `hmso-listener`
- PM2 process name changed to `hmso-listener`
- AI system prompts updated from "WhatsApp intelligence" to "organizational intelligence"

### US-3: Frontend Code Update
**As** a developer, **I want** the frontend schema client and all imports renamed from `waIntel` to `hmso` **so that** the codebase is consistent.

**Acceptance Criteria:**
- `src/lib/supabase.ts` exports `hmso` instead of `waIntel`
- All 11 importing files updated
- UI text updated: "WA Intel" → "HMSO", "WhatsApp Intelligence" → "Signal Operations"
- Page title in `index.html` updated

### US-4: Config & Documentation Update
**As** a developer, **I want** all documentation, config files, and spec files updated to use HMSO naming **so that** there are zero references to the old branding.

**Acceptance Criteria:**
- `package.json` name updated to `hmso-dashboard`
- `wa_intel_setup.sql` renamed to `hmso_setup.sql` with internal refs updated
- All `.kiro/steering/`, `.kiro/prompts/`, `.claude/commands/`, `.kiro/specs/` files updated
- `README.md`, `CLAUDE.md`, `SPEC_REGISTRY.md`, `TECHNICAL_DEBT_REGISTRY.md` updated
- `wa_jid`, `wa_group_id`, `wa_message_id`, `wa_contact_jid`, `wa_role` columns preserved (they describe WA-specific data)

### US-5: Deployment & Verification
**As** an operator, **I want** the rename deployed in the correct order with verification **so that** downtime is minimized (~2-5 minutes).

**Acceptance Criteria:**
- Deployment follows: DB → edge functions → listener → frontend verification
- All verification queries pass (schema exists, tables accessible, cron jobs renamed, registry updated)
- Listener processes messages after restart
- Frontend loads all pages without errors
- Rollback plan documented and tested mentally

## Constraints

- NO dollar-quoting (`$$`) in migration SQL — MCP tool limitation
- Keep WA-specific column names unchanged (`wa_jid`, `wa_group_id`, etc.)
- Hendra manually renames GitHub repo — only manual step
- Migration file must be idempotent where possible
- Split DB migration into chunks for MCP execution
