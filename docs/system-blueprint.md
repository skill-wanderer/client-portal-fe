# Client Portal — System Blueprint

**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Draft  
**Author:** Staff Engineering

---

## 1. Executive Summary

### What is the Client Portal?

The Client Portal is a secure, web-based platform where clients can log in, view their project status, access shared documents, and communicate with the team — all in one place.

It replaces fragmented communication (emails, shared drives, scattered links) with a single, branded access point.

### Business Value

| Value Lever | Description |
|-------------|-------------|
| Client retention | Self-service reduces friction and improves satisfaction |
| Premium positioning | A branded portal signals professionalism and operational maturity |
| Operational efficiency | Fewer support requests, centralized document delivery |
| Security posture | Controlled access replaces ad-hoc file sharing |

### Core User Journeys

1. **Client signs in** → redirected to SSO → lands on dashboard
2. **Client views project status** → sees summary cards, key metrics
3. **Client accesses documents** → downloads/views shared files securely
4. **Client sends a message** → submits a request or question (future)

---

## 2. Stakeholder Alignment

### Business Owner

| Goal | Constraint |
|------|-----------|
| Ship a functional portal within weeks, not months | Budget-conscious — minimal infrastructure |
| Differentiate service offering | Must not require client training |
| Maintain security standards | Cannot expose internal systems |

### Client

| Expectation | Acceptable Tradeoff |
|-------------|-------------------|
| Instant access to their data | Limited to assigned content only |
| Simple, fast login | SSO redirect (no password to remember) |
| Professional, stable experience | Feature set grows incrementally |

### Developer

| Constraint | Mitigation |
|-----------|-----------|
| Small team / limited bandwidth | Minimal scope, modular architecture |
| Must be maintainable long-term | Clean separation, typed contracts |
| Auth complexity (Keycloak) | Adapter pattern — isolate integration |

---

## 3. MVP Scope Definition

### Included (MVP)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Authentication (SSO)** | Keycloak-based redirect login, session management, secure logout |
| 2 | **Dashboard** | Personalized landing page with project summary and status |
| 3 | **Document Access** | View and download files assigned to the client |
| 4 | **Communication Placeholder** | Static UI indicating future messaging capability |

### Excluded (Post-MVP)

| Feature | Reason |
|---------|--------|
| Real-time messaging | Requires WebSocket infrastructure, out of scope |
| Admin panel | Internal tool, separate deployment |
| Billing/invoicing | Third-party integration, separate workstream |
| Multi-language support | Premature optimization |
| Mobile native app | Web-first, responsive design sufficient |
| Notification system | Requires backend event infrastructure |
| File upload (client → team) | Security review needed, deferred |

---

## 4. System Architecture

### Component Responsibilities

```
┌─────────────────────────────────────────────────────────┐
│                      BROWSER                             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Next.js Frontend                      │  │
│  │                                                   │  │
│  │  • UI rendering (React Server Components + CSR)   │  │
│  │  • Route protection (middleware)                  │  │
│  │  • Token management (memory + httpOnly cookie)    │  │
│  │  • API call orchestration                         │  │
│  └──────────────────┬──────────────┬─────────────────┘  │
│                     │              │                     │
└─────────────────────┼──────────────┼─────────────────────┘
                      │              │
          ┌───────────▼───┐    ┌─────▼──────────┐
          │   Keycloak    │    │  Backend API   │
          │   (Auth)      │    │  (Future)      │
          │               │    │                │
          │  • Identity   │    │  • Data layer  │
          │  • SSO        │    │  • Business    │
          │  • Tokens     │    │    logic       │
          │  • Roles      │    │  • File store  │
          └───────────────┘    └────────────────┘
```

### Auth Flow (Sequence)

```
User          Frontend           Keycloak            Backend API
 │                │                  │                    │
 │─── visit /dashboard ──▶│         │                    │
 │                │                  │                    │
 │                │── no session ──▶ │                    │
 │                │   redirect       │                    │
 │                │                  │                    │
 │◀── login page ─────────────────── │                    │
 │                │                  │                    │
 │─── credentials ──────────────────▶│                    │
 │                │                  │                    │
 │◀── redirect + auth code ───────── │                    │
 │                │                  │                    │
 │─── callback ──▶│                  │                    │
 │                │── exchange code ─▶│                    │
 │                │◀── tokens ─────── │                    │
 │                │                  │                    │
 │                │── API call + Bearer token ──────────▶ │
 │                │◀── data ──────────────────────────── │
 │                │                  │                    │
 │◀── render ──── │                  │                    │
```

### Frontend Responsibilities

- Render UI (server and client components)
- Enforce route protection via middleware
- Manage auth state (tokens in memory, session cookie for SSR)
- Call backend APIs with Bearer token
- Handle loading, error, and unauthorized states

### Frontend Limitations

- Does NOT store business data
- Does NOT implement business logic beyond UI orchestration
- Does NOT directly access databases
- Does NOT manage user identity (delegated to Keycloak)

### Backend Assumptions (Future)

- REST or GraphQL API
- Stateless — validates JWT on every request
- Owns data persistence (files, project data)
- Returns scoped data based on token claims (client ID, roles)

---

## 5. Auth Design

### Login Flow

| Step | Action |
|------|--------|
| 1 | User navigates to any protected route |
| 2 | Middleware detects no valid session |
| 3 | Redirect to `/login` |
| 4 | User clicks "Continue with SSO" |
| 5 | Frontend redirects to Keycloak authorization endpoint |
| 6 | User authenticates (credentials, MFA if configured) |
| 7 | Keycloak redirects back with authorization code |
| 8 | Frontend exchanges code for tokens (server-side) |
| 9 | Session established, user lands on `/dashboard` |

### Session Handling Strategy

| Concern | Approach |
|---------|----------|
| Access token storage | In-memory (client-side) — never in localStorage |
| Session persistence | httpOnly, Secure, SameSite=Strict cookie (server-side) |
| Token refresh | Silent refresh via Keycloak refresh token |
| SSR session | Cookie-based session checked in middleware |
| Session expiry | Configurable TTL aligned with Keycloak session |

### Token Storage (Security)

```
❌ localStorage    → XSS vulnerable
❌ sessionStorage  → XSS vulnerable
✅ httpOnly cookie → Not accessible via JS, sent automatically
✅ In-memory       → Cleared on tab close, not persisted
```

The access token is held in memory for API calls. The session cookie (opaque, not the JWT itself) is used for SSR route protection.

### Protected Routes Behavior

| State | Behavior |
|-------|----------|
| No session | Redirect to `/login` |
| Expired session | Attempt silent refresh → if fails, redirect to `/login` |
| Valid session | Allow access, render page |
| Insufficient role | Render 403 or redirect to dashboard |

### Logout Flow

| Step | Action |
|------|--------|
| 1 | User clicks logout |
| 2 | Clear client-side auth state |
| 3 | Clear session cookie |
| 4 | Redirect to Keycloak logout endpoint (ends SSO session) |
| 5 | Keycloak redirects back to `/login` |

---

## 6. Route Structure

| Route | Access | Layout | Purpose |
|-------|--------|--------|---------|
| `/` | Public | — | Redirects to `/dashboard` |
| `/login` | Public | Auth (centered, no nav) | SSO entry point |
| `/dashboard` | Protected | Portal (nav shell) | Primary landing page |
| `/files` | Protected | Portal | Document browser (future) |
| `/messages` | Protected | Portal | Communication (future) |

### Route Groups

```
app/
├── (auth)/          # Public routes — no navigation chrome
│   └── login/
└── (portal)/        # Protected routes — full app shell
    ├── dashboard/
    ├── files/       (future)
    └── messages/    (future)
```

### Middleware Decision Matrix

```
Request to protected route?
├── YES → Has valid session?
│         ├── YES → NextResponse.next()
│         └── NO  → redirect(/login)
└── NO  → NextResponse.next()
```

---

## 7. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Keycloak misconfiguration | Medium | High — login broken entirely | Validate config at startup, fail fast with clear errors |
| Token expiry during session | High | Medium — broken API calls | Silent refresh with retry logic, graceful fallback to login |
| CORS issues between FE and Keycloak | Medium | High — auth flow blocked | Explicit allowed-origins in Keycloak realm settings |
| Client bookmarks protected URL | High | Low — expected behavior | Middleware redirects to login, post-auth redirect back to original URL |
| XSS leading to token theft | Low | Critical | httpOnly cookies, CSP headers, no token in localStorage |
| Keycloak downtime | Low | Critical — no login possible | Health check endpoint, graceful error page, monitoring alert |
| Client shares their session URL | Medium | Low | Sessions are per-browser, URL alone grants no access |
| Stale token used after role change | Low | Medium | Short token TTL (5 min), refresh pulls updated claims |

---

## 8. Trade-offs

### Why Next.js?

| Factor | Reasoning |
|--------|-----------|
| Server Components | Secure token handling without exposing to client bundle |
| Middleware | Route protection at edge, before page renders |
| File-system routing | Predictable, scalable route structure |
| React ecosystem | Component reuse, hiring pool, community |
| Vercel/self-host | Deployment flexibility |

**Alternative considered:** SPA (Vite + React)  
**Rejected because:** No server-side session, no middleware, token handling is less secure in pure SPA.

### Why Keycloak?

| Factor | Reasoning |
|--------|-----------|
| Open source | No per-user licensing cost |
| Battle-tested | Used in enterprise environments globally |
| Protocol support | OIDC, SAML — future-proof |
| Role/group management | Fine-grained access without custom code |
| Federation | Can connect to existing client identity providers |

**Alternative considered:** Auth0, Clerk  
**Rejected because:** Vendor lock-in, per-MAU pricing scales poorly, less control over configuration.

### Why Modular Architecture?

| Factor | Reasoning |
|--------|-----------|
| Team scaling | New developer onboards to one module, not entire codebase |
| Feature isolation | File module bug doesn't break dashboard |
| Testability | Each module is independently testable |
| Replaceability | Swap auth provider without touching UI code |

---

## 9. Execution Plan

| Phase | Step | Status | Dependencies |
|-------|------|--------|-------------|
| 1 | Frontend skeleton (Next.js, TS, Tailwind) | ✅ Done | — |
| 2 | Keycloak instance provisioning | Pending | Infrastructure |
| 3 | Auth adapter implementation (`lib/auth/`) | Pending | Phase 2 |
| 4 | Middleware enforcement (redirect on no session) | Pending | Phase 3 |
| 5 | Protected route testing (login → dashboard flow) | Pending | Phase 4 |
| 6 | Dashboard page (static layout + mock data) | Pending | Phase 4 |
| 7 | Backend API stub (file listing endpoint) | Pending | API team |
| 8 | File/document module (list, download) | Pending | Phase 7 |
| 9 | Communication placeholder UI | Pending | Phase 6 |
| 10 | Production hardening (CSP, error boundaries, monitoring) | Pending | Phase 8 |

### Critical Path

```
Keycloak provisioning → Auth adapter → Middleware → Everything else
```

Nothing ships to clients until the auth path is proven end-to-end.

---

## 10. Non-Goals

The following are **explicitly out of scope** for this project phase:

| Non-Goal | Reason |
|----------|--------|
| Custom identity provider | Keycloak handles identity — we do not build our own |
| Backend development | Separate workstream, separate team/timeline |
| Email notifications | Requires event system and email infrastructure |
| Analytics/tracking | Not a priority for MVP, can be layered later |
| Theming/white-label | Single brand for now, theming adds complexity |
| Offline support | Portal requires network, no service worker needed |
| Native mobile apps | Responsive web is sufficient for MVP |
| Client self-registration | Clients are provisioned by admin, not self-serve |
| Payment processing | Not a portal concern |
| A/B testing | Premature for initial release |
| Internationalization (i18n) | Single-language MVP |

---

## Appendix: Key Interfaces (Reference)

These TypeScript interfaces define the system contracts. Implementation details change; contracts remain stable.

```typescript
// Domain
interface User {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

interface Session {
  user: User;
  accessToken: string;
  expiresAt: number;
}

// Auth adapter contract
interface AuthAdapter {
  init(): Promise<void>;
  login(): Promise<void>;
  logout(): Promise<void>;
  getSession(): Promise<Session | null>;
  refreshToken(): Promise<string | null>;
}

// Auth context (React)
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}
```

---

*End of document.*
