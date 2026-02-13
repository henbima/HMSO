---
inclusion: manual
---

# Supabase Migration Standards — HMSO

## Migration File Naming

Format: `YYYYMMDDHHMMSS_descriptive_name.sql`

Examples:
- `20260213120000_create_signal_sources_table.sql`
- `20260213130000_add_meeting_metadata_column.sql`

### Rules
- Timestamps must be unique — never reuse
- Only `.sql` files in `HMWAIntel/supabase/migrations/`
- Never rename an applied migration
- Names should describe what the migration does
- Use CURRENT timestamp, not example dates

---

## Migration File Location

All migrations go in: `HMWAIntel/supabase/migrations/`

Also applied via Supabase MCP `apply_migration` tool for remote execution.

---

## Migration Content Rules

### Required Elements
1. **Comment header** with purpose
2. **IF NOT EXISTS / IF EXISTS** for idempotency
3. **RLS policies** for any new tables
4. **Permission grants** for `authenticated`, `anon`, `service_role`
5. **UUID primary keys** using `gen_random_uuid()`
6. **Object registration** in `hm_core.object_registry`

### Example
```sql
-- Migration: Create signal_sources table
-- Purpose: Track different signal input sources for HMSO

CREATE TABLE IF NOT EXISTS wa_intel.signal_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE wa_intel.signal_sources ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read signal sources"
  ON wa_intel.signal_sources FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Grants
GRANT SELECT ON wa_intel.signal_sources TO authenticated;
GRANT SELECT ON wa_intel.signal_sources TO anon;
GRANT ALL ON wa_intel.signal_sources TO service_role;

-- Register in object registry
INSERT INTO hm_core.object_registry (object_type, object_name, object_schema, owner_app, description)
VALUES ('table', 'signal_sources', 'wa_intel', 'wa_intel', 'Tracks different signal input sources for HMSO');
```

---

## CRITICAL: MCP Compatibility

When executing migrations via Supabase MCP tool:

**NO DOLLAR-QUOTING** — The MCP tool cannot handle `$` characters in SQL.

Bad:
```sql
CREATE FUNCTION my_func() RETURNS void AS $$
BEGIN
  -- code
END;
$$ LANGUAGE plpgsql;
```

Good:
```sql
CREATE FUNCTION wa_intel__my_func() RETURNS void AS '
BEGIN
  -- code
END;
' LANGUAGE plpgsql;
```

For strings containing single quotes, escape them:
```sql
-- Use doubled single-quotes: 'it''s a test'
```

---

## Destructive Operations

NEVER include these in migrations without explicit user approval AND boundary check:
- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- `DELETE FROM` (bulk deletes)

If destructive operations are needed:
1. Check `hm_core.object_registry` for ownership (`owner_app = 'wa_intel'`)
2. Get user approval
3. Document the reason in the migration comment
4. Create a backup migration first

---

## Enforcement Checklist

Before approving any migration:
- [ ] File in `HMWAIntel/supabase/migrations/` with timestamp name
- [ ] Comment header with purpose
- [ ] `IF NOT EXISTS` / `IF EXISTS` used
- [ ] RLS policies for new tables
- [ ] UUID PKs with `gen_random_uuid()`
- [ ] Grants to `authenticated`, `anon`, `service_role`
- [ ] No dollar-quoting (MCP compatibility)
- [ ] Object registered in `hm_core.object_registry`
- [ ] Boundary check passed (only `wa_intel` objects)
- [ ] No destructive operations without approval
