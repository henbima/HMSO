# SPEC VERIFICATION PROMPT — HMSO

**Version:** 1.0.0
**Last Updated:** 2026-02-13
**Purpose:** Verify that all tasks in a spec are truly complete

---

## STEP 0: Initialize Review

Spec Number: [SPEC_NUMBER]
Construct file paths:
- Requirements: `HMWAIntel/specs/{NUMBER}-{spec-name}/requirements.md`
- Design: `HMWAIntel/specs/{NUMBER}-{spec-name}/design.md`
- Tasks: `HMWAIntel/specs/{NUMBER}-{spec-name}/tasks.md`
- Report output: `HMWAIntel/specs/{NUMBER}-{spec-name}/reports/{NUMBER}-implementation-report-YYYY-MM-DD.md`

---

## STEP 1: Load Specification Documents

Read and understand:
- requirements.md — What needs to be built
- design.md — How it should be built
- tasks.md — Breakdown of work items

---

## STEP 2: Verify Each Task

For each task in the tasks file, verify:

**Completion Criteria:**
- [ ] Code exists: Files/components mentioned in task are present in codebase (under `HMWAIntel/`)
- [ ] Functionality works: Code implements what requirements specify
- [ ] Design compliance: Implementation matches design specifications
- [ ] No placeholders: No TODO comments, dummy data, or incomplete logic
- [ ] Follows standards: Code adheres to kernel.md standards
- [ ] wa_intel schema: All DB queries use `wa_intel` schema
- [ ] Boundary safe: No modifications to objects not owned by `wa_intel`

**Verification Method:**
1. Identify which files should exist for this task
2. Check those files exist in the codebase
3. Review the code to confirm it implements the requirement
4. Compare against design specifications

**Action:**
- If task is complete: Mark as `[x]` in tasks file
- If task is incomplete: Keep as `[ ]` and document what's missing

---

## STEP 3: Generate Implementation Report

Create: `HMWAIntel/specs/{NUMBER}-{spec-name}/reports/{NUMBER}-implementation-report-YYYY-MM-DD.md`

### Report Template:

```markdown
# Implementation Report — Spec {NUMBER}

**Specification:** {Spec Name}
**Review Date:** {Current Date}
**Reviewer:** {AI Name}

---

## Executive Summary
- **Total tasks:** {X}
- **Completed:** {X} ✅
- **Incomplete:** {X} ⚠️
- **Completion rate:** {X}%
- **Overall status:** [Ready / Not Ready / Needs Review]

---

## Completed Tasks

### ✅ Task {ID}: {Task Name}
- **Files verified:** `{list file paths}`
- **Verification method:** {how completion was confirmed}
- **Notes:** {any observations}

---

## Incomplete Tasks

### ⚠️ Task {ID}: {Task Name}
- **Status:** [Not started / Partially complete / Blocked]
- **What's missing:** {specific gaps identified}
- **Next steps:** {what needs to be done}

---

## Discrepancies Found

### Issue {N}: {Brief description}
- **Location:** `{file path}`
- **Expected:** {what requirements/design specify}
- **Actual:** {what code currently does}
- **Severity:** [Critical / Major / Minor]

---

## Quality Checks
- [ ] `npm run typecheck` — {Pass/Fail}
- [ ] `npm run build` — {Pass/Fail}
- [ ] `npm run lint` — {Pass/Fail}
- [ ] wa_intel schema used correctly
- [ ] No boundary violations

---

## Overall Assessment

**Production Readiness:** [Yes / No / With caveats]

**Summary:** {Professional assessment}

**Recommendations:**
1. {Action item}
2. {Action item}
```

---

## DELIVERABLES

1. **Updated Tasks File** — All completed tasks marked `[x]`, incomplete remain `[ ]`
2. **Implementation Report** — In `reports/` folder with comprehensive findings

---

## VERIFICATION STANDARDS

### What "Complete" Actually Means:
- ✅ Code exists and is functional
- ✅ Fully implements the requirement
- ✅ Matches design specifications
- ✅ Includes error handling
- ✅ Has no placeholders or TODOs
- ✅ Follows project standards (kernel.md)
- ✅ Uses `wa_intel` schema correctly

### What "Incomplete" Looks Like:
- ❌ Code missing or commented out
- ❌ Placeholder functions or dummy data
- ❌ TODO comments indicating unfinished work
- ❌ Missing error handling
- ❌ Doesn't match requirements/design
- ❌ Uses wrong schema or direct Supabase calls in components

### Be Honest:
- Don't mark tasks complete just because code exists
- Verify logic, not just presence of files
- Flag ambiguities in requirements/design
- Be honest about what you can/cannot verify

---

## After Doublecheck

Add this header at the top of tasks.md:

```markdown
---
**Last Verified:** YYYY-MM-DD HH:MM
**Verified By:** {AI Name}
**Result:** {X}/{Y} tasks complete
**Report:** `reports/{NUMBER}-implementation-report-YYYY-MM-DD.md`
---
```
