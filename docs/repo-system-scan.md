# Repository System Scan

Purpose: deterministic system reality snapshot, audit baseline, and assessment input layer for the current repository state.

Scan basis:

- Static scan of repository-controlled runtime, config, test, docs, and automation surfaces
- Runtime baseline from `npm run test:auth -- --ci`: 8/8 suites passed, 49/49 tests passed, 2/2 snapshots passed, configured auth coverage reported at 100%

System interpretation rule:

- This document describes how the repository behaves as a system.
- Files are used as evidence, not as the primary unit of explanation.
- Generated and vendor directories are included structurally but are not treated as authored system logic.

---

## 1. Executive Summary

The repository implements a Next.js App Router client portal with a server-side authentication boundary around Keycloak. The active runtime system is composed of public login UI, server auth routes, a middleware gate, an in-memory session store, and a small UI shell for protected pages. The actual login chain is not direct callback-to-dashboard; it uses an intermediate `session-init` bridge route to set the session cookie before forwarding to `/dashboard`.

The repository also contains a second system alongside the runtime: an auth enforcement system. That enforcement system is implemented through Jest auth tests, drift detection in CI, Husky pre-push checks, and snapshot-based flow locking. This governance layer is strong and currently passing, but it is protecting a runtime that still has production-readiness gaps: no Redis session backend, no active token-refresh path in middleware, a defective logout fallback when no session exists, and multiple dormant or stale surfaces.

Current audit conclusion:

- The repo is structurally coherent around server-side auth.
- The repo is not yet a clean production target-state implementation.
- The repo is strong as a controlled auth prototype with deterministic test enforcement.

---

## 2. Repository Structure

### 2.1 Root Structure

```text
client-portal-fe/
  .github/
    workflows/
      auth-tests.yml
  .husky/
    _/
    pre-commit
    pre-push
  app/
    (auth)/
      layout.tsx
      login/
        page.tsx
    (portal)/
      layout.tsx
      dashboard/
        page.tsx
    api/
      auth/
        callback/
          route.ts
        login/
          route.ts
        logout/
          route.ts
        session-init/
          route.ts
    favicon.ico
    globals.css
    layout.tsx
    page.tsx
  certificates/
    client-portal.test-key.pem
    client-portal.test.pem
  components/
    navigation.tsx
    ui/
      button.tsx
      container.tsx
  docs/
    auth-bff-keycloak-implementation.md
    auth-enforcement.md
    auth-loop-fixed.md
    auth-system-e2e.md
    auth-test-system.md
    ci-enforcement.md
    client-portal-blueprint.md
    client-portal-engineering-target.md
    system-blueprint.md
  features/
    .gitkeep
  hooks/
    use-auth.ts
  lib/
    auth/
      config.ts
      index.ts
      keycloak.ts
      provider.tsx
      session.ts
      types.ts
    env.ts
  public/
    file.svg
    globe.svg
    next.svg
    vercel.svg
    window.svg
  tests/
    auth/
      auth.callback.test.ts
      auth.contract.behavior.test.ts
      auth.contract.test.ts
      auth.flow.test.ts
      auth.keycloak.test.ts
      auth.login.test.ts
      auth.loop.test.ts
      auth.middleware.test.ts
    testServer.ts
  types/
    index.ts
  .env.local
  AGENTS.md
  CLAUDE.md
  client-portal.test-key.pem
  client-portal.test.pem
  eslint.config.mjs
  jest.config.js
  localhost-key.pem
  localhost.pem
  middleware.ts
  next-env.d.ts
  next.config.ts
  package-lock.json
  package.json
  postcss.config.mjs
  README.md
  server.js
  structure.txt
  test.txt
  tsconfig.json
  .next/             (generated build/dev output)
  coverage/          (generated test artifacts)
  node_modules/      (vendor dependencies)
```

### 2.2 Structural Interpretation

The repository is divided into four distinct system zones:

| Zone | Contents | System Meaning |
| --- | --- | --- |
| Runtime application | `app/`, `components/`, `lib/`, `hooks/`, `middleware.ts`, `server.js`, `types/` | Live portal behavior and auth control path |
| Validation and enforcement | `tests/`, `jest.config.js`, `.github/workflows/`, `.husky/` | Deterministic test and merge-gate system |
| Architecture and governance memory | `docs/`, `AGENTS.md`, `CLAUDE.md` | Blueprint, implementation rationale, audit policy, and instruction surfaces |
| Support and residual artifacts | `certificates/`, root `.pem` files, `public/`, `features/.gitkeep`, `README.md`, `structure.txt`, `test.txt`, `.next/`, `coverage/`, `node_modules/` | Local dev infra, placeholders, template residue, and generated output |

---

## 3. File Classification

Classification legend used in this scan:

- `UI`: visual or page composition surface
- `API`: request/response route surface
- `Auth`: auth-specific library or contract surface
- `Middleware`: request gate or pre-render access control
- `Config`: configuration or build/runtime policy surface
- `Test`: verification surface
- `Infra`: automation, local server, cert, or environment support surface
- `Docs`: architectural or governance knowledge surface
- `Asset`: static visual asset
- `Generated`: derived output, not authored runtime logic

### 3.1 Runtime and Repo-Controlled Files

| File | Type | Layer |
| --- | --- | --- |
| `.env.local` | Config | Config Layer |
| `.github/workflows/auth-tests.yml` | Infra | Test Layer |
| `.husky/pre-commit` | Infra | Test Layer |
| `.husky/pre-push` | Infra | Test Layer |
| `AGENTS.md` | Docs | Governance Layer |
| `CLAUDE.md` | Docs | Governance Layer |
| `app/layout.tsx` | UI | UI Layer |
| `app/page.tsx` | UI | Routing Layer |
| `app/globals.css` | UI | UI Layer |
| `app/favicon.ico` | Asset | UI Layer |
| `app/(auth)/layout.tsx` | UI | UI Layer |
| `app/(auth)/login/page.tsx` | UI | UI Layer |
| `app/(portal)/layout.tsx` | UI | UI Layer |
| `app/(portal)/dashboard/page.tsx` | UI | UI Layer |
| `app/api/auth/login/route.ts` | API | Auth Layer |
| `app/api/auth/callback/route.ts` | API | Auth Layer |
| `app/api/auth/logout/route.ts` | API | Auth Layer |
| `app/api/auth/session-init/route.ts` | API | Session Layer |
| `certificates/client-portal.test-key.pem` | Infra | Infra Layer |
| `certificates/client-portal.test.pem` | Infra | Infra Layer |
| `client-portal.test-key.pem` | Infra | Infra Layer |
| `client-portal.test.pem` | Infra | Infra Layer |
| `localhost-key.pem` | Infra | Infra Layer |
| `localhost.pem` | Infra | Infra Layer |
| `components/navigation.tsx` | UI | UI Layer |
| `components/ui/button.tsx` | UI | UI Layer |
| `components/ui/container.tsx` | UI | UI Layer |
| `docs/auth-bff-keycloak-implementation.md` | Docs | Documentation Layer |
| `docs/auth-enforcement.md` | Docs | Documentation Layer |
| `docs/auth-loop-fixed.md` | Docs | Documentation Layer |
| `docs/auth-system-e2e.md` | Docs | Documentation Layer |
| `docs/auth-test-system.md` | Docs | Documentation Layer |
| `docs/ci-enforcement.md` | Docs | Documentation Layer |
| `docs/client-portal-blueprint.md` | Docs | Documentation Layer |
| `docs/client-portal-engineering-target.md` | Docs | Documentation Layer |
| `docs/system-blueprint.md` | Docs | Documentation Layer |
| `eslint.config.mjs` | Config | Config Layer |
| `features/.gitkeep` | Infra | Placeholder Layer |
| `hooks/use-auth.ts` | Auth | UI Layer |
| `jest.config.js` | Config | Test Layer |
| `lib/env.ts` | Config | Config Layer |
| `lib/auth/config.ts` | Auth | Auth Layer |
| `lib/auth/index.ts` | Auth | Auth Layer |
| `lib/auth/keycloak.ts` | Auth | Integration Layer |
| `lib/auth/provider.tsx` | Auth | UI Layer |
| `lib/auth/session.ts` | Auth | Session Layer |
| `lib/auth/types.ts` | Auth | Auth Layer |
| `middleware.ts` | Middleware | Middleware Layer |
| `next-env.d.ts` | Config | Config Layer |
| `next.config.ts` | Config | Config Layer |
| `package-lock.json` | Config | Config Layer |
| `package.json` | Config | Config Layer |
| `postcss.config.mjs` | Config | Config Layer |
| `public/file.svg` | Asset | UI Layer |
| `public/globe.svg` | Asset | UI Layer |
| `public/next.svg` | Asset | UI Layer |
| `public/vercel.svg` | Asset | UI Layer |
| `public/window.svg` | Asset | UI Layer |
| `README.md` | Docs | Documentation Layer |
| `server.js` | Infra | Infra Layer |
| `structure.txt` | Infra | Artifact Layer |
| `test.txt` | Infra | Artifact Layer |
| `tests/testServer.ts` | Test | Test Layer |
| `tests/auth/auth.callback.test.ts` | Test | Test Layer |
| `tests/auth/auth.contract.behavior.test.ts` | Test | Test Layer |
| `tests/auth/auth.contract.test.ts` | Test | Test Layer |
| `tests/auth/auth.flow.test.ts` | Test | Test Layer |
| `tests/auth/auth.keycloak.test.ts` | Test | Test Layer |
| `tests/auth/auth.login.test.ts` | Test | Test Layer |
| `tests/auth/auth.loop.test.ts` | Test | Test Layer |
| `tests/auth/auth.middleware.test.ts` | Test | Test Layer |
| `tsconfig.json` | Config | Config Layer |
| `types/index.ts` | Auth | Session Layer |

### 3.2 Generated and Vendor Surfaces

| Surface | Type | Layer |
| --- | --- | --- |
| `.next/**` | Generated | Build Output Layer |
| `coverage/**` | Generated | Test Artifact Layer |
| `node_modules/**` | Generated | Vendor Dependency Layer |

### 3.3 Classification Summary

| System Group | Count Pattern | Meaning |
| --- | --- | --- |
| Runtime auth core | `middleware.ts`, `app/api/auth/**`, `lib/auth/**`, `lib/env.ts`, `types/index.ts` | Active security and session boundary |
| UI shell | `app/(auth)/**`, `app/(portal)/**`, `components/**`, `app/layout.tsx`, `app/globals.css` | Minimal portal interface around auth flow |
| Validation system | `tests/**`, `jest.config.js`, `.github/workflows/auth-tests.yml`, `.husky/*` | Strong automated protection against auth regressions |
| Docs system | `docs/**`, `README.md`, `AGENTS.md`, `CLAUDE.md` | High-volume knowledge layer with some drift |
| Support residue | `public/**`, duplicate cert files, `features/.gitkeep`, `structure.txt`, `test.txt` | Non-core artifacts or placeholders |

---

## 4. System Layer Mapping

| Layer | Files | Responsibility |
| --- | --- | --- |
| UI Layer | `app/layout.tsx`, `app/globals.css`, `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(portal)/layout.tsx`, `app/(portal)/dashboard/page.tsx`, `components/navigation.tsx`, `components/ui/*` | Render the portal shell, login screen, dashboard page, and shared UI primitives |
| Routing Layer | `app/page.tsx`, `app/(auth)/**`, `app/(portal)/**`, `app/api/auth/**` | Define browser entry paths, route groups, and auth endpoint locations |
| Auth Layer | `app/api/auth/login/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/logout/route.ts`, `lib/auth/types.ts`, `lib/auth/config.ts`, `lib/auth/index.ts` | Start login, process callback, start logout, and define auth contracts |
| Middleware Layer | `middleware.ts` | Gate protected routes before render and invalidate stale or expired sessions |
| Session Layer | `app/api/auth/session-init/route.ts`, `lib/auth/session.ts`, `types/index.ts` | Hold server-side session records and hand off opaque session state to the browser |
| Integration Layer (Keycloak) | `lib/auth/keycloak.ts`, `lib/env.ts` | Build IdP URLs, exchange auth codes, refresh tokens, decode ID token payloads, and shape user context |
| Config Layer | `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`, `.env.local` | Define framework, dependencies, environment sources, build rules, and lint/test behavior |
| Test Layer | `tests/**`, `jest.config.js`, `.github/workflows/auth-tests.yml`, `.husky/pre-push`, `.husky/pre-commit` | Prove flow correctness, detect drift, enforce coverage, and block unsafe auth changes |
| Infra Layer | `server.js`, `certificates/**`, root `.pem` files` | Provide local HTTPS development, host redirection, and certificate material |
| Documentation Layer | `docs/**`, `README.md` | Record blueprint, implementation rationale, enforcement policy, and historical incident analysis |

### Layer Interaction Model

```text
User
  -> UI Layer (`/login`, `/dashboard`)
  -> Routing Layer (App Router pages and auth routes)
  -> Auth Layer (`/api/auth/login`, `/callback`, `/logout`)
  -> Integration Layer (`lib/auth/keycloak.ts`)
  -> Session Layer (`sessionStore`, `session-init`)
  -> Middleware Layer (`middleware.ts`)
  -> Protected UI Response (`/dashboard`)

Validation runs in parallel to runtime:

Developer change
  -> Test Layer (Jest, Husky, CI workflow)
  -> Merge decision
```

---

## 5. Data Flow Reconstruction

### 5.1 Login Flow

Current code path:

```text
User
  -> GET /login
  -> Click "Continue with SSO"
  -> GET /api/auth/login
  -> Generate or reuse `__state`
  -> Redirect to Keycloak authorization URL
```

Behavioral facts from code:

- The login page uses a plain anchor to `/api/auth/login`, not a client-side router transition.
- `app/api/auth/login/route.ts` reuses an existing `__state` cookie if present instead of issuing a fresh state value on repeated clicks.
- New state is generated with `randomBytes(32).toString("hex")`.
- The `__state` cookie is `httpOnly`, `path=/`, `maxAge=300`, `secure` only in production, and `sameSite="none"`.
- Authorization URL construction is delegated to `lib/auth/keycloak.ts`, which uses `lib/env.ts` for `appUrl`, Keycloak URL, realm, and client ID.

System meaning:

- Login initiation is deterministic.
- State creation is server-side.
- Browser responsibility remains limited to following redirects and carrying the state cookie.

### 5.2 Callback and Session Establishment Flow

Current code path:

```text
Keycloak
  -> GET /api/auth/callback?code=...&state=...
  -> Validate query params
  -> Compare query `state` to `__state` cookie
  -> Exchange auth code at Keycloak token endpoint
  -> Decode `id_token`
  -> Extract `user`
  -> Create UUID session record in `sessionStore`
  -> Redirect to /api/auth/session-init?sid=<uuid>
  -> Delete `__state`
```

Behavioral facts from code:

- Missing `code` or `state` redirects to `/login?error=invalid_state`.
- State mismatch also redirects to `/login?error=invalid_state` and clears `__state`.
- Token exchange failure redirects to `/login?error=auth_failed` and clears `__state`.
- Successful callback does not set `__session` directly. It stores the session server-side, then redirects to `session-init`.
- `sessionStore` is an in-memory `Map<string, Session>`.

System meaning:

- The true runtime system is a two-step callback handoff: callback creates server state, `session-init` converts it into browser session continuity.
- The auth boundary is server-side.
- The session handoff is coupled to a dedicated bridge route rather than direct callback cookie issuance.

### 5.3 Session-Init Flow

Current code path:

```text
GET /api/auth/session-init?sid=<uuid>
  -> If `sid` missing: redirect to /login
  -> If `sid` present: set `__session=<sid>` cookie
  -> Redirect to /dashboard
```

Behavioral facts from code:

- `session-init` exists specifically as a cookie handoff bridge.
- The `__session` cookie is `httpOnly`, `path=/`, `secure` only in production, `sameSite="lax"`, and has no explicit `maxAge` in this handler.
- This route is publicly bypassed by middleware because all `/api/auth/*` paths are treated as public.

System meaning:

- The bridge route is a live architectural dependency, not an incidental helper.
- Protected access begins only after `session-init` succeeds.
- The cookie contract in code is weaker than the target-state documents that require stricter cookie attributes and TTL control.

### 5.4 Protected Route Flow

Current code path:

```text
Request to protected path
  -> middleware.ts matcher intercepts request
  -> Skip `/login`, `/api/auth*`, static/image/favicon exclusions
  -> Read `__session`
  -> Look up session in `sessionStore`
  -> If missing cookie: redirect /login
  -> If missing server session: redirect /login and delete cookie
  -> If refresh expired: delete session, redirect /login?error=session_expired, delete cookie
  -> Else: NextResponse.next()
```

Behavioral facts from code:

- `app/page.tsx` redirects to `/dashboard`; actual auth gating therefore happens in middleware.
- Middleware never calls `refreshAccessToken`, even though `lib/auth/keycloak.ts` exposes it and the target-state blueprint expects refresh behavior.
- Middleware enforces refresh-expiry invalidation but not access-token refresh.

System meaning:

- Route protection is centralized.
- Session validity is judged by middleware, not by the session store.
- The current repo implements session presence enforcement, not full token-lifecycle enforcement.

### 5.5 Logout Flow

Current code path:

```text
POST /api/auth/logout
  -> Read `__session`
  -> If session exists: load session, build Keycloak logout URL from `idToken`, delete session
  -> Delete `__session`
  -> Redirect to Keycloak logout URL or fallback to /login
```

Behavioral facts from code:

- Logout is server-side and depends on `sessionStore` for `idToken` retrieval.
- The success path is aligned with server-side logout orchestration.
- The fallback path is defective: when no server-side logout URL exists, `new URL("/login")` is used without a base and is invalid at runtime.
- There is no dedicated logout test file in `tests/auth/`.

System meaning:

- Logout intent is correct, but edge-case safety is incomplete.
- The auth system has stronger coverage around login/callback/middleware/session-init than around logout.

---

## 6. Dependency Mapping

### 6.1 Runtime Dependency Graph

```text
app/page.tsx
  -> redirect("/dashboard")
  -> middleware.ts

app/(auth)/login/page.tsx
  -> components/ui/button.tsx
  -> components/ui/container.tsx
  -> /api/auth/login

app/api/auth/login/route.ts
  -> lib/auth/keycloak.ts#getAuthorizationUrl
  -> next/headers cookies()
  -> node:crypto randomBytes

app/api/auth/callback/route.ts
  -> lib/auth/keycloak.ts#exchangeCode
  -> lib/auth/keycloak.ts#decodeIdToken
  -> lib/auth/keycloak.ts#extractUser
  -> lib/auth/session.ts#sessionStore
  -> lib/env.ts
  -> node:crypto randomUUID
  -> /api/auth/session-init

app/api/auth/session-init/route.ts
  -> lib/env.ts
  -> /dashboard

middleware.ts
  -> lib/auth/session.ts#sessionStore

app/api/auth/logout/route.ts
  -> lib/auth/session.ts#sessionStore
  -> lib/auth/keycloak.ts#getLogoutUrl

lib/auth/keycloak.ts
  -> lib/env.ts

lib/auth/session.ts
  -> types/index.ts

hooks/use-auth.ts
  -> lib/auth/provider.tsx

lib/auth/provider.tsx
  -> lib/auth/types.ts
  -> types/index.ts
```

### 6.2 Core Modules

| Module | Why It Is Core |
| --- | --- |
| `middleware.ts` | Single choke point for protected route access |
| `app/api/auth/login/route.ts` | OAuth initiation entry point |
| `app/api/auth/callback/route.ts` | Token exchange and session creation boundary |
| `app/api/auth/session-init/route.ts` | Cookie handoff bridge that makes the current flow work |
| `lib/auth/keycloak.ts` | Sole Keycloak integration module |
| `lib/auth/session.ts` | Sole server-side session store abstraction |
| `lib/env.ts` | Centralized environment access for auth/runtime config |

### 6.3 Entry Points

| Entry Point | Type | Role |
| --- | --- | --- |
| `/login` | Browser page | Public auth entry UI |
| `/dashboard` | Browser page | Protected portal landing page |
| `/api/auth/login` | Route handler | Auth initiation entry point |
| `/api/auth/callback` | Route handler | IdP return entry point |
| `/api/auth/session-init` | Route handler | Same-site cookie handoff entry point |
| `/api/auth/logout` | Route handler | Session teardown entry point |
| `middleware.ts` | Request gate | Pre-render authorization entry point |
| `server.js` | Local dev server | HTTPS host/origin entry point |
| `.github/workflows/auth-tests.yml` | CI workflow | Merge-gate execution entry point |

### 6.4 Dormant or Weakly Connected Modules

| Module | Observed Connection State | Meaning |
| --- | --- | --- |
| `lib/auth/provider.tsx` | Defined but not wired into app layouts or pages | Placeholder client auth context |
| `hooks/use-auth.ts` | Defined but not imported by runtime pages/components | Dormant UI auth abstraction |
| `lib/auth/index.ts` | Barrel exists but not used by runtime path | Unnecessary indirection at current repo size |
| `lib/auth/config.ts` | Used only by barrel export, not by runtime | Unused config abstraction |
| `lib/auth/keycloak.ts#refreshAccessToken` | Implemented and tested, not called by runtime | Incomplete token lifecycle integration |

---

## 7. Execution Paths

### 7.1 Login Path

| Field | Value |
| --- | --- |
| Entry point | `GET /login` |
| Flow | `/login` -> `/api/auth/login` -> `getAuthorizationUrl(state)` -> Keycloak authorization endpoint |
| Dependencies | `app/(auth)/login/page.tsx`, `app/api/auth/login/route.ts`, `lib/auth/keycloak.ts`, `lib/env.ts` |
| Deterministic notes | Existing `__state` is reused; no duplicate state generation on repeated login click |

### 7.2 Callback Path

| Field | Value |
| --- | --- |
| Entry point | `GET /api/auth/callback?code=...&state=...` |
| Flow | Callback -> state validation -> `exchangeCode` -> `decodeIdToken` -> `extractUser` -> `sessionStore.set` -> redirect to `/api/auth/session-init?sid=<uuid>` |
| Dependencies | `app/api/auth/callback/route.ts`, `lib/auth/keycloak.ts`, `lib/auth/session.ts`, `lib/env.ts`, `types/index.ts` |
| Deterministic notes | Failure redirects are stable and covered by tests; success depends on `session-init` bridge |

### 7.3 Protected Route Path

| Field | Value |
| --- | --- |
| Entry point | Any non-public matched route, including `/dashboard` |
| Flow | Request -> `middleware.ts` -> public-path/static check -> `__session` lookup -> `sessionStore.get` -> expiry check -> continue or redirect |
| Dependencies | `middleware.ts`, `lib/auth/session.ts`, `types/index.ts` |
| Deterministic notes | Session presence and refresh-expiry logic are deterministic; access-token refresh is absent |

### 7.4 Logout Path

| Field | Value |
| --- | --- |
| Entry point | `POST /api/auth/logout` |
| Flow | Read `__session` -> load session -> build Keycloak logout URL -> delete session -> clear cookie -> redirect |
| Dependencies | `app/api/auth/logout/route.ts`, `lib/auth/session.ts`, `lib/auth/keycloak.ts` |
| Deterministic notes | Happy path is defined; no-session fallback is not safe because the fallback URL construction is invalid |

### 7.5 Validation/Enforcement Path

| Field | Value |
| --- | --- |
| Entry point | `git push` or pull request to `main` / `dev` |
| Flow | Husky pre-push -> `npm run test:auth` -> CI drift detection -> auth tests in CI mode -> coverage artifact upload -> PR summary |
| Dependencies | `.husky/pre-push`, `package.json`, `jest.config.js`, `.github/workflows/auth-tests.yml`, `tests/auth/**` |
| Deterministic notes | This is a strong second system that governs auth change acceptance |

---

## 8. Risk Detection

### 8.1 Duplicate Logic and Duplicate Artifacts

| Risk | Evidence | Audit Meaning |
| --- | --- | --- |
| Duplicate certificate material | Root `client-portal.test*.pem` files exist alongside `certificates/client-portal.test*.pem`; only `certificates/*` are referenced by `server.js` | Local dev infra is duplicated and can drift |
| Documentation duplication | Multiple docs describe auth architecture, implementation, enforcement, loop debugging, E2E behavior, and target state | Architecture truth is spread across many documents and can diverge from code |
| Default template residue | `public/*.svg` assets and default `README.md` remain present but are not referenced by authored source | Repo contains non-system noise that weakens signal-to-noise ratio |

### 8.2 Bypass Paths and Broad Public Surface

| Risk | Evidence | Audit Meaning |
| --- | --- | --- |
| Broad middleware bypass for all auth routes | `middleware.ts` treats any path starting with `/api/auth` as public | Future auth-adjacent routes under that prefix inherit public access unless reviewed explicitly |
| Root route delegates auth decision downstream | `app/page.tsx` unconditionally redirects to `/dashboard`; middleware performs the real decision later | Auth entry behavior depends on cross-file composition rather than local route logic |
| Session-init is public by necessity | Cookie handoff route is reachable without session | Public bridge route is required for current flow and must remain tightly scoped |

### 8.3 Unused Files and Dead or Dormant Code

| Risk | Evidence | Audit Meaning |
| --- | --- | --- |
| Dormant client auth abstraction | `lib/auth/provider.tsx` and `hooks/use-auth.ts` are defined but not wired into runtime pages/layouts | Repo contains placeholder auth state model that does not participate in the real auth boundary |
| Unused config abstraction | `lib/auth/config.ts` and `lib/auth/index.ts` are not used by the runtime path | Additional indirection exists without current value |
| Unused refresh implementation | `refreshAccessToken` is implemented and tested but never called by middleware or route handlers | Token refresh is architecturally anticipated but not operationally active |
| Placeholder feature area | `features/.gitkeep` exists with no actual feature module | Reserved surface, not active system behavior |
| Stray artifacts | `structure.txt` is a repo dump and `test.txt` is a stray push artifact | Non-system files are present in the root |
| Unused local cert pair | `localhost-key.pem` and `localhost.pem` have no repo references | Likely dead infra residue |

### 8.4 Hidden Coupling

| Risk | Evidence | Audit Meaning |
| --- | --- | --- |
| Callback depends on session-init bridge | Successful callback redirects to `/api/auth/session-init?sid=...` rather than setting the session cookie directly | Login correctness depends on a non-obvious intermediate hop |
| Middleware depends on session-store semantics | `sessionStore` has no TTL logic; middleware owns expiry enforcement | Session correctness is split across layers rather than encapsulated in one place |
| Dev host configuration is split | `server.js` forces `https://client-portal.test:3000`, while `lib/env.ts` defaults `appUrl` to `http://localhost:3000` and `next.config.ts` allows `client-portal.test:3000` as dev origin | Local auth correctness depends on coordinated settings across multiple files |
| Test enforcement depends on path conventions | CI drift detection keys off `middleware.ts`, `app/api/auth/**`, `lib/auth/**`, and `tests/auth/**` | File moves or layer expansion can reduce enforcement if workflow patterns are not updated |

### 8.5 Inconsistent Naming or Contract Drift

| Risk | Evidence | Audit Meaning |
| --- | --- | --- |
| Runtime flow differs from target blueprint | Current code uses `session-init` bridge; blueprint/target state expect callback to set `__session` and move to `/dashboard` directly | Current system is not yet identical to target-state architecture |
| Cookie contract drift across repo | Code uses `sameSite="none"` for `__state`, `sameSite="lax"` for `__session`, `secure` only in production, and no explicit `maxAge` on `__session`; several docs describe stricter cookie settings | Docs cannot be treated as exact implementation truth |
| Debug-style comments remain in production path | `middleware.ts` and `server.js` contain `FIX`/`BLOCK LOCALHOST HARD` comments | Repo still carries evidence of debug-era control decisions |
| Default README is not system-accurate | `README.md` still describes the template Next.js scaffold | Onboarding documentation does not reflect the real system |

### 8.6 Functional and Operational Risks

| Risk | Evidence | Audit Meaning |
| --- | --- | --- |
| Logout fallback defect | `app/api/auth/logout/route.ts` uses `new URL("/login")` with no base; direct runtime check returns `Invalid URL` | Logout is not safe when there is no active session-backed logout URL |
| No active runtime token refresh | Middleware never calls `refreshAccessToken` | Access tokens can expire while session still exists, leaving future server-side data access incomplete |
| In-memory session store only | `lib/auth/session.ts` is a process-local `Map` | Session continuity does not survive restart or horizontal scaling |
| No structured logging in runtime | Runtime auth code contains no structured logger integration | Production observability is weak |
| No dedicated logout test | `tests/auth/` has no logout-focused test file | One critical path is less protected than the rest |

---

## 9. Architecture Evaluation

Status scale used here: `STRONG`, `PARTIAL`, `WEAK`

| Criteria | Status |
| --- | --- |
| Single source of truth | PARTIAL |
| No duplication | WEAK |
| Deterministic flow | PARTIAL |
| Clear separation | PARTIAL |
| No hidden state | WEAK |

### Evaluation Notes

| Criteria | Reasoning |
| --- | --- |
| Single source of truth | `lib/env.ts` centralizes env access and `lib/auth/keycloak.ts` centralizes IdP integration, but auth truth is duplicated across runtime code, extensive docs, and enforcement rules with visible drift between them |
| No duplication | Duplicate cert artifacts, overlapping auth docs, stale root artifacts, and dormant auth abstractions create avoidable duplication |
| Deterministic flow | The implemented login/callback/session-init/dashboard chain is deterministic and test-locked, but logout edge handling and missing refresh behavior keep the full system from being fully deterministic |
| Clear separation | UI, middleware, route handlers, Keycloak integration, and session storage are mostly separated, but `session-init` introduces bridge coupling and dormant provider abstractions muddy the runtime story |
| No hidden state | Session continuity depends on hidden cookie handoff and in-memory server process state; logout fallback and doc drift increase non-obvious behavior risk |

---

## 10. Engineering Position Snapshot

Status scale used here: `VERIFIED`, `PARTIAL`, `AT RISK`, `DORMANT`

| Area | Status | Notes |
| --- | --- | --- |
| Auth Flow | PARTIAL | Login, callback, session-init, and middleware chain exist and pass deterministic tests, but the flow still depends on the bridge route rather than direct callback session establishment |
| Middleware Gate | PARTIAL | Route protection and expiry redirect behavior are implemented and tested, but active access-token refresh is absent |
| Session Management | PARTIAL | Session data is server-side and opaque to the browser, but storage is in-memory only and cookie TTL handling is incomplete |
| Keycloak Integration | VERIFIED | Authorization URL, token exchange, token refresh helper, logout URL, and ID token decoding are implemented and tested |
| Logout Path | AT RISK | Happy path exists, but the no-session fallback redirect is invalid and there is no dedicated logout test |
| UI Shell | VERIFIED | Login page, dashboard page, and navigation shell are present and correctly separated into public and portal groups |
| Client Auth Abstraction | DORMANT | `AuthProvider` and `useAuth` exist but are not part of the actual runtime path |
| Validation System | VERIFIED | Auth test suite, snapshots, drift detection, Husky gate, and CI workflow are present and currently green |
| Dev HTTPS Infra | PARTIAL | Custom HTTPS server and cert-based local domain support exist, but host/origin config is spread across multiple files |
| Documentation Alignment | AT RISK | Documentation volume is high, but several documents describe contracts that no longer exactly match current code |

### Executable Baseline Snapshot

| Check | Result | Notes |
| --- | --- | --- |
| `npm run test:auth -- --ci` | PASS | 8/8 suites, 49/49 tests, 2/2 snapshots |
| Auth coverage baseline | PASS | Reported at 100% for configured auth-critical files |
| Static dependency scan | PASS | Runtime composition is understandable and locally bounded |
| Production readiness baseline | PARTIAL | Static scan found real operational and contract gaps |

---

## 11. Gap Indicators

This section compares the current repository reality against the expected system direction implied by the production blueprint and engineering target state.

| Gap Indicator | Current Reality | Gap Type | Audit Consequence |
| --- | --- | --- | --- |
| Session establishment path | Callback requires `session-init` bridge to set `__session` | Flow gap | Current runtime differs from direct target-state callback contract |
| Token refresh execution | Refresh helper exists but is not used by middleware or another active runtime layer | Incomplete flow | Token lifecycle is not fully implemented |
| Session backend | In-memory `Map` only | Production gap | Restarts and horizontal scaling break session durability |
| Logout fallback correctness | No-session fallback URL is invalid | Functional gap | Logout path is not fully safe in all states |
| Cookie contract fidelity | Runtime cookie flags and TTL behavior differ from target-state docs | Security/contract gap | Audit evidence must rely on code, not docs alone |
| Observability layer | No structured runtime auth logging observed | Operational gap | Incidents are harder to audit and diagnose |
| Client auth abstraction | Client-side provider/hook layer exists but is not wired | Architecture drift risk | Repo contains a second auth model that can confuse future implementation |
| Governance vs runtime symmetry | Test enforcement is stronger than some runtime production guarantees | Maturity gap | Repo is safer to change than it is to deploy |
| Documentation coherence | Multiple docs are authoritative in tone but not always current in fact | Audit gap | Document set cannot be consumed as one exact reality model |
| Root artifact hygiene | Stale root artifacts and duplicate cert files remain | Repository hygiene gap | Audit noise increases and signal degrades |

### Gap Readiness Summary

- No core auth layer is missing; all required runtime layers exist in some form.
- Several layers are incomplete rather than absent.
- The largest gaps are operational and contract-alignment gaps, not total architecture absence.
- The repository is ready for structured gap analysis against the target-state document because both the current runtime and the enforcement system are now clearly visible.

### Validation Questions

- Can this document be used for audit? Yes. It identifies live layers, entry points, dependencies, execution chains, and known risks.
- Can the system be understood without opening code? Yes. The runtime path, enforcement path, and weak points are reconstructable from this scan.
- Can gaps be identified? Yes. Flow, operational, contract, and hygiene gaps are explicit and measurable.
