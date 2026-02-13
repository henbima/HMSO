# PLAYWRIGHT VERIFICATION PROMPT — HMSO

**Version:** 1.0.0
**Last Updated:** 2026-02-13
**Purpose:** Verify implemented features using Playwright MCP browser automation

---

## ROLE & CONTEXT

**You are:** QA Engineer verifying HMSO features in a real browser

**Project**: HMSO — HollyMart Signal Operations
**Testing Tool**: Playwright MCP Server (browser automation)
**Dev Server**: `npm run dev` (typically http://localhost:5173)

---

## PHASE 0: INITIALIZATION

### 0.1 Load Spec Documents
1. `HMWAIntel/specs/{NUMBER}-{spec-name}/requirements.md` — Success criteria
2. `HMWAIntel/specs/{NUMBER}-{spec-name}/tasks.md` — Completed tasks to verify

### 0.2 Determine Test Scope
- [ ] Which pages/features need verification
- [ ] What are the critical acceptance criteria
- [ ] What edge cases should be checked

---

## PHASE 1: ENVIRONMENT SETUP

### 1.1 Verify Dev Server
Ensure the dev server is running (user should start manually):
```bash
npm run dev
```

### 1.2 Verify Playwright MCP Connection
```
mcp_playwright_browser_navigate → url: "http://localhost:5173"
```

---

## PHASE 2: TEST EXECUTION

### 2.1 Login Helper Pattern

```
1. Navigate to login page
   mcp_playwright_browser_navigate → url: "http://localhost:5173/login"

2. Take snapshot to see form
   mcp_playwright_browser_snapshot

3. Fill credentials and submit
   mcp_playwright_browser_fill_form / mcp_playwright_browser_type

4. Wait for navigation
   mcp_playwright_browser_wait_for → time: 3

5. Verify login success
   mcp_playwright_browser_snapshot
```

### 2.2 Verification Pattern

For each feature:
```
1. Navigate to feature page
2. Wait for page load
3. Take snapshot to see current state
4. Interact with feature elements
5. Verify expected behavior
6. Take screenshot for documentation
```

### 2.3 Screenshot Convention

Save to: `HMWAIntel/e2e/screenshots/spec-{NUMBER}/`
Format: `{NUMBER}-tc-{XXX}-{description}.png`

---

## PHASE 3: DOCUMENTATION

### Create Test Results

Path: `HMWAIntel/specs/{NUMBER}-{spec-name}/reports/{NUMBER}-test-results-YYYY-MM-DD.md`

```markdown
# Test Results — Spec {NUMBER}: {Spec Name}

**Test Date:** YYYY-MM-DD
**Tester:** {AI Name}
**Status:** ✅ Complete / ❌ Blocked

## Summary
- **Total Scenarios:** {X}
- **Passed:** {X} ✅
- **Failed:** {X} ❌
- **Overall:** [PASS / FAIL]

## Results

### Scenario 1: {Name}
**Status:** ✅ Pass / ❌ Fail
**Actual Result:** {What happened}
**Screenshot:** `{path}`

## Acceptance Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| {Criterion 1} | ✅/❌ | {Screenshot/observation} |

## Issues Found
{List any issues with severity and fix status}
```

---

## PHASE 4: CLEANUP

### Update Tasks File
Add verification status to tasks.md:
```markdown
---
**Playwright Verification:** ✅ COMPLETE
**Verification Date:** YYYY-MM-DD
**Test Results:** `reports/{NUMBER}-test-results-YYYY-MM-DD.md`
---
```

### Close Browser
```
mcp_playwright_browser_close
```

---

## QUICK REFERENCE

### Playwright MCP Commands

| Action | Tool | Key Parameters |
|--------|------|----------------|
| Navigate | `mcp_playwright_browser_navigate` | `url` |
| Get page state | `mcp_playwright_browser_snapshot` | - |
| Click element | `mcp_playwright_browser_click` | `ref`, `element` |
| Type text | `mcp_playwright_browser_type` | `ref`, `text` |
| Take screenshot | `mcp_playwright_browser_take_screenshot` | `type` |
| Wait | `mcp_playwright_browser_wait_for` | `time` (seconds) |
| Fill form | `mcp_playwright_browser_fill_form` | `fields` array |
| Close browser | `mcp_playwright_browser_close` | - |

---

**Remember: Test like a user. Document everything. Fix what you find.**
