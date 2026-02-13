---
inclusion: always
version: 1.0.0
last-updated: 2026-02-13
---

# Supabase Workflow Rules — HMSO

## Database Access
- ALWAYS use the Supabase MCP server tools (`mcp_supabase_execute_sql`, `mcp_supabase_apply_migration`, `mcp_supabase_list_tables`, etc.) to connect to and interact with Supabase.
- NEVER use raw REST API calls or dashboard instructions when MCP tools are available.

## Migrations
- ALL database changes MUST be done via migration files for traceability.
- Use `mcp_supabase_apply_migration` to apply migrations (this both saves and executes).
- Migration files are saved in `supabase/migrations/` automatically by the MCP tool.
- Also save a local copy in `HMWAIntel/supabase/migrations/` for git tracking.
- Follow naming convention: `YYYYMMDDHHMMSS_descriptive_name.sql`

## Edge Functions
- Use `mcp_supabase_list_edge_functions` to see deployed functions.
- Use `mcp_supabase_get_edge_function` to read function code.
- Use `mcp_supabase_deploy_edge_function` to deploy new/updated functions.

## Cron Jobs
- Cron jobs are managed via `pg_cron` extension in the database.
- Query with: `SELECT * FROM cron.job ORDER BY jobid;`
- Create/modify via migrations using `cron.schedule()`.
- Follow naming: `wa_intel_{descriptive-name}`
