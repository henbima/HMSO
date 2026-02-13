# Spec 101: Baileys v7 Upgrade — Tasks

**Status:** Planned
**Priority:** P1 — High

---

### Phase 1: Preparation

#### - [ ] Task 1.1: Review Baileys v7 changelog and migration guide
**File:** N/A (external research)

**Acceptance Criteria:**
- [ ] Read https://github.com/WhiskeySockets/Baileys/releases for v7 changes
- [ ] Read https://baileys.wiki migration guide
- [ ] Document specific breaking changes that affect our codebase
- [ ] Identify any new required dependencies

**Commit:** N/A (research only)

#### - [ ] Task 1.2: Backup auth state and lock file
**File:** `listener/auth_info/`, `listener/package-lock.json`

**Acceptance Criteria:**
- [ ] `auth_info/` backed up to `auth_info.bak.v6/`
- [ ] `package-lock.json` committed before upgrade

**Commit:** `chore(listener): backup auth state before baileys v7 upgrade`

---

### Phase 2: Upgrade & Fix

#### - [ ] Task 2.1: Upgrade Baileys package
**File:** `listener/package.json`

**Acceptance Criteria:**
- [ ] `@whiskeysockets/baileys` changed from `^6.7.16` to `^7.x`
- [ ] `npm install` completes without errors
- [ ] No peer dependency conflicts

**Commit:** `feat(listener): upgrade baileys to v7`

#### - [ ] Task 2.2: Fix TypeScript compilation errors
**File:** `listener/src/index.ts`, `listener/src/message-handler.ts`, `listener/src/group-sync.ts`

**Acceptance Criteria:**
- [ ] `npm run build` passes with 0 errors
- [ ] All v7 API changes addressed (auth state, socket options, types)
- [ ] Imports updated for any renamed/moved exports

**Commit:** `fix(listener): address baileys v7 breaking changes`

---

### Phase 3: Test & Verify

#### - [ ] Task 3.1: Test listener connection
**File:** N/A (manual testing)

**Acceptance Criteria:**
- [ ] Listener starts without errors
- [ ] QR code scan works (if auth state incompatible) OR existing auth state loads
- [ ] Connection established to WhatsApp
- [ ] Messages received and saved to `wa_intel.messages`
- [ ] Group sync works (`groupFetchAllParticipating`, `groupMetadata`)
- [ ] Reconnection works after simulated disconnect

**Commit:** N/A (testing only)

---

## Completion Checklist
- [ ] `npm run build` passes (0 errors)
- [ ] Listener connects and receives messages
- [ ] Verify via SQL: new messages appearing in `wa_intel.messages` after upgrade
- [ ] PM2 restart works correctly
