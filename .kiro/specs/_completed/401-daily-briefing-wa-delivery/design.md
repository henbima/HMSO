# Spec 401: Daily Briefing WA Delivery — Design

**Priority:** P1 — High
**Domain:** 400-499 (Briefings & Reports)

---

## Architecture Decision: How to Send WA Messages

The Baileys listener runs as a long-lived Node.js process on a PC. Edge Functions cannot send WA messages directly (no Baileys access). Two options:

### Option A: Listener Polls for Unsent Briefings (Recommended)
```
Cron → Edge Function → generates briefing → saves to DB (sent_via='pending')
Listener → polls daily_briefings WHERE sent_via='pending' → sends via Baileys → updates sent_via='whatsapp', sent_at=now()
```

**Pros:** Simple, no new API surface, listener already polls `sync_requests` the same way.
**Cons:** Slight delay between generation and delivery (up to polling interval).

### Option B: Listener Exposes HTTP API
```
Cron → Edge Function → generates briefing → calls listener HTTP endpoint → Baileys sends
```

**Pros:** Immediate delivery.
**Cons:** Requires exposing listener to internet (ngrok/tunnel), more complex, security surface.

**Decision: Option A** — consistent with existing `sync_requests` pattern, minimal new infrastructure.

---

## Part 1: Listener — Briefing Sender Module

### New File: `listener/src/briefing-sender.ts`

```typescript
// Polls wa_intel.daily_briefings for unsent briefings
// Sends via Baileys socket to BRIEFING_RECIPIENT_JID
// Updates sent_via='whatsapp', sent_at=now()

export async function checkAndSendBriefings(sock: WASocket): Promise<void> {
  const { data: unsent } = await supabase
    .from('daily_briefings')
    .select('id, briefing_date, summary_text')
    .eq('sent_via', 'pending')
    .order('briefing_date', { ascending: true })
    .limit(1);

  if (!unsent || unsent.length === 0) return;

  const briefing = unsent[0];
  const recipientJid = config.briefingRecipientJid;
  if (!recipientJid) return;

  await sock.sendMessage(recipientJid, { text: briefing.summary_text });

  await supabase
    .from('daily_briefings')
    .update({
      sent_via: 'whatsapp',
      sent_at: new Date().toISOString(),
    })
    .eq('id', briefing.id);
}
```

### Integration in `listener/src/index.ts`

Add to the existing `setInterval` block (connection open):
```typescript
// Check for unsent briefings every 60 seconds
setInterval(async () => {
  try {
    await checkAndSendBriefings(sock);
  } catch (err) {
    logger.error({ err }, 'Error checking/sending briefings');
  }
}, 60000);
```

### Config Addition: `listener/src/config.ts`

```typescript
export const config = {
  // ... existing ...
  briefingRecipientJid: process.env.BRIEFING_RECIPIENT_JID || '',
} as const;
```

---

## Part 2: Edge Function — Set `sent_via='pending'`

### Change in `daily-briefing` Edge Function

Currently in `saveBriefing()`:
```typescript
sent_via: "console",  // ← change to "pending"
```

Change to:
```typescript
sent_via: "pending",  // Listener will pick this up and send via WA
```

---

## Part 3: Briefing Format Update

Update the briefing text format to use the blueprint's emoji-rich template:

```
📊 HollyMart Daily Brief — {tanggal}

🆕 Task Baru ({count}):
• [{group}] {title} → @{assignee}

⚠️ Overdue / No Response ({count}):
• [{group}] {title} → @{assignee} ({days} hari)

✅ Completed ({count}):
• [{group}] {title} → @{assignee} ✓

📝 Arahan Baru ({count}):
• [{topic}] {title}

💬 Aktivitas Grup:
• {group}: {count} pesan ({important} penting)
```

---

## Part 4: Cron Cleanup

### Remove Duplicate Job 12

```sql
-- Remove the duplicate cron job that also exposes anon key
SELECT cron.unschedule(12);
```

Job 10 remains active with proper `service_role_key` usage.

---

## File Changes Summary

| File | Change Type | Description |
|---|---|---|
| `listener/src/briefing-sender.ts` | **New** | Briefing delivery via Baileys |
| `listener/src/index.ts` | Modify | Add briefing sender poll interval |
| `listener/src/config.ts` | Modify | Add `BRIEFING_RECIPIENT_JID` |
| `supabase/functions/daily-briefing/index.ts` | Modify | Change `sent_via` to `'pending'`, update format |
| `supabase/migrations/XXXXXX_cleanup_duplicate_cron.sql` | **New** | Remove job 12 |

---

## Environment Variables (New)

| Variable | Required | Description |
|---|---|---|
| `BRIEFING_RECIPIENT_JID` | Yes | Hendra's WA JID (e.g., `628xxx@s.whatsapp.net`) |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Baileys banned for sending | Low | Only 1 message/day, read-mostly behavior maintained |
| Listener not running at 7 AM | Medium | Briefing stays as `pending` until listener comes online |
| Message too long for WA | Low | Current briefing format is well under WA's 65K char limit |
| Cron job removal breaks something | Very Low | Job 12 is a duplicate of job 10 |
