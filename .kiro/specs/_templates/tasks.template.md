# Spec {NUMBER}: {Feature Name} — Tasks

**Status:** Planned
**Created:** YYYY-MM-DD HH:MM WITA

### Phase 1: {Phase Name — e.g., Service Layer}

#### - [ ] Task 1.1: {Task Name}
**Delegate to:** Sonnet | Haiku
**File:** `exact/path/to/file.ts`
**Pattern:** Follow `exact/path/to/pattern-file.ts`
**Imports:**
- `import { supabase } from '@shared/services/supabase'`
- `import type { ServiceResponse } from '@shared/types/service'`

**Types to define:** (if new types needed)
- `ExampleRow` — fields: field1 (string), field2 (number)
- Define in `src/modules/{module}/types/index.ts`

**Implementation notes:**
- Query `wa_intel.{table_name}` table
- Use same filtering pattern as {pattern service}
- Return type: `ExampleRow[]`
- Handle empty results with `(data || [])` guard

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Commit:** `feat({spec#}): description`

---

#### - [ ] Task 1.2: {Next Task}
**Delegate to:** Sonnet | Haiku
**File:** `exact/path/to/file.ts`
**Pattern:** Follow `exact/path/to/pattern-file.ts`
**Imports:**
- (list all needed imports)

**Implementation notes:**
- (specific details)

**Acceptance Criteria:**
- [ ] Criterion 1

**Commit:** `feat({spec#}): description`

---

### Phase 2: {Phase Name — e.g., Components}

#### - [ ] Task 2.1: {Task Name}
...

---

## Completion Checklist
- [ ] Run `npm run typecheck` (0 errors)
- [ ] Run `npm run build` (successful)
- [ ] Run `npm run lint` (warnings OK, errors must be fixed)
- [ ] All acceptance criteria from requirements.md met

## Task Writing Rules (Reference)
1. Every task must have a **Pattern file** — point to a real existing file
2. Every task must list **Imports** — exact import statements
3. **Types to define** — list every new interface with its fields
4. **One file per task** — don't combine multiple file changes
5. **Delegate to** — mark each task: Haiku (boilerplate), Sonnet (standard), Opus (novel)
