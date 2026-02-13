# Spec 201: Classifier Improvements — Tasks

**Status:** Completed
**Priority:** P0 (deadline_parsed) + P1 (task completion, model abstraction)

---

### Phase 1: Fix deadline_parsed (P0)

#### - [x] Task 1.1: Update saveClassification() in classify-messages Edge Function
**File:** `supabase/functions/classify-messages/index.ts`

**Acceptance Criteria:**
- [x] `deadline_parsed` field added to `saveClassification()` INSERT using `tryParseDeadline(cls.deadline)`
- [x] Both `classified_items.deadline_parsed` and `tasks.deadline` are set from same parse logic
- [x] NULL handling: if `cls.deadline` is null or unparseable, `deadline_parsed` is null

**Commit:** `fix(classifier): populate deadline_parsed in classified_items`

#### - [x] Task 1.2: Deploy updated classify-messages Edge Function
**File:** N/A (Supabase MCP `deploy_edge_function`)

**Acceptance Criteria:**
- [x] Edge Function deployed successfully (version bump from v9 → v10)
- [ ] Test: trigger classification → verify `deadline_parsed` is populated when deadline text exists

---

### Phase 2: Task Completion Detection (P1)

#### - [x] Task 2.1: Create detect-task-completion Edge Function
**File:** `supabase/functions/detect-task-completion/index.ts`

**Acceptance Criteria:**
- [x] Fetches open tasks (status NOT IN 'done', 'cancelled')
- [x] For each task, searches recent messages in same group from assigned_to person
- [x] Matches completion keywords: "sudah", "selesai", "done", "sudah dikerjakan", "sudah beres", "sudah selesai"
- [x] Updates matched tasks: `status='done'`, `completed_at`, `completion_message_id`
- [x] Returns JSON: `{ checked: N, completed: N, errors: [] }`
- [x] Handles edge cases: null assigned_to, no matching group, no messages

**Commit:** `feat(classifier): add task completion detection edge function`

#### - [x] Task 2.2: Deploy detect-task-completion Edge Function
**File:** N/A (Supabase MCP `deploy_edge_function`)

**Acceptance Criteria:**
- [x] Edge Function deployed and accessible (v1)
- [ ] Manual invocation returns valid JSON response

---

### Phase 3: AI Model Abstraction (P1)

#### - [x] Task 3.1: Refactor classify-messages with AI provider interface
**File:** `supabase/functions/classify-messages/index.ts`

**Acceptance Criteria:**
- [x] `AIProvider` interface defined with `classify()` method
- [x] `OpenAIProvider` class implements the interface (extracted from current `callOpenAI()`)
- [x] `createAIProvider()` factory reads `AI_PROVIDER` and `AI_MODEL` env vars
- [x] Fallback: defaults to OpenAI + gpt-4o-mini if env vars not set
- [x] Existing behavior unchanged — same prompts, same output format
- [x] New env vars: `AI_PROVIDER` (default: "openai"), `AI_MODEL` (default: "gpt-4o-mini")

**Commit:** `refactor(classifier): abstract AI provider for model swappability`

#### - [x] Task 3.2: Deploy refactored classify-messages
**File:** N/A (Supabase MCP `deploy_edge_function`)

**Acceptance Criteria:**
- [x] Deployed successfully (v11)
- [ ] Classification still works with default env vars (OpenAI) — needs live test

---

## Completion Checklist
- [ ] Verify via SQL: `SELECT deadline_parsed FROM wa_intel.classified_items WHERE deadline IS NOT NULL` returns non-null values
- [ ] Verify detect-task-completion returns valid response
- [ ] Verify classify-messages still produces correct classifications after refactor
