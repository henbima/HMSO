# Spec {NUMBER}: {Feature Name} — Design

**Created:** YYYY-MM-DD HH:MM WITA

## Architecture

```
/{route}
  ├── Service Layer
  │    ├── {serviceFunction1}(params)
  │    └── {serviceFunction2}(params)
  ├── Components
  │    ├── {MainComponent}
  │    ├── {SubComponent1}
  │    └── {SubComponent2}
  └── Hooks
       └── use{FeatureName}(filters)
```

## Pattern Reference

**Follow module:** `src/modules/{existing_module}/`
**Service pattern:** `src/modules/{module}/services/{service}.ts`
**Types pattern:** `src/modules/{module}/types/index.ts`
**Component pattern:** `src/modules/{module}/components/{Component}.tsx`

## Database Changes

{Describe any new tables, columns, or migrations needed}

```sql
-- Example table definition
CREATE TABLE IF NOT EXISTS wa_intel.{table_name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns...
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Shared Imports Available

- `import { supabase } from '@shared/services/supabase'`
- `import type { ServiceResponse } from '@shared/types/service'`
- `import { useAuth } from '@shared/contexts/AuthContext'`

## Key Decisions

1. **{Decision}** — {Rationale}
2. **{Decision}** — {Rationale}
3. **{Decision}** — {Rationale}

## UI Specifications

- {Layout description}
- {Chart type and behavior}
- {Mobile behavior}
