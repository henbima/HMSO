# Spec 202: Topic-Based Classification Redesign — Tasks

**Status:** Planned  
**Priority:** P0  
**Estimated effort:** 8-12 days across 5 phases

---

### Phase A: Foundation — Disable Broken Crons + Create New Tables (1 day)

#### - [x] Task A.1: Disable broken cron jobs
**File:** `supabase/migrations/20260211_disable_broken_crons.sql`

**Acceptance Criteria:**
- [ ] `classify-messages` cron job unscheduled
- [ ] `daily-briefing` / `daily-briefing-7am-wib` cron jobs unscheduled
- [ ] All old cron job names cleaned up (job 9, 10, and any duplicates)
- [ ] Verified via `SELECT * FROM cron.job;`

**Commit:** `fix(cron): disable broken classify-messages and daily-briefing cron jobs`

#### - [x] Task A.2: Create `wa_intel.message_flags` table
**File:** `supabase/migrations/20260211_create_message_flags.sql`

**Acceptance Criteria:**
- [ ] Table created with columns: id, message_id, flag_type, confidence, resolved_at, resolved_by_message_id, flagged_at
- [ ] Indexes on flag_type, unresolved flags, message_id
- [ ] RLS enabled with service_role full access + authenticated read
- [ ] Grants to authenticated (SELECT) and service_role (ALL)

**Commit:** `feat(db): create message_flags table for real-time triage`

#### - [x] Task A.3: Create `wa_intel.daily_topics` table
**File:** `supabase/migrations/20260211_create_daily_topics.sql`

**Acceptance Criteria:**
- [ ] Table created with columns: id, group_id, topic_date, topic_label, message_ids[], message_count, classification, summary, outcome, priority, action_needed, assigned_to, assigned_by, deadline, deadline_parsed, key_participants[], key_decisions[], is_ongoing, continued_from, ai_model, raw_ai_response, analyzed_at, created_at
- [ ] Indexes on topic_date, group+date, classification, ongoing, action_needed
- [ ] Self-referential FK: continued_from → daily_topics(id)
- [ ] RLS enabled with service_role full access + authenticated read
- [ ] Grants to authenticated (SELECT) and service_role (ALL)

**Commit:** `feat(db): create daily_topics table for topic-based classification`

#### - [x] Task A.4: Alter `wa_intel.daily_briefings` — add new columns
**File:** `supabase/migrations/20260211_alter_daily_briefings.sql`

**Acceptance Criteria:**
- [ ] Added columns: topics_analyzed (int), groups_analyzed (int), ongoing_topics_count (int), raw_analysis (jsonb)
- [ ] All new columns nullable with defaults
- [ ] Existing data preserved

**Commit:** `feat(db): add topic-based columns to daily_briefings`

---

### Phase B: Real-Time Triage — DB Trigger (1 day)

#### - [x] Task B.1: Create triage function + trigger
**File:** `supabase/migrations/20260211_create_triage_trigger.sql`

**Acceptance Criteria:**
- [ ] PL/pgSQL function `wa_intel.triage_message()` created
- [ ] Detects flag types: urgent, hendra_instruction, question, low_stock, complaint
- [ ] Fires as AFTER INSERT trigger on `wa_intel.messages`
- [ ] Handles NULL/empty message_text gracefully (returns NEW without flagging)
- [ ] Keyword detection uses Bahasa Indonesia terms
- [ ] Hendra instruction: `is_from_hendra = true` AND `length(message_text) > 50`
- [ ] Question: ends with "?" OR starts with question words
- [ ] Performance: regex-only, no external calls, < 1ms overhead

**Commit:** `feat(triage): add real-time message triage trigger with keyword detection`

#### - [x] Task B.2: Test triage trigger with sample data
**File:** N/A (manual SQL test)

**Acceptance Criteria:**
- [ ] Insert test message with "URGENT" → message_flags row created with flag_type='urgent'
- [ ] Insert test message from Hendra with >50 chars → flag_type='hendra_instruction'
- [ ] Insert test message ending with "?" → flag_type='question'
- [ ] Insert test message with "stok habis" → flag_type='low_stock'
- [ ] Insert normal short message → no flag created
- [ ] Clean up test data after verification

**Commit:** N/A (verification only)

---

### Phase C: Daily Analysis Edge Function (3-4 days)

#### - [x] Task C.1: Create `analyze-daily` Edge Function — scaffolding
**File:** `supabase/functions/analyze-daily/index.ts`

**Acceptance Criteria:**
- [ ] Edge Function created with Deno.serve entry point
- [ ] CORS headers configured
- [ ] Supabase client initialized with service_role_key, schema wa_intel
- [ ] AI provider abstraction reused from classify-messages (OpenAI GPT-4o-mini)
- [ ] Date utility: `getYesterdayWIB()` returns previous day 00:00-23:59 WIB in UTC
- [ ] Returns JSON: `{ date, groups_analyzed, topics_found, tasks_created, directions_created, errors }`

**Commit:** `feat(analyze-daily): scaffold edge function with date utils and AI provider`

#### - [x] Task C.2: Implement group message fetching
**File:** `supabase/functions/analyze-daily/index.ts`

**Acceptance Criteria:**
- [ ] `getActiveGroupsWithMessages(startUtc, endUtc)` — returns groups with message count > 0 for date range
- [ ] `getGroupMessages(groupId, startUtc, endUtc)` — returns all messages with contact enrichment, sorted chronologically
- [ ] Messages include: id, wa_message_id, sender_name, contact(display_name, role, location, is_leadership), message_text, timestamp, is_from_hendra, quoted_message_id
- [ ] Skips groups with 0 messages
- [ ] Groups with <3 messages handled as standalone (skip segmentation)

**Commit:** `feat(analyze-daily): implement group message fetching with contact enrichment`

#### - [x] Task C.3: Implement AI topic segmentation
**File:** `supabase/functions/analyze-daily/index.ts`

**Acceptance Criteria:**
- [ ] `segmentTopics(group, messages)` sends full message list to AI
- [ ] AI prompt asks for topic identification with message grouping
- [ ] Returns array of topics with: topic_id, label, message_indices, key_participants, timespan
- [ ] Also returns noise_indices for standalone non-topic messages
- [ ] Handles AI errors gracefully (log + continue to next group)
- [ ] Window splitting for groups >150 messages

**Commit:** `feat(analyze-daily): implement AI-powered topic segmentation`

#### - [x] Task C.4: Implement AI topic classification
**File:** `supabase/functions/analyze-daily/index.ts`

**Acceptance Criteria:**
- [ ] `classifyTopic(group, topicMessages)` sends all messages in a topic to AI
- [ ] AI prompt asks for classification with full conversation context
- [ ] Returns: classification, confidence, summary, outcome, priority, action_needed, assigned_to/by, deadline, key_decisions
- [ ] Noise topics from segmentation are stored with classification='noise' without separate AI call
- [ ] Handles AI errors gracefully per topic (log + continue)

**Commit:** `feat(analyze-daily): implement AI topic classification with full context`

#### - [x] Task C.5: Implement saving results to `daily_topics` + auto-create tasks/directions
**File:** `supabase/functions/analyze-daily/index.ts`

**Acceptance Criteria:**
- [ ] Each classified topic saved to `wa_intel.daily_topics` with all fields
- [ ] `message_ids` populated with actual UUIDs (resolved from message_indices)
- [ ] Topics with `classification = 'task'` auto-create row in `wa_intel.tasks`
- [ ] Topics with `classification = 'direction'` auto-create row in `wa_intel.directions`
- [ ] Duplicate prevention: skip if daily_topics already exists for same group+date
- [ ] `raw_ai_response` stored for debugging

**Commit:** `feat(analyze-daily): save daily topics and auto-create tasks/directions`

#### - [x] Task C.6: Implement multi-day ongoing topic tracking
**File:** `supabase/functions/analyze-daily/index.ts`

**Acceptance Criteria:**
- [ ] After daily analysis, fetch previous days' topics where `is_ongoing = true`
- [ ] For each ongoing topic: check if today's topics in same group have a matching resolution
- [ ] Simple matching: same group_id + overlapping participants + related keywords in summary
- [ ] If match found: update old topic `is_ongoing = false`, new topic sets `continued_from`
- [ ] If no match: ongoing topic stays open (appears in briefing)

**Commit:** `feat(analyze-daily): add multi-day ongoing topic tracking`

#### - [x] Task C.7: Deploy `analyze-daily` Edge Function
**File:** N/A (Supabase MCP `deploy_edge_function`)

**Acceptance Criteria:**
- [ ] Edge Function deployed successfully
- [ ] Manual invocation returns valid JSON response
- [ ] Test with 1-2 groups: topics segmented and classified correctly
- [ ] `daily_topics` rows created with proper data

**Commit:** N/A (deployment)

---

### Phase D: Upgrade Daily Briefing (1-2 days)

#### - [x] Task D.1: Refactor `daily-briefing` Edge Function to use `daily_topics`
**File:** `supabase/functions/daily-briefing/index.ts`

**Acceptance Criteria:**
- [ ] Data source changed from `classified_items` to `daily_topics`
- [ ] Briefing format is topic-based with outcomes (completed/pending/ongoing)
- [ ] Sections: Task Baru, Butuh Perhatian, Arahan Hendra, Percakapan Aktif, Aktivitas Grup
- [ ] "Percakapan Aktif" section shows ongoing multi-day topics
- [ ] Ringkasan header: groups active, total messages, topics identified
- [ ] Fallback: if no daily_topics for today, fall back to old format with message from log
- [ ] `daily_briefings` row includes new columns: topics_analyzed, groups_analyzed, ongoing_topics_count

**Commit:** `refactor(briefing): use daily_topics for topic-based narrative briefing`

#### - [x] Task D.2: Deploy updated `daily-briefing` Edge Function
**File:** N/A (Supabase MCP `deploy_edge_function`)

**Acceptance Criteria:**
- [ ] Deployed successfully
- [ ] Manual invocation produces topic-based briefing text
- [ ] Briefing stored in `daily_briefings` with new columns populated

**Commit:** N/A (deployment)

---

### Phase E: Cron Scheduling + Go Live (1 day)

#### - [x] Task E.1: Store service_role_key in Supabase Vault
**File:** N/A (Supabase Vault)

**Acceptance Criteria:**
- [x] Service role key stored in Supabase Vault as `SERVICE_ROLE_KEY` (app.settings blocked by permissions)
- [x] Verified: `SELECT length(decrypted_secret) FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY'` returns 219
- [x] Key is the service_role secret key (not anon)

**Commit:** N/A (dashboard config)

#### - [x] Task E.2: Create new cron jobs
**File:** `supabase/migrations/20260211_create_new_cron_jobs.sql`

**Acceptance Criteria:**
- [x] `analyze-daily` cron scheduled at 18:00 UTC daily (1:00 AM WIB)
- [x] `daily-briefing` cron scheduled at 22:00 UTC daily (5:00 AM WIB)
- [x] Both use Vault secret `SERVICE_ROLE_KEY` for auth
- [x] Verified: `SELECT * FROM cron.job;` shows only the 2 new jobs (IDs 14, 15)

**Commit:** `feat(cron): schedule analyze-daily and daily-briefing cron jobs`

#### - [ ] Task E.3: Monitor first live run (awaiting next scheduled run)
**File:** N/A (monitoring)

**Acceptance Criteria:**
- [ ] analyze-daily runs at 6 AM WIB without errors
- [ ] daily_topics populated for previous day
- [ ] daily-briefing runs at 7 AM WIB using topic data
- [ ] Briefing text is coherent and topic-based
- [ ] No cron failures in `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

**Commit:** N/A (monitoring)

---

## Completion Checklist

- [ ] All broken crons disabled — `SELECT * FROM cron.job;` shows only analyze-daily + daily-briefing
- [ ] `wa_intel.message_flags` table exists and trigger fires on message insert
- [ ] `wa_intel.daily_topics` table exists with proper indexes and RLS
- [ ] `analyze-daily` Edge Function deployed and produces correct topic segmentation
- [ ] `daily-briefing` Edge Function updated to use topic-based format
- [ ] Both new cron jobs running successfully
- [ ] First live daily briefing uses topic-based format
- [ ] Run `npm run typecheck` (0 errors)
- [ ] Run `npm run build` (successful)

---

## Dependencies

- **Requires:** Service role key configured in `app.settings.service_role_key` (Task E.1)
- **Requires:** OpenAI API key set as Edge Function secret (`OPENAI_API_KEY`)
- **Does not require:** Dashboard UI changes (separate spec)
- **Does not require:** Backfill of existing 22k messages (separate effort)
