# Spec 202: Topic-Based Classification Redesign — Design

**Status:** Planned  
**Domain:** 200-299 (Message Processing & Classification)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│           TWO-LAYER CLASSIFICATION ARCHITECTURE              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LAYER 1: REAL-TIME TRIAGE                                   │
│  ┌──────────────────────────────────────────┐               │
│  │ Message arrives → DB trigger/function     │               │
│  │ Keyword/heuristic scan (NO AI)           │               │
│  │ → INSERT wa_intel.message_flags          │               │
│  │ Flags: urgent, hendra_instruction,       │               │
│  │        question, low_stock, complaint    │               │
│  └──────────────────────────────────────────┘               │
│  ⚡ Latency: <1 sec | Cost: $0                              │
│                                                              │
│  LAYER 2: DAILY DEEP ANALYSIS                                │
│  ┌──────────────────────────────────────────┐               │
│  │ Cron 6AM WIB → analyze-daily Edge Fn     │               │
│  │                                           │               │
│  │ Per active group:                         │               │
│  │  1. Fetch full day's messages (24h)       │               │
│  │  2. AI topic segmentation                 │               │
│  │  3. AI topic classification               │               │
│  │  4. Store → wa_intel.daily_topics         │               │
│  │  5. Auto-create tasks & directions        │               │
│  │                                           │               │
│  │ Then: check ongoing multi-day topics      │               │
│  └──────────────────────────────────────────┘               │
│  ⏰ Runs once/day | Cost: ~15 AI calls                      │
│                                                              │
│  DAILY BRIEFING (7AM WIB, unchanged cron)                    │
│  ┌──────────────────────────────────────────┐               │
│  │ Reads wa_intel.daily_topics (not          │               │
│  │ classified_items) → topic-based briefing  │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
[WhatsApp Message Arrives]
        │
        ├──→ [Layer 1: Triage Function]
        │       │
        │       └──→ wa_intel.message_flags (instant, keyword-based)
        │
        └──→ wa_intel.messages (existing flow, unchanged)
                │
                │  ⏰ Once daily at 6AM WIB
                ▼
        [Layer 2: analyze-daily Edge Function]
                │
                ├── Step 1: Fetch yesterday's messages per group
                ├── Step 2: AI topic segmentation (group related msgs)
                ├── Step 3: AI topic classification (per topic)
                ├── Step 4: Store → wa_intel.daily_topics
                ├── Step 5: Auto-create tasks & directions
                └── Step 6: Check multi-day ongoing topics
                        │
                        ▼
        [Daily Briefing Edge Function — 7AM WIB]
                │
                └──→ wa_intel.daily_briefings (topic-based format)
```

---

## 2. Database Changes

### 2a. New Table: `wa_intel.message_flags`

Purpose: Lightweight real-time flags for urgent/important message detection.

```sql
CREATE TABLE IF NOT EXISTS wa_intel.message_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES wa_intel.messages(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    resolved_at TIMESTAMPTZ,
    resolved_by_message_id UUID REFERENCES wa_intel.messages(id),
    flagged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_flags_type
    ON wa_intel.message_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_message_flags_unresolved
    ON wa_intel.message_flags(flag_type)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_flags_message
    ON wa_intel.message_flags(message_id);

-- RLS
ALTER TABLE wa_intel.message_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on message_flags"
    ON wa_intel.message_flags FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read message_flags"
    ON wa_intel.message_flags FOR SELECT
    TO authenticated USING (true);

-- Grants
GRANT SELECT ON wa_intel.message_flags TO authenticated;
GRANT ALL ON wa_intel.message_flags TO service_role;
```

**Flag types:**

| flag_type | Detection | Example Match |
|---|---|---|
| `urgent` | Keywords: urgent, darurat, segera, ASAP, kebakaran, emergency | "URGENT: stok habis!" |
| `hendra_instruction` | `is_from_hendra = true` AND msg length > 50 AND imperative tone | Hendra: "Tolong semua store manager..." |
| `question` | Ends with "?" OR starts with apa/kapan/dimana/bagaimana/kenapa/siapa/berapa | "Kapan barang datang?" |
| `low_stock` | Keywords: stok habis, tinggal X karton, kosong, out of stock, habis | "Minyak goreng tinggal 3" |
| `complaint` | Keywords: komplain, marah, kecewa, rusak, expired, cacat | "Customer komplain roti expired" |

### 2b. New Table: `wa_intel.daily_topics`

Purpose: One row per identified topic per day per group. The primary classification unit.

```sql
CREATE TABLE IF NOT EXISTS wa_intel.daily_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES wa_intel.groups(id),
    topic_date DATE NOT NULL,
    topic_label TEXT NOT NULL,
    message_ids UUID[] NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    classification TEXT,
    summary TEXT,
    outcome TEXT,
    priority TEXT DEFAULT 'normal',
    action_needed BOOLEAN DEFAULT false,
    assigned_to TEXT,
    assigned_by TEXT,
    deadline TEXT,
    deadline_parsed TIMESTAMPTZ,
    key_participants TEXT[],
    key_decisions TEXT[],
    is_ongoing BOOLEAN DEFAULT false,
    continued_from UUID REFERENCES wa_intel.daily_topics(id),
    ai_model TEXT,
    raw_ai_response JSONB,
    analyzed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_topics_date
    ON wa_intel.daily_topics(topic_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_topics_group_date
    ON wa_intel.daily_topics(group_id, topic_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_topics_class
    ON wa_intel.daily_topics(classification);
CREATE INDEX IF NOT EXISTS idx_daily_topics_ongoing
    ON wa_intel.daily_topics(is_ongoing)
    WHERE is_ongoing = true;
CREATE INDEX IF NOT EXISTS idx_daily_topics_action
    ON wa_intel.daily_topics(action_needed)
    WHERE action_needed = true;

-- RLS
ALTER TABLE wa_intel.daily_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on daily_topics"
    ON wa_intel.daily_topics FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read daily_topics"
    ON wa_intel.daily_topics FOR SELECT
    TO authenticated USING (true);

-- Grants
GRANT SELECT ON wa_intel.daily_topics TO authenticated;
GRANT ALL ON wa_intel.daily_topics TO service_role;
```

**Key columns explained:**

| Column | Purpose |
|---|---|
| `message_ids` | UUID array linking topic to all related messages |
| `message_count` | Denormalized count for quick display |
| `classification` | task / direction / report / question / coordination / noise |
| `summary` | AI-generated 1-2 sentence summary of the COMPLETE conversation arc |
| `outcome` | "completed", "pending", "answered", "ongoing", "no_action_needed" |
| `action_needed` | Boolean — does someone still need to do something? |
| `key_participants` | Array of participant names involved |
| `key_decisions` | Array of decisions made in this conversation |
| `is_ongoing` | True if conversation is unresolved, continues to next day |
| `continued_from` | Self-FK to previous day's topic (multi-day tracking) |
| `raw_ai_response` | Full AI JSON response for debugging/iteration |

### 2c. Modify: `wa_intel.daily_briefings`

Add columns for the new topic-based approach:

```sql
ALTER TABLE wa_intel.daily_briefings
    ADD COLUMN IF NOT EXISTS topics_analyzed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS groups_analyzed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ongoing_topics_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS raw_analysis JSONB;
```

### 2d. Existing Tables — No Structural Changes

- **`messages`** — unchanged, still the raw message store
- **`classified_items`** — keep for backward compatibility, stop populating from new flow
- **`tasks`** — keep, now populated from `daily_topics` where `classification = 'task'`
- **`directions`** — keep, now populated from `daily_topics` where `classification = 'direction'`

---

## 3. Layer 1: Real-Time Triage Function

### Implementation: Postgres Function + Trigger

A PL/pgSQL function that fires on every `INSERT` into `wa_intel.messages`. No AI, just keyword matching.

```sql
CREATE OR REPLACE FUNCTION wa_intel.triage_message()
RETURNS TRIGGER AS $$
DECLARE
    msg_text TEXT;
    msg_lower TEXT;
    is_hendra BOOLEAN;
BEGIN
    msg_text := NEW.message_text;
    IF msg_text IS NULL OR msg_text = '' THEN
        RETURN NEW;
    END IF;

    msg_lower := lower(msg_text);
    is_hendra := COALESCE(NEW.is_from_hendra, false);

    -- Urgent keywords
    IF msg_lower ~ '(urgent|darurat|segera|asap|kebakaran|emergency|gawat)'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'urgent', 1.0);
    END IF;

    -- Hendra instruction (long message from Hendra = likely direction/task)
    IF is_hendra AND length(msg_text) > 50 THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'hendra_instruction', 0.8);
    END IF;

    -- Question detection
    IF msg_text ~ '\?$' OR msg_lower ~ '^(apa|kapan|dimana|di mana|bagaimana|kenapa|siapa|berapa|gimana|mana|bisa|boleh|ada)\s'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'question', 0.9);
    END IF;

    -- Low stock
    IF msg_lower ~ '(stok habis|stok kosong|tinggal \d|out of stock|barang habis|persediaan habis)'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'low_stock', 0.9);
    END IF;

    -- Complaint
    IF msg_lower ~ '(komplain|complaint|marah|kecewa|rusak|expired|cacat|kadaluarsa|basi)'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'complaint', 0.85);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_triage_message
    AFTER INSERT ON wa_intel.messages
    FOR EACH ROW
    EXECUTE FUNCTION wa_intel.triage_message();
```

**Performance:** Regex matching on a single text field is < 1ms. No external calls. No AI. Fires inline with message insert.

---

## 4. Layer 2: `analyze-daily` Edge Function

### 4a. Entry Point & Scheduling

- **Edge Function:** `supabase/functions/analyze-daily/index.ts`
- **Cron:** 23:00 UTC daily (= 6:00 AM WIB)
- **Input:** None (date-based — analyzes previous day)
- **Output:** JSON summary of analysis results

### 4b. Processing Flow

```typescript
// Pseudocode
async function analyzeDailyTopics() {
  const { startUtc, endUtc, dateStr } = getYesterdayWIB();

  // 1. Find active groups with messages yesterday
  const activeGroups = await getActiveGroupsWithMessages(startUtc, endUtc);

  for (const group of activeGroups) {
    // 2. Fetch all messages for this group yesterday
    const messages = await getGroupMessages(group.id, startUtc, endUtc);

    if (messages.length === 0) continue;
    if (messages.length < 3) {
      // Too few messages — classify as standalone
      await classifyStandaloneMessages(group, messages, dateStr);
      continue;
    }

    // 3. Split large groups into windows if needed
    const windows = splitIntoWindows(messages, MAX_MESSAGES_PER_WINDOW);

    for (const window of windows) {
      // 4. AI Step 1: Topic Segmentation
      const topics = await segmentTopics(group, window);

      // 5. AI Step 2: Classify each topic
      for (const topic of topics) {
        const classification = await classifyTopic(group, topic);
        await saveDailyTopic(group, dateStr, topic, classification);

        // 6. Auto-create task/direction if applicable
        if (classification.classification === 'task') {
          await createTaskFromTopic(group, topic, classification);
        }
        if (classification.classification === 'direction') {
          await createDirectionFromTopic(group, topic, classification);
        }
      }
    }
  }

  // 7. Check ongoing topics from previous days
  await checkOngoingTopics(dateStr);
}
```

### 4c. AI Prompts

#### Prompt 1: Topic Segmentation

```
You are analyzing a full day of WhatsApp messages from a HollyMart business group.

Group: "{group_name}"
Date: {date}
Total messages: {count}

Below are all messages from this group today, numbered sequentially:

{messages formatted as:
[1] 08:02 | Hendra (CEO, Lead:YES) "Andi, tolong cek harga kompetitor Indomie goreng hari ini"
[2] 08:03 | Andi (Store Staff, Lead:no) "Siap pak"
[3] 08:47 | Budi (Store Manager, Lead:YES) "Stok minyak goreng tinggal 5 karton"
...}

TASK: Identify distinct conversation TOPICS in these messages.

Rules:
- Group messages that discuss the SAME subject into one topic
- Messages don't need WhatsApp reply threading to be related — use context, timing, and participants
- A response hours later IS part of the same topic if it clearly relates
- Short acknowledgments ("ok", "siap", "noted") belong to the topic they respond to
- A single message can be its own topic if standalone
- Consider sender roles: a Store Manager reporting stock is likely a different topic than the CEO assigning a task

Return ONLY valid JSON:
{
  "topics": [
    {
      "topic_id": 1,
      "label": "short descriptive label in Bahasa Indonesia (max 40 chars)",
      "message_indices": [1, 2, 7, 12],
      "key_participants": ["Hendra", "Andi"],
      "timespan_start": "08:02",
      "timespan_end": "09:45"
    }
  ],
  "noise_indices": [5, 8]
}
```

#### Prompt 2: Topic Classification

```
You are classifying a complete conversation topic from a HollyMart WhatsApp group.

Group: "{group_name}"
Topic: "{topic_label}"
Date: {date}
Participants: {key_participants with roles}

Complete conversation (all messages in this topic, chronologically):

{messages}

Classify this COMPLETE topic. You have the full conversation arc — from start to finish.

Categories:
- "task": Someone assigned work to someone. Include who assigned, who must do it, deadline.
- "direction": Policy, rule, SOP, or directive from leadership. Include target audience.
- "report": Status update, progress, numbers, operational data.
- "question": Someone seeking information or help. Note if it was answered.
- "coordination": Scheduling, planning, logistics between team members.
- "noise": Casual chat, greetings, stickers, non-business.

Return ONLY valid JSON:
{
  "classification": "task",
  "confidence": 0.95,
  "summary": "Complete 1-2 sentence summary of the conversation arc in Bahasa Indonesia",
  "outcome": "completed|pending|answered|ongoing|no_action_needed",
  "priority": "urgent|high|normal|low",
  "action_needed": true,
  "assigned_to": "Andi" or null,
  "assigned_by": "Hendra" or null,
  "deadline": "raw deadline text" or null,
  "key_decisions": ["Harga Indomie diturunkan jadi 3300"] or []
}
```

### 4d. Window Splitting for Large Groups

Groups with >150 messages/day are split into time windows to stay within token limits:

```typescript
const MAX_MESSAGES_PER_WINDOW = 150;

function splitIntoWindows(messages: Message[], maxPerWindow: number): Message[][] {
  if (messages.length <= maxPerWindow) return [messages];

  // Split into roughly equal time-based windows
  const windowCount = Math.ceil(messages.length / maxPerWindow);
  const windowSize = Math.ceil(messages.length / windowCount);

  const windows: Message[][] = [];
  for (let i = 0; i < messages.length; i += windowSize) {
    windows.push(messages.slice(i, i + windowSize));
  }
  return windows;
}
```

### 4e. Multi-Day Ongoing Topic Tracking

After analyzing today's topics, check yesterday's ongoing topics:

```typescript
async function checkOngoingTopics(currentDate: string) {
  // Fetch topics from previous days marked as ongoing
  const ongoingTopics = await supabase
    .from('daily_topics')
    .select('*')
    .eq('is_ongoing', true)
    .lt('topic_date', currentDate)
    .order('topic_date', { ascending: false })
    .limit(50);

  // For each ongoing topic, check if today's topics continue it
  // Simple approach: match by group_id + similar participants + related keywords
  // Mark as resolved if a matching "done" topic exists today
}
```

---

## 5. Cron Schedule

### Disable Old Crons

```sql
-- Remove broken classify-messages cron (job 9)
SELECT cron.unschedule('classify-messages')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'classify-messages');

-- Remove broken daily-briefing cron (will be recreated with correct auth)
SELECT cron.unschedule('daily-briefing')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-briefing');

SELECT cron.unschedule('daily-briefing-7am-wib')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-briefing-7am-wib');
```

### New Crons

```sql
-- analyze-daily: 6:00 AM WIB = 23:00 UTC (previous day)
SELECT cron.schedule(
  'analyze-daily',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/analyze-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- daily-briefing: 7:00 AM WIB = 00:00 UTC
SELECT cron.schedule(
  'daily-briefing',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnzhdjibilebpjgaqkdu.supabase.co/functions/v1/daily-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 6. Daily Briefing Format (Upgraded)

The briefing now uses `daily_topics` and presents a **narrative view**:

```
📊 HollyMart Daily Brief — {tanggal}

📈 Ringkasan: {N} grup aktif, {M} pesan, {T} topik teridentifikasi

🆕 Task Baru ({count}):
• [Bima-1] Cek harga kompetitor Indomie → @Andi
  ✅ SELESAI: Harga sudah diturunkan ke 3300 (dikonfirmasi 09:45)
• [Purchasing] Follow up supplier ikan Ramadan → @Dian
  ⏳ MENUNGGU: Belum ada respon dari supplier

⚠️ Butuh Perhatian:
• [Dompu] Stok minyak goreng rendah (5 karton) — belum ada follow up
• [Lombok-2] Customer komplain roti expired — ditangani @Budi

📝 Arahan Hendra ({count}):
• [All Stores] Kebijakan retur expired harus difoto sebelum diproses
  Target: Semua store manager

🔄 Percakapan Aktif (dari hari sebelumnya):
• [Bima-1] Jadwal shift lebaran — masih diskusi (3 hari)
• [Purchasing] Nego harga gula supplier baru — menunggu keputusan

💬 Aktivitas Grup:
• Bima-1: 45 pesan, 3 topik penting
• Purchasing: 23 pesan, 2 topik penting
• Dompu: 12 pesan, 1 topik penting
```

---

## 7. Migration Strategy

### Backward Compatibility

- **`classified_items` table stays** — existing 30 rows preserved, no deletions
- **`tasks` and `directions` tables stay** — existing rows preserved
- New `daily_topics` is additive — coexists with old data
- Dashboard can query both sources during transition

### Transition Period

1. Deploy new tables + triage trigger (Phase A)
2. Deploy `analyze-daily` function, run manually to test (Phase B)
3. Enable cron for `analyze-daily` (Phase B)
4. Update `daily-briefing` to use `daily_topics` (Phase C)
5. Disable old `classify-messages` cron (Phase A — already broken)
6. Old `classify-messages` Edge Function kept deployed but not scheduled

---

## 8. Cost Analysis

### Current (broken, but if working)

| Item | Per Day |
|---|---|
| Cron executions | 96 (every 15 min) |
| AI calls | ~96 × avg 2 conversations = ~192 calls |
| Tokens per call | ~500-1000 (small context) |
| Estimated daily cost | ~$0.20-0.50 |
| Quality | Low (partial context) |

### Proposed

| Item | Per Day |
|---|---|
| Cron executions | 2 (analyze-daily + daily-briefing) |
| AI calls | ~15-30 (1 segmentation + N classification per active group) |
| Tokens per call | ~2000-5000 (full day context) |
| Estimated daily cost | ~$0.10-0.30 |
| Quality | High (full conversation arcs) |

**Net result: Lower cost, dramatically higher quality.**
