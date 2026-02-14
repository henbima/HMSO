# Spec 002: wa_intel → hmso Complete Rename — Tasks

**Status:** In Progress

---

### Phase 1: Database Migration

#### - [x] Task 1.1: Write database migration SQL file
**Delegate:** Sonnet
**File:** `supabase/migrations/20260215000000_rename_wa_intel_to_hmso.sql`

**Acceptance Criteria:**
- [x] ALTER SCHEMA wa_intel RENAME TO hmso
- [x] PostgREST config updated to expose hmso schema
- [x] All functions recreated with hmso.table references (no wa_intel in bodies)
- [x] All views recreated with hmso.table references
- [x] Cron jobs unscheduled (wa_intel_*) and rescheduled (hmso_*)
- [x] hm_core.object_registry updated to owner_app = 'hmso'
- [x] No dollar-quoting ($$ ) anywhere — single-quote escaping only
- [x] Migration is chunked for MCP execute_sql compatibility

**Commit:** `feat(db): create migration for wa_intel to hmso schema rename`

#### - [ ] Task 1.2: Apply and verify database migration
**Delegate:** Sonnet
**Tool:** Supabase MCP (execute_sql)

**Acceptance Criteria:**
- [ ] Migration applied in chunks via MCP
- [ ] SELECT nspname FROM pg_namespace WHERE nspname = 'hmso' returns row
- [ ] SELECT COUNT(*) FROM hmso.messages succeeds
- [ ] Cron jobs show hmso_* names
- [ ] hm_core.object_registry shows owner_app = 'hmso'

**Commit:** N/A (DB operation, no code change)

---

### Phase 2: Backend Code Changes

#### - [x] Task 2.1: Update Edge Functions (5 files)
**Delegate:** Sonnet
**Files:**
- `supabase/functions/classify-messages/index.ts`
- `supabase/functions/daily-briefing/index.ts`
- `supabase/functions/analyze-daily/index.ts`
- `supabase/functions/detect-task-completion/index.ts`
- `supabase/functions/import-whatsapp-chat/index.ts`

**Acceptance Criteria:**
- [x] All `schema: "wa_intel"` → `schema: "hmso"`
- [x] All `.schema("wa_intel")` → `.schema("hmso")`
- [x] AI system prompts updated where applicable

**Commit:** `refactor(edge-functions): rename wa_intel schema references to hmso`

#### - [x] Task 2.2: Update Listener files (4 files)
**Delegate:** Sonnet
**Files:**
- `listener/src/supabase.ts`
- `listener/src/briefing-sender.ts`
- `listener/package.json`
- `listener/ecosystem.config.cjs`

**Acceptance Criteria:**
- [x] Schema references changed to 'hmso'
- [x] Package name changed to 'hmso-listener'
- [x] PM2 process name changed to 'hmso-listener'

**Commit:** `refactor(listener): rename wa_intel references to hmso`

#### - [ ] Task 2.3: Deploy Edge Functions
**Delegate:** Haiku
**Tool:** Supabase MCP (deploy_edge_function)

**Acceptance Criteria:**
- [ ] All 5 edge functions deployed successfully
- [ ] Supabase dashboard logs show no errors

**Commit:** N/A (deployment operation)

#### - [ ] Task 2.4: Deploy Listener via SSH
**Delegate:** Sonnet
**Tool:** SSH via Bash (see .kiro/steering/listener-deployment-guide.md)

**Acceptance Criteria:**
- [ ] Old PM2 process (wa-intel-listener) stopped and deleted
- [ ] Server directory renamed to ~/hmso-listener
- [ ] Updated source files SCP'd to server
- [ ] Build succeeds on server
- [ ] New PM2 process (hmso-listener) running
- [ ] pm2 logs show messages processing normally

**Commit:** N/A (deployment operation)

---

### Phase 3: Frontend Code Changes

#### - [x] Task 3.1: Update schema client and all imports
**Delegate:** Sonnet
**Files:**
- `src/lib/supabase.ts` (export rename)
- `src/hooks/useSupabase.ts`
- `src/components/BriefingSummaryRenderer.tsx`
- `src/components/CategoryManager.tsx`
- `src/services/group-category-service.ts`
- `src/pages/BriefingsPage.tsx`
- `src/pages/ContactsPage.tsx`
- `src/pages/ConversationsPage.tsx`
- `src/pages/DirectionsPage.tsx`
- `src/pages/GroupsPage.tsx`
- `src/pages/OverviewPage.tsx`
- `src/pages/TasksPage.tsx`

**Acceptance Criteria:**
- [x] `waIntel` export renamed to `hmso` in supabase.ts
- [x] All 11 importing files updated to use `hmso`
- [x] No remaining `waIntel` references in src/

**Commit:** `refactor(frontend): rename waIntel schema client to hmso`

#### - [x] Task 3.2: Update UI text and branding
**Delegate:** Sonnet
**Files:**
- `index.html`
- `src/components/Layout.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/OverviewPage.tsx`

**Acceptance Criteria:**
- [x] Page title updated to "HMSO — HollyMart Signal Operations"
- [x] All "WA Intel" → "HMSO"
- [x] All "WhatsApp Intelligence" → "Signal Operations"

**Commit:** `refactor(ui): update branding from WA Intel to HMSO`

#### - [x] Task 3.3: Verify frontend build
**Delegate:** Haiku
**Command:** `npm run typecheck && npm run build`

**Acceptance Criteria:**
- [x] TypeScript compilation passes (0 errors)
- [x] Build succeeds

**Commit:** N/A (verification)

---

### Phase 4: Config & Schema Reference

#### - [ ] Task 4.1: Update package.json and rename setup file
**Delegate:** Sonnet
**Files:**
- `package.json`
- `wa_intel_setup.sql` → `hmso_setup.sql`

**Acceptance Criteria:**
- [ ] package.json name is "hmso-dashboard"
- [ ] wa_intel_setup.sql renamed to hmso_setup.sql
- [ ] All wa_intel references inside hmso_setup.sql updated to hmso
- [ ] WA column names (wa_jid, wa_group_id, etc.) preserved unchanged

**Commit:** `refactor: rename package and schema setup file to hmso`

---

### Phase 5: Documentation & Config Files

#### - [ ] Task 5.1: Update .kiro/steering/ files (15 files)
**Delegate:** Sonnet
**Path:** `.kiro/steering/`

**Acceptance Criteria:**
- [ ] All wa_intel → hmso, HMWAIntel → HMSO, wa-intel → hmso patterns applied
- [ ] WA column names preserved
- [ ] 15 files updated

**Commit:** `docs: update steering files from wa_intel to hmso naming`

#### - [ ] Task 5.2: Update .kiro/prompts/ files (6 files)
**Delegate:** Sonnet
**Path:** `.kiro/prompts/`

**Acceptance Criteria:**
- [ ] All naming patterns applied across 6 files
- [ ] git.md confirmed as no changes needed

**Commit:** `docs: update prompt files from wa_intel to hmso naming`

#### - [ ] Task 5.3: Update .claude/commands/ files (4 files)
**Delegate:** Sonnet
**Path:** `.claude/commands/`

**Acceptance Criteria:**
- [ ] All naming patterns applied across 4 files

**Commit:** `docs: update claude commands from wa_intel to hmso naming`

#### - [ ] Task 5.4: Update .kiro/specs/ files (31+ files)
**Delegate:** Sonnet
**Path:** `.kiro/specs/`

**Acceptance Criteria:**
- [ ] All naming patterns applied across active, completed, pending, and template specs

**Commit:** `docs: update spec files from wa_intel to hmso naming`

#### - [ ] Task 5.5: Update root-level docs
**Delegate:** Sonnet
**Files:**
- `README.md`
- `CLAUDE.md`
- `SPEC_REGISTRY.md`
- `TECHNICAL_DEBT_REGISTRY.md`
- `docs/project-context.md`
- `docs/HMSO_BLUEPRINT.md`
- `docs/schema-setup-guide.md`
- `docs/shared-auth-setup.md`
- `docs/roadmap.md`
- `docs/Hendra_Core_Package/company_brief.md`
- `listener/README.md`

**Acceptance Criteria:**
- [ ] All naming patterns applied
- [ ] No remaining HMWAIntel, wa-intel, or wa_intel (schema context) references
- [ ] WA column name references preserved

**Commit:** `docs: update all documentation from wa_intel to hmso naming`

---

### Phase 6: Post-Rename Cleanup

#### - [ ] Task 6.1: Update git remote after Hendra renames GitHub repo
**Delegate:** Haiku
**Command:** `git remote set-url origin https://github.com/henbima/hmso.git`

**Acceptance Criteria:**
- [ ] Git remote points to new repo URL
- [ ] Push/pull works

**Commit:** `chore: update git remote to new hmso repo URL`

#### - [ ] Task 6.2: Final verification sweep
**Delegate:** Haiku
**Commands:** `npm run typecheck && npm run build && npm run lint`

**Acceptance Criteria:**
- [ ] Zero TypeScript errors
- [ ] Build succeeds
- [ ] No lint errors (warnings OK)
- [ ] grep for remaining `wa_intel` (non-column) references returns zero hits in code files

**Commit:** N/A (verification)

---

## Completion Checklist
- [ ] Run `npm run typecheck` (0 errors)
- [ ] Run `npm run build` (successful)
- [ ] Run `npm run lint` (warnings OK, errors must be fixed)
- [ ] DB verification queries pass
- [ ] Edge functions operational (check Supabase logs)
- [ ] Listener processing messages (pm2 logs)
- [ ] All pages load in browser without errors
- [ ] No wa_intel references remain in code (columns excluded)
