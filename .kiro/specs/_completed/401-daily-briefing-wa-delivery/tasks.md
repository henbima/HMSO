# Spec 401: Daily Briefing WA Delivery — Tasks

**Status:** Completed
**Priority:** P1 — High

---

### Phase 1: Cron Cleanup (Quick Win)

#### - [x] Task 1.1: Remove duplicate cron job 12
**File:** `supabase/migrations/XXXXXX_remove_duplicate_briefing_cron.sql`

**Acceptance Criteria:**
- [x] Cron job 12 (duplicate with exposed anon key) is removed
- [x] Cron job 10 (proper service_role_key) remains active
- [x] Migration SQL saved to `supabase/migrations/`

**Commit:** `fix(db): remove duplicate daily-briefing cron job with exposed key`

---

### Phase 2: Edge Function — Mark Briefings as Pending

#### - [x] Task 2.1: Update daily-briefing Edge Function sent_via
**File:** `supabase/functions/daily-briefing/index.ts`

**Acceptance Criteria:**
- [x] `saveBriefing()` sets `sent_via: 'pending'` instead of `'console'`
- [x] Briefing text format updated to emoji-rich template per blueprint
- [x] No other logic changes

**Commit:** `feat(briefing): mark new briefings as pending for WA delivery`

#### - [x] Task 2.2: Deploy updated daily-briefing Edge Function
**File:** N/A (Supabase MCP `deploy_edge_function`)

**Acceptance Criteria:**
- [x] Deployed successfully
- [x] Manual trigger creates briefing with `sent_via='pending'`

---

### Phase 3: Listener — Briefing Sender

#### - [x] Task 3.1: Add BRIEFING_RECIPIENT_JID to listener config
**File:** `listener/src/config.ts`

**Acceptance Criteria:**
- [x] `briefingRecipientJid` added to config object
- [x] Optional (empty string default) — listener doesn't crash if not set
- [x] `.env.example` updated with `BRIEFING_RECIPIENT_JID=`

**Commit:** `feat(listener): add briefing recipient JID config`

#### - [x] Task 3.2: Create briefing-sender module
**File:** `listener/src/briefing-sender.ts`

**Acceptance Criteria:**
- [x] Polls `wa_intel.daily_briefings` for `sent_via='pending'`
- [x] Sends briefing text via Baileys `sock.sendMessage()`
- [x] Updates `sent_via='whatsapp'` and `sent_at=now()` after success
- [x] Handles errors gracefully (logs, doesn't crash)
- [x] Skips if `BRIEFING_RECIPIENT_JID` is not configured

**Commit:** `feat(listener): add WA delivery for daily briefings`

#### - [x] Task 3.3: Integrate briefing sender into listener main loop
**File:** `listener/src/index.ts`

**Acceptance Criteria:**
- [x] `checkAndSendBriefings()` called every 60 seconds when connected
- [x] Timer cleared on disconnect (like `syncTimer`)
- [x] Import added for `briefing-sender.ts`

**Commit:** `feat(listener): poll and send pending briefings`

---

## Completion Checklist
- [x] Verify via SQL: `SELECT sent_via, sent_at FROM wa_intel.daily_briefings` — new briefings show `'pending'` then `'whatsapp'` after listener sends
- [x] Verify cron job 12 no longer exists: `SELECT * FROM cron.job WHERE jobid = 12` returns empty
- [x] Manual test: generate briefing → listener picks up → Hendra receives on WA
