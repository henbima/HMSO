# Spec 201: Classifier Improvements — Design

**Priority:** P0 (deadline_parsed) + P1 (task completion, model abstraction)
**Domain:** 200-299 (Message Processing & Classification)

---

## Part 1: Fix `deadline_parsed` Population (P0)

### Current Flow (classify-messages Edge Function v9)

```
AI returns { deadline: "besok" }
  → saveClassification() stores deadline TEXT in classified_items.deadline
  → createTask() calls tryParseDeadline("besok") → stores parsed ISO in tasks.deadline
  → classified_items.deadline_parsed is NEVER set ❌
```

### Fixed Flow

```
AI returns { deadline: "besok" }
  → saveClassification() stores deadline TEXT + calls tryParseDeadline() → stores BOTH:
      classified_items.deadline = "besok"
      classified_items.deadline_parsed = "2026-02-09T17:00:00.000Z"
  → createTask() uses same parsed value for tasks.deadline
```

### Code Change

In `saveClassification()`, add `deadline_parsed` field:

```typescript
// In saveClassification()
const { data, error } = await supabase
  .from("classified_items")
  .insert({
    // ... existing fields ...
    deadline: cls.deadline || null,
    deadline_parsed: cls.deadline ? tryParseDeadline(cls.deadline) : null,  // NEW
    // ... rest ...
  })
```

**Impact:** Minimal — single field addition to an existing INSERT. No schema changes needed (column already exists).

---

## Part 2: Task Completion Detection (P1)

### Design: New Edge Function `detect-task-completion`

A separate Edge Function (not embedded in the classifier) that runs periodically to scan for completion signals.

### Algorithm

```
1. Fetch open tasks (status NOT IN ('done', 'cancelled'))
2. For each task:
   a. Get source_message group + assigned_to
   b. Search recent messages (last 7 days) in same group from assigned_to person
   c. Check if any message text matches completion keywords
   d. If match found → update task status to 'done'
```

### Completion Keywords (Bahasa Indonesia + English)

```typescript
const COMPLETION_KEYWORDS = [
  'sudah', 'selesai', 'done', 'sudah dikerjakan',
  'sudah beres', 'sudah selesai', 'sudah dilakukan',
  'sudah dijalankan', 'already done', 'completed'
];
```

### Matching Logic

```sql
-- Find potential completion messages for a task
SELECT m.id, m.message_text, m.sender_name, m.timestamp
FROM wa_intel.messages m
JOIN wa_intel.contacts c ON c.id = m.contact_id
WHERE m.wa_group_id = (
  SELECT g.wa_group_id FROM wa_intel.groups g WHERE g.name = task.group_name
)
AND (
  c.display_name ILIKE '%' || task.assigned_to || '%'
  OR c.short_name ILIKE '%' || task.assigned_to || '%'
)
AND m.timestamp > task.created_at
AND m.timestamp < task.created_at + INTERVAL '7 days'
AND m.message_text IS NOT NULL
ORDER BY m.timestamp DESC;
```

Then check each message against keywords using case-insensitive substring matching.

### Update on Match

```typescript
await supabase.from('tasks').update({
  status: 'done',
  completed_at: completionMessage.timestamp,
  completion_message_id: completionMessage.id,
  updated_at: new Date().toISOString(),
}).eq('id', task.id);
```

### Edge Function Structure

```
supabase/functions/detect-task-completion/index.ts
```

- Invoked via cron or manual trigger
- Returns: `{ checked: N, completed: N, errors: [] }`
- JWT: `verify_jwt: false` (service-level function, like classifier)

---

## Part 3: AI Model Abstraction (P1)

### Current State

Direct OpenAI fetch in `callOpenAI()`:
```typescript
const AI_MODEL = "gpt-4o-mini";
// ... hardcoded fetch to https://api.openai.com/v1/chat/completions
```

### Target State

Provider interface with environment-variable-driven selection:

```typescript
// ai-provider.ts (embedded in Edge Function)
interface AIProvider {
  classify(systemPrompt: string, userPrompt: string): Promise<string>;
}

class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string, private model: string) {}
  async classify(systemPrompt: string, userPrompt: string): Promise<string> {
    // existing OpenAI fetch logic
  }
}

// Future: GeminiProvider, ClaudeProvider

function createAIProvider(): AIProvider {
  const provider = Deno.env.get("AI_PROVIDER") || "openai";
  const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

  switch (provider) {
    case "openai":
      return new OpenAIProvider(Deno.env.get("OPENAI_API_KEY")!, model);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
```

### Environment Variables (new)

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `openai` | Which AI provider to use |
| `AI_MODEL` | `gpt-4o-mini` | Model name for the selected provider |

### Deployment

Since Edge Functions are single-file deployments, the provider abstraction will be embedded in the same `index.ts` file but structured as a clear section at the top.

---

## File Changes Summary

| File | Change Type | Description |
|---|---|---|
| `supabase/functions/classify-messages/index.ts` | Modify | Add `deadline_parsed` to `saveClassification()` + AI provider abstraction |
| `supabase/functions/detect-task-completion/index.ts` | **New** | Task completion detection Edge Function |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| False positive task completion | Medium | Only match assigned_to in same group within 7-day window |
| AI provider swap breaks output | Low | Output format is enforced by system prompt, not provider |
| deadline_parsed parsing errors | Low | `tryParseDeadline()` returns null on unparseable strings |
