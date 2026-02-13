---
inclusion: manual
---

# Database Governance — Consolidated Rules

## BEFORE ANY DATABASE OPERATION — ASK:
1. **Schema Change?** → If YES, create migration file first
2. **Using MCP for DDL?** → If YES, use `mcp_supabase_apply_migration` instead of `execute_sql`
3. **Schema Verified?** → If NO, check with `mcp_supabase_execute_sql` first
4. **Service Layer?** → If NO, use service layer pattern (see kernel.md)
5. **Boundary Check?** → If modifying/dropping, check `hm_core.object_registry` for ownership

## Core Rules (Never Break)
- **Service Layer Only**: All DB access through service layer — no direct `supabase.from()` in components
- **Migrations Only**: All schema changes through migration files in `HMWAIntel/supabase/migrations/`
- **Schema First**: Always verify actual schema before writing queries
- **Reuse First**: Check existing functionality before building new
- **wa_intel Schema**: All HMSO tables live in `wa_intel` schema, NOT `public`

## Critical HMSO Database Facts

| Aspect | Rule |
|--------|------|
| **Schema** | `wa_intel` (NOT `public`) |
| **Primary Keys** | Always UUID with `gen_random_uuid()` |
| **RLS** | Always ON — every table has Row Level Security enabled |
| **Shared DB** | Database shared with HMCS, HMBI, HMLS, Training |
| **Boundary** | Check `hm_core.object_registry` before any destructive operation |

**Key Tables:**
- **Messages**: `messages` (all sources: WhatsApp, meetings, future channels)
- **Classification**: `classified_items`, `tasks`, `directions`
- **Groups/Contacts**: `groups`, `contacts`, `group_members`
- **Briefings**: `daily_briefings`, `daily_topics`
- **Meetings**: `meetings`
- **Flags**: `message_flags`

## MCP Tool Usage
- **Read-Only Default**: Use `mcp_supabase_execute_sql` for SELECT queries only
- **No Direct DDL**: Never CREATE/ALTER/DROP through MCP `execute_sql`
- **Migration Files**: Use `mcp_supabase_apply_migration` for schema changes
- **Schema Verification**: Always check actual schema before assuming column existence

| Task | Correct Tool | Wrong Tool |
|------|-------------|------------|
| Check if column exists | `mcp_supabase_execute_sql` (SELECT) | Assume it exists |
| Add new column | `mcp_supabase_apply_migration` | `execute_sql` (ALTER) |
| Query data | `mcp_supabase_execute_sql` (SELECT) | Direct component query |
| Test RLS policy | `mcp_supabase_execute_sql` (SELECT) | Skip verification |

---

## Migration Workflow

### Step 1: Discover
```sql
-- Check what exists in wa_intel schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'wa_intel'
ORDER BY table_name;

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '<TABLE>' AND table_schema = 'wa_intel'
ORDER BY ordinal_position;
```

### Step 2: Plan
- Document what needs to change and why
- Present to user for approval
- Consider impact on existing data and queries

### Step 3: Write Migration
- Follow naming: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Save to `HMWAIntel/supabase/migrations/`
- Include all required elements (see below)

### Step 4: Apply
- Use `mcp_supabase_apply_migration` tool
- Also save local copy for git tracking

### Step 5: Verify
- Run a test query against the changed table
- Verify RLS policies work correctly
- Update any affected service functions or types
- Run `NOTIFY pgrst, 'reload schema'` to refresh PostgREST cache

---

## Migration Content Standards

```sql
-- Migration: [Brief Description]
-- Date: [CURRENT_DATE]
-- Description: [What this migration does and why]

-- Use IF NOT EXISTS for idempotent operations
CREATE TABLE IF NOT EXISTS wa_intel.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns here
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE wa_intel.new_table ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "policy_name"
  ON wa_intel.new_table FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Grants
GRANT SELECT, INSERT, UPDATE ON wa_intel.new_table TO authenticated;
GRANT SELECT ON wa_intel.new_table TO anon;
GRANT ALL ON wa_intel.new_table TO service_role;

-- Register in object registry
INSERT INTO hm_core.object_registry (object_type, object_name, object_schema, owner_app, description)
VALUES ('table', 'new_table', 'wa_intel', 'wa_intel', 'Description of table purpose');
```

### NO DOLLAR-QUOTING (MCP Compatibility)
```sql
-- WRONG:
CREATE FUNCTION my_func() RETURNS void AS $$
BEGIN -- code
END;
$$ LANGUAGE plpgsql;

-- CORRECT:
CREATE FUNCTION wa_intel__my_func() RETURNS void AS '
BEGIN -- code
END;
' LANGUAGE plpgsql;
```

---

## Service Layer Pattern

### Correct Pattern
```typescript
// Access wa_intel schema
const { data } = await supabase.schema('wa_intel').from('tasks').select('*')

// Service function
export const taskService = {
  async getTasks() {
    const { data, error } = await supabase
      .schema('wa_intel')
      .from('tasks')
      .select('*')
    return { data: data || [], error }
  }
}
```

### Wrong Pattern
```typescript
// NEVER do this in components
const MyComponent = () => {
  const { data } = supabase.schema('wa_intel').from('tasks').select() // NO!
}
```

---

## Enforcement Checklist

Before approving any database change:
- [ ] Migration file follows naming convention
- [ ] IF NOT EXISTS / IF EXISTS used
- [ ] RLS policies included for new tables
- [ ] UUID primary keys with `gen_random_uuid()`
- [ ] Grants to `authenticated`, `anon`, `service_role`
- [ ] No dollar-quoting (MCP compatibility)
- [ ] No destructive operations without explicit approval
- [ ] Object registered in `hm_core.object_registry`
- [ ] Boundary check passed (ownership = `wa_intel`)
