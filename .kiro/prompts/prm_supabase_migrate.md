# Supabase Migration Task — HMSO

## Objective

Execute pending Supabase migrations while ensuring compliance with HMSO steering rules.

## Steps

### 1. Load Steering Rules

- Read `.kiro/steering/kernel.md`
- Read `.kiro/steering/supabase-migration-standards.md`
- Read `.kiro/steering/database-boundary-governance.md`

Extract rules relevant to:
- Database schema conventions (`wa_intel` schema)
- Naming conventions (`wa_intel_` prefix for shared objects)
- Security policies (RLS)
- Migration best practices (no dollar-quoting)
- Boundary governance (object registry)

### 2. Discover Migration Files

- Scan `HMWAIntel/supabase/migrations/` for pending `.sql` files
- List files in chronological order (by timestamp prefix)

### 3. Validate Each Migration

Before executing, verify each file against steering rules:

- [ ] Follows naming convention `YYYYMMDDHHMMSS_description.sql`
- [ ] Contains appropriate comments/documentation
- [ ] Uses `wa_intel` schema (NOT `public`)
- [ ] Includes RLS policies if creating tables
- [ ] No destructive operations without explicit approval
- [ ] No dollar-quoting (MCP compatibility)
- [ ] UUID primary keys with `gen_random_uuid()`
- [ ] Grants to `authenticated`, `anon`, `service_role`
- [ ] New objects registered in `hm_core.object_registry`
- [ ] Boundary check passed (only `wa_intel` objects modified)

### 4. Execute Migration

- Use `mcp_supabase_apply_migration` to apply validated migrations
- Report success/failure for each file
- Verify schema changes with `mcp_supabase_execute_sql`

### 5. Post-Migration

- Run `NOTIFY pgrst, 'reload schema'` to refresh PostgREST cache
- Verify the migration was applied correctly
- Save local copy in `HMWAIntel/supabase/migrations/` for git tracking

### 6. Summary

- List applied migrations
- Flag any steering rule violations found
- Suggest fixes for non-compliant files (don't auto-apply)

## Error Handling

- Stop on first failure and report
- Never auto-fix migrations without confirmation
- If boundary violation detected, STOP and ask user
