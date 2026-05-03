# CI Enforcement & Governance Rules

## Authority

CI is the **single source of truth**. No code merges without all gates passing.

## Rules

### 1. PR-Only Merge Policy
- All changes to `dev` and `main` must go through pull requests
- Direct push is forbidden (branch protection required)
- Admin bypass merges without CI = policy violation

### 2. `--no-verify` is Irrelevant
- Husky hooks are a **local convenience**, not a security boundary
- CI runs independently of local hooks
- Skipping hooks locally does not bypass CI enforcement
- CI WILL catch any violation regardless of local bypass

### 3. Coverage Enforcement
- Global thresholds: **95% branches, 95% functions, 95% lines, 95% statements**
- Coverage scope: `middleware.ts`, `app/api/auth/**/*.ts`, `lib/auth/keycloak.ts`
- Threshold violation = CI failure = merge blocked

### 4. Drift Detection
- Modifying auth code without updating tests = CI failure
- Monitored paths: `middleware.ts`, `app/api/auth/**`, `lib/auth/**`
- Required test path: `tests/auth/**`

### 5. Snapshot Integrity
- CI runs with `--ci` flag (strict snapshot mode)
- Snapshot updates require explicit commit (no interactive updates in CI)
- Snapshot drift = test failure = merge blocked

### 6. Test Ownership
- Every auth route MUST have corresponding tests
- Coverage drop below threshold = regression = blocked
- Test files must be co-located in `tests/auth/`

## Enforcement Stack

| Layer | Mechanism | Bypass-proof |
|-------|-----------|--------------|
| Local | Husky pre-push | No (--no-verify) |
| CI | GitHub Actions | Yes (required check) |
| Branch | Protection rules | Yes (admin setting) |
| Coverage | Jest thresholds | Yes (CI enforced) |
| Drift | Git diff analysis | Yes (CI enforced) |

## Branch Strategy

```
main (production) ← protected, requires CI + review
  ↑
dev (integration) ← protected, requires CI
  ↑
feat/* (development) ← open push
```
