# Spec 002: wa_intel → hmso Complete Rename — Design

## Approach

This is a systematic find-and-replace across 5 layers, deployed in strict order. The database rename is the only risky step — all other changes are straightforward text replacements.

## Phase Architecture

### Phase 1: Database Migration (HIGHEST RISK)

**Migration file:** `supabase/migrations/20260215000000_rename_wa_intel_to_hmso.sql`

**Operations (executed via MCP in chunks):**

1. **Schema rename:** `ALTER SCHEMA wa_intel RENAME TO hmso` — atomic, all objects move
2. **PostgREST update:** `ALTER ROLE authenticator SET pgrst.db_schemas TO '..., hmso'` + `NOTIFY pgrst, 'reload config'`
3. **Recreate functions** with `hmso.table` references in bodies:
   - `hmso.get_groups_with_today_stats()` — update all internal `wa_intel.` refs
   - Rename `wa_intel__search_messages` → `search_messages` (drop old, create new)
4. **Recreate views:** `overdue_tasks`, `today_summary` — update schema refs in body
5. **Cron jobs:** Unschedule `wa_intel_*`, reschedule as `hmso_*` with single-quote escaping
6. **Object registry:** `UPDATE hm_core.object_registry SET owner_app = 'hmso' WHERE owner_app = 'wa_intel'`

**Risk mitigation:**
- Function/view bodies are stored as text — must be recreated, not just renamed
- Split into multiple `execute_sql` calls for MCP compatibility
- No `$$` dollar-quoting anywhere
- Rollback: `ALTER SCHEMA hmso RENAME TO wa_intel` + revert code

### Phase 2: Backend Code (5 edge functions + 4 listener files)

**Edge Functions** — simple string replacement in each:
| File | Change |
|------|--------|
| `supabase/functions/classify-messages/index.ts` | `schema: "wa_intel"` → `"hmso"` |
| `supabase/functions/daily-briefing/index.ts` | same |
| `supabase/functions/analyze-daily/index.ts` | same |
| `supabase/functions/detect-task-completion/index.ts` | same |
| `supabase/functions/import-whatsapp-chat/index.ts` | all `.schema("wa_intel")` calls |

Also update AI system prompts where they say "WhatsApp business intelligence" → "organizational intelligence system (HMSO)".

**Listener:**
| File | Change |
|------|--------|
| `listener/src/supabase.ts` | `schema: 'wa_intel'` → `'hmso'` |
| `listener/src/briefing-sender.ts` | same |
| `listener/package.json` | `"wa-intel-listener"` → `"hmso-listener"` |
| `listener/ecosystem.config.cjs` | PM2 name `'wa-intel-listener'` → `'hmso-listener'` |

### Phase 3: Frontend Code (1 client file + 11 importers + 4 UI text)

**Schema client:**
- `src/lib/supabase.ts` line 18: `export const waIntel = ...` → `export const hmso = ...`

**Import updates** (11 files) — find-replace `waIntel` → `hmso`:
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

**UI text updates:**
| File | Old | New |
|------|-----|-----|
| `index.html` | title | "HMSO — HollyMart Signal Operations" |
| `src/components/Layout.tsx` | "WA Intel" | "HMSO" |
| `src/pages/LoginPage.tsx` | "HollyMart WA Intel" | "HMSO" |
| `src/pages/OverviewPage.tsx` | "WhatsApp Intelligence overview" | "HMSO overview" |

### Phase 4: Config & Schema Reference File

- `package.json`: `"name"` → `"hmso-dashboard"`
- Rename `wa_intel_setup.sql` → `hmso_setup.sql` + update all internal `wa_intel` → `hmso`

### Phase 5: Documentation (bulk find-replace)

**Patterns applied globally:**
| Old | New | Context |
|-----|-----|---------|
| `wa_intel` | `hmso` | Schema/code contexts (NOT `wa_jid` etc.) |
| `HMWAIntel` | `HMSO` | Project name |
| `wa-intel` | `hmso` | Kebab-case (package, server paths) |
| `waIntel` | `hmso` | camelCase in code examples |
| `"WhatsApp Intelligence"` | `"Signal Operations"` | Branding |
| `"WA Intel"` | `"HMSO"` | Branding |
| `wa_intel_setup.sql` | `hmso_setup.sql` | File reference |
| `wa-intel-listener` | `hmso-listener` | Process name |

**File groups:**
- `.kiro/steering/` — 15 files
- `.kiro/prompts/` — 6 files
- `.claude/commands/` — 4 files
- `.kiro/specs/` — 31+ files across all spec folders
- Root docs — README, CLAUDE.md, SPEC_REGISTRY, TECHNICAL_DEBT_REGISTRY, etc.

## Deployment Sequence

```
1. Apply DB migration (MCP execute_sql, chunked)
2. Verify DB (schema exists, tables accessible, cron renamed)
3. Deploy 5 edge functions (MCP deploy_edge_function)
4. Deploy listener (SSH: stop → rename dir → SCP → build → PM2 restart)
5. Verify frontend (npm run build, dev server check)
6. Hendra renames GitHub repo manually
7. Update git remote URL
```

## Rollback Plan

- **Before code deploy:** `ALTER SCHEMA hmso RENAME TO wa_intel` + don't deploy code
- **After code deploy:** Reverse schema rename + `git revert` + redeploy all services
