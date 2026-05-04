# 1. Executive Summary

Phase 3 turns the current locally working client portal into a production-hardened system. The product behavior is already in place: authentication works through Keycloak, the portal renders real data, domain mapping is enforced against PostgreSQL, and protected routes are gated. What is missing is the production control plane around that behavior.

Phase 3 exists because a functional system is not automatically a safe, supportable, or scalable system. The current implementation has no structured observability, no correlation identifier, no persistent audit trail, no formal RBAC enforcement layer, no scalable session topology, and an explicit TLS bypass in the HTTPS entry server. Those gaps make incidents hard to detect, security boundaries hard to prove, and future production rollout unsafe.

Phase 3 mitigates five concrete risks:

- Silent failures that cannot be traced to a single request or user action.
- Authorization drift where route ownership checks exist but no formal permission model exists.
- Insecure transport behavior caused by `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Session inconsistency when the application moves beyond a single local instance.
- No forensic record of who changed what, when, and under which request.

# 2. Current System Baseline

The current system architecture is correct at the functional level and incomplete at the operational level.

```text
Browser
  -> server.js
     - Express HTTPS entry server
     - currently sets NODE_TLS_REJECT_UNAUTHORIZED=0 in dev flow
  -> proxy.ts
     - public-path bypass
     - protected-route session gate
     - token refresh logic
  -> app/api/auth/*
     - login, callback, logout, session-init
  -> app/api/*
     - account, dashboard, projects, files, messages, tasks
  -> lib/auth/session.ts
     - file-backed session store in OS temp directory
  -> lib/auth/portal-user.ts
     - maps session email to active DB user
  -> lib/db.ts
  -> PostgreSQL on Docker host port 5433

Auth side path:
app/api/auth/* -> lib/auth/keycloak.ts -> Keycloak

Server-rendered page path today:
app/(portal)/dashboard/page.tsx -> HTTPS self-fetch -> /api/dashboard
app/(portal)/projects/[projectId]/page.tsx -> HTTPS self-fetch -> /api/projects/*
```

What is already correct:

| Area | Current State | Why It Is Correct |
| --- | --- | --- |
| Authentication model | Keycloak BFF with server-side code exchange | Tokens stay server-side; browser receives only opaque cookie state |
| Session boundary | `__session` cookie maps to server-side session data | Browser does not hold access or refresh tokens |
| Protected-route enforcement | `proxy.ts` blocks missing or expired sessions | Unauthorized users are redirected before protected content is served |
| Domain mapping | `lib/auth/portal-user.ts` requires an active DB user match | Sign-in alone does not grant portal data access |
| Data ownership | Portal APIs join back to project and user ownership | Client users cannot read arbitrary project data by default |
| Local functional coverage | Existing auth test suite and local portal flows pass | Phase 1 and Phase 2 are functionally complete |

What is missing:

| Gap | Current Evidence | Operational Risk |
| --- | --- | --- |
| Request logging | No structured logging layer | Incidents cannot be traced deterministically |
| Error visibility | Route handlers return errors without unified error logger | Failures are hard to classify or alert on |
| Correlation ID | No request-scoped trace identifier | Multi-step failures cannot be stitched together |
| Monitoring input | No health or readiness endpoint | External monitoring has nothing deterministic to probe |
| TLS hardening | `server.js` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` in dev flow | Trust is bypassed instead of validated |
| RBAC | Role exists in `users.role`, but policy is not centralized | Authorization behavior is implicit and can drift |
| Audit trail | No audit table and no audit writer | Security-relevant actions leave no durable record |
| Session scalability | `lib/auth/session.ts` is a file-backed local store | Multi-instance or restart behavior is not production-safe |

# 3. Phase 3 Engineering Objectives

Phase 3 is complete only when the following measurable objectives are met.

| Objective Area | Measurement Rule | Required Target |
| --- | --- | --- |
| Observability | Every inbound HTTP request emits one start log and one completion log with `correlationId`, method, path, status, and duration | 100% coverage for `server.js`, `proxy.ts`, and all `app/api/*` routes |
| Error visibility | Every handled and unhandled server error emits one structured error log with redacted metadata | 0 secret-bearing error logs; 100% of 5xx responses include a correlation identifier |
| Security hardening | No code path disables TLS verification; certificate or hostname errors fail closed | 0 occurrences of `NODE_TLS_REJECT_UNAUTHORIZED=0`; no bypass flag permitted outside test-only harnesses |
| Scalability readiness | Session store is selected by abstraction, not direct file implementation | File driver allowed only for local development; production startup fails if non-scalable driver is selected |
| Access control maturity | Every protected route declares a permission and a resource scope rule | 100% protected-route coverage with negative tests for unauthorized access |
| Auditability | Every auth lifecycle event and every portal mutation writes a durable audit event or a deterministic degraded-path error log | 100% coverage for login success/failure, logout, account update, message create, task complete, and RBAC deny |

# 4. Phase 3 Scope Definition

## IN SCOPE

- Structured request logging to standard output in JSON format.
- Structured error logging with redaction of cookies, tokens, secrets, and raw authorization headers.
- Correlation ID generation, propagation, and response echoing.
- Health and readiness endpoints that expose monitorable state without exposing secrets.
- TLS hardening that removes all bypass behavior and fails closed on trust errors.
- A centralized RBAC layer based on the existing `users.role` column.
- Session store abstraction with a file adapter for local development and a Redis adapter for production readiness.
- Audit logging for security-relevant and state-mutating actions.
- Refactoring server-rendered pages away from HTTPS self-fetch to internal service modules so internal page rendering does not depend on loopback TLS.

## OUT OF SCOPE

- Deployment infrastructure such as Vercel, Kubernetes, load balancers, or managed Redis provisioning.
- New product features, new client workflows, or new portal modules.
- UI redesign or visual restyling.
- Full metrics backends, dashboards, or alert managers. Phase 3 provides the monitorable signals, not the external platform.
- Multi-tenant data partitioning or role hierarchy redesign beyond the current `client` and `admin` role model.

# 5. System Architecture Upgrade (Phase 3)

The Phase 3 transformation is not a product rewrite. It is a control-layer upgrade around the existing product paths.

## BEFORE

```text
Browser
  -> server.js (HTTPS wrapper, TLS bypass in dev)
  -> proxy.ts (session gate only)
  -> route handlers with inline auth and error handling
  -> lib/auth/session.ts (file-backed local store)
  -> lib/db.ts
  -> PostgreSQL

Route handlers -> lib/auth/keycloak.ts -> Keycloak
Server pages -> HTTPS self-fetch -> same app API routes
```

## AFTER

```text
Browser
  -> server.js
     - strict TLS only
     - correlation ID generation
     - request edge logging
  -> proxy.ts
     - session gate
     - refresh logging
     - auth failure classification
  -> withRouteContext wrapper
     - structured logs
     - standardized error mapping
     - correlation propagation
  -> RBAC layer
     - permission check
     - resource scope check
  -> service layer
     - shared business logic for pages and API routes
  -> session abstraction
     - file adapter for local dev
     - Redis adapter for production
  -> audit writer
     - persistent security and mutation trail
  -> PostgreSQL

Keycloak calls -> strict TLS fetch helper -> Keycloak
Server pages -> shared service modules -> DB
```

Transformation summary:

| Concern | Before | After |
| --- | --- | --- |
| Logging layer | No unified logger | Structured JSON logger with redaction |
| Tracing | No request correlation | `x-correlation-id` generated at edge and propagated everywhere |
| RBAC enforcement | Inline ownership checks only | Central permission model plus resource-scope checks |
| Session abstraction | Direct file-backed implementation | Driver-selected abstraction with file and Redis adapters |
| Audit trail | None | Durable `audit_logs` table and audit writer |
| TLS posture | Bypass exists | Strict trust, explicit failure behavior, no bypass |

# 6. Workstream Breakdown (CRITICAL)

## 6.1 Observability Layer

Objective:

Make every request, response, and server-side failure traceable without exposing secrets.

Implementation tasks:

1. Create a structured JSON logger with explicit redaction rules.
2. Generate a correlation ID in `server.js` and propagate it through `proxy.ts`, route handlers, and responses.
3. Add a route wrapper that records start, completion, and failure events for every `app/api/*` route.
4. Add liveness and readiness endpoints for deterministic health probing.
5. Ensure logger failure never blocks a user request.

Success criteria:

- Every request to `server.js` receives a correlation ID.
- Every `app/api/*` handler emits a completion log with status and duration.
- Every 5xx response has a matching error log entry with redacted metadata.
- Health endpoints return machine-readable JSON with deterministic status fields.

Failure scenarios:

- Log serialization throws because metadata contains unexpected shapes.
- Correlation ID header is missing on inbound request.
- Readiness check cannot reach PostgreSQL or Keycloak within timeout.

Blast radius:

- Impact if logger degrades correctly: low, because requests still complete and only observability is reduced.
- Impact if logger is allowed to crash request handling: medium, because all API paths become unstable.

Example request log payload:

```json
{
  "timestamp": "2026-05-03T14:05:19.221Z",
  "level": "info",
  "event": "http_request_completed",
  "correlationId": "6e48a6b1-9a73-4f2c-9d8a-6f8fc932ebd0",
  "method": "GET",
  "path": "/api/dashboard",
  "status": 200,
  "durationMs": 41,
  "actorUserId": "7a0ef6d1-b6a0-4fe7-bf7d-0c3ae5a5f05d"
}
```

## 6.2 Security Hardening

Objective:

Remove all TLS bypass behavior and make transport failures fail closed with deterministic error handling.

Implementation tasks:

1. Remove the `NODE_TLS_REJECT_UNAUTHORIZED=0` assignment from `server.js`.
2. Add centralized TLS configuration so Keycloak calls and any remaining outbound HTTPS calls use strict trust settings.
3. Refactor server-rendered pages away from HTTPS self-fetch to shared service modules so internal page rendering does not rely on loopback TLS.
4. Preserve the correct cookie model: `__state` remains `SameSite=Lax` for OIDC callback integrity; `__session` remains `SameSite=Strict` and `Secure`.
5. Make transport trust failures return deterministic `service_unavailable` behavior instead of silent fallback or bypass.

Success criteria:

- `server.js` contains no TLS bypass logic.
- Login, callback, refresh, and page rendering work without bypass.
- Trust failures are visible in logs and do not silently downgrade transport security.
- Cookie behavior remains compatible with the Keycloak redirect flow.

Failure scenarios:

- Local or production certificate is expired.
- Hostname does not match certificate subject.
- Keycloak certificate chain is untrusted.
- A developer attempts to reintroduce bypass logic.

Blast radius:

- High. If TLS trust is broken, login, callback, refresh, and any remaining outbound HTTPS path will fail. The system must fail closed rather than continue insecurely.

## 6.3 RBAC Implementation

Objective:

Replace implicit route-by-route authorization behavior with an explicit permission system that is easy to review and test.

Implementation tasks:

1. Define permission constants and a route policy map for every protected route.
2. Implement an authorization helper that evaluates role permission first, then resource scope.
3. Preserve current anti-enumeration behavior by returning `404` for missing owned resources and `403` for role-based denial.
4. Log and audit every denied request with permission key, actor, route, and correlation ID.
5. Add negative tests for unsupported role and cross-resource access.

Success criteria:

- Every protected route declares one permission key.
- Role denial returns `403` before any mutation is attempted.
- Resource ownership mismatch returns the existing `404` behavior where resource enumeration must be prevented.
- RBAC denial events are visible in both structured logs and audit records.

Failure scenarios:

- A new route is added without a policy.
- Authorization check runs after a mutation query.
- A client attempts to access another client's resource by changing route parameters.

Blast radius:

- High. An RBAC defect can expose or mutate protected data. Missing policy coverage blocks release.

## 6.4 Session & Scalability Foundation

Objective:

Keep the current auth behavior intact while removing the single-instance session assumption.

Implementation tasks:

1. Split the current session store into an interface plus a file adapter and a Redis adapter.
2. Select the active driver through environment configuration.
3. Preserve current API usage so route handlers still import a single `sessionStore` abstraction.
4. Fail startup in production if the configured driver is not production-safe.
5. Log session creation, refresh, invalidation, and deletion events without logging tokens.

Success criteria:

- `lib/auth/session.ts` exposes only the abstraction, not file-specific logic.
- Local development can still run with the file adapter.
- Production cannot start with the file adapter.
- Session refresh and logout behavior remain functionally unchanged.

Failure scenarios:

- Redis is unreachable when the Redis driver is enabled.
- Session payload cannot be parsed or is missing required fields.
- Production configuration still points to the file adapter.

Blast radius:

- High. Session store failure affects all protected routes and all auth continuity.

## 6.5 Audit & Traceability

Objective:

Create a durable, queryable record of security-relevant and state-mutating actions.

Implementation tasks:

1. Add an `audit_logs` table to PostgreSQL.
2. Create an audit writer that accepts actor, resource, action, outcome, route, status code, and correlation ID.
3. Use database transactions for write endpoints so business mutation and audit insert succeed or fail together.
4. Record auth lifecycle events, RBAC denials, and portal mutations.
5. Keep audit metadata useful but small. Do not store tokens, cookies, or unredacted request bodies.

Success criteria:

- Task completion, message creation, and account update each create one audit record on success.
- RBAC denies create one audit record with outcome `denied`.
- Login success, login failure, session refresh failure, and logout are logged with actor information when available.
- Audit writes are queryable by actor, resource, and correlation ID.

Failure scenarios:

- Audit insert fails inside a mutation transaction.
- Actor information is missing during auth failure.
- Audit table migration is missing in a fresh environment.

Blast radius:

- Medium to high. Mutating routes should fail closed if the transaction cannot write the required audit record; auth lifecycle logging may degrade to structured error logging when no DB actor context exists yet.

Example audit event payload:

```json
{
  "eventType": "task.completed",
  "actorUserId": "7a0ef6d1-b6a0-4fe7-bf7d-0c3ae5a5f05d",
  "resourceType": "task",
  "resourceId": "3e92ef20-c9a7-4d59-b014-fde9152304bc",
  "outcome": "success",
  "route": "/api/tasks/3e92ef20-c9a7-4d59-b014-fde9152304bc/complete",
  "correlationId": "6e48a6b1-9a73-4f2c-9d8a-6f8fc932ebd0",
  "metadata": {
    "projectId": "624a0e90-7b21-46e4-b818-f72dcb1d2730"
  }
}
```

# 7. Detailed Execution Plan (STEP-BY-STEP)

## 7.1 Observability Layer Steps

| Step | Exact Files to Create or Modify | Expected Behavior | Validation Steps |
| --- | --- | --- | --- |
| O1 | Create `lib/observability/logger.ts`; create `lib/observability/redaction.ts` | One logger API emits JSON with fixed keys and strips `accessToken`, `refreshToken`, `idToken`, `client_secret`, `cookie`, and `authorization` fields | Add `tests/observability/logger.test.ts`; verify a sample log line contains redaction markers instead of raw secrets |
| O2 | Create `lib/observability/correlation.ts`; modify `server.js`; modify `proxy.ts` | `server.js` generates `x-correlation-id` if absent, adds it to request and response, and `proxy.ts` preserves it across redirects | Request `/dashboard` without a session and confirm redirect response still includes `x-correlation-id` |
| O3 | Create `lib/observability/with-route-context.ts`; modify `app/api/auth/login/route.ts`; modify `app/api/auth/callback/route.ts`; modify `app/api/auth/logout/route.ts`; modify `app/api/auth/session-init/route.ts`; modify `app/api/account/route.ts`; modify `app/api/dashboard/route.ts`; modify `app/api/projects/route.ts`; modify `app/api/projects/[projectId]/route.ts`; modify `app/api/projects/[projectId]/files/route.ts`; modify `app/api/projects/[projectId]/messages/route.ts`; modify `app/api/tasks/[taskId]/complete/route.ts` | Every route logs start, completion, and failure with correlation ID, status code, and duration | Add `tests/observability/route-context.test.ts`; force one route to throw in test and verify a 500 response has a matching error log |
| O4 | Create `app/api/health/route.ts`; create `app/api/ready/route.ts` | `/api/health` returns simple process-level liveness; `/api/ready` checks DB and Keycloak reachability with bounded timeouts | Add `tests/observability/health.test.ts`; call both endpoints and verify `200` in healthy state and `503` when a dependency is intentionally unavailable |

## 7.2 Security Hardening Steps

| Step | Exact Files to Create or Modify | Expected Behavior | Validation Steps |
| --- | --- | --- | --- |
| S1 | Modify `server.js` | Remove TLS bypass logic entirely. If bypass env is present in non-test execution, startup fails with a fatal log and non-zero exit | Start the app with `NODE_TLS_REJECT_UNAUTHORIZED=0`; confirm startup fails instead of silently continuing |
| S2 | Modify `lib/env.ts`; create `lib/http/tls.ts`; modify `lib/auth/keycloak.ts` | Outbound Keycloak calls use strict TLS and classify trust failures as `service_unavailable` without leaking secrets | Add `tests/security/tls-hardening.test.ts`; mock a trust error and verify deterministic failure behavior |
| S3 | Create `lib/portal/dashboard-service.ts`; create `lib/portal/project-service.ts`; create `lib/portal/account-service.ts`; modify `app/(portal)/dashboard/page.tsx`; modify `app/(portal)/projects/[projectId]/page.tsx`; modify `app/api/dashboard/route.ts`; modify `app/api/projects/route.ts`; modify `app/api/projects/[projectId]/route.ts`; modify `app/api/projects/[projectId]/files/route.ts`; modify `app/api/projects/[projectId]/messages/route.ts`; modify `app/api/account/route.ts`; modify `app/api/tasks/[taskId]/complete/route.ts` | Server-rendered pages stop self-fetching the app over HTTPS. Pages and API routes share one service layer, removing loopback TLS dependency and reducing duplicate logic | Render `/dashboard` and `/projects/[projectId]` with loopback HTTPS blocked; pages must still load because they no longer call the app over HTTPS |
| S4 | Modify `app/api/auth/login/route.ts`; modify `app/api/auth/callback/route.ts`; modify `app/api/auth/logout/route.ts`; modify `lib/auth/config.ts` | Auth cookies remain secure and correct for OIDC: `__state` stays `SameSite=Lax`; `__session` stays `SameSite=Strict`; error redirects remain deterministic | Extend existing auth tests to assert cookie flags and redirect behavior without TLS bypass |

## 7.3 RBAC Implementation Steps

| Step | Exact Files to Create or Modify | Expected Behavior | Validation Steps |
| --- | --- | --- | --- |
| R1 | Create `lib/auth/permissions.ts`; create `lib/auth/route-policy.ts`; create `lib/auth/authorize.ts` | One permission catalog exists for every protected route, with deny-by-default behavior for unmapped routes | Add `tests/auth/rbac.test.ts`; fail the test suite if any protected route is missing from the policy map |
| R2 | Modify `lib/auth/portal-user.ts` | Auth context exposes role, actor identity, and canonical portal user metadata needed by RBAC and audit paths | Add `tests/auth/portal-user.test.ts`; verify role and actor data are populated for a mapped user |
| R3 | Modify `app/api/account/route.ts`; modify `app/api/dashboard/route.ts`; modify `app/api/projects/route.ts`; modify `app/api/projects/[projectId]/route.ts`; modify `app/api/projects/[projectId]/files/route.ts`; modify `app/api/projects/[projectId]/messages/route.ts`; modify `app/api/tasks/[taskId]/complete/route.ts` | Each handler performs permission check before any mutation and uses resource-scope filtering for ownership-sensitive reads and writes | Add route-level negative tests that prove a client cannot access another client's resource or execute unsupported actions |
| R4 | Modify `proxy.ts`; modify `lib/observability/with-route-context.ts`; modify `lib/audit/write-audit-event.ts` once created | Role denial and permission failures produce one structured security log and one audit event with `denied` outcome | Attempt an unauthorized request and verify `403`, structured log, and audit entry all occur together |

Recommended permission model for current routes:

| Route File | Permission Key | Allowed Role | Scope Rule | Deny Behavior |
| --- | --- | --- | --- | --- |
| `app/api/account/route.ts` GET | `account.read.self` | `client` | session-mapped user only | `403` for unsupported role |
| `app/api/account/route.ts` PATCH | `account.update.self` | `client` | session-mapped user only | `403` for unsupported role |
| `app/api/dashboard/route.ts` GET | `dashboard.read.self` | `client` | projects and tasks filtered by `portalUser.id` | `403` for unsupported role |
| `app/api/projects/route.ts` GET | `project.read.self` | `client` | `client_id = portalUser.id` | `403` for unsupported role |
| `app/api/projects/[projectId]/route.ts` GET | `project.read.self` | `client` | owned project only | `404` when not owned |
| `app/api/projects/[projectId]/files/route.ts` GET | `project.file.read.self` | `client` | owned project only | `404` when not owned |
| `app/api/projects/[projectId]/messages/route.ts` GET | `project.message.read.self` | `client` | owned project only | `404` when not owned |
| `app/api/projects/[projectId]/messages/route.ts` POST | `project.message.create.self` | `client` | owned project only | `404` when not owned |
| `app/api/tasks/[taskId]/complete/route.ts` POST | `task.complete.self` | `client` | assigned task on owned project only | `404` when not owned |

Phase 3 does not add admin product endpoints. `admin` permissions may be defined for future use, but unsupported role-path combinations must deny explicitly in this phase.

## 7.4 Session & Scalability Foundation Steps

| Step | Exact Files to Create or Modify | Expected Behavior | Validation Steps |
| --- | --- | --- | --- |
| SS1 | Create `lib/auth/session/types.ts`; create `lib/auth/session/file-store.ts`; modify `lib/auth/session.ts` | The current JSON file store is preserved behind a dedicated adapter with no route-level code change | Re-run existing auth middleware, callback, and logout tests to prove no behavior regression |
| SS2 | Create `lib/auth/session/redis-store.ts`; modify `lib/env.ts`; modify `package.json` | The session driver becomes configurable through environment variables and the Redis client dependency is explicit | Add `tests/auth/session-driver-selection.test.ts`; verify the correct adapter is selected for `file` and `redis` modes |
| SS3 | Modify `server.js`; modify `app/api/ready/route.ts` | Production startup fails if the file adapter is configured; readiness reports session backend state deterministically | Start the app in production mode with `SESSION_STORE_DRIVER=file`; expect a startup failure and fatal log |
| SS4 | Modify `app/api/auth/callback/route.ts`; modify `app/api/auth/logout/route.ts`; modify `app/api/auth/session-init/route.ts`; modify `proxy.ts` | Session create, resume, refresh, expiry, and delete events are logged with correlation ID and no token leakage | Add `tests/auth/session-store.contract.test.ts`; verify create, get, delete, and refresh paths behave the same across adapters |

Implementation rule:

- Redis runtime enablement may remain design-level if the environment is not available during Phase 3 execution.
- The abstraction, configuration contract, startup guards, and tests are still mandatory in Phase 3.

## 7.5 Audit & Traceability Steps

| Step | Exact Files to Create or Modify | Expected Behavior | Validation Steps |
| --- | --- | --- | --- |
| A1 | Modify `db/schema.sql` | Add `audit_logs` table and indexes for time, actor, resource, action, and correlation ID lookup | Apply schema to local PostgreSQL and insert one sample row successfully |
| A2 | Modify `lib/db.ts` or create `lib/db/transaction.ts`; create `lib/audit/write-audit-event.ts` | Mutating endpoints can commit domain change and audit entry in the same transaction | Add `tests/audit/audit-log.test.ts`; force audit insert failure and verify the main mutation rolls back |
| A3 | Modify `app/api/auth/callback/route.ts`; modify `app/api/auth/logout/route.ts`; modify `app/api/account/route.ts`; modify `app/api/projects/[projectId]/messages/route.ts`; modify `app/api/tasks/[taskId]/complete/route.ts`; modify `proxy.ts` | Security and mutation events are persisted with actor, route, resource, outcome, and correlation ID | Exercise each route and verify exactly one audit row is written per event |
| A4 | Modify `lib/observability/with-route-context.ts`; modify `lib/auth/authorize.ts` | Denied requests and unexpected 5xx errors carry the same correlation ID in logs and audit records when audit context exists | Trigger a permission deny and a forced server error; verify matching trace identifiers across log and audit data |

Recommended `audit_logs` shape:

| Column | Purpose |
| --- | --- |
| `id` | Stable audit event identifier |
| `occurred_at` | Event time in UTC |
| `correlation_id` | Request trace stitching key |
| `actor_user_id` | Authenticated portal user if available |
| `actor_email` | Useful for auth failure and pre-mapping events |
| `session_id` | Opaque session reference without tokens |
| `event_type` | Normalized event name such as `message.created` |
| `resource_type` | Domain object type |
| `resource_id` | Domain object identifier |
| `route` | HTTP route path |
| `http_method` | Request method |
| `status_code` | HTTP result |
| `outcome` | `success`, `denied`, `failed` |
| `metadata` | Small JSONB payload for non-sensitive detail |

# 8. Validation Strategy

Validation must prove that Phase 3 controls are present and that they behave correctly under both normal and failure conditions.

| Validation Area | Required Method | Required Evidence | Failure Verdict |
| --- | --- | --- | --- |
| Logs | Unit test logger redaction, integration test route wrapper, manual runtime inspection of stdout | One start log, one completion log, and one error log for forced failure with same `correlationId` | Missing log, inconsistent `correlationId`, or secret leakage |
| RBAC | Route-policy coverage test plus negative route tests with owned and unowned resources | `403` for unsupported role, `404` for unowned resource, no mutation on denied write | Unauthorized access succeeds or resource leakage occurs |
| TLS correctness | Startup guard test, Keycloak trust-failure test, manual app start without bypass | App starts only with trusted certificates; trust errors fail closed and log deterministically | App runs with bypass or silently downgrades trust |
| Session integrity | Adapter contract tests, expiry tests, corrupt-payload tests | Same create/get/delete/refresh semantics across drivers; corrupt sessions are purged | Stale or corrupt session continues to authorize requests |
| Audit | Transaction rollback test and route-level audit assertions | Exactly one audit record for each required action; rollback on audit failure for mutations | Mutation commits without audit entry or audit data contains secrets |

Minimum validation sequence:

1. Run the existing auth suite after each session, proxy, or auth-route change.
2. Run the new observability, RBAC, session-abstraction, and audit tests.
3. Run `npm run build` to confirm no TypeScript or Next integration regressions.
4. Manually call `/api/health`, `/api/ready`, `/login`, `/dashboard`, and one mutation route under HTTPS without bypass.

Example verification commands:

```bash
npm test -- --runInBand tests/auth tests/observability tests/audit
npm run build
curl -I https://client-portal.test:3000/api/health
curl -I https://client-portal.test:3000/api/ready
```

Failure simulation checklist:

- Simulate logging failure by forcing the logger serializer to throw; request must still complete.
- Simulate RBAC bypass attempt by calling a protected route with another client's resource ID.
- Simulate session corruption by writing malformed JSON to the file adapter store or returning invalid payload from the Redis adapter.
- Simulate TLS failure by presenting an untrusted or mismatched certificate to a Keycloak call.
- Simulate audit failure by forcing the audit insert to fail inside a write transaction.

# 9. Failure Scenario Mapping

| Failure Scenario | Detection | Expected System Behavior | Fallback Behavior |
| --- | --- | --- | --- |
| Logging failure | Logger throws during serialization or output write | Request continues, minimal fallback error is written to stderr, and readiness can expose degraded logging state | Serve the request; restore logger without restarting product behavior |
| RBAC bypass attempt | Role check fails or ownership query returns no allowed resource | Unsupported role returns `403`; unowned resource returns `404`; write is not attempted; deny event is logged and audited | Deny by default. Missing route policy blocks release until fixed |
| Session corruption | Session parse fails or required fields are missing | Delete the corrupted session, clear `__session`, redirect to `/login?error=session_expired`, and log one security event | Force re-authentication; never continue with partially valid session data |
| TLS misconfiguration | Certificate validation or hostname verification fails | Outbound auth-dependent requests return deterministic `service_unavailable`; startup fails when the app's own transport config is invalid | No bypass allowed. Fix certificate chain, hostname, or trust store and retry |
| Audit write failure on mutation | Transaction cannot insert audit row | Roll back the mutation, return a deterministic 5xx or 503 response, and emit one structured error log | Preserve data integrity by failing the write rather than accepting an unaudited change |
| Dependency readiness failure | DB or Keycloak probe times out or returns error | `/api/ready` returns `503` with machine-readable dependency status and correlation ID | Liveness remains healthy if process is alive; external monitor should treat readiness as degraded |

# 10. Blast Radius Analysis

| Phase 3 Component | What Breaks If It Fails | System Impact Level |
| --- | --- | --- |
| Structured request logger | Traceability and diagnostics degrade; user traffic should still continue if logger is fail-open | Low |
| Correlation ID propagation | Logs, audit events, and user reports cannot be stitched into one request path | Low |
| Health and readiness endpoints | Monitoring loses deterministic probe signals, but portal behavior continues | Low |
| TLS hardening | Login, callback, token refresh, and any remaining outbound HTTPS path fail closed | High |
| RBAC guard | Unauthorized read or write risk appears immediately if policy is wrong or bypassed | High |
| Session abstraction and driver selection | Protected routes lose session continuity; multi-instance safety is broken | High |
| Audit writer and transaction coupling | Mutations may be blocked or traceability is lost, depending on failure path | Medium |
| Service-layer extraction for server pages | Page rendering can regress if shared services diverge from API behavior | Medium |

# 11. Final Target State (CRITICAL)

Phase 3 is COMPLETE only when all statements below are true at the same time.

- ✔ request logging
- ✔ error logging
- ✔ correlation id
- ✔ RBAC enforced
- ✔ TLS secure (no bypass)
- ✔ session abstraction ready for scaling
- ✔ audit logs

Exact meaning of complete:

| Requirement | Exact Completion Definition |
| --- | --- |
| Request logging | Every inbound request writes start and completion logs with `correlationId`, method, route, status, and duration |
| Error logging | Every server-side failure writes one structured error record with redacted metadata |
| Correlation ID | `x-correlation-id` is created at ingress, preserved through redirects, present in logs, and echoed in responses |
| RBAC enforced | Every protected route uses explicit permission evaluation plus resource scope rules and has negative tests |
| TLS secure | No code sets `NODE_TLS_REJECT_UNAUTHORIZED=0`; transport failures fail closed; certificates are trusted explicitly, not bypassed |
| Session abstraction ready for scaling | File and Redis adapters exist behind one abstraction; production cannot start with the file adapter |
| Audit logs | Required auth and mutation events write durable audit records with actor, resource, outcome, and correlation ID |

Release gate:

- Existing auth tests still pass.
- New observability, RBAC, session, and audit tests pass.
- Build passes.
- Manual HTTPS validation works without bypass.

# 12. Engineering Definition of Done (DoD)

- [ ] `server.js` contains no TLS bypass logic.
- [ ] `lib/observability/logger.ts` exists and redacts tokens, secrets, cookies, and authorization headers.
- [ ] `x-correlation-id` is generated for every inbound request and echoed in every response path.
- [ ] Every protected route is present in the RBAC policy map.
- [ ] Negative RBAC tests prove unauthorized access is denied deterministically.
- [ ] `db/schema.sql` contains the `audit_logs` table and required indexes.
- [ ] Mutating routes write audit records transactionally.
- [ ] `lib/auth/session.ts` resolves a session abstraction rather than embedding file-store logic directly.
- [ ] Production startup fails when the file session driver is selected.
- [ ] No log line contains raw access tokens, refresh tokens, ID tokens, cookies, or client secrets.
- [ ] `/api/health` and `/api/ready` return deterministic machine-readable responses.
- [ ] `npm run build` passes.
- [ ] Phase 3 test suite passes.
- [ ] Repeated execution of the same scenario yields the same observable result.

# 13. Risks & Trade-offs

| Trade-off | Benefit | Cost | Accepted Phase 3 Position |
| --- | --- | --- | --- |
| Dev vs prod gap | Removing TLS bypass eliminates false confidence and matches production trust behavior | Developers must install or trust the local CA correctly | Accept the extra setup cost; do not preserve insecure convenience |
| Performance vs logging overhead | Structured logs and audit data make failures diagnosable and auditable | Small CPU and I/O overhead on every request and write path | Keep log payloads small and deterministic; do not log full bodies |
| Simplicity vs scalability | Session abstraction prepares the system for multi-instance deployment | More code paths and configuration branches exist | Accept the abstraction now because the current local-only store is not production-safe |
| Availability vs compliance | Failing a mutation when audit insert fails preserves traceability | Write paths can be unavailable during audit DB issues | Accept fail-closed behavior for mutations; do not allow unaudited state change |
| Fast local implementation vs clean architecture | Service-layer extraction removes internal loopback fetches and TLS coupling | Requires refactor of pages and route handlers | Accept the refactor because it fixes a real hardening weakness at the root cause |

# 14. Future Phase (Phase 4 Preview)

Phase 4 starts only after Phase 3 controls are stable.

- Deployment: container image strategy, secret injection, reverse proxy configuration, certificate lifecycle automation, and external readiness monitoring.
- Infrastructure scaling: managed Redis, production PostgreSQL operations, log shipping, metrics, alerting, and zero-downtime rollout strategy.
- Multi-tenant support: tenant-aware authorization, tenant-partitioned audit retrieval, stronger admin capabilities, and tenant-safe data isolation.