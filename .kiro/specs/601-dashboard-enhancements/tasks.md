# Spec 601: Dashboard Enhancements — Tasks

**Status:** Planned
**Priority:** P2 — Medium

---

### Phase 1: Feature Flags Foundation (Do First)

#### - [ ] Task 1.1: Create feature_flags table migration
**File:** `supabase/migrations/XXXXXX_add_feature_flags.sql`

**Acceptance Criteria:**
- [ ] `wa_intel.feature_flags` table created with `name`, `enabled`, `description`
- [ ] RLS enabled + SELECT policy for `authenticated`
- [ ] Seed data: `drag_drop_kanban`, `activity_charts`, `realtime_updates`, `search_page` (all `false`)
- [ ] Migration applied via Supabase MCP

**Commit:** `feat(db): add feature_flags table to wa_intel schema`

#### - [ ] Task 1.2: Create useFeatureFlags hook
**File:** `src/hooks/useFeatureFlags.ts`

**Acceptance Criteria:**
- [ ] Fetches flags from `wa_intel.feature_flags` on mount
- [ ] Exposes `isEnabled(name: string): boolean`
- [ ] Caches flags in state (single fetch per mount)
- [ ] Returns `false` for unknown flags

**Commit:** `feat(ui): add useFeatureFlags hook`

---

### Phase 2: Drag & Drop Kanban

#### - [ ] Task 2.1: Install @dnd-kit dependencies
**File:** `package.json`

**Acceptance Criteria:**
- [ ] `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` added
- [ ] `npm install` succeeds

**Commit:** `chore: add @dnd-kit dependencies for kanban drag-drop`

#### - [ ] Task 2.2: Refactor TasksPage with DnD
**File:** `src/pages/TasksPage.tsx`

**Acceptance Criteria:**
- [ ] `DndContext` wraps the kanban columns
- [ ] Each column is a droppable zone (id = status value)
- [ ] Each TaskCard is draggable
- [ ] `handleDragEnd` updates task status in DB (optimistic update)
- [ ] `completed_at` set when dropped to "done" column
- [ ] Existing filter functionality preserved
- [ ] Gated by `features.isEnabled('drag_drop_kanban')` with fallback to current button UI

**Commit:** `feat(ui): add drag-and-drop to task kanban board`

---

### Phase 3: Activity Charts

#### - [ ] Task 3.1: Create get_group_activity database function
**File:** `supabase/migrations/XXXXXX_add_group_activity_function.sql`

**Acceptance Criteria:**
- [ ] `wa_intel.get_group_activity(p_wa_group_id, p_days)` function created
- [ ] Returns: `date`, `messages`, `tasks`, `directions` per day
- [ ] `SECURITY DEFINER` for RLS bypass
- [ ] Migration applied via Supabase MCP

**Commit:** `feat(db): add get_group_activity function for charts`

#### - [ ] Task 3.2: Install recharts
**File:** `package.json`

**Acceptance Criteria:**
- [ ] `recharts` added to dependencies
- [ ] `npm install` succeeds

**Commit:** `chore: add recharts for activity charts`

#### - [ ] Task 3.3: Create GroupActivityChart component
**File:** `src/components/GroupActivityChart.tsx`

**Acceptance Criteria:**
- [ ] Bar chart showing daily message volume
- [ ] Stacked bars: total (gray), tasks (blue), directions (orange)
- [ ] Fetches data via `supabase.rpc('get_group_activity', { ... })`
- [ ] Loading state while data fetches
- [ ] Responsive width

**Commit:** `feat(ui): add group activity chart component`

#### - [ ] Task 3.4: Integrate chart into GroupsPage
**File:** `src/pages/GroupsPage.tsx`

**Acceptance Criteria:**
- [ ] Chart appears below group detail when a group is selected
- [ ] Gated by `features.isEnabled('activity_charts')`
- [ ] Shows last 14 days of data

**Commit:** `feat(ui): integrate activity chart into groups page`

---

### Phase 4: Supabase Realtime

#### - [ ] Task 4.1: Create useRealtimeSubscription hook
**File:** `src/hooks/useRealtimeSubscription.ts`

**Acceptance Criteria:**
- [ ] Subscribes to `postgres_changes` on specified `wa_intel` table
- [ ] Calls callback function on any change (INSERT/UPDATE/DELETE)
- [ ] Cleans up channel on unmount
- [ ] Handles connection errors gracefully

**Commit:** `feat(ui): add useRealtimeSubscription hook`

#### - [ ] Task 4.2: Add realtime to OverviewPage
**File:** `src/pages/OverviewPage.tsx`

**Acceptance Criteria:**
- [ ] Subscribes to `messages`, `tasks`, `directions` changes
- [ ] Auto-refreshes stats on change
- [ ] Gated by `features.isEnabled('realtime_updates')`

**Commit:** `feat(ui): add realtime updates to overview page`

#### - [ ] Task 4.3: Add realtime to TasksPage
**File:** `src/pages/TasksPage.tsx`

**Acceptance Criteria:**
- [ ] Subscribes to `tasks` table changes
- [ ] Auto-refreshes task list on INSERT/UPDATE

**Commit:** `feat(ui): add realtime updates to tasks page`

#### - [ ] Task 4.4: Add realtime to GroupsPage and DirectionsPage
**Files:** `src/pages/GroupsPage.tsx`, `src/pages/DirectionsPage.tsx`

**Acceptance Criteria:**
- [ ] GroupsPage subscribes to `messages` for live message count
- [ ] DirectionsPage subscribes to `directions` for new entries

**Commit:** `feat(ui): add realtime updates to groups and directions pages`

---

## Completion Checklist
- [ ] Run `npm run typecheck` (0 errors)
- [ ] Run `npm run build` (successful)
- [ ] Run `npm run lint` (warnings OK, errors fixed)
- [ ] Verify feature flags: all 4 flags exist in `wa_intel.feature_flags`
- [ ] Verify DnD: drag task card → status updates in DB
- [ ] Verify chart: select group → chart renders with data
- [ ] Verify realtime: add message via SQL → dashboard updates automatically
