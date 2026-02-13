---
inclusion: manual
---

# Documentation Standards — HMSO

## Before Creating Any New Documentation

### Step 1: Determine Category

| Category | Purpose | Location |
|----------|---------|----------|
| Technical Guides | Step-by-step instructions | `HMWAIntel/docs/guides/` |
| Architecture | Architecture decisions, data flows | `HMWAIntel/docs/architecture/` |
| Reference | Quick reference, specifications | `HMWAIntel/docs/reference/` |
| Reports | Implementation summaries | Within spec `reports/` folder |

### Step 2: Follow Naming Convention

```
kebab-case-descriptive-name.md

Examples:
- schema-setup-guide.md
- shared-auth-setup.md
- daily-briefing-architecture.md
```

### Step 3: Place File in Correct Directory

All documentation lives under `HMWAIntel/docs/`. Never place docs at workspace root.

```
HMWAIntel/docs/
├── architecture/          # Architecture decisions and diagrams
├── guides/                # How-to guides
├── reference/             # Quick reference docs
├── Hendra_Core_Package/   # Company context (read-only)
├── Archieves/             # Deprecated content
└── project-context.md     # Project background
```

### Step 4: Add Required Header

```markdown
# [Full Title]

**Status:** [Draft | Active | Deprecated]
**Created:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD
**Related Specs:** [Spec numbers or "None"]

---

## Purpose

[Clear statement of why this document exists]

---

[Document content follows...]
```

---

## Documentation Quality Standards

### Writing Style
- Use clear, concise language
- Hendra speaks English well but it's not his first language — avoid jargon
- Use active voice
- Keep sentences short
- Use bullet points for lists
- Include working code examples

### Code Examples
- Include working examples with correct `wa_intel` schema references
- Show both correct and incorrect patterns
- Add explanatory comments

### Cross-References
- Link to related specs by number
- Link to related steering files
- Keep links current

---

## Key Project Documents

| Document | Purpose |
|----------|---------|
| `HMWAIntel/CLAUDE.md` | AI role definition (mirrors kernel.md) |
| `HMWAIntel/SPEC_REGISTRY.md` | Single source of truth for spec statuses |
| `HMWAIntel/docs/project-context.md` | Project background & safety rules |
| `HMWAIntel/docs/Hendra_Core_Package/` | HollyMart context & operating philosophy |

---

## Implementation Reports

Implementation reports live within their spec folder:

```
HMWAIntel/specs/{NUMBER}-{name}/
└── reports/
    └── {NUMBER}-implementation-report-YYYY-MM-DD.md
```

**Minimum content:**
- Executive Summary (2-3 sentences)
- Delivered Features (checkbox list)
- Files Created / Modified
- Quality Assurance results
- Known Issues / Technical Debt
