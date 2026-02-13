---
inclusion: always
version: 1.0.0
last-updated: 2026-02-13
---

# HMSO Kernel (Always)

**Version:** 1.0.0
**Last Updated:** 2026-02-13

---

## ⛔ CRITICAL SAFETY RULES (READ FIRST)

**These rules are NON-NEGOTIABLE.**

### 1. READ-ONLY FIRST
Never write to, modify, or delete production data without explicit approval.

### 2. MULTI-APP DATABASE BOUNDARY
This Supabase database is shared with other HollyMart apps. Before ANY `DROP`, `ALTER`, `DELETE`, `TRUNCATE`, or `cron.unschedule()`: query `hm_core.object_registry` to verify ownership is `wa_intel`. NEVER touch objects owned by other apps. See `database-boundary-governance.md`.

### 3. Ask Before Acting
When in doubt, explain what you want to do and ask Hendra to confirm.

### 4. Backup Before Write Operations
If we ever need to write, always back up first.

---

## Product & Identity

**HMSO — HollyMart Signal Operations**: a source-agnostic organizational intelligence system that captures signals from WhatsApp, meeting transcripts, and future channels.

- **Database Schema:** `wa_intel` (legacy name, may migrate to `hmso` later)
- **Allowed schemas:** `wa_intel` (full read/write), `hm_core` (read-only unless shared)
- **Other app schemas (NEVER modify):** `public`, `hmbi`, `hmcs`, `training`, etc.

### How HMSO Fits the HM Ecosystem

| System | Function |
|--------|----------|
| **HMCS** | Runs the operation (Central System) |
| **HMLS** | Trains the people (Learning System) |
| **HMBI** | Reads the numbers (Business Intelligence) |
| **HMSO** | Hears the organization (Signal Operations) |

## Who You Are Working With

Hendra, the owner/operator of HollyMart — a retail grocery chain in Nusa Tenggara Barat, Indonesia (~230 employees, 8+ stores). He is technically capable but is NOT a professional developer — guide him clearly, explain decisions, and confirm before making changes.

## Tech Stack
- React 18 + TypeScript, Vite, TailwindCSS, Lucide React, React Router v6
- Supabase (PostgreSQL with RLS, Auth, Edge Functions, tsvector full-text search)
- Node.js + Baileys (WhatsApp listener)
- n8n (meeting ingestion)
- AI: GPT-4o-mini (classification), OpenRouter Claude Sonnet/GPT-4o (meeting summaries)

## Project Structure
```
.kiro/
├── specs/                  # Feature specifications (Kiro native location)
│   ├── _completed/         # Finished specs
│   ├── _pending/           # On hold / blocked specs
│   └── _templates/         # Spec templates
├── steering/               # Steering files
└── settings/               # Kiro settings

HMWAIntel/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Core utilities (auth, supabase client, types)
│   └── pages/              # Route-level page components
├── listener/               # WhatsApp listener (Node.js + Baileys)
├── supabase/
│   ├── functions/          # Edge Functions
│   └── migrations/         # SQL migration files
├── docs/                   # Documentation
├── SPEC_REGISTRY.md        # Spec numbering registry
└── CLAUDE.md               # AI role definition
```

**Code and app files live under `HMWAIntel/`. Specs and steering live under `.kiro/`.**

---

## Code Conventions
- **Files/folders:** kebab-case
- **Components:** PascalCase
- **Functions/variables:** camelCase
- **No `any` types** — use specific interfaces from `src/lib/types.ts`
- **Tailwind CSS + Lucide React** only for styling and icons
- Service layer only: no `supabase.from()` in components

## Code Modification Rules
1. Read existing code FIRST — understand what's there before changing
2. Make minimal changes — only add what's needed, don't refactor unrelated code
3. Don't touch working code — if data fetching works, leave it alone
4. Test incrementally — add one piece at a time and verify
5. When something breaks, REVERT — don't try to "fix" by changing more things

## Verify Before Changing — "Measure Twice, Cut Once"
1. Check the actual data — query the DB, read the code, inspect the state
2. Discuss with the user — present findings and confirm direction BEFORE implementing
3. Only then implement — once facts are verified and direction is agreed

---

## Database Governance (Critical)

### Core Rules
- All tables live in the **`wa_intel`** schema (NOT `public`)
- Verify schema via Supabase MCP before writing queries
- RLS is enabled on all tables; never bypass
- Use UUID primary keys and follow existing FK patterns
- Schema changes ONLY via migration files in `supabase/migrations/`
- Apply via Supabase MCP `apply_migration` tool
- NO DOLLAR-QUOTING in migrations (MCP compatibility)
- For any DB changes, load `#database-governance-consolidated.md` for full workflow

### Supabase Access Pattern
```typescript
// Access wa_intel schema tables
const { data } = await supabase.schema('wa_intel').from('tasks').select('*')
```

---

## Spec System

**Specs live in `.kiro/specs/` (Kiro's native spec location). This is the single source of truth.**

### Folder naming: `{NUMBER}-{spec-name-kebab-case}/`

Kiro creates specs in `.kiro/specs/` by default. All spec folders MUST follow our numbering convention.

Domain ranges:
- **0xx**: Foundation & Discovery
- **1xx**: Listener & Infrastructure
- **2xx**: Classification & AI
- **3xx**: Contacts & Groups
- **4xx**: Briefings & Delivery
- **5xx**: Tasks & Directions
- **6xx**: Dashboard & UI
- **7xx**: Database & Performance

### Spec folder structure:
- `.kiro/specs/` — active specs (In Progress + Planned)
- `.kiro/specs/_completed/` — finished specs
- `.kiro/specs/_pending/` — on hold / blocked specs
- `.kiro/specs/_templates/` — templates for new specs

### Required files per spec:
- `requirements.md`, `design.md`, `tasks.md`

### Before creating a spec:
1. Check `HMWAIntel/SPEC_REGISTRY.md` for next available number
2. Reserve the number in the registry
3. Create the folder as `.kiro/specs/{NUMBER}-{spec-name-kebab-case}/` — the number is part of the name from creation
4. Follow templates in `.kiro/specs/_templates/`

---

## Server Deployment (Listener)

**CRITICAL: Kiro MUST handle all server operations directly. NEVER ask Hendra to SSH, type commands, or copy files manually. Kiro has full access to do this.**

### Connection Details
- **Server IP:** 103.150.92.166
- **User:** henbima
- **PEM Key:** `D:\biznet\Hr43GeZ3.pem`
- **SSH command:** `C:\WINDOWS\System32\OpenSSH\ssh.exe -i "D:\biznet\Hr43GeZ3.pem" henbima@103.150.92.166`
- **SCP command:** `C:\WINDOWS\System32\OpenSSH\scp.exe -O -i "D:\biznet\Hr43GeZ3.pem"`
- **Listener path on server:** `~/wa-intel-listener/`
- **Process manager:** PM2 (`ecosystem.config.cjs`)

### Deployment Steps (Kiro does ALL of this)
1. SCP changed listener files: `scp -O -i "D:\biznet\Hr43GeZ3.pem" <local-file> henbima@103.150.92.166:~/wa-intel-listener/<path>`
2. SSH to build: `ssh -i ... "cd ~/wa-intel-listener && chmod +x node_modules/.bin/tsc && npm run build"`
3. SSH to restart: `ssh -i ... "cd ~/wa-intel-listener && pm2 restart ecosystem.config.cjs"`
4. SSH to check logs: `ssh -i ... "cd ~/wa-intel-listener && pm2 logs wa-intel-listener --lines 20 --nostream"`

### Important Notes
- The server folder is NOT a git repo — files must be SCP'd individually
- Use `-O` flag with scp (legacy protocol mode, required for this server)
- `auth_info/` on the server contains WhatsApp session credentials — NEVER touch or delete
- The `.env` file on the server has Supabase credentials — NEVER overwrite

---

## Communication Style
- Hendra speaks English well but it's not his first language — be clear and avoid jargon
- Show progress step by step — don't dump everything at once
- When presenting options, give a clear recommendation with reasoning
- Use practical examples rather than abstract explanations

---

## Steering Usage
- Only this kernel is auto-included (plus `database-boundary-governance.md` and `supabase-workflow.md`)
- Use manual steering docs via `#filename` when needed (see invocation map below)

## Invocation Map (Manual Steering)
- DB schema/DDL changes → `#database-governance-consolidated.md`
- DB query design/filters/schema checks → `#database-essentials.md`
- Multi-app boundary safety → `#database-boundary-governance.md`
- Spec creation/organization → `#spec-numbering-system.md`
- Documentation creation → `#documentation-standards.md`
- Debugging issues → `#superior-debugging-methodology.md`
- Quality gates & verification → `#implementation-complete-guide.md`
- Task tracking in specs → `#spec-task-tracking.md`
- Governance/operational decisions → `#hendra-governance.md`
- Code quality & defensive programming → `#code-quality-complete.md`
- TypeScript testing → `#typescript-testing-complete.md`
- Supabase migration format → `#supabase-migration-standards.md`
