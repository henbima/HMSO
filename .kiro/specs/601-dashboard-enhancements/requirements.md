# Spec 601: Dashboard Enhancements — Requirements

**Priority:** P2 — Medium
**Domain:** 600-699 (Dashboard & UI)
**Status:** Planned

---

## Problem Statement

The dashboard (Module 5) is functional but missing several blueprint features and user-rule requirements:

1. **No drag & drop on Kanban board** — Blueprint: *"Drag & drop untuk update status."* Current TasksPage uses button/dropdown clicks to change task status.

2. **No activity charts** — Blueprint: *"Activity chart: message volume per hari per grup."* GroupsPage has no charts.

3. **No Supabase Realtime subscriptions** — Blueprint: *"Supabase Realtime subscriptions."* Dashboard requires manual refresh.

4. **No feature flags system** — User rules: *"All work-in-progress UI is gated by a boolean flag fetched from the feature_flags table."* No such table or system exists.

### Verified Data (Supabase MCP, 2026-02-08)

| Metric | Value |
|---|---|
| `wa_intel.groups` | 299 rows |
| `wa_intel.messages` | 19,351 rows |
| `wa_intel.tasks` | 1 row |
| `wa_intel.directions` | 2 rows |
| `wa_intel.classified_items` | 30 rows |
| Feature flags table | ❌ Does not exist |
| Supabase Realtime enabled | Available (Supabase project supports it) |

---

## User Stories

### US-1: Drag & Drop Kanban
**As** a dashboard user,
**I want** to drag task cards between columns (New → In Progress → Done),
**So that** updating task status is intuitive and fast.

### US-2: Activity Charts
**As** Hendra,
**I want** to see message volume charts per group per day on the Groups page,
**So that** I can visualize activity patterns and identify quiet/active periods.

### US-3: Realtime Updates
**As** a dashboard user,
**I want** the dashboard to update automatically when new messages, tasks, or classifications arrive,
**So that** I always see the latest data without manual refresh.

### US-4: Feature Flags
**As** a developer,
**I want** a feature flag system to gate WIP features,
**So that** incomplete features can be deployed without affecting users.

---

## Acceptance Criteria

### AC-1: Drag & Drop Kanban
- [ ] Task cards can be dragged between status columns
- [ ] Dropping a card updates `wa_intel.tasks.status` in the database
- [ ] Visual feedback during drag (ghost card, highlighted drop zone)
- [ ] Uses a lightweight DnD library (e.g., `@dnd-kit/core` — Tailwind-compatible, maintained)
- [ ] Existing filter functionality (group, assignee) preserved

### AC-2: Activity Charts
- [ ] GroupsPage shows a bar/line chart of message volume per day for selected group
- [ ] Last 7 or 14 days of data displayed
- [ ] Uses a lightweight chart library (e.g., `recharts` — React-native, small bundle)
- [ ] Chart loads data from `wa_intel.messages` aggregated by date

### AC-3: Realtime Subscriptions
- [ ] OverviewPage stats auto-update when new data arrives
- [ ] TasksPage reflects new/updated tasks without refresh
- [ ] GroupsPage message list updates in realtime
- [ ] Uses Supabase Realtime `.on('postgres_changes', ...)` pattern
- [ ] Graceful fallback if realtime connection drops

### AC-4: Feature Flags
- [ ] `wa_intel.feature_flags` table created (name TEXT, enabled BOOLEAN, description TEXT)
- [ ] `useFeatureFlags()` hook created in `src/hooks/`
- [ ] WIP components wrapped with `{features.use('flagName') && <Component />}` pattern
- [ ] Migration SQL saved to `supabase/migrations/`

---

## Out of Scope

- Redesigning existing pages (layout, color scheme)
- Adding new pages (search, settings)
- Mobile-specific responsive layouts (basic responsive is fine)
- PWA / offline support
