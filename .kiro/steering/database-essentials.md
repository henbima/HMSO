---
inclusion: manual
version: 1.0.0
last-updated: 2026-02-13
---

# Database Essentials — Quick Reference Guide

## Critical Decision Tree (Check EVERY Time)

**Before ANY database operation, answer these questions in order:**

1. **Am I changing schema?** (CREATE/ALTER/DROP)
   - YES → Stop. Create migration file first (see `database-governance-consolidated.md`)
   - NO → Continue

2. **Have I verified the actual schema?**
   - NO → Stop. Run schema verification queries first
   - YES → Continue

3. **Am I accessing database from a component?**
   - YES → Stop. Use service layer only
   - NO → Continue

4. **Am I using MCP tools for DDL?**
   - YES → Stop. Use `mcp_supabase_apply_migration`, not `execute_sql`
   - NO → Proceed

---

## HMSO Database Facts

| Aspect | Rule | Example |
|--------|------|---------|
| **Schema** | `wa_intel` (NOT `public`) | `wa_intel.messages` |
| **Primary Keys** | Always UUID | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| **RLS** | Always ON | Every table has Row Level Security enabled |
| **Access** | Use `.schema('wa_intel')` | `supabase.schema('wa_intel').from('tasks')` |

**Core Tables:**
- **Messages**: `messages` (WhatsApp, meetings, future channels — `source_type` column)
- **Classification**: `classified_items` (AI classification results)
- **Tasks/Directions**: `tasks`, `directions`
- **Groups/Contacts**: `groups`, `contacts`, `group_members`
- **Briefings**: `daily_briefings`, `daily_topics`
- **Meetings**: `meetings` (transcripts + summaries)
- **Flags**: `message_flags` (real-time triage)

### Essential Commands (Copy-Paste Ready)

```sql
-- 1. Verify table structure (ALWAYS run first)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'your_table' AND table_schema = 'wa_intel'
ORDER BY ordinal_position;

-- 2. Check RLS policies (when updates/inserts fail)
SELECT policyname, cmd, qual FROM pg_policies
WHERE tablename = 'your_table';

-- 3. Test data access (verify permissions)
SELECT COUNT(*) FROM wa_intel.your_table;

-- 4. List all wa_intel tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'wa_intel'
ORDER BY table_name;
```

---

## Schema Verification Workflow

### NEVER Assume Schema — Always Verify First

**3-Step Verification Process:**

#### Step 1: Verify Table Structure
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'target_table' AND table_schema = 'wa_intel'
ORDER BY ordinal_position;
```

#### Step 2: Check Constraints & Keys
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'target_table' AND table_schema = 'wa_intel';
```

#### Step 3: Verify Foreign Keys
```sql
SELECT
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.key_column_usage kcu
JOIN information_schema.constraint_column_usage ccu
    ON kcu.constraint_name = ccu.constraint_name
WHERE kcu.table_name = 'target_table'
AND kcu.constraint_name IN (
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
);
```

---

## RLS Policy Requirements

### Every New Table Needs RLS

```sql
-- 1. Enable RLS
ALTER TABLE wa_intel.your_table ENABLE ROW LEVEL SECURITY;

-- 2. Authenticated users: scoped access
CREATE POLICY "authenticated_access" ON wa_intel.your_table
FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. Service role: full access
-- (service_role bypasses RLS by default in Supabase)
```

### RLS Debugging Commands
```sql
-- Check all policies for a table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'your_table';

-- Test current user context
SELECT auth.uid(), auth.role();
```

---

## Database-First Debugging

### When Database Operations Fail

**Follow this sequence — database first, application last:**

1. **Schema Verification** (ALWAYS FIRST)
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'target_table' AND table_schema = 'wa_intel';
```

2. **RLS Policy Check** (CRITICAL for UPDATE/INSERT failures)
```sql
SELECT policyname, cmd, qual FROM pg_policies
WHERE tablename = 'target_table';
```

3. **Permission Verification**
```sql
SELECT auth.uid(), auth.role();
```

4. **Data Integrity Check**
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'target_table' AND table_schema = 'wa_intel';
```

5. **Application Layer** (ONLY AFTER DATABASE VERIFIED)

### Common Failure Patterns

| Symptom | Most Likely Cause | First Check |
|---------|-------------------|-------------|
| UPDATE fails silently | RLS policy blocks it | Check RLS policies |
| INSERT returns error | Column doesn't exist | Verify schema |
| SELECT returns empty | RLS policy too restrictive | Check user role |
| Foreign key error | Referenced record missing | Check related table |
| Schema not found | Wrong schema name | Verify using `wa_intel` |

---

## Index Strategy

### When to Use Indexes

```sql
-- Check existing indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'wa_intel' AND tablename = 'your_table';

-- Check index usage
SELECT
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'wa_intel'
ORDER BY idx_scan ASC;
```

### Common Index Patterns for HMSO
```sql
-- Messages by group and date (most common query)
CREATE INDEX IF NOT EXISTS idx_messages_group_date
ON wa_intel.messages(group_id, created_at DESC);

-- Messages by source type
CREATE INDEX IF NOT EXISTS idx_messages_source_type
ON wa_intel.messages(source_type, created_at DESC);

-- Classified items by type and date
CREATE INDEX IF NOT EXISTS idx_classified_items_type_date
ON wa_intel.classified_items(classification_type, created_at DESC);
```

---

## See Also

- **database-governance-consolidated.md** — Full governance rules and migration workflow
- **database-boundary-governance.md** — Multi-app boundary safety
- **supabase-migration-standards.md** — Migration file format and MCP compatibility
- **superior-debugging-methodology.md** — Infrastructure-first debugging approach
