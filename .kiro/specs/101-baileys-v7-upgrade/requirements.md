# Spec 101: Baileys v7 Upgrade — Requirements

**Priority:** P1 — High
**Domain:** 100-199 (WhatsApp Listener & Groups)
**Status:** Planned

---

## Problem Statement

The blueprint (Section 2, Section 4) specifies `@whiskeysockets/baileys v7.x`. The current `listener/package.json` pins `^6.7.16`.

Baileys v7 has breaking changes from v6 (new auth API, signal key store changes, event structure updates). The blueprint explicitly notes: *"Baileys v7 — ada breaking changes dari v6. Refer ke https://baileys.wiki dan https://whiskey.so/migrate-latest."*

### Verified Data (2026-02-08)

| Metric | Value |
|---|---|
| Current Baileys version | `^6.7.16` (package.json) |
| Blueprint required version | v7.x |
| Listener files affected | `index.ts`, `message-handler.ts`, `group-sync.ts` |
| Baileys imports used | `makeWASocket`, `useMultiFileAuthState`, `DisconnectReason`, `makeCacheableSignalKeyStore`, `fetchLatestBaileysVersion`, `WASocket`, `GroupMetadata`, `proto` |

---

## User Stories

### US-1: Version Compliance
**As** a developer,
**I want** the Baileys listener to use v7.x as specified in the blueprint,
**So that** I benefit from the latest protocol updates, bug fixes, and maintained compatibility with WhatsApp's evolving protocol.

---

## Acceptance Criteria

- [ ] `@whiskeysockets/baileys` upgraded to `^7.x` in `listener/package.json`
- [ ] All breaking changes addressed (auth API, imports, event types)
- [ ] QR code scanning still works
- [ ] Auth state persistence still works (existing `auth_info/` folder)
- [ ] `messages.upsert` event handling still works
- [ ] `group-participants.update` event handling still works
- [ ] `groupFetchAllParticipating()` still works
- [ ] `groupMetadata()` still works
- [ ] Contact resolution and message saving unchanged
- [ ] Reconnection logic still works
- [ ] TypeScript compilation passes (`npm run build`)
- [ ] Manual test: listener connects, receives messages, saves to DB

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Breaking changes in auth API | High | High | Refer to https://baileys.wiki migration guide |
| Existing auth_info incompatible | Medium | Medium | May need to re-scan QR; backup auth_info first |
| Event type signature changes | Medium | Medium | Review Baileys v7 TypeScript types |
| Community bugs in v7 | Low | Medium | Pin to specific v7.x patch, monitor GitHub issues |

---

## Out of Scope

- Adding new Baileys features (e.g., message sending beyond briefing)
- Changing listener architecture
- Multi-session support
