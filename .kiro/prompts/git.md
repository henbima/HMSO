# Git Workflow — HMSO

## 1. Check Status

```bash
git status
git log --oneline -5
```

## 2. Commit Changes

```bash
git add .
git commit -m "type: description"
```

**Commit types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Maintenance, config changes
- `docs:` — Documentation only
- `refactor:` — Code restructuring
- `style:` — Formatting, no logic change
- `perf:` — Performance improvement

## 3. Push

```bash
git push origin {branch-name}
```

## 4. If Something Goes Wrong

### Quick Revert (Safe)
```bash
git revert HEAD
git push origin {branch-name}
```

### Rollback to Previous Commit
```bash
git log --oneline -5
git reset --hard {commit-hash}
git push origin {branch-name} --force
```

**Warning:** Force push is destructive. Only use if necessary.

## 5. Branch Strategy

- `main` — Production
- `staging` — Staging/testing
- Feature branches: `feature/{description}`
- Fix branches: `fix/{description}`
