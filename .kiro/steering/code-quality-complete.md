---
inclusion: manual
---

# Code Quality & Defensive Programming — Complete Guide

## Quick Reference

### Before ANY Code Changes
1. **Run quality check** → `npm run lint` and `npm run typecheck`
2. **No `any` types** → Use specific types from `src/lib/types.ts`
3. **Null safety** → Use optional chaining `obj?.prop`
4. **Service layer** → No direct `supabase.from()` in components

### Critical Commands
```bash
npm run lint         # ESLint check
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run build        # Production build
```

---

## TypeScript Standards

### Zero Tolerance — Prohibited Patterns

```typescript
// NEVER ALLOWED
const data: any = response.data
const result: any = await service.method()

// ALWAYS REQUIRED
const data: Message[] = response.data
const result: { data: Task[], error: Error | null } = await service.method()
```

---

## Null Safety Patterns

### Mandatory Null Safety

```typescript
// NEVER DO THIS
item.name.toLowerCase()
data.filter(x => x.field.includes(search))

// ALWAYS DO THIS
(item?.name || '').toLowerCase()
(data || []).filter(x => x?.field?.includes?.(search))
```

### Array Operations Safety
```typescript
// WRONG — Causes errors if items is null/undefined
const result = items.map(item => item.property)

// CORRECT — Defensive
const result = (items || [])
  .filter(Boolean)
  .map(item => item?.property)
  .filter(Boolean)
```

---

## Service Layer Pattern

```typescript
// CORRECT — Service handles DB access
export const messageService = {
  async getMessages(groupId: string) {
    const { data, error } = await supabase
      .schema('wa_intel')
      .from('messages')
      .select('*')
      .eq('group_id', groupId)

    return { data: data || [], error }
  }
}

// Component uses service only
const MessageList = () => {
  const { data: messages } = await messageService.getMessages(groupId)
}
```

```typescript
// WRONG — Direct DB access in component
const MyComponent = () => {
  const { data } = supabase.schema('wa_intel').from('messages').select() // NO!
}
```

---

## Error Prevention Patterns

### Component Safety Pattern
```typescript
const MessageList = ({ messages }: { messages?: Message[] }) => {
  const safeMessages = (messages || []).filter(Boolean)

  if (safeMessages.length === 0) {
    return <EmptyState message="No messages available" />
  }

  return (
    <div>
      {safeMessages.map(msg => (
        <MessageCard key={msg?.id || 'unknown'} message={msg} />
      ))}
    </div>
  )
}
```

---

## Code Review Checklist

- [ ] No `any` types in new code
- [ ] Null safety patterns applied (optional chaining, fallbacks)
- [ ] Service layer used for all DB access
- [ ] Loading/empty states exist in components
- [ ] Error handling implemented
- [ ] No `console.log` left (except intentional debug)
- [ ] Follows project naming conventions (kebab-case files, PascalCase components)
- [ ] Uses `wa_intel` schema for all Supabase queries

---

## Development Workflow

### Starting New Work
1. Read existing code first — understand what's there
2. Make minimal changes — only add what's needed
3. Run `npm run typecheck` after changes
4. Run `npm run lint` before committing
5. Run `npm run build` to verify production build

### When Something Breaks
1. Don't panic — revert to last working state
2. Check infrastructure first (see `superior-debugging-methodology.md`)
3. Isolate the change that caused the break
4. Fix root cause, not symptoms
