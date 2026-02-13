---
inclusion: manual
---

# HMSO Spec Numbering System — MANDATORY

## CRITICAL: AI AGENTS MUST CHECK THIS BEFORE ANY SPEC WORK

**STOP AND READ THIS CHECKLIST BEFORE:**
- Creating a new spec
- Creating implementation documentation
- Creating implementation reports
- Moving/organizing spec files

## Spec Location: `.kiro/specs/`

All specs live in `.kiro/specs/` (Kiro's native spec location).
All spec folders MUST be numbered using our domain-based numbering system FROM CREATION.

**The folder name must include the number from the very beginning. There is no rename step.**

---

## Before Creating Any New Spec — Follow This Exact Process:

### Step 1: Check Spec Registry FIRST
- [ ] **Read `HMWAIntel/SPEC_REGISTRY.md`** to get next available number
- [ ] **Identify the domain range** for your spec
- [ ] **Reserve the number** by updating the registry

### Step 2: Create the Spec Folder WITH the Number

**Location:** `.kiro/specs/`
**Format:** `{NUMBER}-{descriptive-kebab-case-name}/`
**Example:** `.kiro/specs/203-meeting-transcript-classifier/`

**The number is part of the folder name from creation. Do NOT create an unnumbered folder.**

### Step 3: Create Required Files Within Spec
```
Required files:
- requirements.md — follow template in .kiro/specs/_templates/requirements.template.md
- design.md — follow template in .kiro/specs/_templates/design.template.md
- tasks.md — follow template in .kiro/specs/_templates/tasks.template.md
```

### Step 4: Folder Structure
```
.kiro/specs/{NUMBER}-{spec-name}/
├── .config.kiro              # Kiro config (if auto-created)
├── requirements.md
├── design.md
├── tasks.md
├── implementation/           # Implementation documentation (optional)
│   ├── {NUMBER}-01-component-name.md
│   └── ...
└── reports/                  # Implementation reports
    ├── {NUMBER}-implementation-report-YYYY-MM-DD.md
    └── ...
```

### Step 5: Update SPEC_REGISTRY.md
- Add the spec to the Active Specs table
- Update the "Next Available" number in Domain Ranges

---

## HMSO Domain Ranges

| Range | Domain | Description | Next Available |
|-------|--------|-------------|----------------|
| **0xx** | Foundation & Discovery | Project setup, realignment, core architecture | Check SPEC_REGISTRY |
| **1xx** | Listener & Infrastructure | WhatsApp listener, Baileys, message capture | Check SPEC_REGISTRY |
| **2xx** | Classification & AI | Message classification, AI processing, topic analysis | Check SPEC_REGISTRY |
| **3xx** | Contacts & Groups | Contact management, group sync, membership | Check SPEC_REGISTRY |
| **4xx** | Briefings & Delivery | Daily briefings, WA delivery, summaries | Check SPEC_REGISTRY |
| **5xx** | Tasks & Directions | Task extraction, direction tracking, action items | Check SPEC_REGISTRY |
| **6xx** | Dashboard & UI | Frontend dashboard, visualization, UX | Check SPEC_REGISTRY |
| **7xx** | Database & Performance | Schema fixes, indexes, performance optimization | Check SPEC_REGISTRY |

**Always check `HMWAIntel/SPEC_REGISTRY.md` for the actual next available number.**

---

## Folder Organization

```
.kiro/specs/
├── _completed/          # Finished specs (moved here when done)
├── _pending/            # On hold / blocked specs
├── _templates/          # Templates for new specs
├── 001-hmso-project-realignment/
├── 101-baileys-v7-upgrade/
├── 102-personal-messages-capture/
├── 202-topic-based-classification-redesign/
├── 601-dashboard-enhancements/
└── 701-db-indexes-and-schema-fixes/
```

### Status Transitions
```
Planned → In Progress → Complete (move to _completed/)
              ↓
           Pending (move to _pending/) → In Progress (when unblocked)
```

---

## Implementation Documentation Rules

**Implementation files format:**
- Location: `implementation/` subfolder within the spec
- Naming: `{NUMBER}-{XX}-{component-name}.md`
- Sequential numbering: 01, 02, 03, etc.

**Reports format:**
- Location: `reports/` subfolder within the spec
- Naming: `{NUMBER}-implementation-report-YYYY-MM-DD.md`

---

## Numbering Rules

1. **Domain-based**: Pick the range that matches the feature domain
2. **Sequential**: Use the next available number in that range
3. **Never reuse**: Deleted or superseded specs keep their number forever
4. **Folder format**: `.kiro/specs/{NUMBER}-{name-kebab-case}/`
5. **Completed folder**: `.kiro/specs/_completed/{NUMBER}-{name-kebab-case}/`
6. **Pending folder**: `.kiro/specs/_pending/{NUMBER}-{name-kebab-case}/`

---

## Violation Recovery

If a spec folder is found without a number:
1. **Stop immediately**
2. **Check registry for proper number**
3. **Fix the folder name**
4. **Update the registry**
