---
inclusion: manual
---

# TypeScript Testing Standards — HMSO

## Quick Reference

### Before Writing ANY Test
1. **No `any` types** → Use specific interfaces from `src/lib/types.ts`
2. **ES6 imports only** → No `require()` statements
3. **Type all functions** → `vi.fn<[ParamType], ReturnType>()`

### Critical Commands
```bash
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint check
npm run build        # Verify production build
```

---

## Mandatory Testing Rules

### Rule 1: Never Use `any` Types in Tests
```typescript
// FORBIDDEN
const mockData: any = { ... }

// REQUIRED — Use specific types
const mockData: { id: string; content: string } = { id: '123', content: 'test' }
```

### Rule 2: Type All Mock Functions
```typescript
// FORBIDDEN — Untyped mock
const mockCallback = vi.fn()

// REQUIRED — Properly typed
const mockCallback = vi.fn<[string], Promise<void>>()
```

### Rule 3: Use ES6 Imports Only
```typescript
// FORBIDDEN
const fs = require('fs')

// REQUIRED
import fs from 'fs'
```

---

## Test File Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Component/Service Name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should perform expected behavior', async () => {
    // Arrange
    const mockData = { id: '123', content: 'Test message' }

    // Act
    const result = await functionUnderTest(mockData)

    // Assert
    expect(result).toEqual(expectedResult)
  })

  it('should handle errors gracefully', async () => {
    // Arrange — Set up error scenario

    // Act & Assert
    await expect(functionUnderTest()).rejects.toThrow('Expected error')
  })
})
```

---

## HMSO-Specific Testing Patterns

### Testing Service Layer
```typescript
// Mock Supabase client for wa_intel schema
const mockSupabase = {
  schema: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: '1', content: 'test' }],
        error: null
      })
    })
  })
}
```

### Testing with wa_intel Types
```typescript
import type { Message, ClassifiedItem, Task } from '@/lib/types'

const mockMessage: Message = {
  id: 'test-uuid',
  group_id: 'group-uuid',
  sender_name: 'Test User',
  content: 'Test message content',
  source_type: 'whatsapp',
  created_at: new Date().toISOString()
}
```

---

## Verification Commands

After creating/modifying test files, ALWAYS run:

```bash
npm run typecheck    # Check for type errors
npm run lint         # Check for lint errors
npm run build        # Verify build succeeds
```

---

## Success Criteria

- Zero `any` types in test files
- ES6 imports only — no `require()`
- All mock functions properly typed
- All tests pass
- TypeScript type checking passes
