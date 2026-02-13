---
inclusion: manual
---

# Superior Debugging Methodology
*Infrastructure-First Problem Solving Framework*

## Core Principle: Infrastructure → Symptoms

**Always debug from the bottom up, not top down.**
- Start with infrastructure dependencies
- Trace the full execution path
- Find the deepest failure point
- Fix root causes, not symptoms

---

## The 4-Phase Investigation Framework

### Phase 1: Context Analysis (ALWAYS FIRST)
*"What changed recently that could have caused this?"*

#### Mandatory First Steps
- [ ] **Timeline Correlation**: When exactly did the issue start?
- [ ] **Recent Changes**: What changed in the last 7 days?
- [ ] **Migration History**: Check recent database migrations
- [ ] **Deployment Timeline**: Recent deployments or configuration changes

#### Quick Commands
```bash
# Check recent migrations
ls -la HMWAIntel/supabase/migrations/ | tail -10

# Check recent git changes
git log --oneline --since="7 days ago"
```

```sql
-- Check recent schema changes
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 5;
```

---

### Phase 2: Dependency Mapping
*"What infrastructure does this feature depend on?"*

#### System Dependency Checklist
- [ ] **Database Tables**: Do all required tables exist in `wa_intel` schema?
- [ ] **Database Columns**: Are column names/types correct?
- [ ] **Foreign Keys**: Are relationships intact?
- [ ] **RLS Policies**: Are security policies working?
- [ ] **Edge Functions**: Are they deployed and responding?
- [ ] **Listener**: Is the WhatsApp listener connected?

#### HMSO-Specific Dependencies
```sql
-- Verify critical wa_intel tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'wa_intel'
AND table_name IN (
  'messages', 'groups', 'contacts', 'group_members',
  'classified_items', 'tasks', 'directions',
  'daily_briefings', 'daily_topics', 'meetings',
  'message_flags'
);
```

#### Dependency Tracing Pattern
```
1. UI Component → What service does it call?
2. Service Layer → What database tables does it query?
3. Database → Do tables/columns exist in wa_intel?
4. Authorization → What RLS policies apply?
5. External → Is the listener/edge function working?
```

---

### Phase 3: Infrastructure Verification
*"Are all dependencies actually working?"*

#### Database-First Verification
```sql
-- Test table existence
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'suspected_table' AND table_schema = 'wa_intel';

-- Test RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'target_table';

-- Test actual data access
SELECT COUNT(*) FROM wa_intel.target_table;

-- Check object ownership (boundary safety)
SELECT owner_app, description
FROM hm_core.object_registry
WHERE object_name = 'target_table';
```

#### Edge Function Verification
```sql
-- Check if edge function exists
-- Use mcp_supabase_list_edge_functions

-- Check edge function logs
-- Use mcp_supabase_get_logs with service='edge-function'
```

---

### Phase 4: Root Cause Isolation
*"What's the deepest point of failure?"*

#### Failure Point Identification
1. **Database Level**: Table/column missing, RLS blocking, wrong schema
2. **Service Level**: Broken queries, missing dependencies
3. **Authorization Level**: Permission checks failing
4. **UI Level**: Component logic errors
5. **External Level**: Listener disconnected, edge function error

#### Common Root Cause Patterns

**Pattern 1: Wrong Schema**
- Symptom: Empty results, table not found
- Root Cause: Querying `public` instead of `wa_intel`
- Fix: Use `supabase.schema('wa_intel').from('table')`

**Pattern 2: RLS Blocking**
- Symptom: Silent failures, empty results for authenticated users
- Root Cause: RLS policy too restrictive or missing
- Fix: Check and update RLS policies

**Pattern 3: Migration Side Effects**
- Symptom: Previously working feature fails
- Root Cause: Migration changed/dropped dependencies
- Fix: Update code to match new schema

**Pattern 4: Listener Disconnection**
- Symptom: No new messages appearing
- Root Cause: Baileys session expired or listener crashed
- Fix: Check listener logs, restart if needed

---

## HMSO-Specific Debugging Patterns

### "Messages not showing"
1. Check: Is the listener running and connected?
2. Check: Are messages being inserted into `wa_intel.messages`?
3. Check: Is the `source_type` correct?
4. Check: Is RLS allowing the read?
5. Check: Is the frontend querying `wa_intel` schema?

### "Classification not working"
1. Check: Is the classify-messages edge function deployed?
2. Check: Are there unclassified messages in `wa_intel.messages`?
3. Check: Is the OpenAI API key valid?
4. Check: Are results being written to `wa_intel.classified_items`?

### "Briefing not generating"
1. Check: Is the daily-briefing edge function deployed?
2. Check: Is the cron job scheduled? (`SELECT * FROM cron.job WHERE jobname LIKE 'wa_intel%'`)
3. Check: Are there enough messages for the briefing period?
4. Check: Are results in `wa_intel.daily_briefings`?

---

## Investigation Workflow Template

```markdown
## Issue Investigation Report

### Phase 1: Context Analysis
- **Issue Start Time**: [When did this begin?]
- **Recent Changes**: [What changed in last 7 days?]
- **Migration History**: [Recent database changes?]
- **User Impact**: [How many users affected?]

### Phase 2: Dependency Mapping
- **Database Dependencies**: [Tables, columns in wa_intel]
- **Service Dependencies**: [What services are called?]
- **External Dependencies**: [Listener, edge functions, APIs]

### Phase 3: Infrastructure Verification
- **Database Status**: [✅/❌ All tables exist and accessible]
- **Service Status**: [✅/❌ All services responding correctly]
- **External Status**: [✅/❌ Listener connected, edge functions deployed]

### Phase 4: Root Cause Analysis
- **Failure Point**: [Database/Service/Auth/UI/External]
- **Root Cause**: [Specific technical issue]
- **Fix Strategy**: [How to address root cause]
```

---

## Anti-Patterns (DO NOT DO)

- Don't guess — verify with data
- Don't change multiple things at once — isolate variables
- Don't add `any` types to "fix" errors — find the real type
- Don't restart the server as first action — understand the error first
- Don't delete and recreate — understand why it broke
- Don't assume schema — always verify against `wa_intel`
- Don't touch other apps' objects — check boundary first

---

## Quick Reference Commands

### Database Investigation
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'wa_intel';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'target' AND table_schema = 'wa_intel';
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'target';
SELECT COUNT(*) FROM wa_intel.target_table;
```

### Boundary Investigation
```sql
SELECT owner_app, description FROM hm_core.object_registry WHERE object_name = 'target';
SELECT * FROM hm_core.object_registry WHERE owner_app = 'wa_intel';
```

### Migration Investigation
```bash
# Recent migrations
dir HMWAIntel\supabase\migrations\ /O:-D
```

**Remember: Always start with "What changed recently?" and trace dependencies before looking at UI components.**
