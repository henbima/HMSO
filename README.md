# HMWAIntel — HollyMart WhatsApp Intelligence

**WhatsApp message intelligence platform** that monitors group conversations, classifies messages using AI, and surfaces actionable insights (tasks, directions, briefings) for HollyMart leadership.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + TailwindCSS |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Storage) |
| **Icons** | Lucide React |
| **Routing** | React Router v7 |
| **WA Listener** | Node.js + Baileys (WhatsApp Web API) |
| **AI Classification** | OpenAI via Supabase Edge Functions |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

## Project Structure

```
src/
├── components/        # Reusable UI components (Layout, StatCard, EmptyState)
├── hooks/             # Custom hooks (useSupabase)
├── lib/               # Core utilities (auth, supabase client, types)
├── pages/             # Route pages
│   ├── OverviewPage   # Dashboard with summary stats
│   ├── TasksPage      # Tasks extracted from WA messages
│   ├── DirectionsPage # Leadership directions
│   ├── BriefingsPage  # AI-generated daily briefings
│   ├── GroupsPage     # Monitored WA groups
│   ├── ContactsPage   # Known contacts
│   └── ImportPage     # Manual WA chat import
└── App.tsx            # Root with routing and auth

listener/              # WhatsApp listener service (Node.js)
├── src/               # Listener source code
└── auth_info/         # Baileys auth state (gitignored in prod)

supabase/
├── functions/         # Edge Functions (classify, briefing, import)
└── migrations/        # Database migration SQL files

docs/
├── reference/         # Company brief, ISO standards
├── Hendra_Core_Package/  # Governance & operating philosophy
└── architecture/      # ADRs (future)
```

## Database Schema

All tables live in the **`wa_intel`** schema (separate from HMCS public schema):

- **`groups`** — Monitored WhatsApp groups
- **`contacts`** — Known contacts with role/location metadata
- **`group_members`** — Group membership mapping
- **`messages`** — Raw WhatsApp messages
- **`classified_items`** — AI classification results (task/direction/report/noise)
- **`tasks`** — Extracted actionable tasks with status tracking
- **`directions`** — Leadership directions with validity tracking
- **`daily_briefings`** — AI-generated daily summary briefings

Full schema: `wa_intel_setup.sql`

## Key Documentation

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | AI developer guidance for this project |
| `docs/reference/company_brief.md` | HollyMart company context |
| `docs/Hendra_Core_Package/` | Governance framework & operating philosophy |
| `docs/reference/DOC-REFFERENCE-004_ISO_document_standard.md` | ISO 9001 documentation standard |

## Environment Variables

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Listener (`listener/.env`):
```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
HENDRA_JID=<owner-whatsapp-jid>
```
