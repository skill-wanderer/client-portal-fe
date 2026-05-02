# Client Portal - Production Blueprint

**Version:** 2.1 (Decision Grade)  
**Date:** 2026-04-23  
**Status:** Approved for Execution  
**Classification:** Internal Engineering

---

## 1. Executive Summary

This blueprint defines the approved approach for a secure client portal that gives clients one place to access project information without exposing internal systems or putting security tokens in the browser.

| Area | Summary |
| --- | --- |
| Problem | Clients currently rely on email, shared drives, and manual updates, which creates fragmented access and no clear boundary between internal systems and client-facing access. |
| Business Impact | Fragmented access increases support effort, weakens client confidence, and creates avoidable security risk around file sharing and identity handling. |
| Decision | Build the Client Portal as a Next.js application that also acts as the server-side authentication boundary, using Keycloak for identity and opaque session cookies for browser access. |
| Timeline | Execution starts with Keycloak provisioning and then follows a fixed order: auth foundation, auth routes, middleware enforcement, UI integration, and validation. |
| Effort | Moderate and bounded. Work is limited to auth routes, session handling, middleware, login and dashboard integration, and production-ready validation. |
| Next Step | Approve execution and start the ordered implementation plan in Section 7, beginning with Keycloak setup and environment configuration. |

### One-Line Decision

Approve a Next.js-based client portal that keeps all tokens server-side, uses Keycloak for single sign-on, and gives clients a single secure dashboard behind middleware-enforced sessions.

---

## 2. Objective

Why this matters: the portal needs one blueprint that business and engineering can approve without interpretation.

Decision: design the Client Portal as a secure web application that becomes the client-facing access point for project data, documents, and communication while keeping identity and session control on the server.

This blueprint solves three problems at once. It removes fragmented client access, it creates a clean boundary between internal systems and external users, and it defines exactly how authentication will work so execution does not depend on verbal explanation.

The system being designed is the Client Portal itself: a Next.js application that renders the user experience, handles authentication flows, manages secure sessions, and controls access to protected routes for authenticated clients.

---

## 3. Business Impact Summary

Why this matters: this initiative exists to reduce client friction, protect revenue, and lower operational overhead.

Decision: replace fragmented access methods with a single authenticated client portal backed by server-controlled sessions.

### Current Risks

- Clients do not have one reliable place to see project status, documents, and engagement context.
- File sharing is inconsistent across email, shared drives, and ad-hoc delivery methods.
- Internal systems do not have a clearly enforced external access boundary.
- Teams spend time answering repetitive status and document requests that a portal should answer directly.

### Business Consequences

- Clients experience avoidable confusion and delay because information is scattered.
- The business absorbs higher support cost for tasks that should be self-service.
- Security posture is weaker when access and file delivery are handled through inconsistent channels.
- The overall client experience looks less mature than the service being delivered.

### Expected Impact After Implementation

- Clients will use one secure entry point instead of multiple channels.
- Project visibility will improve through a single dashboard and controlled document access.
- Support load will decrease because current information becomes self-service.
- The business will present a more credible enterprise posture through clear access control and auditable session handling.

---

## 4. System Overview

Why this matters: the owner needs a simple model of what the portal is, who it serves, and where it sits in the product landscape.

Decision: position the Client Portal as the external-facing web application between clients and the company's protected project systems.

The Client Portal is a secure web application for clients. It is not an internal admin tool and it is not a generic file share. Its purpose is to give clients a branded, authenticated place to review their work, retrieve documents, and interact with the engagement without direct access to internal systems.

Primary users are client stakeholders who need trusted access to project information, and internal teams who need a controlled way to provide that access. In the system landscape, the portal sits at the front edge: the browser reaches the portal, the portal handles identity with Keycloak, and only the portal controls session state and access decisions.

### 5W1H Table

| What | Why | Who | When | Where | How |
| --- | --- | --- | --- | --- | --- |
| A secure client portal | To replace fragmented client access with one controlled entry point | Clients as end users; engineering, product, and operations as delivery owners | When a client needs status, documents, or authenticated access | In the browser, backed by the Next.js application and Keycloak | Through server-side authentication, opaque session cookies, and middleware enforcement |

---

## 5. Architecture Design

Why this matters: the owner needs to know how the system works at a business level and why this design is the approved implementation model.

Decision: keep the browser simple, keep secrets and tokens on the server, and make the portal responsible for authentication and access control.

### 5.1 High-Level Flow

```text
User (Client)
  -> Browser (Client Environment)
  -> Client Portal Frontend (Next.js UI Layer)
  -> Auth Routes (Server Entry Point)
  -> Middleware Enforcement Layer
  -> Keycloak Identity Provider
  -> Token Exchange Layer (Server-side)
  -> Session Store (Server-side)
  -> Protected Resource Layer
```

This flow is layered on purpose so each part of the system has one clear job and one clear risk boundary.

| Layer | What It Does | Why It Exists | Risk It Removes |
| --- | --- | --- | --- |
| User (Client) | Initiates login, views the dashboard, and signs out. | The portal must support a simple and safe client experience. | Removes the need for clients to use scattered channels such as email or shared drives for protected access. |
| Browser (Client Environment) | Displays the portal and sends requests to the application. | The browser is the user's access point, but not the place where trust decisions should live. | Removes the risk of turning the client device into the holder of reusable auth tokens. |
| Client Portal Frontend (Next.js UI Layer) | Presents login, dashboard, navigation, and user-facing messages. | The portal needs a single branded interface that clients can understand immediately. | Removes fragmented user journeys and inconsistent access paths. |
| Auth Routes (Server Entry Point) | Start login, handle callback, and execute logout. | The authentication journey needs controlled server-side entry points. | Removes the risk of exposing the client secret or leaving auth steps to browser code. |
| Middleware Enforcement Layer | Checks whether a request is allowed before protected content is shown. | Access control must happen before the user reaches protected pages. | Removes the risk of protected content loading before auth is validated. |
| Keycloak Identity Provider | Verifies identity and issues auth tokens to the server-side flow. | Identity needs to remain centralized instead of being rebuilt inside the portal. | Removes the risk of creating a custom identity system with inconsistent security behavior. |
| Token Exchange Layer (Server-side) | Exchanges the authorization code for tokens and refreshes tokens when needed. | The confidential client model requires server-side secret handling. | Removes the risk of placing sensitive token exchange logic in the browser. |
| Session Store (Server-side) | Stores tokens, expiry times, and user context behind an opaque session ID. | The portal needs durable session control without exposing auth data to the browser. | Removes the risk of token leakage through browser storage or readable cookies. |
| Protected Resource Layer | Serves dashboard and protected portal experiences only after session validation passes. | Business information must remain reachable only after successful authentication. | Removes the risk of unauthorized access to protected client information. |

The important operating rule is unchanged: the browser receives only an opaque session cookie, while identity validation, token handling, refresh, and revocation stay on the server.

### Business Interpretation

In plain terms, the client sees a simple portal, but the trust decisions happen behind the scenes in controlled layers. That matters because it lets the business offer a professional, secure login experience without asking the client's browser to hold sensitive credentials or tokens. Each layer exists to keep the client experience simple while keeping access control strict.

### 5.2 Detailed System Flow

The approved design keeps all authentication control inside the Next.js application. That matters because the portal uses a confidential client, which requires a server-side client secret that cannot be exposed in browser code.

| Layer | Approved Design | Why It Matters |
| --- | --- | --- |
| Frontend layer | The browser renders pages and triggers auth routes, but it never receives access tokens or refresh tokens. It stores only the short-lived `__state` cookie during login and the opaque `__session` cookie after authentication. | This reduces browser-side attack surface and keeps client devices from holding reusable tokens. |
| Auth layer | Keycloak remains the identity provider. The portal sends users to the Keycloak authorization endpoint, exchanges the returned code at the token endpoint, and uses the Keycloak logout endpoint to terminate SSO sessions. | Identity stays centralized, and the portal does not invent its own credential system. |
| Middleware enforcement | `middleware.ts` runs before protected pages render. It skips public routes and static assets, checks the session cookie, validates the server-side session, refreshes access tokens when allowed, and redirects unauthenticated users to `/login`. | Access control is enforced consistently before any protected content is shown. |
| Backend/API layer | In current scope, the backend responsibility is handled by the portal's own route handlers: `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, and the session-management logic behind them. | The system stays deployable as one application without adding a separate gateway or auth service. |
| State management | Session state lives server-side. Development uses an in-memory map. Production uses Redis. The stored session contains access token, refresh token, ID token, user claims, expiry timestamps, and creation time. | This keeps sensitive data off the browser while allowing refresh, logout, and revocation to be controlled centrally. |

#### Login Flow

The login flow begins when the user visits `/login` or is redirected there by middleware. The portal sends the user to `/api/auth/login`, generates a cryptographically random 32-byte hex `state` value, stores that value in a short-lived `__state` cookie, and redirects the browser to the Keycloak authorization endpoint with these required parameters:

| Parameter | Value | Purpose |
| --- | --- | --- |
| `client_id` | `client-portal-fe` | Identifies the portal to Keycloak |
| `redirect_uri` | `{APP_URL}/api/auth/callback` | Tells Keycloak where to return the authorization code |
| `response_type` | `code` | Uses Authorization Code flow |
| `scope` | `openid` | Requests OpenID Connect identity context |
| `state` | Random 32-byte hex value | Protects the login flow from CSRF |

#### Callback Flow

Keycloak returns the browser to `/api/auth/callback` with `code` and `state`. The portal reads the `__state` cookie and accepts the callback only if the query `state` matches the cookie value.

If the state is missing or invalid, the portal clears the `__state` cookie and redirects to `/login?error=invalid_state`. If the state is valid, the portal exchanges the code at the Keycloak token endpoint using the server-side client secret. Keycloak responds with `access_token`, `refresh_token`, `id_token`, `expires_in`, and `refresh_expires_in`.

The portal then creates a UUID v4 session ID, stores the tokens and user context in the server-side session store, sets the `__session` cookie, clears the `__state` cookie, and redirects the user to `/dashboard`.

#### Protected Request Flow

Every protected request passes through middleware. The middleware logic is fixed:

- Public routes pass through without auth checks.
- Static assets pass through without auth checks.
- If `__session` is missing, the request redirects to `/login`.
- If the cookie exists but no server-side session exists, the request redirects to `/login`.
- If the refresh token is expired, the session is deleted and the request redirects to `/login` or `/login?error=session_expired` depending on the request path and failure mode.
- If the access token is expired but the refresh token is still valid, the portal calls the Keycloak token endpoint with `grant_type=refresh_token`, updates the session, and continues the request.
- If the session is valid, the request proceeds normally.

#### Logout Flow

Logout is handled by `POST /api/auth/logout`. The portal reads the session ID, retrieves the stored ID token, deletes the server-side session, clears the `__session` cookie, and redirects the browser to the Keycloak logout endpoint with `id_token_hint` and `post_logout_redirect_uri={APP_URL}/login`. Keycloak then terminates the SSO session and returns the user to `/login`.

#### Security Decision

The frontend will not handle tokens directly. That is a deliberate business and security decision, not an implementation detail. Tokens will not be stored in browser memory, `localStorage`, `sessionStorage`, or readable cookies. The portal is the auth boundary because it is the only layer that can safely hold the client secret, perform refresh rotation, and revoke sessions immediately by deleting server-side session data.

---

## 6. Component Breakdown

Why this matters: delivery becomes predictable when each portal component has a single defined responsibility.

Decision: keep responsibilities narrow so authentication, layout, navigation, and protected content do not overlap in unclear ways.

| Component | Type | Responsibility |
| --- | --- | --- |
| Dashboard | Protected page | Presents the client's authenticated landing experience and project visibility after successful login. |
| Layout | Shared UI shell | Provides consistent page structure for auth and portal areas and separates public and protected user experiences. |
| Navigation | UI component | Gives authenticated users clear movement through the portal and exposes logout entry points. |
| Login page | Public page | Presents the SSO entry action and displays user-facing error messages for failed or expired auth flows. |
| Auth hook | Frontend hook | Supplies auth or session awareness to client-side behavior without exposing security tokens. |
| Middleware | Request guard | Enforces route protection, validates session presence, handles refresh checks, and redirects unauthenticated traffic. |
| Auth login route | API route handler | Generates the state value, stores the state cookie, and redirects the browser to Keycloak. |
| Auth callback route | API route handler | Validates state, exchanges the authorization code, creates the server-side session, and sets the session cookie. |
| Auth logout route | API route handler | Destroys the session, clears the session cookie, and initiates Keycloak logout. |
| Session store | Server-side service | Holds tokens, user claims, and expiry data; uses in-memory storage in development and Redis in production. |
| Keycloak integration module | Server-side service | Builds Keycloak URLs and executes token exchange, refresh, and logout interactions. |

---

## 7. Execution Plan

Why this matters: the document must tell the team exactly what to do next and in what order.

Decision: execute in one controlled branch with ordered pull requests so auth foundation is merged before dependent behavior.

### Execution Timeline

| Phase | Timeline | Outcome |
| --- | --- | --- |
| Phase 1 - Foundation | Start of execution | Identity environment, branch strategy, and runtime configuration are ready. |
| Phase 2 - Auth Implementation | After foundation is complete | Secure login, callback, logout, and session creation work end to end. |
| Phase 3 - Enforcement & UI | After auth implementation is stable | Protected routes, login messaging, dashboard access, and navigation behavior are fully connected. |
| Phase 4 - Validation | Final execution window before approval | The owner has clear evidence that the portal works securely in normal and failure scenarios. |

### Phase 1 - Foundation

| Step | Action | Owner | Output | Business Impact | Why It Matters |
| --- | --- | --- | --- | --- | --- |
| 1 | Create a dedicated feature branch from `main` for the client portal auth delivery. | Application Engineer | Isolated implementation branch with a single approved scope. | Protects delivery quality by keeping the portal work controlled and reviewable. | The owner should care because execution stays traceable and low-risk instead of mixing with unrelated changes. |
| 2 | Provision the Keycloak instance at a known URL. | Platform / Infrastructure | Reachable Keycloak environment. | Enables the identity system that all client access depends on. | Without this, the portal cannot authenticate users and cannot function as a secure client-facing system. |
| 3 | Create the `client-portal` realm. | Identity Admin | Realm available for portal configuration. | Creates the business boundary that separates portal identity from other systems. | The owner should care because this establishes the controlled access space clients will actually use. |
| 4 | Create the `client-portal-fe` confidential client and generate the client secret. | Identity Admin | Client ID and secret ready for server-side use. | Unlocks secure server-side authentication for the portal. | Without this step, the application cannot safely complete login or token exchange. |
| 5 | Apply Keycloak client settings, redirect URIs, logout URIs, token TTLs, and create a test user. | Identity Admin | Identity configuration matches the blueprint and is ready for verification. | Ensures the login flow behaves predictably and can be tested before go-live. | The owner should care because correct identity configuration prevents broken sign-in, broken logout, and avoidable support incidents. |
| 6 | Add the required environment variables to the Next.js application. | Application Engineer | Runtime configuration resolves correctly in the portal. | Connects the application to the approved identity environment. | Without correct configuration, the portal cannot reach the right auth endpoints and cannot be validated. |

### Phase 2 - Auth Implementation

| Step | Action | Owner | Output | Business Impact | Why It Matters |
| --- | --- | --- | --- | --- | --- |
| 7 | Open PR 1 for the auth foundation: `lib/auth/keycloak.ts`, `lib/auth/session.ts`, and related configuration support. | Application Engineer + Reviewer | Reusable auth foundation merged first. | Establishes the security core that every later portal action depends on. | The owner should care because this is the point where the portal gains a stable and repeatable auth backbone instead of one-off logic. |
| 8 | Open PR 2 for the auth routes: `/api/auth/login`, `/api/auth/callback`, and `/api/auth/logout`. | Application Engineer + Reviewer | End-to-end login, callback, and logout behavior available. | Unlocks the actual sign-in and sign-out experience the client will use. | This matters because the portal is not usable until the full login journey works from start to finish. |

### Phase 3 - Enforcement & UI

| Step | Action | Owner | Output | Business Impact | Why It Matters |
| --- | --- | --- | --- | --- | --- |
| 9 | Open PR 3 for enforcement and UI integration: `middleware.ts`, login error display, dashboard protection, and navigation or logout integration. | Application Engineer + Reviewer | Protected portal experience wired into the UI. | Turns the auth system into a usable and controlled client experience. | The owner should care because this is where secure access becomes visible in the product, not just in backend logic. |

### Phase 4 - Validation

| Step | Action | Owner | Output | Business Impact | Why It Matters |
| --- | --- | --- | --- | --- | --- |
| 10 | Validate the full login flow in the browser and confirm session creation, cookie behavior, and redirect destinations. | Application Engineer / QA | Working authenticated portal entry. | Proves that a real client can sign in and reach the portal successfully. | This matters because go-live confidence requires evidence, not assumptions, that the main user path works. |
| 11 | Validate failure cases: expired session, tampered state, token exchange failure, and logout. | Application Engineer / QA | Auth error handling and cleanup confirmed. | Confirms the system behaves safely when something goes wrong. | The owner should care because secure failure handling protects trust, reduces support risk, and prevents partial or confusing login states. |
| 12 | Merge in order: PR 1 -> PR 2 -> PR 3, then complete release-readiness review. | Tech Lead / Product Owner | Controlled rollout with clear evidence that the implementation matches the blueprint. | Converts completed work into a release decision with visible controls and accountability. | This matters because the owner needs a clean approval point before client-facing rollout. |

The integration order is fixed. Foundation merges before routes, routes merge before middleware and UI enforcement, and validation happens before release approval.

---

## Success Criteria

Why this matters: the owner needs a simple definition of what “done” looks like from the outside.

Decision: treat the portal as successful only when the client-facing auth experience works cleanly in normal use.

- A user can log in successfully and reach the dashboard.
- A secure session is created and persists correctly during normal use.
- Protected routes are inaccessible without authentication.
- Logout fully destroys the session and returns the user to a signed-out state.
- No authentication errors appear during the normal login-to-logout flow.

### Interpretation

The owner can verify success without reading code. Using a test account, the user should be able to sign in, stay signed in while navigating normal protected pages, be blocked from protected pages when signed out, and fully lose access again after logout. If those visible outcomes are true and the normal flow shows no auth errors, the blueprint has been delivered successfully.

---

## Operational Checklist

Why this matters: go-live readiness should be checked by a repeatable list, not by memory or verbal confirmation.

Decision: use one operational checklist for QA validation and release readiness.

- [ ] Keycloak reachable
- [ ] Environment variables correct
- [ ] Login flow verified
- [ ] Session creation verified
- [ ] Token refresh verified
- [ ] Logout verified
- [ ] Error scenarios tested

### Usage

This checklist is used for go-live readiness and QA validation. It provides a simple release control so the team can confirm that identity, configuration, user flow, session behavior, refresh behavior, logout, and failure handling have all been proven before approval.

---

## Execution Priority

Why this matters: the owner needs to know what is mandatory now, what comes next, and what can wait.

Decision: sequence work by business dependency, not by technical preference.

| Priority | Scope | Description |
| --- | --- | --- |
| P0 | Auth system | Mandatory work that blocks everything else: identity setup, auth routes, token exchange, session creation, logout, and middleware enforcement. |
| P1 | UI integration | Required work that makes the secure system usable for clients: login messaging, dashboard protection, navigation behavior, and sign-out entry points. |
| P2 | Enhancements / scaling | Follow-on work after the core portal is working, such as broader portal expansion and production scaling refinements already anticipated by the design. |

### Interpretation

In business terms, P0 is the gate to having a functioning portal at all. P1 is what turns that secure core into a product clients can actually use with confidence. P2 matters, but it does not block initial approval or first release. This sequencing protects the business from spending effort on polish or expansion before secure access is proven.

---

## 8. Engineering Effort & Scope

Why this matters: the owner needs a realistic view of implementation size and what is deliberately excluded.

Decision: treat this as a bounded, moderate effort focused on secure access, not as a broad platform rebuild.

### Effort Table

| Workstream | Included Scope | Effort |
| --- | --- | --- |
| Keycloak provisioning and configuration | Realm, client, secret, redirect URIs, token TTLs, test user | Medium |
| Auth foundation | Keycloak helpers, session store, env wiring | Medium |
| Auth route implementation | Login, callback, logout route handlers | Medium |
| Middleware enforcement | Protected-route checks, session validation, refresh path | Medium |
| UI integration | Login page messaging, dashboard protection, navigation and logout behavior | Low to Medium |
| Validation | Browser flow, session-expiry checks, CSRF or state rejection, logout verification | Medium |

Overall effort is moderate because the work is concentrated in one application and one identity provider. It does not require a separate backend gateway, a custom identity store, or browser token management.

### Phase Breakdown

| Phase | Focus | Outcome |
| --- | --- | --- |
| Phase 1 | Identity setup | Keycloak is reachable and configured to the required contract. |
| Phase 2 | Auth foundation | The portal can build Keycloak requests and store sessions safely on the server. |
| Phase 3 | Route and middleware integration | Users can sign in, receive a server-side session, reach protected pages, and sign out. |
| Phase 4 | Validation and release review | Success and failure scenarios are confirmed before rollout. |

### Scope Boundaries

In scope:

- Single sign-on through Keycloak for the client portal
- Server-side token exchange, refresh, and logout
- Opaque session cookies and server-side session storage
- Middleware-based route protection
- Login, dashboard access, and logout flow validation

Out of scope:

- Token storage in browser `localStorage`, `sessionStorage`, or readable cookies
- Direct Keycloak calls from browser JavaScript
- PKCE for this confidential-client flow
- A separate backend or API gateway for authentication
- A custom local identity store
- Token introspection on every request
- Multi-realm auth support
- Social login providers
- Client self-registration

---

## 9. Risks & Mitigation

Why this matters: only operational risks that can affect delivery or production behavior belong here.

Decision: manage runtime and rollout risk through explicit configuration, server-side session control, and ordered validation.

| Risk | Mitigation |
| --- | --- |
| Keycloak is unreachable during login or callback | Return the user to `/login?error=service_unavailable` for login paths, avoid automatic retries, and alert operations to restore identity service. |
| Redirect URIs or environment variables are misconfigured | Configure exact environment values before implementation testing and validate against the Keycloak well-known and client settings before release. |
| In-memory session storage is used in production | Use Redis in production so sessions survive restarts and multiple instances. |
| Session expiry creates broken access behavior | Middleware deletes expired sessions, clears cookies when required, and sends the user back through login with an explicit expired-session message. |
| Stale or tampered state values block login | Clear the `__state` cookie, redirect to `/login?error=invalid_state`, and let the user restart the flow safely. |
| Auth changes are merged out of order | Use the branch and PR sequence in Section 7 so foundation changes land before route and UI dependencies. |

---

## 10. Scaling & Future Evolution

Why this matters: the owner needs to know whether this design supports growth without rewriting the foundation.

Decision: use a small, secure auth boundary now that can expand later without changing the core security model.

This system evolves cleanly because the browser never owns tokens. As the portal expands beyond the initial dashboard, additional protected pages and future business-data integrations can sit behind the same session boundary. The portal remains the server-side control point, so new features inherit the same login, refresh, and logout behavior.

The design is already prepared for the expected scaling path:

- Development uses an in-memory session map for speed and simplicity.
- Production uses Redis so sessions survive restarts and support horizontal scaling.
- Keycloak remains the single identity provider, so branding changes, role evolution, and additional provider options can be managed through the identity layer without changing the browser security model.
- If the portal later calls additional backend services, those calls can be made from the server side behind the existing session boundary rather than moving tokens into the browser.

This blueprint is intentionally not a multi-realm or multi-provider platform design. It creates a reliable starting point for a single portal, a single realm, and controlled future expansion.

---

## 11. Final Decision

Why this matters: this section states the approval decision in plain language and closes off ambiguous alternatives.

Decision: proceed with the Client Portal as a Next.js application that serves both the client experience and the server-side auth boundary, with Keycloak as the identity provider and server-controlled sessions as the access model.

### Decision Framing

This is not only a technical implementation choice. It is an operational and security boundary decision about how the business allows clients to enter a protected environment.

It defines where trust lives, where identity is verified, where sessions are controlled, and where access can be revoked. In practical business terms, it defines how clients access the business in a secure, professional, and auditable way.

Choosing this model means the company is deliberately deciding that client access must be governed by server-side controls rather than browser convenience. That is the correct boundary because the portal is not just a website. It is the front door to protected client relationships, project visibility, and document access.

### Why This Approach

This approach gives the business one deployable application that handles both the portal UI and the required authentication control point. It keeps the client secret off the browser, keeps tokens off the browser, and enforces protected access before any page renders. That makes it secure enough for production without introducing a second gateway or a custom auth service.

### Why Now

The current operating model already creates visible business drag. Clients depend on fragmented channels, support teams absorb repetitive requests, and the company lacks a single professional access experience. The portal addresses those issues directly with a bounded implementation that is ready for execution now.

### Why Not Alternatives

Browser-held tokens are rejected because they increase XSS and replay exposure. Direct browser calls to Keycloak are rejected because the confidential client secret must stay server-side. PKCE is not chosen because this is not a public-client design. A separate backend gateway is not chosen because the Next.js application already provides the required auth orchestration. A local identity store is not chosen because Keycloak is the single source of identity. Token introspection on every request is not chosen because session lookup is sufficient for this design. Multi-realm, social login, and self-registration are not part of the approved MVP scope.

---

## 12. Decision Confidence

Why this matters: the owner needs a direct view of how strong the current decision is across business, security, and delivery.

Decision: confidence is high enough to execute immediately, with the remaining caution limited to standard operational readiness items.

| Factor | Confidence |
| --- | --- |
| Business problem fit | High |
| Security model clarity | High |
| Architecture appropriateness | High |
| Implementation determinism | High |
| Operational readiness | Medium |
| Scaling path | Medium to High |

Operational readiness is the only factor below fully high confidence because production success depends on correct Keycloak provisioning, environment configuration, and Redis use in production.

---

## Appendix A: Operational Auth Contract

### Route Contract

| Route | Type | Access | Action | Output |
| --- | --- | --- | --- | --- |
| `GET /login` | Page | Public | Render login UI with the SSO action | Redirect authenticated users to `/dashboard` |
| `GET /api/auth/login` | Route handler | Public | Generate state, set `__state`, redirect to Keycloak | `302` redirect to Keycloak authorization endpoint |
| `GET /api/auth/callback` | Route handler | Public with state validation | Validate state, exchange code, create session | `302` redirect to `/dashboard` or `/login?error=...` |
| `POST /api/auth/logout` | Route handler | Authenticated | Destroy session, clear cookie, redirect to Keycloak logout | `302` redirect to Keycloak logout endpoint |
| `GET /dashboard` | Page | Protected | Render dashboard with user context | Middleware redirects unauthenticated users to `/login` |

### Cookie Specification

| Property | `__session` | `__state` |
| --- | --- | --- |
| Purpose | Opaque session identifier | CSRF protection during login |
| Value | UUID v4 session ID | Random 32-byte hex value |
| HttpOnly | `true` | `true` |
| Secure | `true` | `true` |
| SameSite | `Strict` | `Strict` |
| Path | `/` | `/` |
| Max-Age | `1800` seconds | `300` seconds |

### Session Storage Contract

The browser stores only the opaque session ID. The server-side session store holds the actual auth state:

```text
session_id -> {
  access_token,
  refresh_token,
  id_token,
  user,
  access_expires,
  refresh_expires,
  created_at
}
```

### Token Lifecycle

| Token | TTL | Storage | Exposed to Browser |
| --- | --- | --- | --- |
| `access_token` | 300 seconds | Server session store | Never |
| `refresh_token` | 1800 seconds | Server session store | Never |
| `id_token` | Stored for logout | Server session store | Never |
| `session_id` | 1800 seconds | HttpOnly cookie | Yes, as an opaque value only |

### Security Controls

The CSRF state check works because the browser must return both the query `state` value and the matching `__state` cookie. The value is cryptographically random, the cookie is HttpOnly, and `SameSite=Strict` prevents the normal cross-site replay pattern.

| Control | Implementation |
| --- | --- |
| No browser token storage | Tokens never enter `localStorage`, `sessionStorage`, or browser-managed auth state. |
| HttpOnly cookies | `__session` and `__state` cannot be read by browser JavaScript. |
| Server-side token storage | Access, refresh, and ID tokens remain in Node.js process memory or Redis. |
| Content Security Policy | `default-src 'self'; script-src 'self'` |
| React auto-escaping | Rendered UI benefits from default escaping behavior against straightforward reflected XSS. |

```text
Browser knows: session_id only
Server knows: access_token, refresh_token, id_token, user claims, and expiry timestamps
```

### Middleware Logic

```text
1. Allow public routes.
2. Allow static assets.
3. Read `__session`.
4. If missing, redirect to `/login`.
5. Look up the session in the store.
6. If missing, redirect to `/login`.
7. If `refresh_expires` is past, delete the session and redirect to `/login`.
8. If the access token is expired but refresh is valid, refresh via Keycloak and update the session.
9. If valid, continue the request.
```

### Matcher Configuration

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## Appendix B: Keycloak Configuration

### Realm

| Setting | Value |
| --- | --- |
| Realm name | `client-portal` |
| Display name | Client Portal |
| Login theme | Default |
| Access token TTL | 300 seconds |
| Refresh token TTL | 1800 seconds |
| SSO session idle | 1800 seconds |
| SSO session max | 36000 seconds |

### Client Configuration

| Setting | Value |
| --- | --- |
| Client ID | `client-portal-fe` |
| Client protocol | `openid-connect` |
| Access type | `confidential` |
| Standard flow enabled | `ON` |
| Implicit flow enabled | `OFF` |
| Direct access grants enabled | `OFF` |
| Service accounts enabled | `OFF` |
| Valid redirect URIs | `https://{APP_DOMAIN}/api/auth/callback` |
| Valid post-logout redirect URIs | `https://{APP_DOMAIN}/login` |
| Web origins | `https://{APP_DOMAIN}` |
| Root URL | `https://{APP_DOMAIN}` |
| Admin URL | Empty |
| Base URL | `/` |

### Development Overrides

| Setting | Dev Value |
| --- | --- |
| Valid redirect URIs | `http://localhost:3000/api/auth/callback` |
| Valid post-logout redirect URIs | `http://localhost:3000/login` |
| Web origins | `http://localhost:3000` |

### Client Secret Decision

- Keycloak generates the client secret.
- The portal stores it as `KEYCLOAK_CLIENT_SECRET`.
- The secret is never committed to source control.
- The secret is never sent to the browser.

---

## Appendix C: Error Handling, Environment, and URLs

### Error Handling Contract

| Error | Trigger | Redirect or Response | Log Level | User Message | Required Action |
| --- | --- | --- | --- | --- | --- |
| Invalid state | Missing or mismatched `state` value | `302` to `/login?error=invalid_state` | WARN | `Login session expired. Please try again.` | Clear `__state`; do not create a session |
| Token exchange failure | Keycloak returns non-200 during code exchange | `302` to `/login?error=auth_failed` | ERROR | `Authentication failed. Please try again.` | Clear `__state`; do not create a session |
| Expired session | Refresh token expired or refresh fails | `302` to `/login?error=session_expired` | INFO | `Your session has expired. Please sign in again.` | Delete the session and clear `__session` |
| Keycloak unreachable | Network timeout or connection failure | `302` to `/login?error=service_unavailable` for login paths, or `503` for affected API routes | CRITICAL | `Service temporarily unavailable. Please try again later.` | Do not modify the session; alert operations; do not retry automatically on auth paths |

### Login Error Display

```text
error=invalid_state -> Login session expired. Please try again.
error=auth_failed -> Authentication failed. Please try again.
error=session_expired -> Your session has expired. Please sign in again.
error=service_unavailable -> Service temporarily unavailable. Please try again later.
```

### Environment Variables

```env
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=client-portal
KEYCLOAK_CLIENT_ID=client-portal-fe
KEYCLOAK_CLIENT_SECRET=<from-keycloak-admin>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### URL Reference

| Endpoint | Full URL |
| --- | --- |
| Keycloak authorization | `{KEYCLOAK_URL}/realms/client-portal/protocol/openid-connect/auth` |
| Keycloak token | `{KEYCLOAK_URL}/realms/client-portal/protocol/openid-connect/token` |
| Keycloak logout | `{KEYCLOAK_URL}/realms/client-portal/protocol/openid-connect/logout` |
| Keycloak well-known | `{KEYCLOAK_URL}/realms/client-portal/.well-known/openid-configuration` |
| App login | `{APP_URL}/login` |
| App auth login | `{APP_URL}/api/auth/login` |
| App auth callback | `{APP_URL}/api/auth/callback` |
| App auth logout | `{APP_URL}/api/auth/logout` |

---

## Appendix D: Exact Token Requests

### Token Exchange Request

```http
POST /realms/client-portal/protocol/openid-connect/token HTTP/1.1
Host: {KEYCLOAK_HOST}
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={AUTH_CODE}&redirect_uri={APP_URL}%2Fapi%2Fauth%2Fcallback&client_id=client-portal-fe&client_secret={CLIENT_SECRET}
```

### Token Refresh Request

```http
POST /realms/client-portal/protocol/openid-connect/token HTTP/1.1
Host: {KEYCLOAK_HOST}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={REFRESH_TOKEN}&client_id=client-portal-fe&client_secret={CLIENT_SECRET}
```

---

*End of blueprint. This document is the single source of truth for Client Portal authentication architecture and execution. Implementation must conform to these decisions.*