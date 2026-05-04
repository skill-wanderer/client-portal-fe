# 1. System Overview (As-Is)

This report maps the current repository state at the start of Phase 3 using only direct code evidence.

Observed runtime entry path:

```text
Browser
  -> server.js
     - starts Express over HTTPS
     - forces localhost requests to https://client-portal.test:3000
     - sets NODE_TLS_REJECT_UNAUTHORIZED=0 when undefined in dev flow
  -> proxy.ts
     - bypasses /login and /api/auth
     - requires __session for protected routes
     - refreshes access token when access token is expired and refresh token is still valid
  -> app/api/auth/*
     - login creates __state and redirects to Keycloak
     - callback validates state, exchanges code, creates session, sets __session
     - logout deletes __session and server-side session
     - session-init can set __session from sid query parameter when a backing session exists
  -> lib/auth/session.ts
     - stores sessions in a JSON file under the OS temp directory
  -> lib/auth/portal-user.ts
     - maps session.user.email to one active row in users
  -> app/api/* portal routes
     - call getCurrentPortalAuthContext()
     - scope data by client ownership in SQL
  -> PostgreSQL via lib/db.ts

Server-rendered portal data path:

```text
app/(portal)/dashboard/page.tsx
  -> derives origin from request headers
  -> fetches https://<origin>/api/dashboard with forwarded cookies

app/(portal)/projects/[projectId]/page.tsx
  -> derives origin from request headers
  -> fetches https://<origin>/api/projects/[projectId]
  -> fetches https://<origin>/api/projects/[projectId]/files
```

Auth and transport facts:

- `package.json:10` defines `dev:https` as `node server.js`.
- `package.json:17` pins Next.js to `16.2.4`.
- `next.config.ts:5` allows the development origin `client-portal.test`.
- `server.js:10-11` disables TLS verification in the `dev:https` execution path when the env var is not already set.

Observed control model:

- Authentication is centralized in the BFF routes and `proxy.ts`.
- Authorization is implicit in route-local SQL filters and ownership checks, not in a centralized permission system.
- Sessions are persistent across process restarts on the same machine because they are file-backed, but they are still machine-local and single-store.
- Observability is effectively absent beyond one startup `console.log` in `server.js:42`.

# 2. Layer-by-Layer Mapping

| Layer | File(s) | Responsibility | Current Behavior | Risk |
| ----- | ------- | -------------- | ---------------- | ---- |
| Entry Layer | `server.js:1-42`, `package.json:10`, `next.config.ts:5` | HTTPS entry server, localhost canonicalization, bootstrapping Next | Starts Express behind `https.createServer`, redirects `localhost` to `client-portal.test`, and sets `NODE_TLS_REJECT_UNAUTHORIZED=0` in dev flow | Transport trust is bypassed in the local HTTPS run path; no request logging, correlation ID, or edge-level error capture exists |
| Auth Gate | `proxy.ts:6-69` | Public-path bypass, session gate, refresh flow | Allows `/login` and `/api/auth`, redirects missing session to `/login`, deletes stale `__session`, refreshes expired access tokens with Keycloak, redirects expired refresh state to `/login?error=session_expired` | No correlation ID, no structured logging, no RBAC policy check, and no explicit classification of refresh failures beyond redirect behavior |
| Auth System | `app/api/auth/login/route.ts:1-28`, `app/api/auth/callback/route.ts:1-79`, `app/api/auth/logout/route.ts:1-31`, `app/api/auth/session-init/route.ts:1-29`, `lib/auth/keycloak.ts:1-94`, `lib/auth/config.ts:1-27` | Login redirect, callback exchange, session creation, logout, session resume, Keycloak calls, cookie options | Login creates `__state` with `SameSite=Lax`; callback validates state, exchanges code, decodes `id_token`, creates UUID session, sets `__session`; logout deletes session and redirects; session-init sets `__session` from `sid` query parameter if session exists | No auth-event logging, no correlation propagation, no audit trail, no centralized outbound TLS handling, and `session-init` remains an alternate cookie bootstrap surface |
| Session System | `lib/auth/session.ts:1-68` | Session persistence and lookup | Reads and writes the full session map from `%TEMP%/client-portal-fe/sessions.json`, uses atomic rename on write, exposes `get`, `set`, and `delete` only | Whole-store JSON read/write on every mutation, no TTL inside store, no driver selection, no production-safe distributed backend |
| Domain Mapping | `lib/auth/portal-user.ts:1-90` | Convert session user email into active portal user | Reads `__session`, loads session, extracts `session.user.email`, selects one active user by email, throws on missing email, zero match, or multiple matches | Failure mapping is duplicated across route handlers; role is returned but not used by a centralized authorization layer |
| API Layer | `app/api/account/route.ts:1-140`, `app/api/dashboard/route.ts:1-137`, `app/api/projects/route.ts:1-63`, `app/api/projects/[projectId]/route.ts:1-140`, `app/api/projects/[projectId]/files/route.ts:1-92`, `app/api/projects/[projectId]/messages/route.ts:1-203`, `app/api/tasks/[taskId]/complete/route.ts:1-82` | Protected data access and mutation | Every route calls `getCurrentPortalAuthContext()`, translates portal-user mapping errors locally, returns `401` when auth context is null, and scopes data by SQL joins or `client_id` filters | Authorization is implicit and repeated per route; no explicit permission catalog, no route wrapper, no audit logging, no structured error logging |
| Database Layer | `db/schema.sql:1-54`, `lib/db.ts:1-28` | User and project data model, DB connection pooling | Defines `users`, `projects`, `tasks`, `messages`, and `files`; `users.role` allows only `client` and `admin`; `lib/db.ts` uses one `pg.Pool` from `DATABASE_URL` | No `audit_logs` table, no transaction helper for mutation plus audit, and role model exists without a DB-backed permission structure |
| UI Data Flow | `app/(portal)/dashboard/page.tsx:63-85`, `app/(portal)/projects/[projectId]/page.tsx:57-90`, `app/(portal)/layout.tsx:1-13`, `components/navigation.tsx:1-19` | Server-rendered protected UI and API composition | Portal pages derive origin from request headers and self-fetch their own API routes over HTTPS with forwarded cookies; redirects to `/login` on `401` | Page rendering depends on loopback HTTPS trust and API availability; data logic is duplicated between page fetch path and API path |
| Test Coverage | `tests/auth/*.test.ts`, `tests/testServer.ts:1-76`, `jest.config.js:12-17` | Auth behavior verification | Tests cover login cookies, callback flow, logout redirect, keycloak token functions, session-init redirect behavior, redirect loops, and proxy refresh behavior | No tests for logging, correlation ID, readiness, RBAC, audit logging, portal API routes, or session adapter selection; Jest coverage target still references nonexistent `middleware.ts` instead of `proxy.ts` |

# 3. Gap Detection (VS Phase 3 Blueprint)

| Gap | Current State | Expected | Severity |
| --- | ------------- | -------- | -------- |
| Request observability | Only startup logging exists in `server.js:42`; no request or response logs were found in `server.js`, `proxy.ts`, or `app/api/*` | Structured request start and completion logs across entry, proxy, and route layers | Critical |
| Error observability | Route handlers return JSON errors or redirects, but no unified logger exists in `app/api/*`, `proxy.ts`, or `lib/auth/*` | Structured error logging with redaction and correlation ID | Critical |
| Correlation ID | No `x-correlation-id` handling was found in the repository | Correlation ID created at ingress and propagated through responses, logs, and audit | Critical |
| Health and readiness | No `/api/health` or `/api/ready` route exists in `app/api/*` | Deterministic liveness and readiness endpoints | High |
| TLS hardening | `server.js:10-11` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` in the HTTPS dev path | No TLS bypass anywhere; trust failures fail closed | Critical |
| Outbound TLS control | `lib/auth/keycloak.ts:36-69` uses plain `fetch` with no centralized trust handling or error classification | Centralized strict TLS behavior for Keycloak and other outbound HTTPS calls | High |
| Loopback HTTPS dependency | `app/(portal)/dashboard/page.tsx:76-81` and `app/(portal)/projects/[projectId]/page.tsx:74-87` fetch the app's own API over request-derived HTTPS origin | Shared internal service layer without app-to-self HTTPS dependency | High |
| Explicit RBAC | `users.role` exists in `db/schema.sql:5`, but route handlers do not evaluate role permissions | Centralized permission catalog and route policy with deny-by-default behavior | Critical |
| Authorization wrapper | Portal routes repeat auth-context and mapping error handling locally, e.g. `app/api/account/route.ts:18-44`, `app/api/dashboard/route.ts:37-64` | Standard route wrapper for auth, logging, correlation, and policy enforcement | High |
| Session scalability | `lib/auth/session.ts:17-68` stores sessions in one local JSON file in temp storage | Session abstraction with environment-selected backend and production-safe distributed option | Critical |
| Session startup guard | No environment-driven session driver selection or production guard exists in `lib/auth/session.ts`, `server.js`, or `lib/env.ts` | Production startup must fail when configured with non-scalable session backend | High |
| Audit logging | `db/schema.sql` has no `audit_logs` table; no audit writer exists under `lib/*` | Durable audit records for auth lifecycle, denies, and mutations | Critical |
| Mutation transaction support | Current mutations call `query()` directly from route files, e.g. `app/api/account/route.ts:105`, `app/api/projects/[projectId]/messages/route.ts:169`, `app/api/tasks/[taskId]/complete/route.ts:54` | Transactional mutation plus audit insert | High |
| Phase 3 test coverage | `tests/*` contains auth-focused tests only; `jest.config.js:13` still collects coverage from nonexistent `middleware.ts` | Coverage for RBAC, observability, readiness, session abstraction, and audit behavior | High |

# 4. Insertion Points (CRITICAL)

| Component | File | Injection Point | Reason |
| --------- | ---- | --------------- | ------ |
| Logging layer | `server.js` | Before the first `server.use(...)` middleware and around the final `server.use((req, res) => handle(req, res))` block | This is the earliest common request edge and the only place that sees all browser traffic before redirect or Next handling |
| Logging layer | `proxy.ts` | At the start of `proxy(request)` and inside each redirect or refresh branch | This is the protected-route gate and auth refresh control point |
| Logging layer | `app/api/auth/*` and portal `app/api/*` routes | Wrap each exported `GET` and `POST` handler at the route boundary | This is the narrowest common location for per-route status, duration, and failure logging |
| Correlation ID | `server.js` | Generate or accept request correlation before localhost redirect middleware | Correlation must exist before any redirect or downstream branching occurs |
| Correlation ID | `proxy.ts` | Read inbound correlation ID and attach it to redirect or success responses | Protected-route redirects currently lose trace context |
| Correlation ID | `app/api/*` routes | Read from request headers and echo in `NextResponse` | API responses need correlation propagation for user-visible failures and audit correlation |
| RBAC enforcement | `lib/auth/portal-user.ts` | After portal user resolution returns role and actor identity | This is the first canonical place where role and actor data are available |
| RBAC enforcement | `app/api/account/route.ts`, `app/api/dashboard/route.ts`, `app/api/projects/route.ts`, `app/api/projects/[projectId]/route.ts`, `app/api/projects/[projectId]/files/route.ts`, `app/api/projects/[projectId]/messages/route.ts`, `app/api/tasks/[taskId]/complete/route.ts` | Immediately after successful auth-context resolution and before the first domain query or mutation query | This is the first route-local point where permission can be evaluated before DB work begins |
| Audit writer | `app/api/auth/callback/route.ts` | After successful session creation and in auth failure branches | Auth lifecycle events originate here |
| Audit writer | `app/api/auth/logout/route.ts` | After session lookup and before redirect response | Logout is a security-relevant lifecycle event |
| Audit writer | `app/api/account/route.ts` | After successful update query or inside a transaction wrapper around it | Account mutation currently has no persistent trail |
| Audit writer | `app/api/projects/[projectId]/messages/route.ts` | Around the insert at `insertResult = await query(...)` | Message creation is the current content mutation path |
| Audit writer | `app/api/tasks/[taskId]/complete/route.ts` | Around the update query that marks tasks as done | Task completion is the current workflow mutation path |
| Session abstraction | `lib/auth/session.ts` | Replace direct file implementation behind the exported `sessionStore` symbol | All auth, proxy, and portal-user code already depends on this one module |
| Session abstraction | `lib/env.ts` | Add backend selection and production guard input here | Environment access is already centralized here |
| Session abstraction | `server.js` or startup bootstrap path | Add production startup validation before request serving begins | Invalid session backend selection should fail before traffic is accepted |
| Route wrapper | `app/api/*` routes | Replace repeated try/catch mapping blocks after `getCurrentPortalAuthContext()` | The same mapping logic repeats across routes and is the cleanest insertion point for observability and policy hooks |
| Internal service layer | `app/(portal)/dashboard/page.tsx`, `app/(portal)/projects/[projectId]/page.tsx` | Replace `fetch(${origin}/api/...)` calls with shared server-side service functions | These are the current loopback HTTPS coupling points |

# 5. Risk & Blast Radius Mapping

| System | What Breaks If Modified | Dependency Chain |
| --- | --- | --- |
| `server.js` entry layer | HTTPS startup, localhost canonicalization, and all browser request ingress | `package.json dev:https` -> `server.js` -> Express middleware -> Next handler |
| `proxy.ts` auth gate | All protected-route access, refresh behavior, and session-expiry redirects | Browser request -> `proxy.ts` -> `sessionStore` -> `refreshAccessToken` -> protected page/API |
| Auth callback flow | New sessions cannot be created; login completion breaks | Keycloak redirect -> `app/api/auth/callback/route.ts` -> `exchangeCode` -> `sessionStore.set` -> `__session` cookie |
| Session store | All authenticated traffic loses continuity if lookup or write semantics change incorrectly | `app/api/auth/callback` / `logout` / `session-init` / `proxy.ts` / `lib/auth/portal-user.ts` -> `lib/auth/session.ts` |
| Portal-user mapping | All portal APIs can shift from `401`/`403`/`500` behavior or map wrong users if lookup changes | Cookie -> session lookup -> email extraction -> DB `users` lookup -> route handler |
| Portal API routes | Dashboard, project detail, files, messages, task completion, and account flows can change behavior immediately | Protected page or client action -> portal API route -> `getCurrentPortalAuthContext()` -> SQL query/mutation |
| DB schema | Role semantics, ownership joins, and future audit insertion depend on table integrity | `lib/db.ts` pool -> `db/schema.sql` tables -> portal API queries and mutations |
| Portal server pages | Dashboard and project rendering currently depend on API availability and HTTPS loopback trust | Page request -> request-derived origin -> HTTPS self-fetch -> same app API route -> DB |
| Test configuration | Regressions can slip through if changes land outside the currently targeted auth coverage surface | `npm test` / `npm run test:auth` -> Jest config -> auth-only tests |

Blast radius notes by dependency:

- Changing `server.js` affects both transport and observability because it is the earliest shared request surface.
- Changing `proxy.ts` affects every protected route, not just one page, because all protected routes pass through it.
- Changing `lib/auth/session.ts` affects login, logout, proxy validation, portal-user mapping, and the legacy `session-init` path at once.
- Changing `lib/auth/portal-user.ts` affects every portal API because each route depends on it before DB work begins.
- Changing page-level data flow in `app/(portal)` affects user-visible rendering and can remove the current HTTPS loopback dependency if done correctly.

# 6. Deterministic Findings (NO OPINION)

```text
FACT: The HTTPS development entry path disables TLS verification for outbound Node HTTPS calls.
EVIDENCE: server.js:10-11 sets NODE_TLS_REJECT_UNAUTHORIZED to 0 when undefined.
IMPACT: Under npm run dev:https, the Node process can accept untrusted TLS certificates instead of failing closed.
```

```text
FACT: The entry server rewrites localhost traffic to client-portal.test before Next handles the request.
EVIDENCE: server.js:29 redirects any host containing localhost to https://client-portal.test:3000${req.url}.
IMPACT: Local browser access depends on the custom hostname path, not raw localhost.
```

```text
FACT: The auth gate bypasses only /login and /api/auth and treats other matched paths as protected.
EVIDENCE: proxy.ts:6 defines PUBLIC_PATHS as ["/login", "/api/auth"], and proxy.ts:11 checks startsWith against those paths.
IMPACT: All other matched routes depend on __session lookup before they can proceed.
```

```text
FACT: Access-token refresh happens inside proxy.ts, not inside the session store.
EVIDENCE: proxy.ts:30 checks refreshExpiresAt, proxy.ts:41 calls refreshAccessToken(session.refreshToken), and proxy.ts:43-49 writes refreshed tokens back to sessionStore.
IMPACT: Session validity policy is enforced in the gate layer, so any session-backend change must preserve proxy.ts semantics.
```

```text
FACT: The login route sets the CSRF state cookie with SameSite=Lax.
EVIDENCE: app/api/auth/login/route.ts:19-22 sets __state with sameSite: "lax".
IMPACT: Cross-site redirect return from Keycloak can validate state while keeping the cookie httpOnly.
```

```text
FACT: The callback route creates server-side sessions using a generated UUID and stores tokens in the session store.
EVIDENCE: app/api/auth/callback/route.ts:57 generates randomUUID(), app/api/auth/callback/route.ts:59 calls sessionStore.set(sessionId, { accessToken, refreshToken, idToken, ... }).
IMPACT: Browser state stays opaque, but session backend changes affect login completion immediately.
```

```text
FACT: A legacy auth route can set __session from a sid query parameter when the session already exists server-side.
EVIDENCE: app/api/auth/session-init/route.ts:8 reads req.nextUrl.searchParams.get("sid"), and app/api/auth/session-init/route.ts:22-25 sets __session from that sid.
IMPACT: There is a second cookie-bootstrap surface besides callback success.
```

```text
FACT: Sessions are persisted as a single JSON file in the OS temp directory.
EVIDENCE: lib/auth/session.ts:19-21 builds the path from tmpdir() and sessions.json, and lib/auth/session.ts:24-66 reads and rewrites the whole store.
IMPACT: Session persistence is local to one machine and one storage file, not a distributed backend.
```

```text
FACT: Portal user mapping depends on session.user.email matching exactly one active users row.
EVIDENCE: lib/auth/portal-user.ts:48 reads session.user.email, lib/auth/portal-user.ts:66-67 queries users WHERE email = $1 AND status = 'active', and lib/auth/portal-user.ts:75-79 throws on zero or multiple matches.
IMPACT: Sign-in alone is insufficient for portal access; DB provisioning remains mandatory.
```

```text
FACT: Portal API routes duplicate the same portal-user error translation logic.
EVIDENCE: app/api/account/route.ts:23-36 and 59-72, app/api/dashboard/route.ts:43-56, app/api/projects/route.ts:22-35, app/api/projects/[projectId]/route.ts:43-56, and comparable blocks in messages, files, and task routes all translate the same three error names.
IMPACT: Observability, RBAC, and error standardization do not currently have one shared injection point at the route layer.
```

```text
FACT: Current authorization is implemented by route-local ownership filters, not by explicit role or permission evaluation.
EVIDENCE: app/api/projects/route.ts:48 queries projects WHERE client_id = $1; app/api/projects/[projectId]/route.ts:71 queries by id and client_id; app/api/tasks/[taskId]/complete/route.ts:54 updates tasks only when project and assigned user match the portal user.
IMPACT: Data scoping exists, but there is no centralized RBAC policy map or deny-by-default permission layer.
```

```text
FACT: The database schema has role support but no audit structure.
EVIDENCE: db/schema.sql:5 constrains users.role to ('client', 'admin'); no CREATE TABLE for audit_logs exists in db/schema.sql:1-54.
IMPACT: The system has role data available for policy enforcement but no durable audit trail for security or mutation events.
```

```text
FACT: Portal pages fetch their own API routes over request-derived HTTPS origin.
EVIDENCE: app/(portal)/dashboard/page.tsx:63-81 builds an origin and fetches ${origin}/api/dashboard; app/(portal)/projects/[projectId]/page.tsx:57-87 builds an origin and fetches its own project APIs.
IMPACT: Page rendering depends on app-to-self HTTPS trust and API availability instead of direct in-process service calls.
```

```text
FACT: Current automated coverage is concentrated on auth behavior and does not target Phase 3 control surfaces.
EVIDENCE: tests/ contains only tests/auth/*.test.ts plus tests/testServer.ts, and jest.config.js:12-17 collects coverage from auth files plus nonexistent middleware.ts.
IMPACT: RBAC, observability, readiness, session abstraction, audit behavior, and portal API authorization currently lack automated coverage evidence.
```

# 7. Phase 3 Readiness Score

Scoring method used in this report:

- 100% means the Phase 3-required control is fully present in code.
- 50% means a direct prerequisite exists but the required control layer is incomplete.
- 0% means no code-backed implementation evidence was found for the required control.

| Area | Score |
| ------------- | ----- |
| Observability | 0% |
| Security | 20% |
| RBAC | 20% |
| Session | 40% |
| Audit | 0% |

Score basis:

- Observability = 0% because no request logging, error logging, correlation ID, health endpoint, or readiness endpoint was found.
- Security = 20% because secure auth cookies and protected-route gating exist, but strict TLS hardening, centralized trust handling, and loopback decoupling are not present.
- RBAC = 20% because a role column and ownership scoping exist, but explicit permissions, route policy, centralized authorization, and negative coverage do not.
- Session = 40% because a session abstraction interface, persisted storage, and expiry/refresh enforcement exist, but backend selection, production-safe scalability, and startup guards do not.
- Audit = 0% because no audit schema, audit writer, or transactional audit coupling was found.

🎯 Phase 3 Readiness: 16%

Readiness interpretation:

- Functional baseline is present.
- Production-hardening control baseline is mostly absent.
- The highest-confidence insertion points are already visible in `server.js`, `proxy.ts`, `lib/auth/session.ts`, `lib/auth/portal-user.ts`, portal route handlers, and the current page-level self-fetch seams.