# Spec 001: HMSO Project Realignment — Design

**Created:** 2026-02-13 22:00 WITA

## Architecture

This spec does not change the fundamental architecture. It evolves the data layer to be source-agnostic by adding `source_type` discrimination:

```
INPUT SOURCES (Capture)
├── WhatsApp (250+ groups, Baileys) ──→ source_type='whatsapp'
├── Meeting Transcripts (n8n, future) ──→ source_type='meeting'
└── Future Channels (email, HMCS notes) ──→ source_type='*'
        │
        ▼
DATA LAYER — wa_intel schema
├── messages (+ source_type, meeting_id, meeting_metadata)
├── meetings table (NEW)
├── Full-Text Search (tsvector index, NEW)
├── classified_items, tasks, directions (unchanged)
└── daily_briefings, contacts, groups (unchanged)
        │
        ▼
INTELLIGENCE LAYER
├── Classifier Edge Fn (+ source_type aware prompt)
├── Daily Briefing Edge Fn (unchanged)
└── Chat with Data (future, uses full-text search)
        │
        ▼
OUTPUT LAYER
├── Dashboard (+ SourceBadge component)
├── WA Briefing to Hendra (unchanged)
└── HMCS Integration (future)
```

Key principle: existing WhatsApp data and functionality is untouched. New columns have defaults. New tables are additive. Dashboard changes are backward-compatible.

## Database Changes

### New Table: `wa_intel.meetings`

```sql
CREATE TABLE IF NOT EXISTS wa_intel.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zoom_meeting_id TEXT,
    title TEXT NOT NULL,
    meeting_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    participants TEXT[],
    total_chunks INTEGER,
    executive_summary TEXT,
    raw_transcript TEXT,
    key_decisions JSONB,
    source TEXT DEFAULT 'zoom',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Modified Table: `wa_intel.messages` — 3 new columns

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| source_type | TEXT NOT NULL | 'whatsapp' | Origin: 'whatsapp', 'meeting', future types |
| meeting_id | UUID | NULL | FK to wa_intel.meetings(id) |
| meeting_metadata | JSONB | NULL | Chunk info: index, total, time range, speakers |

### New Indexes

| Index | Table | Column(s) | Type |
|-------|-------|-----------|------|
| idx_messages_source_type | messages | source_type | btree |
| idx_messages_meeting_id | messages | meeting_id (WHERE NOT NULL) | btree partial |
| idx_meetings_date | meetings | meeting_date DESC | btree |
| idx_meetings_zoom_id | meetings | zoom_meeting_id (WHERE NOT NULL) | btree partial |
| idx_messages_search | messages | search_vector | GIN |

### New Function: `wa_intel.wa_intel__search_messages(query text, limit_count int)`

- Returns: TABLE(id, message_text, sender_name, group_name, timestamp, relevance)
- Uses `websearch_to_tsquery('indonesian', query)` for Indonesian language
- Joins with groups table for group_name
- Orders by relevance DESC

### Object Registry Entries

| object_type | object_name | object_schema | owner_app |
|-------------|-------------|---------------|-----------|
| table | meetings | wa_intel | wa_intel |
| function | wa_intel__search_messages | wa_intel | wa_intel |
| index | idx_messages_source_type | wa_intel | wa_intel |
| index | idx_messages_meeting_id | wa_intel | wa_intel |
| index | idx_meetings_date | wa_intel | wa_intel |
| index | idx_meetings_zoom_id | wa_intel | wa_intel |
| index | idx_messages_search | wa_intel | wa_intel |

## Spec Evaluation Summary

| Spec | Assessment | Rationale |
|------|-----------|-----------|
| 101 — Baileys v7 Upgrade | **Keep** | Blueprint specifies v7.x, still relevant |
| 201 — Classifier Improvements | **Update** | Add source_type awareness for meeting chunks |
| 202 — Topic-Based Classification | **Keep** | Core to HMSO intelligence layer, blueprint-aligned |
| 401 — Daily Briefing WA Delivery | **Keep** | Blueprint Module 4 explicitly requires this |
| 601 — Dashboard Enhancements | **Update** | Add source_type awareness, meetings page placeholder |
| 701 — DB Indexes & Schema Fixes | **Update** | Add new indexes from this spec |

## TypeScript Type Changes

Add to `src/lib/types.ts`:
- `source_type`, `meeting_id`, `meeting_metadata` fields on Message interface
- New `Meeting` interface matching the meetings table schema

## Component: SourceBadge

New component in `src/components/SourceBadge.tsx`:
- Renders WhatsApp icon for `source_type='whatsapp'`
- Renders Meeting/Video icon for `source_type='meeting'`
- Renders generic icon for unknown types
- Handles null/undefined gracefully (defaults to 'whatsapp')

## Key Decisions

1. **Meetings table created before multi-source columns** — meeting_id FK on messages references meetings table, so meetings must exist first
2. **source_type defaults to 'whatsapp'** — all 23k+ existing rows automatically get the correct value, no manual backfill needed for NOT NULL constraint
3. **Full-text search uses 'indonesian' config** — matches the primary language of WhatsApp messages
4. **No dollar-quoting in migrations** — MCP tool compatibility requirement
5. **Registration in separate migration** — if hm_core is unavailable, table creation isn't blocked
6. **SourceBadge is a separate component** — reusable across all pages that show messages
