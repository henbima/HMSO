# Spec 401: Daily Briefing WA Delivery — Requirements

**Priority:** P1 — High
**Domain:** 400-499 (Briefings & Reports)
**Status:** Planned

---

## Problem Statement

The blueprint (Module 4) specifies: *"Kirim summary harian ke Hendra setiap pagi jam 7 via Baileys ke WA Hendra (atau email)."*

Currently, the `daily-briefing` Edge Function generates the briefing text and stores it in `daily_briefings` table, but **never delivers it** to Hendra via WhatsApp. The `sent_via` field is always `'console'` and `sent_at` is always NULL.

### Verified Data (Supabase MCP, 2026-02-08)

| Metric | Value |
|---|---|
| `daily_briefings` total | 1 |
| `sent_via` values | `'console'` only |
| `sent_at` values | NULL (never sent) |
| Cron job 10 | `0 0 * * *` (midnight UTC = 7 AM WIB) — ✅ active |
| Cron job 12 | `0 0 * * *` — ⚠️ **duplicate**, uses anon key (security issue) |
| Classifier cron job 9 | `*/15 * * * *` — ✅ active |

### Cron Issues Found
- **Duplicate daily-briefing cron** (job 10 + job 12) — job 12 should be removed
- **Job 12 leaks anon key** in the cron command SQL — security concern
- Daily briefing schedule is correct (7 AM WIB = 0 UTC)

---

## User Stories

### US-1: WA Delivery
**As** Hendra (CEO),
**I want** to receive a daily briefing message on my WhatsApp every morning at 7 AM,
**So that** I can see a summary of all tasks, directions, and activity without opening the dashboard.

### US-2: Cron Cleanup
**As** a system operator,
**I want** duplicate and insecure cron jobs removed,
**So that** the system is clean and does not expose credentials.

---

## Acceptance Criteria

### AC-1: WA Delivery via Baileys
- [ ] Briefing text is sent to Hendra's WA via the Baileys listener process
- [ ] `BRIEFING_RECIPIENT_JID` env var configures the recipient
- [ ] `sent_at` is populated after successful delivery
- [ ] `sent_via` is set to `'whatsapp'` after delivery
- [ ] Delivery failure does not prevent briefing from being saved to DB

### AC-2: Delivery Architecture
- [ ] Edge Function generates briefing and stores in DB (existing behavior, keep)
- [ ] Listener process polls for unsent briefings OR Edge Function calls listener API
- [ ] Briefing format uses emoji-rich template per blueprint (📊🆕⚠️✅📝💬)

### AC-3: Cron Cleanup
- [ ] Remove duplicate cron job 12 (the one with exposed anon key)
- [ ] Verify job 10 continues to work correctly
- [ ] Migration SQL saved to `supabase/migrations/`

---

## Out of Scope

- Email delivery (Phase 2 enhancement)
- Telegram delivery
- Changing briefing generation logic (content is fine)
- Realtime briefing push to dashboard
