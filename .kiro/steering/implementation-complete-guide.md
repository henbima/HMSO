---
inclusion: manual
---

# Implementation Quality Gates & Verification — HMSO

## Quick Reference

### Before Starting ANY Implementation
1. **Map affected components** → List ALL creation, display, processing points
2. **Plan integration** → How components connect
3. **Define verification** → How to prove it works

### During Implementation
1. **Show actual changes** → File diffs, not descriptions
2. **Update ALL integration points** → Every component that uses the feature
3. **Test incrementally** → Verify each component works

### After Implementation
1. **End-to-end workflow test** → Complete user journey
2. **Backward compatibility** → Old data still works
3. **Quality checks** → `npm run typecheck`, `npm run build`, `npm run lint`

### Critical Principle
**VERIFICATION > SPECIFICATION** — Prove completion, don't just claim it.

---

## 5 Mandatory Quality Gates

### Gate 1: Component Integration Verification
Before marking any UI task complete:
- Component renders without errors
- Props are correctly typed (no `any`)
- Event handlers are connected
- State management works (loading, error, success, empty)

### Gate 2: Impact Analysis
Before modifying any existing file:
- List all files that import/use the changed code
- Verify changes don't break existing functionality
- Check for cascading type changes

### Gate 3: Completeness Checklist
For each task, verify:
- [ ] Code compiles (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Linter passes (`npm run lint`)
- [ ] All acceptance criteria from spec are met
- [ ] No placeholder/TODO comments left in code
- [ ] No hardcoded values that should be configurable
- [ ] Uses `wa_intel` schema for all DB queries

### Gate 4: Integration Testing
After implementation:
- Test the feature end-to-end
- Test edge cases (empty data, long strings, many items)
- Test error states (network failure, invalid data)

### Gate 5: Code Review Checklist
- [ ] No `any` types
- [ ] Array operations have null guards
- [ ] Loading/empty states exist
- [ ] No console.log left (except intentional debug)
- [ ] Follows project naming conventions
- [ ] Service layer used for all DB access

---

## 3-Gate AI Safety System

### Before Implementation
- Read the spec files completely
- Read CLAUDE.md / kernel.md for conventions
- Verify database schema matches design (query `wa_intel` schema)
- Present plan to user before coding

### During Implementation
- Follow conventions from kernel.md
- Run typecheck after each significant change
- Don't skip steps or take shortcuts

### After Implementation
- Run full quality suite (`npm run typecheck` + `npm run build` + `npm run lint`)
- Verify against acceptance criteria
- Mark task complete only when ALL gates pass

---

## Prevention of False Verification

NEVER claim something works without evidence:
- "Tested and working" requires actual test execution
- "Build passes" requires `npm run build` output showing success
- "No errors" requires `npm run typecheck` output showing 0 errors

If you cannot verify, say so honestly: "I believe this should work but I wasn't able to verify because [reason]."

### Red Flags (Never Accept)
- "Component created" (without integration proof)
- "Should work now" (without demonstration)
- "Feature implemented" (without verification)
- "Task complete" (without evidence)

### Verification Questions
- "Show me the complete user journey"
- "What happens when [specific action] is performed?"
- "How do you know all the viewing components work?"
- "Show me evidence for each task you claim to have verified"

---

## Task Completion Criteria

A task is only complete when:
- All specified changes are implemented
- All integration points are updated
- End-to-end workflow is demonstrated
- Backward compatibility is verified
- Evidence is provided for each claim
- Quality gates pass (`typecheck` + `build` + `lint`)
