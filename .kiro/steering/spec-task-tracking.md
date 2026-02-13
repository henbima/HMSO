---
inclusion: manual
---

# Spec Task Tracking Standards — HMSO

**Version:** 1.0.0
**Created:** 2026-02-13

---

## Rules

### 1. Task Checkboxes (MANDATORY)

Every task in tasks.md MUST include a checkbox marker:
- `- [ ]` for pending/not-started tasks
- `- [x]` for completed tasks

**Format:**
```markdown
#### - [ ] Task 1.1: Create Migration File
#### - [x] Task 1.2: Apply Migration
```

### 2. Acceptance Criteria Checkboxes

Each acceptance criterion within a task SHOULD use checkboxes:

```markdown
**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] RLS policies enabled
- [x] Migration uses IF NOT EXISTS
```

### 3. Mark Tasks As You Go

- Mark each task `[x]` immediately after completing it
- Do NOT batch-mark tasks at the end of implementation
- This creates an accurate progress trail

### 4. Status Header

Every tasks.md MUST have a status header:

```markdown
**Status:** Planned          (not started)
**Status:** In Progress      (partially done)
**Status:** Completed        (all done)
```

Add `**Completed:** YYYY-MM-DD` when marking as complete.

### 5. Implementation Reports (MANDATORY on completion)

After ALL tasks are done, create an implementation report:

**Path:** `HMWAIntel/specs/{NUMBER}-{name}/reports/{NUMBER}-implementation-report-YYYY-MM-DD.md`

**Minimum content:**
- Executive Summary (2-3 sentences)
- Delivered Features (checkbox list)
- Files Created / Modified
- Quality Assurance results (typecheck, build, lint)
- Known Issues / Technical Debt

### 6. Spec Completion Protocol

Before marking a spec as complete in `HMWAIntel/SPEC_REGISTRY.md`:

1. All tasks marked `[x]` in tasks.md
2. Status updated to "Completed" with date
3. Implementation report created in `reports/` folder
4. Quality checks pass (`npm run typecheck`, `npm run build`)
5. SPEC_REGISTRY.md updated (move to Completed section)
6. Spec folder moved to `HMWAIntel/specs/_completed/`
