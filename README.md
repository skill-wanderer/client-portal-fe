# 1. System Overview

Client Portal is a server-rendered web application for client access to projects, tasks, files, messages, and account data. It solves a specific boundary problem: expose project delivery data to authenticated client users without trusting browser-side identity, role, or data scoping decisions.

The implementation is a Next.js 16 App Router application running behind a custom local HTTPS entry server in [server.js](server.js). Authentication is handled as a backend-for-frontend flow against Keycloak. The browser receives an opaque `__session` cookie only; Keycloak tokens remain server-side. Protected API routes resolve the cookie to a server session, map the session user to a single active row in the application `users` table, enforce server-side RBAC, and then query PostgreSQL.

# 2. Architecture

High-level request flow:

1. User requests a protected page or API.
2. [proxy.ts](proxy.ts) checks for the `__session` cookie and blocks unauthenticated access before route execution.
3. If no valid session exists, the user is redirected to `/login`.
4. `/login` triggers [app/api/auth/login/route.ts](app/api/auth/login/route.ts), which creates a CSRF state cookie and redirects to Keycloak.
5. Keycloak authenticates the user and returns to [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts).
6. The callback exchanges the authorization code for tokens, decodes the `id_token`, creates a server-side session, stores it via the session store abstraction, and sets the `__session` cookie.
7. The user is redirected to `/dashboard`.
8. For subsequent protected requests, [proxy.ts](proxy.ts) validates the session and refreshes Keycloak tokens server-side when the access token expires.
9. Route handlers resolve the current portal user through [lib/auth/portal-user.ts](lib/auth/portal-user.ts), which maps `session.user.email` to exactly one active `users` row in PostgreSQL.
10. Business APIs execute only after session validation, domain mapping, and RBAC checks.

Effective path:

`User -> Keycloak -> Callback -> Session -> Proxy -> API -> DB`

# 3. Core Features

Authentication (Keycloak BFF)

- OIDC authorization code flow is executed server-side.
- Keycloak tokens are exchanged and refreshed in [lib/auth/keycloak.ts](lib/auth/keycloak.ts).
- The browser does not receive access or refresh tokens.

Session management

- The browser receives a single opaque `__session` cookie.
- Session data is stored server-side through the `SessionStore` abstraction.
- Session refresh is handled in [proxy.ts](proxy.ts) before protected route execution.

Domain mapping

- A successful Keycloak login is not sufficient for application access.
- The authenticated email must map to exactly one active row in `users`.
- Missing or ambiguous mappings are treated as server-side authorization failures.

RBAC

- Role checks are enforced on the server from the application database role, not from browser input.
- Protected business routes call `requireRole(...)` from [lib/auth/rbac.ts](lib/auth/rbac.ts).

Observability

- Request/response logging and correlation IDs are applied at the entry server, proxy, and API layers.
- Public health and readiness probes are available.

Audit logging

- Critical business actions write audit records to `audit_logs`.
- Audit persistence is intentionally non-blocking and does not fail the primary request path.

# 4. Security Model

Deny-by-default

- [proxy.ts](proxy.ts) blocks protected routes when `__session` is missing, stale, or expired.
- Only `/login`, `/api/auth/*`, `/api/health`, and `/api/ready` bypass the proxy gate.

Server-side trust only

- The browser is not trusted for identity, roles, project ownership, or scope.
- The session cookie only identifies a server-side session record.
- Tokens remain server-side.

Role enforcement

- The authoritative role is `users.role` from PostgreSQL.
- Token roles from Keycloak are not the authorization source for protected business APIs.
- Disallowed roles return `403` with `{ "error": "forbidden", "reason": "insufficient_role" }`.

Cookie contract

- Session cookie name: `__session`
- Session cookie attributes: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`
- Login CSRF cookie name: `__state`
- CSRF cookie attributes: `HttpOnly`, `SameSite=Lax`, short-lived

TLS behavior

- The custom HTTPS server refuses to start if `NODE_TLS_REJECT_UNAUTHORIZED=0` is set.
- Local HTTPS is expected to use trusted certificates under [certs/cert.pem](certs/cert.pem) and [certs/key.pem](certs/key.pem).

# 5. Tech Stack

- Next.js 16.2.4 App Router
- Node.js with a custom Express HTTPS entry server
- PostgreSQL 15 in Docker
- `pg` for database access
- Keycloak for OIDC identity
- mkcert for trusted local HTTPS certificates
- Jest + ts-jest for test coverage on the auth and hardening layers

# 6. Local Development Setup

This repository is currently wired for Windows/PowerShell local development.

1. Install Node.js and npm.
2. Install Docker Desktop.
3. Install mkcert and trust a local root CA.
4. Add a hosts entry for `client-portal.test`.
5. Install project dependencies.
6. Start PostgreSQL.
7. Apply the schema.
8. Create `.env.local`.
9. Start the HTTPS dev server.

Step-by-step:

1. Install dependencies.

```powershell
npm install
```

2. Start PostgreSQL from the repository root.

```powershell
docker compose up -d postgres
```

3. Apply the schema using the PowerShell-safe command verified in this repository.

```powershell
Get-Content -Raw .\db\schema.sql | docker exec -i client-portal-db psql -U postgres -d client_portal
```

4. Add this hosts entry with administrator privileges.

```text
127.0.0.1 client-portal.test
```

5. Install and trust mkcert if not already installed.

```powershell
mkcert -install
```

6. Ensure the local HTTPS certificate files exist at [certs/cert.pem](certs/cert.pem) and [certs/key.pem](certs/key.pem). If they do not exist, generate them.

```powershell
mkcert -cert-file certs/cert.pem -key-file certs/key.pem client-portal.test localhost 127.0.0.1 ::1
```

7. Create `.env.local` with the values described in the Environment Variables section.

8. Start the HTTPS entry server.

```powershell
npm run dev:https
```

9. Open the application at `https://client-portal.test:3000`.

Operational notes:

- `npm run dev:https` injects `NODE_EXTRA_CA_CERTS=%LOCALAPPDATA%\mkcert\rootCA.pem` before starting [server.js](server.js).
- Requests sent to `localhost:3000` are redirected to `https://client-portal.test:3000` by the custom entry server.
- The application expects PostgreSQL on `localhost:5433` if you use the provided Docker Compose file.

# 7. Environment Variables

The current implementation requires or consumes the following values.

Required at runtime:

- `DATABASE_URL`
	- Used by [lib/db.ts](lib/db.ts)
	- Example: `postgresql://postgres:postgres@localhost:5433/client_portal`

- `NEXT_PUBLIC_APP_URL`
	- Used by [lib/env.ts](lib/env.ts)
	- Must match the externally reachable application URL and the Keycloak redirect URI
	- Local value: `https://client-portal.test:3000`

- `KEYCLOAK_URL`
	- Base URL for Keycloak
	- Example: `https://sso.skill-wanderer.com`

- `KEYCLOAK_REALM`
	- Keycloak realm name
	- Current local/default realm: `client-portal`

- `KEYCLOAK_CLIENT_ID`
	- OIDC client ID
	- Current local/default client ID: `client-portal-fe`

- `KEYCLOAK_CLIENT_SECRET`
	- Used by the token exchange and refresh flow
	- Required in production
	- Read by [lib/auth/keycloak.ts](lib/auth/keycloak.ts)

Optional or framework-level values:

- `NODE_ENV`
	- Standard runtime mode switch
	- Influences whether `KEYCLOAK_CLIENT_SECRET` is treated as required

Minimal `.env.local` example:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/client_portal
NEXT_PUBLIC_APP_URL=https://client-portal.test:3000
KEYCLOAK_URL=https://sso.skill-wanderer.com
KEYCLOAK_REALM=client-portal
KEYCLOAK_CLIENT_ID=client-portal-fe
KEYCLOAK_CLIENT_SECRET=replace-me
```

# 8. Auth Flow

The implemented login flow is:

1. User opens `/login`.
2. `/login` links into `/api/auth/login`.
3. [app/api/auth/login/route.ts](app/api/auth/login/route.ts) generates a random CSRF state value and stores it in `__state`.
4. The route redirects the browser to the Keycloak authorization endpoint.
5. Keycloak authenticates the user and redirects to `/api/auth/callback?code=...&state=...`.
6. [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts) validates the returned state against `__state`.
7. The callback exchanges the authorization code for Keycloak tokens.
8. The callback decodes the `id_token`, extracts the user identity payload, creates a server-side session, and stores it via the session store abstraction.
9. The callback sets the `__session` cookie and redirects directly to `/dashboard`.
10. On future requests, [proxy.ts](proxy.ts) validates or refreshes the session before the request reaches protected routes.

Legacy bootstrap support:

- [app/api/auth/session-init/route.ts](app/api/auth/session-init/route.ts) still supports server session bootstrap from `?sid=...` for compatibility.

# 9. API Contract

Protected API behavior:

- Business APIs require a valid `__session` cookie.
- Protected routes do not trust request body fields, query parameters, or browser role claims for authorization.
- Role enforcement is server-side and database-backed.

Public exceptions:

- `/api/auth/login`
- `/api/auth/callback`
- `/api/auth/logout`
- `/api/auth/session-init`
- `/api/health`
- `/api/ready`

Protected business endpoints currently include:

- `/api/account`
- `/api/dashboard`
- `/api/projects`
- `/api/projects/[projectId]`
- `/api/projects/[projectId]/files`
- `/api/projects/[projectId]/messages`
- `/api/tasks/[taskId]/complete`
- `/api/admin/rbac-check`

Authorization rules:

- Missing session returns `401` or a redirect at the proxy boundary depending on request type/path.
- Missing or stale sessions are removed and redirected to `/login` by [proxy.ts](proxy.ts).
- Domain mapping failures are handled server-side after session resolution.
- RBAC failures return deterministic `403` responses.

# 10. Observability

Logging

- Entry server logging is implemented in [server.js](server.js) via [lib/observability/runtime.js](lib/observability/runtime.js).
- Proxy logging is implemented in [proxy.ts](proxy.ts).
- Route-level request/response/error logging is implemented through [lib/observability/with-observability.ts](lib/observability/with-observability.ts).

Correlation ID

- Correlation IDs are generated or propagated through the `x-correlation-id` header.
- The correlation ID is attached at the entry, proxy, and API layers.

Health endpoint

- `GET /api/health`
- Public
- Returns liveness data with `status`, `timestamp`, and `service`

Readiness endpoint

- `GET /api/ready`
- Public
- Executes `SELECT 1` against PostgreSQL
- Returns `200` with `{ "status": "ready" }` when the DB is reachable
- Returns `503` with `{ "status": "not_ready" }` when the DB check fails

# 11. Audit Logging

Audit logging is implemented in [lib/audit/audit.ts](lib/audit/audit.ts).

Current audited actions:

- `task.complete`
- `message.send`
- `file.access`
- `project.access`

Each audit event records:

- `user_id`
- `action`
- `resource`
- `metadata`
- `created_at`

Storage:

- Audit records are stored in the `audit_logs` table defined in [db/schema.sql](db/schema.sql).

Non-blocking behavior:

- `logAudit(...)` schedules the insert asynchronously.
- Route handlers do not await audit persistence.
- If the audit insert fails, the primary API response still succeeds and the failure is written to the structured logger as `audit_log_failed`.

# 12. Session System

Session storage is abstracted behind the `SessionStore` interface in [lib/auth/session-store.ts](lib/auth/session-store.ts).

Current backend:

- [lib/auth/session-file-store.ts](lib/auth/session-file-store.ts)
- Stores session state in a JSON file under the OS temp directory
- Current path pattern: `%TEMP%\client-portal-fe\sessions.json` on Windows

Factory:

- [lib/auth/session-factory.ts](lib/auth/session-factory.ts)
- The current factory returns a singleton `FileSessionStore`

Compatibility shim:

- [lib/auth/session.ts](lib/auth/session.ts) still exports `sessionStore` for compatibility, but runtime consumers use `createSessionStore()`

Future backend:

- [lib/auth/session-redis-store.ts](lib/auth/session-redis-store.ts) exists as an explicit placeholder for a Redis-backed implementation

# 13. Testing

Current validation commands:

```powershell
npm run test:auth
npx jest tests/audit/audit.test.ts --runInBand --coverage=false
npm run build
```

Auth tests

- The repository includes a focused auth suite under [tests/auth](tests/auth).
- The auth suite covers login, callback, session-init, logout, middleware/proxy behavior, and RBAC behavior.

RBAC tests

- RBAC behavior is validated in [tests/auth/rbac.test.ts](tests/auth/rbac.test.ts).
- Tests cover allowed role access, denied role access, missing role rejection, and the admin-only example route.

Audit tests

- Audit behavior is validated in [tests/audit/audit.test.ts](tests/audit/audit.test.ts).
- Tests cover insert structure, audited route integration, and the requirement that audit failure must not fail the main API response.

Coverage note:

- `npm run test:auth` is configured with coverage for the auth-critical slice, not as repository-wide coverage enforcement.

# 14. Known Limitations

- Session storage is file-based and therefore single-node by design today.
- The file-backed session store is not safe for horizontally scaled multi-instance production deployment.
- The Redis session backend is a stub only and is not yet implemented.
- Local development and TLS setup are currently Windows/PowerShell oriented.
- The repository contains application hardening work, but no production deployment manifests, secret management, load balancing, or managed infrastructure definitions.
- Observability is application-level structured logging only; no metrics pipeline, trace backend, Grafana, or Sentry integration exists yet.

# 15. Phase Status

Repository implementation status:

- Phase 1: complete
- Phase 2: complete
- Phase 3: complete

Interpretation of Phase 3 status:

- The application-layer hardening work implemented in this repository is complete for the current scope: observability, TLS hardening, server-side RBAC, session abstraction, and audit logging.
- This does not mean production infrastructure is already deployed.

# 16. Future Roadmap

- Replace the file session backend with a real Redis-backed `SessionStore` implementation.
- Add deployment infrastructure and environment-specific release automation.
- Add production monitoring integrations such as Grafana dashboards, metrics export, and Sentry error capture.
- Add first-class multi-tenant isolation if the portal evolves beyond the current client-to-project ownership model.
