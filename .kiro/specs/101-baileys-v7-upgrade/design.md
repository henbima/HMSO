# Spec 101: Baileys v7 Upgrade — Design

**Priority:** P1 — High
**Domain:** 100-199 (WhatsApp Listener & Groups)

---

## Overview

Upgrade `@whiskeysockets/baileys` from `^6.7.16` to `^7.x` in the listener module. Address all breaking changes per the official migration guide.

---

## Known Breaking Changes (v6 → v7)

Based on Baileys v7 release notes and https://baileys.wiki:

### 1. Auth State API
**v6:** `useMultiFileAuthState(folder)` returns `{ state, saveCreds }`
**v7:** Same API signature, but internal signal key store format may change.

**Action:** Test with existing `auth_info/` folder. If incompatible, delete and re-scan QR.

### 2. Signal Key Store
**v6:** `makeCacheableSignalKeyStore(state.keys, logger)`
**v7:** May have updated signature or be removed/renamed.

**Action:** Check v7 exports. Update import and usage if signature changed.

### 3. Socket Creation
**v6:** `makeWASocket({ version, auth, ... })`
**v7:** May have new required options or renamed properties.

**Action:** Review `makeWASocket` TypeScript types in v7. Update options object.

### 4. Event Types
**v6:** `messages.upsert`, `connection.update`, `group-participants.update`, `creds.update`
**v7:** Event names likely unchanged, but payload types may differ.

**Action:** Verify `WAMessage`, `GroupMetadata` type imports still exist and match.

### 5. Group Methods
**v6:** `sock.groupFetchAllParticipating()`, `sock.groupMetadata(jid)`
**v7:** Should be unchanged, but verify return types.

---

## Upgrade Strategy

### Step 1: Backup
```bash
# Backup existing auth state
cp -r listener/auth_info listener/auth_info.bak.v6
```

### Step 2: Upgrade Package
```bash
cd listener
npm install @whiskeysockets/baileys@^7
```

### Step 3: Fix Compilation Errors
Run `npm run build` (tsc) and fix any type errors. Common fixes:
- Updated import paths
- Changed type signatures
- New required parameters

### Step 4: Test Connection
```bash
npm run dev
```
- Verify QR scan / auth state loading
- Verify message reception
- Verify group sync

---

## Files to Modify

| File | Likely Changes |
|---|---|
| `listener/package.json` | Version bump `^6.7.16` → `^7.x` |
| `listener/src/index.ts` | Socket creation options, auth state API |
| `listener/src/message-handler.ts` | WAMessage type changes (if any) |
| `listener/src/group-sync.ts` | GroupMetadata type changes (if any) |

---

## Rollback Plan

If v7 introduces critical bugs:
1. Restore `package.json` to `^6.7.16`
2. Run `npm install`
3. Restore `auth_info.bak.v6` if auth state was corrupted

---

## Pre-Upgrade Checklist

Before starting:
- [ ] Read Baileys v7 changelog: https://github.com/WhiskeySockets/Baileys/releases
- [ ] Read migration guide: https://baileys.wiki
- [ ] Backup `listener/auth_info/` folder
- [ ] Ensure listener is stopped (PM2 stop)
- [ ] Snapshot current `package-lock.json`
