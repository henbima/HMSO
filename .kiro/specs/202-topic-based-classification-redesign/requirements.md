# Spec 202: Topic-Based Classification Redesign — Requirements

**Priority:** P0  
**Domain:** 200-299 (Message Processing & Classification)  
**Status:** Planned  
**Supersedes:** Current `classify-messages` 15-minute batch approach  
**Reference:** `docs/CLASSIFICATION_REDESIGN_PROPOSAL.md`

---

## Problem Statement

The current `classify-messages` Edge Function runs every 15 minutes and classifies messages using reply-chain threading. This produces misleading and incomplete results because:

1. **Reply-chain-only threading** — `groupMessagesIntoConversations()` groups messages only by `quoted_message_id`. ~70% of WhatsApp users type new messages without using the reply feature, so most related messages are never connected.

2. **30-minute conversation timeout** — Messages older than 30 minutes are classified with whatever partial context exists. Real WhatsApp conversations span hours or days (task at 8 AM → "done" at 3 PM).

3. **15-minute snapshot = partial picture** — A question at 9:00 and its answer at 9:20 may be classified in separate runs as unrelated items.

4. **No reclassification** — Once classified, a message is never re-evaluated when new context arrives later.

5. **Per-message classification wastes tokens** — "Ok", "Siap", "👍" are classified individually as noise when they are actually task acknowledgments that need prior context.

### Verified Data (Supabase MCP, 2026-02-11)

| Metric | Value |
|---|---|
| `messages` total | 22,356 |
| `classified_items` total | 30 |
| `tasks` total | 1 |
| `directions` total | 2 |
| `groups` total | 299 |
| Messages with `quoted_message_id` populated | ~10-15% (most users don't use reply) |
| `classify-messages` cron status | FAILING (auth error) |
| `daily-briefing` cron status | FAILING (auth error) |

### Research Findings

**Periskope (SaaS):**
- Real-time per-message flagging (lightweight, no deep AI)
- Flags questions/queries as they arrive
- Resolution tracking: flag auto-resolves when internal responds
- Key insight: *Flag first, classify later*

**OpenClaw (open-source):**
- 3-tier memory: ephemeral (daily logs), durable (curated), session
- Daily logs as primary memory artifact — narrative, not per-message tags
- Hybrid search (BM25 + vector) for retrieval
- Key insight: *Daily summaries capture what happened, not individual message metadata*

---

## Core Design Shift

| Current | Proposed |
|---|---|
| Classify every 15 min | Classify **once daily** (6 AM WIB, before briefing) |
| Thread by reply-chain only | **AI-powered topic segmentation** per group per day |
| Classify per message | Classify **per topic/conversation** |
| 30-min conversation timeout | **Full 24-hour window** |
| No re-evaluation | Daily re-evaluation of ongoing conversations |
| AI for every message | Heuristic triage for urgent items (zero AI cost) |

---

## User Stories

### US-1: Real-Time Triage (Layer 1)
**As** Hendra (CEO),  
**I want** urgent messages (low stock alerts, customer complaints, direct instructions from me) to be flagged immediately as they arrive,  
**So that** time-sensitive items don't wait until the next morning's briefing.

### US-2: Daily Topic Segmentation (Layer 2)
**As** a system,  
**I want** to analyze a full day's messages per group and identify distinct conversation topics (even without reply threading),  
**So that** classification is based on complete conversations, not fragments.

### US-3: Topic-Level Classification
**As** Hendra,  
**I want** each identified topic classified with full context (all related messages, complete arc from question to answer),  
**So that** the briefing tells me "Task given, completed by Andi at 9:45" instead of separate "task" + "noise" entries.

### US-4: Improved Daily Briefing
**As** Hendra,  
**I want** the daily briefing to be topic-based with outcomes (completed/pending/ongoing),  
**So that** I get a story of what happened, not a list of fragmented classifications.

### US-5: Multi-Day Conversation Tracking
**As** a system,  
**I want** to track conversations that span multiple days (task Monday → done Wednesday),  
**So that** ongoing items appear in the briefing until resolved.

---

## Acceptance Criteria

### AC-1: Real-Time Triage (`message_flags` table)
- [ ] New `wa_intel.message_flags` table created
- [ ] Flags are created for: `urgent`, `hendra_instruction`, `question`, `low_stock`, `complaint`
- [ ] Detection is keyword/heuristic-based (no AI cost)
- [ ] Flags can be resolved (when someone responds or manually)
- [ ] Flagging can run as a DB trigger or lightweight function on message insert

### AC-2: Daily Analysis Edge Function (`analyze-daily`)
- [ ] New Edge Function `analyze-daily` created
- [ ] Fetches full previous day's messages per active group (00:00-23:59 WIB)
- [ ] Sends messages to AI for topic segmentation (which messages belong together)
- [ ] Classifies each identified topic: task/direction/report/question/coordination/noise
- [ ] Stores results in new `wa_intel.daily_topics` table
- [ ] Auto-creates `tasks` and `directions` rows from classified topics
- [ ] Handles groups with >200 messages by splitting into time windows

### AC-3: Daily Topics Table
- [ ] New `wa_intel.daily_topics` table with: topic_label, message_ids[], classification, summary, outcome, priority, action_needed, assigned_to/by, deadline, is_ongoing, continued_from
- [ ] Indexed by topic_date, classification, is_ongoing, action_needed
- [ ] RLS enabled, proper grants

### AC-4: Upgraded Daily Briefing
- [ ] Daily briefing uses `daily_topics` as data source (not `classified_items`)
- [ ] Briefing format is topic-based with outcomes
- [ ] Includes "ongoing conversations" section for multi-day items
- [ ] Per-group activity summary

### AC-5: Cron Schedule
- [ ] `classify-messages` cron disabled (or removed)
- [ ] `analyze-daily` cron at 23:00 UTC (6:00 AM WIB)
- [ ] `daily-briefing` cron at 00:00 UTC (7:00 AM WIB) — unchanged

### AC-6: Multi-Day Tracking
- [ ] Topics marked `is_ongoing = true` when conversation is unresolved
- [ ] Next day's analysis checks for continuations via `continued_from` FK
- [ ] Ongoing topics appear in briefing until resolved

---

## Out of Scope

- Real-time push notifications for flagged messages (future — needs delivery channel)
- Dashboard UI updates for topic-based view (separate spec 602+)
- RAG/vector search integration (Phase 2, Module 6)
- Backfill classification of existing 22k+ messages (separate batch job)
- Changing AI provider (keep OpenAI GPT-4o-mini)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI topic segmentation inaccurate | Medium | Medium | Start with small groups (<100 msgs/day). Iterate prompt. Human review on dashboard. |
| Large groups exceed token limits | Medium | High | Split into morning/afternoon/evening windows. Summarize if >200 msgs. |
| Daily-only classification misses urgent items | Low | High | Layer 1 real-time triage catches urgent keywords immediately. |
| AI cost increase with full-day context | Low | Low | One call per group vs 96 calls/day. GPT-4o-mini is cheap. Net savings expected. |
| Multi-day tracking complexity | Medium | Low | Start simple: mark ongoing, manual review. Auto-linking in later iteration. |
