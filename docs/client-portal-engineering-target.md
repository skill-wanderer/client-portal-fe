# Client Portal Engineering Target

Source Basis: Client Portal Production Blueprint (Decision Grade)

Purpose: Measurement instrument for target-state alignment, implementation assessment, audit execution, and release verdicting.

---

## 1. Executive Summary

| Area | Summary |
| --- | --- |
| Purpose | Define engineering target state |
| System | Client Portal Auth System |
| Role | Measurement + Audit + Execution |
| Outcome | Deterministic engineering alignment |

### One-Line Definition

This document defines the measurable target state of the client portal system and enables deterministic validation of implementation correctness.

---

## 2. Target System Definition

A correct system is one that implements the approved blueprint without architectural drift, security weakening, or operational ambiguity. Correctness is established by observable behavior, verifiable configuration, and auditable evidence.

### 2.1 Functional Target

- The portal exposes a public login entry at `/login` and starts authentication through `GET /api/auth/login`.
- Login initiation generates a cryptographically random state value, stores it in `__state`, and redirects to the Keycloak authorization endpoint with the approved parameters.
- The callback accepts authorization results only through `GET /api/auth/callback`.
- A valid callback exchanges the authorization code server-side, creates a UUID v4 session ID, stores auth state server-side, clears `__state`, sets `__session`, and redirects to `/dashboard`.
- Protected routes are inaccessible without a valid server-side session.
- Expired access tokens are refreshed server-side when the refresh token remains valid.
- Logout is executed through `POST /api/auth/logout`, destroys the server-side session, clears `__session`, calls the Keycloak logout endpoint, and returns the user to `/login`.
- Failure paths return the exact approved redirect and user-message behavior without leaving partial session state behind.

### 2.2 Security Target

- Access tokens, refresh tokens, and ID tokens never reach browser JavaScript, browser storage, or readable cookies.
- The browser stores only `__state` and `__session`, both as `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` cookies.
- `__state` is random 32-byte hex with a 300-second lifetime.
- `__session` is an opaque session identifier with a 1800-second lifetime.
- State validation is mandatory before code exchange.
- The client secret remains server-side only and never enters the browser or source control.
- Middleware enforces protected-route access before protected content renders.
- The portal remains the only auth boundary; the browser does not call Keycloak token endpoints directly.
- Production session storage uses Redis; in-memory storage is development-only.

### 2.3 Operational Target

- Keycloak realm, client, redirect URIs, logout URIs, and token TTLs match the approved contract.
- Environment variables resolve exactly to the approved identity and app URLs.
- Middleware behavior is deterministic for public routes, static assets, missing sessions, expired sessions, refreshable sessions, and valid sessions.
- Error handling follows the approved redirect, log-level, and user-message contract.
- Validation covers normal flow, failure flow, session expiry, token refresh, logout, and service-unavailable scenarios.
- Release readiness is based on evidence, not manual confidence.

---

## 3. System Truth Model (CRITICAL)

These truths are non-negotiable. Any implementation that violates them is not target-state compliant.

| Rule | Description | Type |
| --- | --- | --- |
| ST-01 | Tokens never reach the browser. | Security |
| ST-02 | The browser stores only `__state` and `__session`; both are opaque cookies. | Architecture |
| ST-03 | Session state is stored server-side and contains tokens, user claims, expiry timestamps, and creation time. | Architecture |
| ST-04 | `__state` must be cryptographically random 32-byte hex and must match callback query state before code exchange. | Security |
| ST-05 | Missing or mismatched state must clear `__state` and redirect to `/login?error=invalid_state`. | Security |
| ST-06 | Middleware must gate all protected routes before content renders. | Security |
| ST-07 | Missing `__session` must redirect to `/login`. | Functional |
| ST-08 | A present cookie with no server-side session must redirect to `/login`. | Functional |
| ST-09 | Expired refresh state must delete the session and force a signed-out path. | Operational |
| ST-10 | Expired access tokens may be refreshed only server-side while refresh remains valid. | Security |
| ST-11 | Logout must delete the session, clear `__session`, and call Keycloak logout with `id_token_hint` and `post_logout_redirect_uri`. | Functional |
| ST-12 | Keycloak is the single identity provider; the portal does not operate a local identity store. | Architecture |
| ST-13 | This design is a confidential-client flow and does not use browser-driven PKCE. | Architecture |
| ST-14 | Production session storage must be Redis; in-memory storage is not production compliant. | Operational |
| ST-15 | The client secret is server-side only and is never committed or exposed. | Security |
| ST-16 | Protected content is served only after session validation passes. | Security |
| ST-17 | Login, callback, and logout occur only through the approved auth routes. | Functional |
| ST-18 | Error redirects, log levels, and user messages follow the approved contract exactly. | Operational |

---

## 4. Layer-by-Layer Target Mapping

| Layer | Responsibility | Expected Behavior | Failure Mode |
| --- | --- | --- | --- |
| User | Initiate login, access dashboard, sign out | User can enter through `/login`, reach `/dashboard` after successful auth, and lose access after logout | Redirect loop, failed sign-in, misleading signed-out state |
| Browser | Render UI and carry opaque cookies only | Browser renders portal pages and sends `__state` and `__session` as cookies without ever handling tokens | Token exposure, readable auth state, browser-managed trust decisions |
| Frontend | Present login, dashboard, navigation, and error messaging | Public and protected views are separated correctly; approved error messages are shown when redirects include `error` query params | Protected UI exposed early, missing error messaging, wrong auth entry path |
| Auth | Execute login, callback, and logout route handling | Auth routes generate state, validate state, exchange code server-side, create session, clear cookies correctly, and redirect deterministically | Invalid state accepted, session not created, partial auth state, logout incomplete |
| Middleware | Enforce access before protected render | Public routes and static assets bypass checks; protected requests require valid session and refresh handling | Unauthorized access, stale-session access, redirect loops, refresh not performed |
| Keycloak | Provide identity verification and token endpoints | Authorization, token exchange, refresh, and logout behave according to configured realm and confidential client | Unreachable IdP, misconfigured redirects, non-200 token exchange |
| Session | Store auth state and session lifecycle data server-side | Session store contains tokens, claims, expiry timestamps, and supports lookup, refresh updates, and deletion | Session missing, expiry unmanaged, restart loss in production |
| Data | Serve protected client information only after auth validation | Dashboard and protected resources are available only when middleware and session validation succeed | Data exposure without session, partially gated routes |

---

## 5. Engineering Capability Matrix (CRITICAL)

| Area | Required Capability | Evidence |
| --- | --- | --- |
| Keycloak contract fidelity | Realm, client type, redirect URIs, logout URIs, TTLs, and secret handling match the approved contract | Keycloak configuration review and environment verification |
| Login initiation | `/api/auth/login` generates state, sets `__state`, and redirects with required authorization parameters | Route tests, browser-network validation, cookie inspection |
| Callback integrity | `/api/auth/callback` rejects invalid state and only creates sessions after successful server-side code exchange | Route tests for valid and invalid state, token-exchange assertions |
| Session management | Session store holds auth material server-side only and uses UUID v4 opaque session IDs for browser access | Code inspection, session-store inspection, browser storage review |
| Middleware enforcement | Protected routes are blocked before render; public routes and static assets pass through correctly | Middleware tests, route access verification, matcher review |
| Token refresh handling | Expired access tokens refresh server-side when refresh is valid; expired refresh state forces sign-out | Expiry simulation tests and runtime logs |
| Logout completeness | Logout removes server session, clears cookie, and ends Keycloak SSO path | Route tests, browser verification, redirect validation |
| Error contract compliance | Invalid state, auth failure, session expiry, and service-unavailable paths produce exact redirects, messages, and log severities | Failure-path tests and log review |
| Production session topology | Production deployment uses Redis rather than in-memory storage | Deployment configuration review and runtime verification |
| Observability discipline | Required auth events are logged and sensitive values are absent from logs | Log inspection and security review |
| Deterministic behavior | Repeated execution of the same preconditions yields the same redirect, cookie, and session result | Automated tests and repeated scenario verification |

---

## 6. Assessment Framework (CORE SYSTEM)

### 6.1 Assessment Dimensions

| Dimension | What Is Being Evaluated | Pass Condition |
| --- | --- | --- |
| Functional correctness | Whether approved routes, redirects, session creation, refresh, and logout behave exactly as defined | All required functional behaviors occur with no missing step or unauthorized bypass |
| Security correctness | Whether tokens, secrets, cookies, and state validation follow the approved security boundary | No token exposure, mandatory state validation, correct cookie flags, server-side secret handling |
| Flow integrity | Whether auth transitions happen in the approved order and only through the approved control points | Login, callback, session, middleware, refresh, and logout follow the approved sequence without drift |
| Failure handling | Whether defined failures map to exact redirect, cleanup, and log behavior | Invalid state, token exchange failure, session expiry, and service unavailability follow the error contract exactly |
| Determinism | Whether behavior is stable and auditable across repeated executions | Same input state produces the same observable result with no silent partial state |

Assessment rule: a component is only correct when it satisfies all dimensions that apply to that component.

### 6.2 Scoring Model

| Score | Meaning |
| --- | --- |
| 0 | Broken |
| 1 | Partial |
| 2 | Correct |
| 3 | Production-ready |

Scoring rules:

- `0`: The component fails its primary responsibility, violates a required truth, or cannot be shown to work safely.
- `1`: The component works on some paths but has missing controls, incomplete failure handling, or insufficient evidence.
- `2`: The component matches the blueprint behavior and has direct proof through tests, manual validation, or runtime verification.
- `3`: The component scores `2` and also has production-grade operational proof, complete failure coverage, and observability evidence.

Score cap rules:

- Failure of `ST-01`, `ST-04`, `ST-06`, `ST-11`, or `ST-14` caps the affected component at `1` and prevents a `READY` system verdict.
- Any unresolved security gap prevents a `3` score for the affected component.
- Missing evidence prevents a `2` or `3` score even if behavior appears correct.

### 6.3 Assessment Table

Use this table to record current-state evidence against the target state.

| Component | Expected | Actual | Score | Gap |
| --- | --- | --- | --- | --- |
| Login route | Generates state, sets `__state`, redirects to Keycloak with approved parameters | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Callback route | Validates state, exchanges code server-side, creates session, clears `__state`, redirects to `/dashboard` | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Session store | Stores tokens and user context server-side only; browser sees opaque session ID only | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Middleware | Gates protected routes, refreshes when allowed, redirects unauthenticated users | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Login page | Public entry point with correct auth action and approved error messaging | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Dashboard protection | Protected content available only after successful session validation | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Logout route | Deletes session, clears cookie, redirects through Keycloak logout, returns user to `/login` | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Error handling | All defined failures map to exact redirects, log levels, and cleanup behavior | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Keycloak configuration | Realm, client, URLs, and TTLs match contract | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Production session storage | Redis used in production; in-memory excluded | TO BE FILLED | TO BE FILLED | TO BE FILLED |
| Observability | Required events logged; prohibited values absent | TO BE FILLED | TO BE FILLED | TO BE FILLED |

---

## 7. Gap Detection System

Gap detection exists to identify exactly how implementation differs from the approved target state.

| Gap Type | Definition | Detection Trigger | Audit Meaning |
| --- | --- | --- | --- |
| Functional gap | Required behavior does not occur as defined | Route, redirect, session, refresh, or logout behavior differs from contract | System is not functionally correct |
| Security gap | Security boundary or control is weakened or bypassed | Tokens appear in browser scope, state validation is absent, cookie flags are wrong, or secrets are exposed | System is unsafe and cannot be approved |
| Flow gap | The approved auth sequence is broken, reordered, or bypassable | Login, callback, middleware, refresh, or logout occurs outside the approved path | System behavior is non-deterministic or incomplete |
| Architecture drift | Implementation introduces an unapproved auth pattern or storage model | Browser token handling, local identity store, separate auth gateway, or other unapproved model appears | Implementation has moved away from the blueprint |
| Silent failure risk | Failure occurs without explicit redirect, cleanup, logging, or user feedback | Missing query error, missing log, retained stale session, or partial state persists | Failures will be hard to detect, debug, and audit |

Gap severity rule:

- Critical: Violates any system truth or exposes protected content or auth material.
- Major: Breaks core auth flow or prevents deterministic validation.
- Moderate: Leaves approved behavior incomplete but not unsafe.
- Minor: Evidence or observability is incomplete while behavior remains correct.

---

## 8. Audit Checklist (MANDATORY)

### Functional

- [ ] `GET /login` is public and redirects authenticated users to `/dashboard`
- [ ] `GET /api/auth/login` generates a random state value and stores it in `__state`
- [ ] `GET /api/auth/login` redirects to Keycloak with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid`, and `state`
- [ ] `GET /api/auth/callback` rejects missing or mismatched state
- [ ] Valid callback creates a UUID v4 session ID and stores auth state server-side
- [ ] Valid callback clears `__state`, sets `__session`, and redirects to `/dashboard`
- [ ] Middleware redirects requests with missing `__session` to `/login`
- [ ] Middleware redirects requests with stale cookie and missing server-side session to `/login`
- [ ] Middleware refreshes expired access tokens server-side when refresh is still valid
- [ ] Logout destroys the server-side session and clears `__session`
- [ ] Logout redirects through Keycloak logout and returns the user to `/login`

### Security

- [ ] Browser storage contains no access token, refresh token, or ID token
- [ ] `__session` is `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and `Max-Age=1800`
- [ ] `__state` is `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and `Max-Age=300`
- [ ] State validation occurs before authorization code exchange
- [ ] Client secret remains server-side and is not committed to source control
- [ ] Direct browser calls to Keycloak token endpoints do not exist
- [ ] Protected content does not render before middleware validation passes
- [ ] Session payload remains server-side only
- [ ] Production does not rely on in-memory session storage

### Operational

- [ ] Keycloak realm is `client-portal`
- [ ] Keycloak client is `client-portal-fe` and configured as confidential
- [ ] Redirect and logout URIs match the approved app URLs
- [ ] Access token TTL is `300` seconds and refresh token TTL is `1800` seconds
- [ ] Environment variables match the approved contract
- [ ] Invalid state redirects to `/login?error=invalid_state` and is logged at `WARN`
- [ ] Token exchange failure redirects to `/login?error=auth_failed` and is logged at `ERROR`
- [ ] Expired session redirects to `/login?error=session_expired` and is logged at `INFO`
- [ ] Keycloak unavailability redirects to `/login?error=service_unavailable` for login paths or returns `503` for affected API routes, and is logged at `CRITICAL`
- [ ] Normal flow and failure flow validation have been completed before release verdicting

---

## 9. Failure Mode Mapping (CRITICAL)

| Failure | Detection | Impact | Mitigation |
| --- | --- | --- | --- |
| Missing `__session` | Middleware receives protected request with no session cookie | Unauthenticated user reaches protected route unless blocked | Redirect to `/login` before render |
| Stale cookie with missing server-side session | Session lookup returns no record for presented session ID | Broken access continuity and potential redirect confusion | Redirect to `/login` and treat session as invalid |
| Missing or mismatched state | Callback query `state` does not match `__state` cookie | CSRF protection failure path and blocked login | Clear `__state` and redirect to `/login?error=invalid_state` |
| Token exchange failure | Keycloak token endpoint returns non-200 or invalid response | User cannot complete login; partial auth state risk | Clear `__state` and redirect to `/login?error=auth_failed` |
| Access token expired while refresh valid | Middleware detects expired access token with valid refresh window | Protected request fails unless refresh succeeds | Refresh server-side, update session, continue request |
| Refresh token expired | Middleware detects `refresh_expires` is in the past | Session cannot be recovered and user must reauthenticate | Delete session, clear cookie when required, redirect to signed-out path |
| Refresh attempt fails | Keycloak refresh call fails before refresh expiry window completes | Session continuity broken and stale state risk | Delete session, clear cookie, redirect to `/login?error=session_expired` |
| Keycloak unreachable | Network failure or timeout on auth-dependent route | Login or callback cannot complete; service degradation | Redirect to `/login?error=service_unavailable` for login paths or return `503`; alert operations; do not auto-retry |
| In-memory storage used in production | Deployment or runtime inspection shows non-Redis production session storage | Session loss on restart and multi-instance inconsistency | Replace with Redis before production approval |
| Logout does not terminate SSO path | Logout clears local state but does not call Keycloak logout correctly | User appears signed out locally but remains authenticated at IdP | Send logout request with `id_token_hint` and `post_logout_redirect_uri` |

---

## 10. Validation System

System correctness is proven only when manual validation, automated validation, and runtime validation all support the same verdict.

### Manual Validation

| Scenario | Proof Required | Pass Condition |
| --- | --- | --- |
| Normal login | Browser walkthrough from `/login` to `/dashboard` | User reaches dashboard and receives only opaque session cookie |
| Invalid state | Tampered or missing state during callback | Redirects to `/login?error=invalid_state`; no session created |
| Token exchange failure | Simulated non-200 callback exchange | Redirects to `/login?error=auth_failed`; no session created |
| Session expiry | Expired refresh token or failed refresh path | Session is removed and user is redirected to signed-out state |
| Logout | Authenticated logout flow | Session removed, cookie cleared, Keycloak logout invoked, user returned to `/login` |
| Keycloak unavailable | Simulated IdP outage during login path | Redirect or response matches approved service-unavailable contract |

### Test Validation

| Test Area | What Must Be Proven | Pass Condition |
| --- | --- | --- |
| Login route tests | State generation, cookie setting, redirect parameters | Test assertions match exact contract |
| Callback route tests | State validation, token exchange handling, session creation, error redirects | Valid and failure branches both pass |
| Middleware tests | Public bypass, protected-route blocking, refresh handling, expiry handling | Middleware behavior is deterministic across all defined branches |
| Session service tests | Create, retrieve, update, refresh, and delete session state | Session lifecycle works without exposing auth material to browser scope |
| Logout route tests | Session destruction, cookie clearing, Keycloak logout redirect | Logout path is complete and deterministic |
| Contract tests | Cookie attributes, redirect targets, error query parameters | Output matches the approved contract exactly |

### Runtime Validation

| Runtime Check | What Must Be Observed | Pass Condition |
| --- | --- | --- |
| Cookie verification | Browser shows only `__state` and `__session` with approved flags | No tokens or readable auth cookies exist |
| Session-store verification | Server-side store contains tokens and user context | Browser contains opaque session ID only |
| Keycloak connectivity | Authorization, token, and logout endpoints are reachable from the app | No environment or network mismatch blocks auth |
| Production storage verification | Production environment uses Redis | Session behavior survives restart and instance changes |
| Log verification | Required auth events are logged; prohibited values are absent | Observability is sufficient for audit and incident handling |

Correctness proof rule:

- No system verdict may be `READY` without passing manual, test, and runtime validation for all P0 auth capabilities.

---

## 11. Observability Mapping

### What Must Be Logged

| Event | Level | Required Signal |
| --- | --- | --- |
| Login flow initiated | INFO | Auth entry started through approved route |
| Session created | INFO | Session established after successful callback |
| Session refreshed | INFO | Access token refreshed server-side |
| Missing session redirect | INFO | Protected request blocked due to absent or stale session |
| Invalid state | WARN | Callback rejected due to missing or mismatched state |
| Token exchange failure | ERROR | Keycloak exchange failed and session was not created |
| Session expired or refresh failed | INFO | Session destroyed and user returned to signed-out path |
| Logout completed | INFO | Session deleted and logout path executed |
| Keycloak unreachable | CRITICAL | Identity dependency unavailable |

### What Must Not Be Logged

- Raw `access_token` values
- Raw `refresh_token` values
- Raw `id_token` values
- `KEYCLOAK_CLIENT_SECRET`
- Full `__session` cookie values
- Full session-store payloads containing auth material

### What Indicates System Health

| Indicator | Healthy Signal | Concern Signal |
| --- | --- | --- |
| Login completion | Successful `/login` to `/dashboard` transitions | Repeated auth failures or abandoned callback flows |
| State validation behavior | Invalid state is rejected predictably | Invalid state accepted or silently ignored |
| Session creation | Session created after successful callback | Callback succeeds without durable server-side session |
| Refresh behavior | Expired access tokens refresh without browser involvement | Frequent forced sign-outs while refresh should still be valid |
| Protected-route enforcement | Unauthenticated requests are redirected before render | Protected content is reachable without valid session |
| Logout behavior | Signed-out user loses local and SSO access path | User appears signed out locally but remains authenticated upstream |
| Keycloak dependency | Auth endpoints reachable and responsive | Service-unavailable path triggered during normal operation |

---

## 12. Engineering Positioning (IMPORTANT)

### Current Position (TO BE FILLED BY ENGINEER)

Status values: `NOT ASSESSED`, `PARTIAL`, `VERIFIED`, `BLOCKED`

| Area | Status | Notes |
| --- | --- | --- |
| Keycloak configuration | NOT ASSESSED |  |
| Login route | NOT ASSESSED |  |
| Callback route | NOT ASSESSED |  |
| Session store | NOT ASSESSED |  |
| Middleware enforcement | NOT ASSESSED |  |
| Token refresh | NOT ASSESSED |  |
| Login page behavior | NOT ASSESSED |  |
| Dashboard protection | NOT ASSESSED |  |
| Logout behavior | NOT ASSESSED |  |
| Error contract | NOT ASSESSED |  |
| Production session storage | NOT ASSESSED |  |
| Observability | NOT ASSESSED |  |

---

## 13. Path to Target State

| Step | Action | Outcome |
| --- | --- | --- |
| 1 | Provision Keycloak realm, confidential client, redirect URIs, logout URIs, token TTLs, and test user | Identity boundary matches the approved contract |
| 2 | Apply approved environment variables to the application | App points to the correct Keycloak and portal URLs |
| 3 | Implement auth foundation in server-side modules for Keycloak integration, session handling, and config | Server-side token and session capabilities exist |
| 4 | Implement `GET /api/auth/login`, `GET /api/auth/callback`, and `POST /api/auth/logout` | End-to-end auth routes follow the approved flow |
| 5 | Implement middleware enforcement and matcher behavior | Protected routes are gated before render and refresh behavior is controlled |
| 6 | Integrate login page, dashboard protection, navigation, and logout entry points | User-facing flow aligns with the approved auth boundary |
| 7 | Execute manual, automated, and runtime validation for normal and failure scenarios | Correctness is proven rather than assumed |
| 8 | Verify Redis-backed production session storage and observability evidence | Production-readiness can be scored objectively |
| 9 | Apply the assessment framework and final verdict rules | Release status is explicit: `READY`, `PARTIAL`, or `BLOCKED` |

---

## 14. Final Engineering Verdict Framework

| Verdict | Definition | Required Conditions |
| --- | --- | --- |
| READY | The implementation matches the blueprint and is suitable for release approval | All critical system truths hold, all P0 components score at least `2`, no unresolved security gaps exist, and manual, test, and runtime validation are complete |
| PARTIAL | The implementation is directionally aligned but not yet sufficient for release approval | Some components remain at `1`, evidence is incomplete, or non-critical gaps remain, but no hidden architecture drift is being accepted as correct |
| BLOCKED | The implementation cannot be approved because the system boundary or core flow is incorrect, unsafe, or unproven | Any critical truth fails, protected access is not enforced, tokens or secrets are exposed, logout is incomplete, or production session storage is non-compliant |

Final verdict rule:

- `READY` is a release decision.
- `PARTIAL` is an execution decision.
- `BLOCKED` is a stop decision.

Final validation checklist:

- [ ] Can the system be scored objectively?
- [ ] Can the gap be measured?
- [ ] Can correctness be proven?
- [ ] Can failure be predicted?

---

This document is not a rewrite of the blueprint. It is the measurement layer that converts the approved blueprint into engineering target state, assessment logic, audit structure, and release-verdict criteria.