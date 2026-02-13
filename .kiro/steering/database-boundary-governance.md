---
inclusion: always
version: 1.0.0
last-updated: 2026-02-13
---

# Database Boundary Governance — HMSO (HollyMart Signal Operations)

> **Reference:** HMCS Spec 631, ADR-006 (Multi-App Naming Convention)
> **Why:** On 2026-02-12, an AI assistant accidentally deleted another app's production cron job because there were no ownership markers in the shared database.

## App Identity
- **This project**: `wa_intel` (HMSO — HollyMart Signal Operations, database schema uses legacy name `wa_intel`)
- **Allowed schemas**: `wa_intel` (our own schema — full read/write)
- **Shared schemas** (read-only unless shared ownership): `hm_core`
- **Other app schemas** (NEVER modify): Any schema not listed above (`public`, `hmbi`, `hmcs`, `training`, etc.)

## Mandatory Registry Check

**Before ANY `DROP`, `ALTER`, `DELETE`, `TRUNCATE`, or `cron.unschedule()` operation:**

1. Query the object registry:
   ```sql
   SELECT owner_app, description
   FROM hm_core.object_registry
   WHERE object_type = '{type}' AND object_name = '{name}';
   ```

2. If `owner_app != 'wa_intel'` → **STOP. Do NOT proceed.** Tell the user this object belongs to another app.
3. If object not found in registry → **STOP. Ask the user.**
4. If `owner_app = 'wa_intel'` → Proceed with caution.

## Naming Convention for New Objects

| Object Type | Format | Example |
|-------------|--------|---------|
| Table (in `wa_intel` schema) | No prefix needed | `wa_intel.my_table` |
| Table (in `public`, if ever needed) | `wa_intel_{name}` | `wa_intel_audit_log` |
| Function | `wa_intel__{verb}_{noun}()` | `wa_intel__compute_summary()` |
| Cron Job | `wa_intel_{descriptive-name}` | `wa_intel_daily-sync` |
| Edge Function | `wa_intel-{descriptive-name}` | `wa_intel-process-data` |

## Registration Requirement

After creating ANY new database object, register it:
```sql
INSERT INTO hm_core.object_registry (object_type, object_name, object_schema, owner_app, description)
VALUES ('{type}', '{name}', '{schema}', 'wa_intel', '{description}');
```

## Forbidden Operations

**NEVER do these without explicit user confirmation AND registry check:**
- `DROP TABLE` on any table not owned by `wa_intel`
- `ALTER TABLE` on any table not owned by `wa_intel`
- `cron.unschedule()` on any cron job not prefixed with `wa_intel_`
- Any DDL in schemas not listed in "Allowed schemas" above
- Deleting or modifying Edge Functions not prefixed with `wa_intel-`

## Fallback Rule

If `hm_core.object_registry` is unavailable:
1. Check object name prefix — if it doesn't start with `wa_intel`, do NOT touch it
2. Check schema ownership — if it's not in `wa_intel` schema, do NOT touch it
3. If ambiguous → **STOP and ask the user**

## App Prefix Registry

| Prefix | Full Name | Primary Schema |
|--------|-----------|---------------|
| `hm` | HollyMart Core | `hm_core` |
| `hmcs` | HollyMart Control System | `public` |
| `hmbi` | HollyMart Business Intelligence | `hmbi` |
| `training` | Training Module | `training` |
| `wa_intel` | HMSO — Signal Operations | `wa_intel` |

## Quick Reference Queries

```sql
-- What does this project own?
SELECT object_type, object_name, description
FROM hm_core.object_registry
WHERE owner_app = 'wa_intel'
ORDER BY object_type, object_name;

-- Who owns this object? (check before modifying)
SELECT owner_app, description
FROM hm_core.object_registry
WHERE object_name = 'some_object';

-- Full registry overview
SELECT owner_app, object_type, COUNT(*)
FROM hm_core.object_registry
GROUP BY owner_app, object_type
ORDER BY owner_app, object_type;
```
