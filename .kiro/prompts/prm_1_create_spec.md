# SPEC CREATION PROMPT — HMSO

**Version:** 1.0.0
**Last Updated:** 2026-02-13
**Purpose:** Guide AI to create high-quality specs for HMSO (HollyMart Signal Operations)

---

## ROLE & CONTEXT

**You are:** Senior Signal Operations Architect creating a spec for HMSO

**Your Goal:** Create a complete, implementation-ready spec folder that:
- Passes all review criteria without revision
- Can be executed without assumptions
- Follows HMSO architecture standards (kernel.md)
- Is neither over-engineered nor under-engineered

**Project Standards:**
- `.kiro/steering/kernel.md`
- `.kiro/steering/hendra-governance.md` (if operational/system design)

---

## PHASE 0: PRE-CREATION VERIFICATION (MANDATORY)

### 0.1 Load Context Documents
- [ ] Read `.kiro/steering/kernel.md` (always)
- [ ] Read `.kiro/steering/database-essentials.md` (if spec involves DB changes)
- [ ] Read `.kiro/steering/hendra-governance.md` (if operational/system design)
- [ ] Read `HMWAIntel/SPEC_REGISTRY.md` to get next available spec number

### 0.2 Database Verification (If Applicable)
Run these queries via **Supabase MCP** to understand current state:

```sql
-- Check if tables mentioned in requirement exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'wa_intel' AND table_name = '{table_name}';

-- Check column structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '{table_name}' AND table_schema = 'wa_intel'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = '{table_name}';
```

### 0.3 Codebase Verification
Search the codebase to understand existing patterns:
- Check if similar functionality exists in `HMWAIntel/src/`
- Check existing services and components
- Check listener code in `HMWAIntel/listener/src/`
- Check edge functions in `HMWAIntel/supabase/functions/`

### 0.4 Document Findings

| Aspect | Current State | Impact on Spec |
|--------|---------------|----------------|
| [Tables] | [Exist/Missing] | [Need migration?] |
| [Services] | [Exist/Missing] | [Extend or create?] |
| [Components] | [Exist/Missing] | [Reuse or create?] |
| [Edge Functions] | [Exist/Missing] | [Deploy or update?] |

---

## PHASE 1: SPEC NUMBER RESERVATION

### 1.1 Determine Domain
Choose the appropriate domain range (HMSO-specific):
- **0xx**: Foundation & Discovery
- **1xx**: Listener & Infrastructure
- **2xx**: Classification & AI
- **3xx**: Contacts & Groups
- **4xx**: Briefings & Delivery
- **5xx**: Tasks & Directions
- **6xx**: Dashboard & UI
- **7xx**: Database & Performance

### 1.2 Get Next Available Number
Check `HMWAIntel/SPEC_REGISTRY.md` for the next available number in your domain.

### 1.3 Create Folder Structure
```
HMWAIntel/specs/{NUMBER}-{spec-name-kebab-case}/
├── requirements.md
├── design.md
├── tasks.md
├── implementation/           # Created during implementation
└── reports/                  # Created during implementation
```

---

## PHASE 2: REQUIREMENTS.MD CREATION

### Template Structure

```markdown
# {NUMBER}: {Spec Title}

**Status:** Planned
**Created:** YYYY-MM-DD
**Domain:** [Domain name from range]

## Overview
[2-3 sentences describing what this spec accomplishes]

## Problem Statement
[Clear description of the problem being solved]

## Success Criteria
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]

## Scope

### In Scope
- [Feature/change 1]

### Out of Scope
- [Explicitly excluded item 1]

## Dependencies
- **Database Dependencies**: [Tables/columns in wa_intel schema]
- **Service Dependencies**: [Services required]
- **External Dependencies**: [Listener, edge functions, APIs]

## Acceptance Criteria
1. [Specific, testable criterion]
2. [Specific, testable criterion]
```

---

## PHASE 3: DESIGN.MD CREATION

### Template Structure

```markdown
# {NUMBER}: {Spec Title} — Design

## Architecture Overview
[High-level description of the solution approach]

## Database Changes (If Applicable)

### New Tables (in wa_intel schema)
```sql
CREATE TABLE IF NOT EXISTS wa_intel.{table_name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.{table_name} ENABLE ROW LEVEL SECURITY;

-- Register in object registry
INSERT INTO hm_core.object_registry (object_type, object_name, object_schema, owner_app, description)
VALUES ('table', '{table_name}', 'wa_intel', 'wa_intel', '{description}');
```

### Rollback Plan
```sql
-- Rollback: {description}
```

## Service Layer Design
[Services to create/modify]

## Component Design
[Components to create/modify]

## Data Flow
```
Signal Source → Listener/Ingestion → wa_intel.messages → Classification → Output
```

## Error Handling
| Error Case | Handling Strategy |
|------------|-------------------|

## Security Considerations
- [ ] RLS policies defined
- [ ] Boundary check (wa_intel ownership)
- [ ] No hardcoded values
```

---

## PHASE 4: TASKS.MD CREATION

### Template Structure

```markdown
# {NUMBER}: {Spec Title} — Tasks

**Status:** Planned
**Total Tasks**: {N}

## Tasks

### Phase 1: {Phase Name}

#### - [ ] Task 1.1: {Task Name}
**File:** `HMWAIntel/{exact/file/path}`

**Acceptance Criteria:**
- [ ] {Specific criterion}
- [ ] {Specific criterion}

#### - [ ] Task 1.2: {Task Name}
...

## Post-Implementation Checklist
- [ ] All tasks marked complete
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Implementation report created in `reports/`
- [ ] SPEC_REGISTRY.md updated
```

### Task Quality Rules
- Each task is <4 hours of work
- File paths are exact (under `HMWAIntel/`)
- Acceptance criteria are specific and testable
- Dependencies between tasks are explicit
- Tasks follow logical implementation order

---

## PHASE 5: REGISTRY UPDATE

### Update HMWAIntel/SPEC_REGISTRY.md
- Add entry to the appropriate Active Specs table
- Update the "Next Available" number in Domain Ranges

---

## FINAL CHECKLIST

- [ ] Problem statement is clear
- [ ] Success criteria are measurable
- [ ] All dependencies verified against actual DB/codebase
- [ ] Database changes use `wa_intel` schema
- [ ] New objects registered in `hm_core.object_registry`
- [ ] No dollar-quoting in SQL (MCP compatibility)
- [ ] File paths use `HMWAIntel/` prefix
- [ ] Spec folder in `HMWAIntel/specs/` (NOT `.kiro/specs/`)
- [ ] SPEC_REGISTRY.md updated
