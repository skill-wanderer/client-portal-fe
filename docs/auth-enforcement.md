# Auth Test Enforcement Policy

---

## Authority Hierarchy

1. **CI is the authority.** Not husky. Not the developer. Not the reviewer. The GitHub Actions workflow is the single source of truth for whether auth code is correct. If CI passes, the code is valid. If CI fails, the code is rejected. No human override.

2. **Husky is a convenience layer.** It catches failures early to save developer time. It is NOT the enforcement mechanism. Developers who bypass husky (`--no-verify`) will still be blocked by CI.

3. **Documentation is the policy layer.** It defines what "auth change" means and what the expectations are. It does not enforce — CI does.

---

## PR Gate Rules

1. **All pull requests to `main` or `dev` must pass `test:auth`.**
   The GitHub Actions workflow (`auth-tests.yml`) runs `npm run test:auth` on every PR. A failing run blocks merge.

2. **Auth-related changes must include test updates.**
   Any modification to the following files requires corresponding test additions or updates:
   - `middleware.ts`
   - `app/api/auth/**`
   - `lib/auth/**`

3. **Failing auth tests = automatic PR rejection.**
   No override. No exceptions. Fix the tests or revert the change.

---

## Coverage Gate

The test suite enforces minimum coverage thresholds on auth-critical files:

| Metric | Threshold |
|--------|-----------|
| Branches | 90% |
| Functions | 95% |
| Lines | 95% |
| Statements | 95% |

**Covered files:**
- `middleware.ts`
- `app/api/auth/session-init/**/*.ts`

Note: Files that require external integration (callback, login, logout, keycloak) are excluded from coverage enforcement. They are validated through drift detection — any change to those files requires a corresponding test update. As integration tests are added, coverage scope expands.

If coverage drops below these thresholds, `npm run test:auth` fails. This means:
- Local push is blocked (husky)
- CI fails (GitHub Actions)
- PR cannot be merged

**How to check coverage locally:**
```
npm run test:auth
```
Coverage report is printed to stdout and written to `coverage/`.

---

## Drift Detection

CI includes an automated drift detection step:

**Rule:** If any auth-related file is modified in a PR but no file under `tests/auth/` is modified, the build fails immediately.

**Monitored files:**
- `middleware.ts`
- `app/api/auth/**`
- `lib/auth/**`

**Required co-change:**
- `tests/auth/**`

**Rationale:** Auth code cannot change without corresponding test updates. This prevents coverage erosion and untested behavioral changes from entering the codebase.

---

## Enforcement Layers

| Layer | Mechanism | Trigger | Effect |
|-------|-----------|---------|--------|
| Local | Husky `pre-push` hook | `git push` | Blocks push if `test:auth` fails |
| CI | GitHub Actions workflow | Pull request opened/updated | Blocks merge if `test:auth` fails |
| CI | Drift detection step | Pull request opened/updated | Blocks merge if auth changed without tests |
| CI | Coverage threshold | Pull request opened/updated | Blocks merge if coverage drops below threshold |
| CI | Artifact upload | Always | Preserves coverage report for 14 days |
| Review | This policy document | Code review | Reviewer checks test coverage for auth changes |

---

## How It Works

### Pre-Push (Local)

```
git push → .husky/pre-push → npm run test:auth → pass/fail
```

If tests fail or coverage drops, the push is aborted. The developer must fix the issue locally before pushing.

### CI (Remote)

```
PR opened → drift detection → npm run test:auth (with coverage) → artifact upload → summary
```

If any step fails, the PR status check fails. GitHub branch protection rules require this check to pass before merge.

---

## Required GitHub Settings

To fully enforce, enable these branch protection rules on `main` and `dev`:

1. **Require status checks to pass before merging**
2. **Require the "Auth Tests" check**
3. **Do not allow bypassing the above settings**

---

## What Counts as an Auth Change

Any modification to:

- `middleware.ts` (route protection logic)
- `app/api/auth/login/route.ts` (OAuth initiation)
- `app/api/auth/callback/route.ts` (token exchange)
- `app/api/auth/session-init/route.ts` (session handoff)
- `app/api/auth/logout/route.ts` (session teardown)
- `lib/auth/session.ts` (session store)
- `lib/auth/keycloak.ts` (IdP integration)

---

## Escalation

If a test is failing and the cause is unclear:

1. Run `npm run test:auth -- --verbose` for detailed output
2. Check which test file fails to isolate the layer
3. Do NOT disable or skip the test
4. Do NOT push with `--no-verify`

---

## Contract Behavior Tests

The `auth.contract.behavior.test.ts` file validates cross-layer behavioral contracts:

| Contract | Assertion |
|----------|-----------|
| Callback must redirect to session-init | Redirect target contains `/api/auth/session-init` with `sid` param |
| session-init must not redirect to login when sid exists | Location does NOT contain `/login` |
| Full auth flow must end in dashboard | Final chain entry contains `/dashboard` |
| Full auth flow must never visit /login | No chain entry has `/login` path |
| Flow must not exceed 3 hops | `chain.length <= 3` |

These tests prevent behavioral regressions where the system appears to work but produces incorrect redirect sequences.

---

## Semantic Drift Protection

Inline snapshots (`toMatchInlineSnapshot`) are used to lock the redirect chain structure:

```typescript
expect(result.chain.map(url => new URL(url).pathname))
  .toMatchInlineSnapshot(`
    ["/api/auth/callback", "/api/auth/session-init", "/dashboard"]
  `);
```

**How it works:**
- If the redirect chain structure changes (new hop added, order changed, target changed), the snapshot fails.
- In CI (`--ci` flag), snapshot failures are hard failures. No interactive update is possible.
- To update a snapshot after an intentional change, run `npm run test:auth -- --updateSnapshot` locally, verify the diff, and commit.

**Why this matters:**
- Unit tests validate individual responses. Snapshots validate the *shape* of the entire flow.
- A passing unit test with a failing snapshot means: "each step works, but the composition changed." This catches semantic drift that per-unit tests miss.

---

## CI as Authority

The CI workflow is the final arbiter. It enforces:

| Gate | Mechanism | Bypass Possible? |
|------|-----------|-----------------|
| Drift detection | `git diff` on auth files vs test files | No |
| Test execution | `npm run test:auth -- --ci` | No |
| Coverage threshold | Jest `coverageThreshold` config | No |
| Snapshot integrity | `--ci` flag prevents auto-update | No |
| Artifact preservation | `upload-artifact` action | N/A (observability) |

Human actions that are explicitly blocked:
- `--no-verify` on push: CI still catches it
- Manual snapshot update without review: diff is visible in PR
- Lowering coverage thresholds: requires modifying `jest.config.js` which triggers drift detection

---

## Summary

The auth test system is an immutable merge gate. CI is the authority. Coverage thresholds prevent erosion. Drift detection prevents unvalidated changes. Semantic snapshots prevent behavioral drift. Bypassing it is not permitted.
