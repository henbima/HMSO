# Spec 601: Dashboard Enhancements — Design

**Priority:** P2 — Medium
**Domain:** 600-699 (Dashboard & UI)

---

## Part 1: Drag & Drop Kanban (TasksPage)

### Library Choice: `@dnd-kit/core` + `@dnd-kit/sortable`

**Why:** Lightweight, accessible, React 18 compatible, works with Tailwind CSS, no jQuery dependency. Better maintained than `react-beautiful-dnd` (archived by Atlassian).

### Architecture

```
TasksPage
├── DndContext (from @dnd-kit/core)
│   ├── KanbanColumn (droppable) — status="new"
│   │   └── TaskCard (draggable)
│   ├── KanbanColumn — status="in_progress"
│   │   └── TaskCard (draggable)
│   ├── KanbanColumn — status="stuck"
│   │   └── TaskCard (draggable)
│   └── KanbanColumn — status="done"
│       └── TaskCard (draggable)
```

### On Drop Handler

```typescript
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over) return;

  const taskId = active.id;
  const newStatus = over.id; // column id = status

  // Optimistic update
  setTasks(prev => prev.map(t =>
    t.id === taskId ? { ...t, status: newStatus } : t
  ));

  // Persist to DB
  await waIntel.from('tasks').update({
    status: newStatus,
    updated_at: new Date().toISOString(),
    completed_at: newStatus === 'done' ? new Date().toISOString() : null,
  }).eq('id', taskId);
}
```

### Dependencies to Add

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Part 2: Activity Charts (GroupsPage)

### Library Choice: `recharts`

**Why:** React-native charting library, small bundle, composable components, good TypeScript support. No need for heavy libraries like Chart.js.

### Chart Component

New component: `src/components/GroupActivityChart.tsx`

```typescript
interface ChartData {
  date: string;       // "2026-02-01"
  messages: number;
  tasks: number;
  directions: number;
}
```

### Data Query

```sql
SELECT
  DATE(timestamp) as date,
  COUNT(*) as messages,
  COUNT(ci.id) FILTER (WHERE ci.classification = 'task') as tasks,
  COUNT(ci.id) FILTER (WHERE ci.classification = 'direction') as directions
FROM wa_intel.messages m
LEFT JOIN wa_intel.classified_items ci ON ci.message_id = m.id
WHERE m.wa_group_id = $groupId
  AND m.timestamp >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY DATE(timestamp)
ORDER BY date;
```

Since Supabase JS client doesn't support raw SQL aggregation easily, this will be implemented as a database function:

```sql
CREATE OR REPLACE FUNCTION wa_intel.get_group_activity(
  p_wa_group_id TEXT,
  p_days INTEGER DEFAULT 14
) RETURNS TABLE(date DATE, messages BIGINT, tasks BIGINT, directions BIGINT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    DATE(m.timestamp) as date,
    COUNT(DISTINCT m.id) as messages,
    COUNT(DISTINCT ci.id) FILTER (WHERE ci.classification = 'task') as tasks,
    COUNT(DISTINCT ci.id) FILTER (WHERE ci.classification = 'direction') as directions
  FROM wa_intel.messages m
  LEFT JOIN wa_intel.classified_items ci ON ci.message_id = m.id
  WHERE m.wa_group_id = p_wa_group_id
    AND m.timestamp >= CURRENT_DATE - p_days
  GROUP BY DATE(m.timestamp)
  ORDER BY date;
$$;
```

### Chart Display

Bar chart showing daily message volume with stacked colors:
- Gray: total messages
- Blue: tasks
- Orange: directions

Placed below the group detail view when a group is selected.

### Dependencies to Add

```bash
npm install recharts
```

---

## Part 3: Supabase Realtime Subscriptions

### Hook: `src/hooks/useRealtimeSubscription.ts`

```typescript
export function useRealtimeSubscription(
  table: string,
  callback: () => void,
  filter?: string
) {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'wa_intel',
        table,
        filter,
      }, () => {
        callback(); // trigger data refetch
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, filter]);
}
```

### Integration Points

| Page | Table(s) | Trigger |
|---|---|---|
| OverviewPage | `messages`, `tasks`, `directions` | Refresh stats counters |
| TasksPage | `tasks` | Refresh task list |
| GroupsPage | `messages` | Refresh message list for selected group |
| DirectionsPage | `directions` | Refresh directions list |
| BriefingsPage | `daily_briefings` | Show new briefing when generated |

### Realtime Channel Setup

Each page subscribes when mounted, unsubscribes on unmount. Callback triggers the existing `fetchData()` / `loadData()` functions that pages already have.

---

## Part 4: Feature Flags

### Database Table

```sql
CREATE TABLE IF NOT EXISTS wa_intel.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view feature_flags"
  ON wa_intel.feature_flags FOR SELECT
  TO authenticated USING (auth.uid() IS NOT NULL);

GRANT SELECT ON wa_intel.feature_flags TO authenticated;
GRANT ALL ON wa_intel.feature_flags TO service_role;
```

### Hook: `src/hooks/useFeatureFlags.ts`

```typescript
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    waIntel.from('feature_flags')
      .select('name, enabled')
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        data?.forEach(f => { map[f.name] = f.enabled; });
        setFlags(map);
      });
  }, []);

  return {
    isEnabled: (name: string) => flags[name] === true,
    flags,
  };
}
```

### Usage Pattern

```tsx
const features = useFeatureFlags();

return (
  <div>
    {features.isEnabled('realtime_updates') && <RealtimeIndicator />}
    {features.isEnabled('activity_charts') && <GroupActivityChart />}
  </div>
);
```

### Initial Flags to Seed

```sql
INSERT INTO wa_intel.feature_flags (name, enabled, description) VALUES
  ('drag_drop_kanban', false, 'Enable drag & drop on task kanban board'),
  ('activity_charts', false, 'Enable message activity charts on groups page'),
  ('realtime_updates', false, 'Enable Supabase Realtime subscriptions'),
  ('search_page', false, 'Enable search page (Phase 2 RAG)');
```

---

## File Changes Summary

| File | Change Type | Description |
|---|---|---|
| `src/pages/TasksPage.tsx` | Modify | Add DnD context and droppable columns |
| `src/pages/GroupsPage.tsx` | Modify | Add activity chart below group detail |
| `src/pages/OverviewPage.tsx` | Modify | Add realtime subscription |
| `src/components/GroupActivityChart.tsx` | **New** | Recharts bar chart component |
| `src/hooks/useRealtimeSubscription.ts` | **New** | Generic realtime subscription hook |
| `src/hooks/useFeatureFlags.ts` | **New** | Feature flags hook |
| `supabase/migrations/XXXXXX_add_feature_flags.sql` | **New** | Feature flags table + seed data |
| `supabase/migrations/XXXXXX_add_group_activity_function.sql` | **New** | `get_group_activity()` function |
| `package.json` | Modify | Add `@dnd-kit/*` and `recharts` dependencies |

---

## Dependencies to Add

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x",
  "recharts": "^2.x"
}
```

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| DnD library conflicts with Tailwind | Low | @dnd-kit is CSS-agnostic |
| Recharts bundle size too large | Low | Tree-shakeable, only import used components |
| Realtime subscription overload | Medium | Throttle callbacks, use debounce |
| Feature flags add query per page load | Low | Cache flags in context, single fetch |
