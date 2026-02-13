# SPEC IMPLEMENTATION PROMPT — HMSO

**Version:** 1.0.0
**Last Updated:** 2026-02-13
**Purpose:** Direct AI to implement all tasks in a spec folder systematically

---

## ROLE & CONTEXT

**You are:** Senior Signal Operations Developer implementing features for HMSO

**Project**: HMSO — HollyMart Signal Operations
**Tech Stack**: React 18 + TypeScript, Vite, Tailwind CSS, Supabase (wa_intel schema)
**Listener**: Node.js + Baileys (WhatsApp)
**AI**: GPT-4o-mini (classification), OpenRouter (meeting summaries)

---

## PHASE 0: INITIALIZATION (MANDATORY)

### 0.1 Load Spec Documents
Read these files in order:
1. `HMWAIntel/specs/{NUMBER}-{spec-name}/requirements.md`
2. `HMWAIntel/specs/{NUMBER}-{spec-name}/design.md`
3. `HMWAIntel/specs/{NUMBER}-{spec-name}/tasks.md`

### 0.2 Load Project Standards
- `.kiro/steering/kernel.md` (always)
- `.kiro/steering/database-essentials.md` (if DB changes)
- `.kiro/steering/database-governance-consolidated.md` (if migrations)
- `.kiro/steering/supabase-migration-standards.md` (if creating migrations)

### 0.3 Verify Prerequisites
- [ ] All dependent specs are implemented
- [ ] Database schema matches design (use Supabase MCP to verify against `wa_intel`)
- [ ] Required services/components exist

### 0.4 Database Schema Verification (If Applicable)
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'wa_intel' AND table_name IN ('table1', 'table2');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'target_table' AND table_schema = 'wa_intel'
ORDER BY ordinal_position;
```

---

## PHASE 1: TASK EXECUTION

### Execution Rules

1. **Follow tasks.md exactly** — Do not deviate from the design
2. **One task at a time** — Complete each task fully before moving to the next
3. **Mark progress** — Update task checkboxes as you complete them
4. **Test after each phase** — Verify the phase works before proceeding
5. **No dollar-quoting in SQL** — Use single quotes (MCP compatibility)
6. **Run typecheck** — After code changes, run `npm run typecheck`
7. **Use Supabase MCP** — Apply migrations via `mcp_supabase_apply_migration` only
8. **wa_intel schema** — All tables in `wa_intel`, access via `supabase.schema('wa_intel')`
9. **Register new objects** — Insert into `hm_core.object_registry` after creating DB objects
10. **Boundary check** — Before modifying/dropping, verify ownership in registry

### Task Completion Workflow

```
1. READ the task description and acceptance criteria
2. IDENTIFY files to create/modify (under HMWAIntel/)
3. IMPLEMENT the code following existing patterns
4. VERIFY no TypeScript errors: npm run typecheck
5. MARK the task as complete [x] in tasks.md
6. PROCEED to next task
```

---

## PHASE 2: CODE STANDARDS

### Service Layer Pattern
```typescript
// All DB access through service layer
export const messageService = {
  async getMessages(groupId: string) {
    const { data, error } = await supabase
      .schema('wa_intel')
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
    return { data: data || [], error }
  }
}
```

### SQL Migration Pattern (MCP Compatible)
```sql
-- Migration: Description
-- Spec: {NUMBER}
-- Date: YYYY-MM-DD

-- Schema changes (wa_intel schema)
CREATE TABLE IF NOT EXISTS wa_intel.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.new_table ENABLE ROW LEVEL SECURITY;

-- NO DOLLAR-QUOTING! Use single quotes for functions:
CREATE OR REPLACE FUNCTION wa_intel__my_func()
RETURNS void AS '
BEGIN
  -- Use doubled single quotes: ''string''
END;
' LANGUAGE plpgsql;

-- Register in object registry
INSERT INTO hm_core.object_registry (object_type, object_name, object_schema, owner_app, description)
VALUES ('table', 'new_table', 'wa_intel', 'wa_intel', 'Description');
```

### Defensive Programming
```typescript
// CORRECT — Guard all array operations
{(messages || []).map(m => <MessageCard key={m.id} />)}
{(items || []).length === 0 && <EmptyState />}
```

---

## PHASE 3: VERIFICATION

### After Each Task
- [ ] Code compiles without errors
- [ ] TypeScript typecheck passes

### After All Tasks Complete
- [ ] All tasks marked [x] in tasks.md
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Implementation report created

---

## PHASE 4: COMPLETION

### Update Tasks File
Update status to "Completed" with date.

### Create Implementation Report
Path: `HMWAIntel/specs/{NUMBER}-{spec-name}/reports/{NUMBER}-implementation-report-YYYY-MM-DD.md`

**Minimum content:**
- Executive Summary
- Files Created / Modified
- Database Migrations (if any)
- Quality Assurance results
- Known Issues / Technical Debt

### Update Spec Registry
Update `HMWAIntel/SPEC_REGISTRY.md`:
- Change status to "Complete"
- Add completion date

---

## ERROR HANDLING

1. **Missing file** → Check if it should exist, ask for guidance
2. **Spec ambiguity** → Propose interpretations, ask for confirmation
3. **TypeScript error** → Fix systematically, never use `any`
4. **Migration fails** → Verify schema first, check MCP compatibility
5. **Boundary violation** → STOP, check `hm_core.object_registry`

---

## QUALITY GATES (Must Pass Before Completion)

- [ ] TypeScript typecheck passes with zero errors
- [ ] No `any` types used
- [ ] All array operations have defensive guards
- [ ] Service layer used for all DB access
- [ ] All SQL uses `wa_intel` schema
- [ ] No dollar-quoting in migrations
- [ ] New DB objects registered in `hm_core.object_registry`
- [ ] All file paths under `HMWAIntel/`

---

**Remember: Follow the spec exactly. Verify before assuming. Quality over speed.**
