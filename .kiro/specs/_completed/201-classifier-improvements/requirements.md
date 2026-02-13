# Spec 201: Classifier Improvements — Requirements

**Priority:** P0 (deadline_parsed) + P1 (task completion, model abstraction)
**Domain:** 200-299 (Message Processing & Classification)
**Status:** Planned

---

## Problem Statement

The `classify-messages` Edge Function (v9, deployed) has three gaps versus the blueprint:

1. **`deadline_parsed` never populated** — The `tryParseDeadline()` function exists and parses deadline text into ISO timestamps, but the result is only stored in `tasks.deadline`, never in `classified_items.deadline_parsed`. This column exists but is always NULL.

2. **Task completion detection missing** — Blueprint Module 3 specifies: *"If there's a reply 'sudah/selesai/done' from the assigned person → flag task as done."* This is not implemented at all. Currently 1 task exists with status `new` since 2026-02-07 with no mechanism to auto-close.

3. **AI model hardcoded, not abstracted** — Blueprint Note 7: *"AI API calls: abstract to separate function for easy swap (Gemini ↔ Claude ↔ GPT)."* Currently `gpt-4o-mini` is hardcoded with direct OpenAI `fetch()` calls. No abstraction layer.

### Verified Data (Supabase MCP, 2026-02-08)

| Metric | Value |
|---|---|
| `classified_items` total | 30 |
| `classified_items` with `deadline_parsed` populated | 0 |
| `classified_items` with `deadline` text populated | 0 |
| `tasks` total | 1 |
| `tasks` with status `new` (open) | 1 |
| Deployed classifier version | v9 |
| Current AI model | `gpt-4o-mini` (OpenAI) |

---

## User Stories

### US-1: deadline_parsed (P0)
**As** a dashboard user,
**I want** the `deadline_parsed` column in `classified_items` to be populated when the AI extracts a deadline,
**So that** I can sort and filter tasks by their parsed deadline dates.

### US-2: Task Completion Detection (P1)
**As** a system,
**I want** to automatically detect when a task assignee replies with completion keywords ("sudah", "selesai", "done", "sudah dikerjakan"),
**So that** tasks are auto-closed without manual intervention — reducing Hendra's workload.

### US-3: AI Model Abstraction (P1)
**As** a developer,
**I want** AI API calls abstracted behind a provider interface,
**So that** I can swap between OpenAI, Gemini, and Claude without rewriting the classifier logic.

---

## Acceptance Criteria

### AC-1: deadline_parsed
- [ ] When classifier saves to `classified_items`, `deadline_parsed` is populated using `tryParseDeadline()` if `deadline` text is present
- [ ] Existing `tryParseDeadline()` logic is reused (already handles "besok", "lusa", "hari ini", date patterns)
- [ ] Both `classified_items.deadline_parsed` AND `tasks.deadline` are set

### AC-2: Task Completion Detection
- [ ] A new Edge Function or extension to the classifier detects completion keywords
- [ ] Matching logic: same group + same `assigned_to` + keyword match + within 7 days of task creation
- [ ] Matched tasks are updated: `status = 'done'`, `completed_at = now()`, `completion_message_id` set
- [ ] Keywords supported: "sudah", "selesai", "done", "sudah dikerjakan", "sudah beres", "sudah selesai"
- [ ] Does not require 100% accuracy — dashboard allows manual override

### AC-3: AI Model Abstraction
- [ ] AI provider logic extracted into a separate module/function
- [ ] Supports at minimum: OpenAI (current), with interface ready for Gemini/Claude
- [ ] Model name configurable via environment variable (e.g., `AI_PROVIDER=openai`, `AI_MODEL=gpt-4o-mini`)
- [ ] No changes to classification prompt or output format

---

## Out of Scope

- Changing the classification prompt content
- Adding new classification categories
- Realtime classification (hybrid mode) — current batch mode is acceptable
- Implementing Gemini or Claude providers (just the interface/abstraction)
