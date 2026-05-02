# System Observation — Step 1.1

## 1. Executive Summary

The current repository implements a Next.js application with a public `/login` page, a protected `/dashboard` page, and auth handlers under `/api/auth/*`. Login starts at `/api/auth/login`, which creates or reuses a `__state` cookie and redirects the browser to Keycloak; callback handling then exchanges the authorization code, stores tokens and user data in an in-memory server-side map, and redirects through `/api/auth/session-init` before the browser receives `__session`. Protected requests are enforced in `middleware.ts` by checking the `__session` cookie, resolving the matching server-side session, and rejecting sessions whose `refreshExpiresAt` is already in the past. Logout deletes local session state when a server-side session record exists, but the missing-session fallback path attempts to construct `new URL("/login")`, which is not a valid relative `URL` construction in Node.

## 2. System Boundary

### 2.1 Entry Points

| Entry Point | Type | File | Description |
| ----------- | ---- | ---- | ----------- |
| `/` | Browser route | `app/page.tsx` | Root request immediately redirects to `/dashboard`, so the dashboard path becomes the effective default landing route. Evidence: `app/page.tsx:1-5`. |
| `/login` | Browser route | `app/(auth)/login/page.tsx` | Public login page renders error text from `searchParams.error` and exposes a direct anchor to `/api/auth/login`. Evidence: `app/(auth)/login/page.tsx:4-17`, `app/(auth)/login/page.tsx:30-39`. |
| `/dashboard` | Browser route | `app/(portal)/dashboard/page.tsx`, `app/(portal)/layout.tsx` | Protected dashboard renders static content and shared navigation; route protection is not implemented in the page itself. Evidence: `app/(portal)/dashboard/page.tsx:5-15`, `app/(portal)/layout.tsx:5-15`. |
| `/api/auth/login` | API route (GET) | `app/api/auth/login/route.ts` | Starts auth by reading `__state`, generating a random state when absent, setting the cookie, and redirecting to the Keycloak authorization URL. Evidence: `app/api/auth/login/route.ts:13-34`. |
| `/api/auth/callback` | API route (GET) | `app/api/auth/callback/route.ts` | Accepts Keycloak callback parameters, validates state, exchanges code for tokens, stores the server-side session, clears `__state`, and redirects to `/api/auth/session-init`. Evidence: `app/api/auth/callback/route.ts:16-75`. |
| `/api/auth/session-init` | API route (GET) | `app/api/auth/session-init/route.ts` | Reads `sid` from the query string, sets `__session`, and redirects to `/dashboard`. Evidence: `app/api/auth/session-init/route.ts:5-21`. |
| `/api/auth/logout` | API route (POST) | `app/api/auth/logout/route.ts` | Attempts local session lookup and deletion, clears `__session`, and redirects either to Keycloak logout or to a `/login` fallback path. Evidence: `app/api/auth/logout/route.ts:12-31`. |
| Matched non-static requests | Middleware | `middleware.ts` | Runs before matched requests, bypasses `/login` and `/api/auth*`, then enforces `__session` existence, server-side session lookup, and refresh-expiry cutoff. Evidence: `middleware.ts:6-58`. |
| `npm run dev` | Dev server | `package.json` | Starts the standard Next.js development server with `next dev`. Evidence: `package.json:5-10`. |
| `npm run dev:https` | Dev server | `package.json`, `server.js` | Starts an Express HTTPS wrapper around Next.js, serves on port `3000`, and redirects `localhost` requests to `https://client-portal.test:3000`. Evidence: `package.json:5-10`, `server.js:8-38`. |

### 2.2 Auth Boundary

- Authentication starts on the public `/login` page, where the only sign-in action is an anchor to `/api/auth/login`; the route handler then constructs the Keycloak authorization redirect. Evidence: `app/(auth)/login/page.tsx:15-39`, `app/api/auth/login/route.ts:13-34`, `lib/auth/keycloak.ts:11-20`.
- Authentication is verified in `/api/auth/callback`, which requires both `code` and `state`, reads `__state` from cookies, and compares the stored cookie value with the callback query value before calling `exchangeCode`. Evidence: `app/api/auth/callback/route.ts:17-47`.
- The server-side session record is created in `/api/auth/callback` by generating `randomUUID()`, then storing tokens, user data, and expiry timestamps in `sessionStore`. The browser session cookie is not created there; it is created later by `/api/auth/session-init`. Evidence: `app/api/auth/callback/route.ts:50-74`, `app/api/auth/session-init/route.ts:12-19`, `lib/auth/session.ts:18-32`, `types/index.ts:18-25`.
- Session enforcement is implemented in `middleware.ts`, which bypasses `/login` and `/api/auth*`, then checks `__session`, loads the session from the store, and rejects sessions whose `refreshExpiresAt` is older than the current Unix timestamp. Evidence: `middleware.ts:7-52`.

## 3. Layer Mapping (CRITICAL)

| Layer | Files | Responsibility |
| ----- | ----- | -------------- |
| UI Layer | `app/(auth)/login/page.tsx`, `app/(auth)/layout.tsx`, `app/(portal)/dashboard/page.tsx`, `app/(portal)/layout.tsx`, `components/navigation.tsx` | Renders the public login experience, the protected dashboard shell, and navigation. The login page consumes `error` query state and sends the user into `/api/auth/login`; the dashboard page itself does not load or verify session state. Evidence: `app/(auth)/login/page.tsx:4-39`, `app/(portal)/dashboard/page.tsx:5-15`, `app/(portal)/layout.tsx:5-15`, `components/navigation.tsx:5-22`. |
| Routing Layer | `app/page.tsx`, `app/api/auth/login/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/session-init/route.ts`, `app/api/auth/logout/route.ts` | Owns URL entry points, redirects, and route-handler control flow for login, callback, session initialization, and logout. Evidence: `app/page.tsx:1-5`, `app/api/auth/login/route.ts:13-34`, `app/api/auth/callback/route.ts:16-75`, `app/api/auth/session-init/route.ts:5-21`, `app/api/auth/logout/route.ts:12-31`. |
| Auth Layer | `app/api/auth/login/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/logout/route.ts`, `lib/auth/provider.tsx`, `hooks/use-auth.ts` | Implements the active server-side login, callback, and logout handlers. A separate client-side `AuthProvider` and `useAuth` hook exist, but the observed app layouts do not mount the provider, so the active auth boundary is server-side rather than React-context-driven. Evidence: `app/layout.tsx:20-30`, `app/(auth)/layout.tsx:1-10`, `app/(portal)/layout.tsx:3-15`, `lib/auth/provider.tsx:13-45`, `hooks/use-auth.ts:9-18`. |
| Middleware Layer | `middleware.ts` | Enforces access before matched protected requests proceed, clears stale cookies when the backing server session is missing, and deletes sessions whose refresh window has expired. Evidence: `middleware.ts:16-58`. |
| Session Layer | `lib/auth/session.ts`, `types/index.ts`, `app/api/auth/session-init/route.ts` | Defines the server-side session shape, stores session records in an in-memory `Map`, and writes the browser-facing `__session` cookie from the `sid` query parameter. Evidence: `lib/auth/session.ts:13-32`, `types/index.ts:14-25`, `app/api/auth/session-init/route.ts:5-21`. |
| Integration Layer (Keycloak) | `lib/auth/keycloak.ts` | Builds Keycloak authorization and logout URLs, exchanges authorization codes for tokens, exposes a refresh helper, and decodes the ID token payload used to derive the local user object. Evidence: `lib/auth/keycloak.ts:8-120`. |
| Config Layer | `lib/env.ts`, `lib/auth/config.ts`, `package.json`, `server.js` | Resolves application and Keycloak environment values, exposes an auth config object, defines dev scripts, and provides an HTTPS dev wrapper that redirects `localhost` hosts to `client-portal.test`. Evidence: `lib/env.ts:20-45`, `server.js:8-38`, `package.json` scripts. |

## 4. Runtime Flow Reconstruction (CRITICAL)

### 4.1 Login Flow

1. The browser requests `/login`, and the page reads `searchParams.error` to optionally render an error message. The page's only sign-in action is `<a href="/api/auth/login">`. Evidence: `app/(auth)/login/page.tsx:15-39`.
2. `GET /api/auth/login` reads the `__state` cookie. If `__state` already exists, the handler does not generate a new value; it reuses the existing cookie value and immediately redirects to the Keycloak authorization URL built from that value. Evidence: `app/api/auth/login/route.ts:14-20`, `lib/auth/keycloak.ts:11-20`.
3. If `__state` is absent, the route generates `randomBytes(32).toString("hex")`, sets `__state`, and redirects to the same Keycloak authorization URL builder. The cookie attributes in code are `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "none"`, `path: "/"`, and `maxAge: 300`. Evidence: `app/api/auth/login/route.ts:23-34`.
4. `getAuthorizationUrl` builds the redirect target as `${env.keycloakUrl}/realms/${env.keycloakRealm}/protocol/openid-connect/auth` with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid`, and `state`. Evidence: `lib/auth/keycloak.ts:8-20`, `lib/env.ts:20-38`.

### 4.2 Callback Flow

1. Keycloak returns the browser to `GET /api/auth/callback` with `code` and `state` query parameters. The handler constructs `loginUrl` from `env.appUrl` and `/login`. Evidence: `app/api/auth/callback/route.ts:16-20`, `lib/env.ts:20-38`.
2. If either `code` or `state` is missing, the handler redirects to `/login?error=invalid_state`. This branch returns the redirect immediately and does not delete `__state`. Evidence: `app/api/auth/callback/route.ts:22-26`.
3. If both params are present, the handler reads `__state` from cookies and compares it to the `state` query value. On missing or mismatched state, it redirects to `/login?error=invalid_state` and deletes `__state`. Evidence: `app/api/auth/callback/route.ts:28-37`.
4. With valid state, the handler calls `exchangeCode(code)`. Any thrown error from token exchange is mapped to `/login?error=auth_failed`, and `__state` is deleted before returning. Evidence: `app/api/auth/callback/route.ts:39-47`, `lib/auth/keycloak.ts:42-63`.
5. On successful token exchange, the handler decodes `id_token`, extracts a local `user` object, generates `sessionId = randomUUID()`, and writes a session record to `sessionStore` with `accessToken`, `refreshToken`, `idToken`, `user`, `accessExpiresAt`, `refreshExpiresAt`, and `createdAt`. Evidence: `app/api/auth/callback/route.ts:50-66`, `lib/auth/keycloak.ts:91-120`, `types/index.ts:18-25`.
6. The callback does not set `__session` directly. It redirects to `/api/auth/session-init?sid=<sessionId>` and deletes `__state`. Session creation therefore happens in two stages: server-side record creation in the callback, then browser cookie creation via the session-init bridge. Evidence: `app/api/auth/callback/route.ts:68-74`, `app/api/auth/session-init/route.ts:5-21`.

### 4.3 Session Establishment

- `__session` is set only in `GET /api/auth/session-init`. The handler reads the `sid` query parameter, redirects to `${env.appUrl}/login` when `sid` is missing, and otherwise redirects to `${env.appUrl}/dashboard` after setting the cookie. Evidence: `app/api/auth/session-init/route.ts:5-21`.
- The session ID is generated in `/api/auth/callback` with `randomUUID()` and then copied into the `sid` query string passed to `/api/auth/session-init`. Evidence: `app/api/auth/callback/route.ts:55-70`.
- The browser cookie attributes set in code are `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, and `path: "/"`. No `maxAge` or `expires` value is set in this handler. Evidence: `app/api/auth/session-init/route.ts:13-19`.
- The backing session store is a process-local `Map<string, Session>` in `lib/auth/session.ts`. The stored payload contains tokens, user claims, access expiry, refresh expiry, and creation time. Evidence: `lib/auth/session.ts:18-32`, `types/index.ts:18-25`.
- Session lifecycle is split across handlers: create in callback, read in middleware and logout, delete in middleware when `refreshExpiresAt` is past and in logout when a session record exists. Evidence: `app/api/auth/callback/route.ts:58-66`, `middleware.ts:31-48`, `app/api/auth/logout/route.ts:18-27`.

### 4.4 Protected Route Flow

1. `middleware.ts` applies to every route matched by `config.matcher`, excluding `_next/static`, `_next/image`, `favicon.ico`, and common image extensions. Evidence: `middleware.ts:55-58`.
2. The middleware treats any pathname starting with `/login` or `/api/auth` as public and immediately returns `NextResponse.next()`. Evidence: `middleware.ts:7-21`.
3. For all other matched routes, middleware reads `request.cookies.get("__session")?.value`. If the cookie is missing, the request is redirected to `/login`. Evidence: `middleware.ts:24-29`.
4. If `__session` exists, middleware loads the session from `sessionStore`. Missing server-side session records produce a redirect to `/login`, and the response deletes `__session`. Evidence: `middleware.ts:31-37`, `lib/auth/session.ts:20-23`.
5. If the server-side session exists, middleware compares `session.refreshExpiresAt` to the current Unix timestamp. Expired refresh state causes session deletion, redirect to `/login?error=session_expired`, and `__session` deletion. Evidence: `middleware.ts:40-48`.
6. If none of the above branches trigger, middleware returns `NextResponse.next()` and the protected route renders. The observed middleware does not inspect `accessExpiresAt` and does not call `refreshAccessToken`, even though a refresh helper exists in `lib/auth/keycloak.ts`. Evidence: `middleware.ts:40-52`, `lib/auth/keycloak.ts:66-89`.

### 4.5 Logout Flow

1. `POST /api/auth/logout` reads `__session` from cookies and initializes `logoutRedirectUrl` to `null`. Evidence: `app/api/auth/logout/route.ts:12-16`.
2. If `__session` is present, the route loads the backing server session. When a record exists, it builds a Keycloak logout URL with `id_token_hint` and `post_logout_redirect_uri=${env.appUrl}/login`, then deletes the server-side session record. Evidence: `app/api/auth/logout/route.ts:18-23`, `lib/auth/keycloak.ts:23-30`.
3. The route always calls `cookieStore.delete("__session")` before redirect selection. Evidence: `app/api/auth/logout/route.ts:26-27`.
4. When `logoutRedirectUrl` is present, the route returns `NextResponse.redirect(new URL(redirectUrl))` with an absolute Keycloak URL, so the request leaves the app for upstream logout. Evidence: `app/api/auth/logout/route.ts:29-31`, `lib/auth/keycloak.ts:23-30`.
5. When no server-side session record is found, `redirectUrl` falls back to `"/login"`, but the handler still calls `new URL(redirectUrl)` with no base URL. A direct reproduction using `node -e "new URL('/login')"` returns `TypeError: Invalid URL`, so the fallback path is not safe in all states. Evidence: `app/api/auth/logout/route.ts:29-31`; reproducible runtime check executed on 2026-04-30.

### 4.6 Runtime Validation Evidence

Runtime harness note:

- Next.js reported an active `.env.local`, and that file points to the external SSO host and `https://client-portal.test:3000`. Evidence: `.env.local:1-7`.
- To keep runtime proof local, deterministic, and non-destructive, the unmodified app was started on 2026-04-30 with process-only overrides `KEYCLOAK_URL=http://localhost:8080`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, and `NEXTAUTH_URL=http://localhost:3000`, plus a temporary mock Keycloak endpoint at `http://localhost:8080`. No repository files were changed during this run.
- Browser-state observations below come from the live integrated browser cookie jar via the browser protocol (`Network.getAllCookies`), not from code inspection.

#### 4.6.1 Login Flow (REAL EXECUTION)

Browser execution:

```text
Step 1:
GET http://localhost:3000/login
-> 200 -> rendered login page

Step 2:
Click "Continue with SSO"
GET http://localhost:3000/api/auth/login
-> 307 -> http://localhost:8080/realms/client-portal/protocol/openid-connect/auth?client_id=client-portal-fe&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback&response_type=code&scope=openid&state=42606053d125dd154a1a1df376dffec65b4c177fcde70f0785c0e65f1645d2d0

Landing page:
GET http://localhost:8080/realms/client-portal/protocol/openid-connect/auth?...state=42606053d125dd154a1a1df376dffec65b4c177fcde70f0785c0e65f1645d2d0
-> 200 -> mock Keycloak login page showing state=42606053d125dd154a1a1df376dffec65b4c177fcde70f0785c0e65f1645d2d0
```

Header capture of the same route shape:

```text
GET /api/auth/login
-> 307 Temporary Redirect
-> Location: http://localhost:8080/realms/client-portal/protocol/openid-connect/auth?client_id=client-portal-fe&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback&response_type=code&scope=openid&state=bf7e8b75e0193fe72d0401bdb6c6476b88f9d4b88ed4b441139d3f8da4b04a0c

Set-Cookie header emitted by the app:
__state=bf7e8b75e0193fe72d0401bdb6c6476b88f9d4b88ed4b441139d3f8da4b04a0c; Path=/; Expires=Thu, 30 Apr 2026 06:10:26 GMT; Max-Age=300; HttpOnly; SameSite=none
```

Observed browser cookie store immediately after navigation to the IdP page:

```text
Network.getAllCookies()
-> []
```

Observed result: the browser reached the IdP page, but no `__state` cookie was present in the live browser cookie jar after the redirect.

#### 4.6.2 Callback Flow (REAL EXECUTION)

Unassisted browser execution:

```text
GET /api/auth/callback?code=mock-code&state=594098f3d93aba636245ed7d75ec8c45ed836ebf9019ef7c148fa7d20c3052f6
-> 307 -> http://localhost:3000/login?error=invalid_state

Browser result:
/login?error=invalid_state rendered "Login session expired. Please try again."
```

Assisted success-path execution after manual browser seeding of `__state` with the live `state` value shown on the IdP page:

```text
GET /api/auth/callback?code=mock-code&state=a9ff74198d23f0bed9320232413df85cba7ce630742388c7a4fc004a7d09a2b2
-> 307 -> http://localhost:3000/api/auth/session-init?sid=10bcd004-1b2e-483e-9f46-825940e473e2

Set-Cookie:
__state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT

GET /api/auth/session-init?sid=10bcd004-1b2e-483e-9f46-825940e473e2
-> 307 -> http://localhost:3000/dashboard

Set-Cookie:
__session=10bcd004-1b2e-483e-9f46-825940e473e2; Path=/; HttpOnly; SameSite=lax
```

Observed next protected request with the freshly issued `sid`:

```text
GET /dashboard with __session=10bcd004-1b2e-483e-9f46-825940e473e2
-> 307 -> /login
```

Observed result: callback and session-init can execute and emit a `sid`, but that `sid` was not accepted by the next protected request in the live run.

#### 4.6.3 Cookie Observation (REAL BROWSER)

Observed browser cookie jar after the login redirect and after the callback/session-init attempt:

| Cookie | HttpOnly | Secure | SameSite | TTL |
| ------ | -------- | ------ | -------- | --- |
| `__state` | Not present in live browser store | Not present | Not present | Not present |
| `__session` | Not present in live browser store | Not present | Not present | Not present |

Observed browser-cookie evidence:

- After the browser followed `/api/auth/login` to the IdP page, `Network.getAllCookies()` returned `[]`.
- After a callback/session-init attempt that issued `Set-Cookie: __session=...; HttpOnly; SameSite=lax`, `Network.getAllCookies()` again returned `[]`.
- After manual browser injection of `__session=10bcd004-1b2e-483e-9f46-825940e473e2`, the next `/dashboard` request redirected to `/login`, and the browser cookie jar returned to `[]`.

#### 4.6.4 Session Persistence

Observed browser result:

```text
Reload /dashboard with browser cookie jar empty
-> 307 -> /login

Manual browser injection:
__session=10bcd004-1b2e-483e-9f46-825940e473e2

GET /dashboard
-> 307 -> /login

Browser cookie jar after redirect
-> []
```

Observed result: no persistent authenticated browser session was established during the live run. A fresh `sid` issued by the callback path did not survive as a usable browser session on `/dashboard`.

### 4.7 Network Trace (Real Requests)

| Request | Method | Status | Redirect / Result |
| ------- | ------ | ------ | ----------------- |
| `/api/auth/login` | `GET` | `307` | Redirected to `http://localhost:8080/realms/client-portal/protocol/openid-connect/auth?...state=<hex>` |
| Keycloak authorization endpoint | `GET` | `200` | Returned mock login page showing the same `state` value in the page body |
| `/api/auth/callback?code=mock-code&state=<live-state>` with no retained browser `__state` | `GET` | `307` | Redirected to `http://localhost:3000/login?error=invalid_state` |
| `/api/auth/callback?code=mock-code&state=a9ff74198d23f0bed9320232413df85cba7ce630742388c7a4fc004a7d09a2b2` with explicit `Cookie: __state=<same>` | `GET` | `307` | Redirected to `http://localhost:3000/api/auth/session-init?sid=10bcd004-1b2e-483e-9f46-825940e473e2` |
| `/api/auth/session-init?sid=10bcd004-1b2e-483e-9f46-825940e473e2` | `GET` | `307` | Emitted `Set-Cookie: __session=10bcd004-1b2e-483e-9f46-825940e473e2; Path=/; HttpOnly; SameSite=lax` and redirected to `http://localhost:3000/dashboard` |
| `/dashboard` with `Cookie: __session=10bcd004-1b2e-483e-9f46-825940e473e2` | `GET` | `307` | Redirected to `/login` |

Observed chain summary:

```text
/login
  -> /api/auth/login (307)
  -> Keycloak /auth (200)
  -> /api/auth/callback (307)
  -> /api/auth/session-init (307)
  -> /dashboard (307)
  -> /login (200)
```

### 4.8 Failure Scenario Validation

#### 4.8.1 Invalid State

Explicit mismatch probe:

```text
GET /api/auth/callback?code=mock-code&state=wrong-state
Cookie: __state=expected-state
-> 307 -> http://localhost:3000/login?error=invalid_state

Set-Cookie:
__state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

Observed result: invalid state redirects to `/login?error=invalid_state` and clears `__state` when a mismatched cookie value is present.

Additional unassisted browser result:

```text
GET /api/auth/callback?code=mock-code&state=<live-state>
-> 307 -> /login?error=invalid_state
```

Observed result: the live browser reached the same invalid-state redirect even with a valid IdP-returned `state`, because no `__state` cookie was present in the browser store at callback time.

#### 4.8.2 Expired Session

Live runtime isolation result:

```text
Fresh sid from callback/session-init:
10bcd004-1b2e-483e-9f46-825940e473e2

Immediate GET /dashboard with Cookie: __session=10bcd004-1b2e-483e-9f46-825940e473e2
-> 307 -> /login
```

Observed result: the live browser/HTTP run did not reach a distinct `session_expired` redirect because a freshly issued `sid` was already rejected on the next protected request.

Executable branch proof from the repository test harness:

```text
Command:
npx jest tests/auth/auth.middleware.test.ts -t "should redirect to /login when session refresh token is expired" --runInBand --coverage=false

Result:
PASS tests/auth/auth.middleware.test.ts
```

Observed result: the existing middleware test seeds `refreshExpiresAt` in the past and asserts that the redirect contains both `/login` and `session_expired`. Evidence: `tests/auth/auth.middleware.test.ts:89-109`.

#### 4.8.3 Missing Session Cookie

Browser probe with cookie jar explicitly cleared:

```text
GET /dashboard
-> 307 -> /login
```

Observed browser result:

```text
Final URL: http://localhost:3000/login
Browser cookie jar: []
```

#### 4.8.4 Logout Without Session

Live runtime probe:

```text
POST /api/auth/logout
-> 500 Internal Server Error
```

Observed server error:

```text
TypeError: Invalid URL
at POST (app\api\auth\logout\route.ts:31:32)
input: '/login'
```

Observed result: logout without a valid server-side session does not redirect to `/login`; it fails with a server-side `Invalid URL` error and returns HTTP `500`.

## 5. State Model

### 5.1 Browser State

| State | Where Set | Attributes in Code | TTL in Code | SameSite Behavior | Observed Notes |
| ----- | --------- | ------------------ | ----------- | ----------------- | -------------- |
| `__state` | `app/api/auth/login/route.ts` | `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `path: "/"` | `maxAge: 300` | `sameSite: "none"` | The app emits the cookie header on the login response, but the live browser cookie jar remained empty after redirecting to the IdP page. Evidence: `app/api/auth/login/route.ts:16-31`; runtime capture in Section 4.6. |
| `__session` | `app/api/auth/session-init/route.ts` | `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `path: "/"` | No `maxAge` or `expires` is set in code | `sameSite: "lax"` | The app emits the cookie header in the session-init response, but the live browser cookie jar remained empty after the callback/session-init attempt, and `/dashboard` redirected back to `/login`. Evidence: `app/api/auth/session-init/route.ts:12-19`, `app/api/auth/callback/route.ts:68-70`; runtime capture in Section 4.6. |

Additional browser-visible state:

- `/login` consumes an `error` query parameter and maps known values to text for `invalid_state`, `auth_failed`, `session_expired`, and `service_unavailable`. Evidence: `app/(auth)/login/page.tsx:4-17`, `app/(auth)/login/page.tsx:30-33`.
- `/api/auth/session-init` consumes a `sid` query parameter before it sets `__session`, so the session ID is present in the browser-visible redirect URL during that bridge step. Evidence: `app/api/auth/callback/route.ts:68-70`, `app/api/auth/session-init/route.ts:5-14`.

### 5.2 Server State

The only observed session storage implementation is the in-memory `Map<string, Session>` in `lib/auth/session.ts`. No store-level TTL, persistence layer, or multi-instance adapter exists in the current repository state; comments in the file explicitly describe the implementation as suitable for development and single-process deployments. Evidence: `lib/auth/session.ts:13-32`.

| Server State Element | Current Implementation | Evidence |
| -------------------- | ---------------------- | -------- |
| Session identifier | UUID v4 generated with `randomUUID()` in the callback route | `app/api/auth/callback/route.ts:55-56` |
| Session payload | `accessToken`, `refreshToken`, `idToken`, `user`, `accessExpiresAt`, `refreshExpiresAt`, `createdAt` | `app/api/auth/callback/route.ts:58-66`, `types/index.ts:18-25` |
| Session creation | `sessionStore.set(sessionId, session)` in callback | `app/api/auth/callback/route.ts:58-66` |
| Session lookup | `sessionStore.get(sessionId)` in middleware and logout | `middleware.ts:31-32`, `app/api/auth/logout/route.ts:18-20` |
| Session deletion | `sessionStore.delete(sessionId)` on refresh-expired middleware path and on logout when a session exists | `middleware.ts:42-43`, `app/api/auth/logout/route.ts:21-22` |
| Access token refresh | Helper exists, but no observed caller in active request paths | `lib/auth/keycloak.ts:66-89`, `middleware.ts:40-52` |
| Route-to-middleware session acceptance | Not observed in the live run; a `sid` returned by callback and written by session-init still produced `GET /dashboard -> 307 -> /login` on the next protected request | Runtime capture in Sections 4.6 and 4.7 |

## 6. Dependency Graph

```text
/
  -> app/page.tsx
  -> redirect("/dashboard")
  -> middleware.ts

/login
  -> app/(auth)/login/page.tsx
  -> /api/auth/login

/api/auth/login
  -> app/api/auth/login/route.ts
  -> lib/auth/keycloak.ts#getAuthorizationUrl
  -> Keycloak /auth endpoint

/api/auth/callback
  -> app/api/auth/callback/route.ts
  -> lib/auth/keycloak.ts#exchangeCode
  -> lib/auth/keycloak.ts#decodeIdToken
  -> lib/auth/keycloak.ts#extractUser
  -> lib/auth/session.ts#sessionStore.set
  -> /api/auth/session-init?sid=<sessionId>

/api/auth/session-init
  -> app/api/auth/session-init/route.ts
  -> response.cookies.set("__session", sid)
  -> /dashboard

/dashboard
  -> middleware.ts
  -> lib/auth/session.ts#sessionStore.get
  -> app/(portal)/layout.tsx
  -> app/(portal)/dashboard/page.tsx

/api/auth/logout
  -> app/api/auth/logout/route.ts
  -> lib/auth/session.ts#sessionStore.get
  -> lib/auth/keycloak.ts#getLogoutUrl
  -> lib/auth/session.ts#sessionStore.delete
  -> Keycloak /logout endpoint or fallback /login path

Custom HTTPS dev path
  -> package.json#dev:https
  -> server.js
  -> express redirect localhost -> https://client-portal.test:3000
  -> Next request handler
```

## 7. Deterministic Behavior Check

| Area | Status | Why |
| ---- | ------ | --- |
| Login | PARTIAL | The login handler deterministically emits a `307` redirect and a `Set-Cookie` header for `__state`, but the live browser cookie jar remained empty after the redirect to the IdP page. Evidence: `app/api/auth/login/route.ts:16-34`; runtime capture in Section 4.6. |
| Callback | NO | The unassisted browser callback deterministically returned `307 -> /login?error=invalid_state`. A handler-success path could be observed only after manual runtime seeding of `__state`, and even then the browser did not end with an authenticated session. Evidence: `app/api/auth/callback/route.ts:22-74`, `lib/auth/keycloak.ts:42-63`; runtime capture in Sections 4.6 and 4.7. |
| Session | NO | No persistent authenticated browser session was observed. A fresh `sid` returned by callback and written by session-init still produced `GET /dashboard -> 307 -> /login`, and manual browser injection of the same `__session` value produced the same result. Evidence: `lib/auth/session.ts:18-32`, `app/api/auth/session-init/route.ts:13-19`, `middleware.ts:40-52`; runtime capture in Sections 4.6 and 4.7. |
| Logout | NO | The session-present branch is explicit, but the session-missing branch falls back to `"/login"` and then constructs `new URL("/login")` with no base, which reproduces as `TypeError: Invalid URL`. The route therefore does not complete safely in every observed state. Evidence: `app/api/auth/logout/route.ts:29-31`; reproducible runtime check executed on 2026-04-30. |

## 8. Divergence from Blueprint (IMPORTANT)

Expected values in this table are taken from the approved auth blueprint and engineering target contract in `docs/client-portal-blueprint.md` and `docs/client-portal-engineering-target.md`.

| Area | Expected | Actual | Gap Type | Severity | Impact |
| ---- | -------- | ------ | -------- | -------- | ------ |
| Login page authenticated behavior | `/login` is public but redirects authenticated users to `/dashboard` | `/login` is always bypassed by middleware and the page itself performs no session check or redirect for authenticated users | Flow gap | MEDIUM | UX, System correctness |
| Login state generation | Login initiation generates a new random state for the auth redirect | `/api/auth/login` reuses an existing `__state` cookie when present and skips regeneration | Security gap | HIGH | Security, System correctness |
| Browser retention of `__state` | Browser retains the state cookie long enough for the callback to validate it | The app emits `SameSite=none` without `Secure`, and controlled browser response-matrix tests proved that this exact cookie shape is rejected on both HTTP and HTTPS; the unassisted callback therefore returned `invalid_state` | Flow gap | CRITICAL | UX, System correctness |
| Callback session establishment | Valid callback sets `__session` and redirects to `/dashboard` | Valid callback creates the session record, then redirects to `/api/auth/session-init?sid=<sessionId>`; `__session` is set in that second route | Flow gap | HIGH | System correctness, Security |
| Session identifier transport | Browser holds opaque cookies only | The callback passes the opaque session ID in the `sid` query string during the session-init redirect | Security gap | HIGH | Security |
| Fresh `sid` acceptance on protected route | A freshly issued session cookie allows the next `/dashboard` request to pass middleware | A `sid` returned by callback and written by session-init still produced `GET /dashboard -> 307 -> /login`; the same `sid` remained readable in `/api/auth/logout` before restart and disappeared after restart, proving a session-store visibility/durability fault rather than callback creation failure | Flow gap | CRITICAL | UX, System correctness, Operational risk |
| `__state` cookie contract | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=300` | `httpOnly: true`, `secure` only in production, `sameSite: "none"`, `path: "/"`, `maxAge: 300` | Security gap | HIGH | Security |
| Missing-state cleanup | Invalid callback state clears `__state` before returning to `/login?error=invalid_state` | The missing-parameter branch redirects to `/login?error=invalid_state` without deleting `__state`; only the mismatch branch deletes it | Security gap | MEDIUM | Security, UX |
| `__session` cookie contract | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=1800` | `httpOnly: true`, `secure` only in production, `sameSite: "lax"`, `path: "/"`, and no TTL is configured in the cookie write | Security gap | HIGH | Security, System correctness |
| Protected-route refresh behavior | Middleware refreshes expired access tokens server-side while refresh state remains valid | Middleware never checks `accessExpiresAt` and never calls `refreshAccessToken`; it only deletes sessions after `refreshExpiresAt` passes | Flow gap | HIGH | System correctness, UX |
| Logout completion | Logout destroys local session, clears cookie, and always returns a valid logout result | Logout only calls Keycloak when a server session exists; missing-session fallback returns `500 Internal Server Error` because `new URL("/login")` is invalid without a base URL | Flow gap | CRITICAL | UX, System correctness |
| Production session topology | Production uses Redis-backed session storage | The only implemented session store is an in-memory `Map` | Operational gap | HIGH | Operational risk, System correctness |
| Auth event observability | Login, callback, refresh, expiry, and logout events are logged with defined severities | No auth route or middleware path in the observed runtime code emits auth-event logs; only `server.js` logs HTTPS server startup | Operational gap | MEDIUM | Operational risk |
| Service-unavailable contract | Identity outage produces the approved `service_unavailable` redirect/response behavior | The login page can render `service_unavailable`, but the observed auth routes do not emit that error and the callback catch path maps all exchange failures to `auth_failed` | Operational gap | HIGH | UX, Operational risk |
| Dev URL contract | App URLs and redirect URLs resolve to the approved portal host | `.env.local` points to external SSO and `https://client-portal.test:3000`, while `lib/env.ts` defaults to `http://localhost:3000`; deterministic local runtime required process-level overrides | Operational gap | MEDIUM | Operational risk, System correctness |
| UI logout entry | Navigation exposes a logout entry point | The observed navigation contains only a `/dashboard` link and no logout trigger | Flow gap | LOW | UX |

## 9. Risk Surface (OBSERVATION ONLY)

- Logout is not safe in all states because the no-session fallback constructs `new URL("/login")` with no base and reproduces as `TypeError: Invalid URL`. Evidence: `app/api/auth/logout/route.ts:29-31`.
- The live browser did not retain `__state` after `/api/auth/login`, and a controlled response-matrix probe proved the rejecting condition is `SameSite=None` without `Secure` on both HTTP and HTTPS response paths. Evidence: runtime capture in Section 4.6 and Section 13.1.
- The session-init bridge places the opaque session ID in the `sid` query string before cookie establishment, making the identifier browser-visible in the intermediate redirect URL. Evidence: `app/api/auth/callback/route.ts:68-70`, `app/api/auth/session-init/route.ts:5-14`.
- `GET /api/auth/session-init` accepts any `sid` value and sets `__session` without checking the server-side store first; invalid values are only rejected later by middleware. Evidence: `app/api/auth/session-init/route.ts:5-19`, `middleware.ts:31-37`.
- A freshly issued `sid` was not accepted by the next `/dashboard` request in either the mock or real-IdP runs, while the same `sid` remained resolvable in `/api/auth/logout` before restart and disappeared after restart. Evidence: runtime capture in Sections 4.6, 4.7, and 13.2-13.3.
- Cookie contracts do not match the target cookie boundary: `__state` uses `SameSite=None`, `__session` uses `SameSite=Lax`, and neither cookie is always `Secure` in code. Evidence: `app/api/auth/login/route.ts:25-31`, `app/api/auth/session-init/route.ts:14-19`.
- `__session` has no code-level browser TTL, so browser persistence is decoupled from the server-side `refreshExpiresAt` field that middleware enforces. Evidence: `app/api/auth/session-init/route.ts:14-19`, `middleware.ts:40-48`.
- Access-token refresh is not part of the active request path even though a refresh helper exists, so requests continue only until refresh expiry rather than through an observed refresh branch. Evidence: `middleware.ts:40-52`, `lib/auth/keycloak.ts:66-89`.
- Session storage is process-local memory, and the observed runtime did not provide a single shared session view across middleware and route-handler surfaces. The same real-IdP `sid` was readable in logout, rejected by middleware, and lost on restart. Evidence: `lib/auth/session.ts:13-32`, Section 13.2, and Section 13.3.
- The default app URL and the custom HTTPS dev host do not match in code, creating hidden coupling between environment variables and the local HTTPS server wrapper. Evidence: `lib/env.ts:20-22`, `server.js:20-27`.
- A client-side auth provider and hook exist separately from the active server-side auth boundary, creating a hidden coupling risk if client auth state is later introduced without reconciling it with middleware and server sessions. Evidence: `lib/auth/provider.tsx:13-45`, `hooks/use-auth.ts:9-18`, `app/layout.tsx:1-24`, `app/(portal)/layout.tsx:5-15`.
- The login page supports a `service_unavailable` message, but the observed auth routes do not currently emit that error code. Evidence: `app/(auth)/login/page.tsx:4-8`, `app/api/auth/callback/route.ts:39-47`, `app/api/auth/login/route.ts:13-34`.

## 10. Observability Score (INITIAL)

| Area | Score (0–3) | Reason |
| ---- | ----------- | ------ |
| Login flow visibility | 0 | `GET /api/auth/login` performs cookie and redirect work with no log output. Evidence: `app/api/auth/login/route.ts:13-34`. |
| Callback visibility | 0 | State rejection, token-exchange failure, and successful session creation paths do not emit auth-event logs. Evidence: `app/api/auth/callback/route.ts:22-75`. |
| Session lifecycle visibility | 0 | Session creation, lookup, expiry deletion, and stale-cookie cleanup occur with no logging in the active request path. Evidence: `app/api/auth/callback/route.ts:58-66`, `middleware.ts:31-48`, `app/api/auth/logout/route.ts:18-27`. |
| Logout visibility | 0 | Logout does not log successful sign-out, missing-session fallback, or upstream logout redirection. Evidence: `app/api/auth/logout/route.ts:12-31`. |
| Service/runtime visibility | 1 | The repo logs HTTPS dev server startup in `server.js`, but this is not auth-specific runtime observability. Evidence: `server.js:36-37`. |

## 11. Raw Evidence References

- `app/page.tsx`
- `app/(auth)/layout.tsx`
- `app/(auth)/login/page.tsx`
- `app/(portal)/layout.tsx`
- `app/(portal)/dashboard/page.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/callback/route.ts`
- `app/api/auth/session-init/route.ts`
- `app/api/auth/logout/route.ts`
- `components/navigation.tsx`
- `hooks/use-auth.ts`
- `lib/env.ts`
- `lib/auth/config.ts`
- `lib/auth/keycloak.ts`
- `lib/auth/provider.tsx`
- `lib/auth/session.ts`
- `middleware.ts`
- `package.json`
- `server.js`
- `.env.local` (runtime host values inspected; secret redacted in documentation)
- `types/index.ts`
- `tests/auth/auth.middleware.test.ts`
- `docs/client-portal-blueprint.md`
- `docs/client-portal-engineering-target.md`
- Additional runtime reproduction used for logout fallback verification: `node -e "try { console.log(String(new URL('/login'))); } catch (error) { console.error(error.toString()); process.exit(1); }"`
- Runtime header capture commands executed on 2026-04-30:
- `curl.exe -s -D - -o NUL http://localhost:3000/api/auth/login`
- `curl.exe -s -D - -o NUL -H "Cookie: __state=expected-state" "http://localhost:3000/api/auth/callback?code=mock-code&state=wrong-state"`
- `curl.exe -s -D - -o - -X POST http://localhost:3000/api/auth/logout`
- `curl.exe -k -s -D - -o NUL https://client-portal.test:3000/api/auth/login`
- `curl.exe -k -s -D - -o NUL -H "Cookie: __state=<real-state>" "https://client-portal.test:3000/api/auth/callback?..."`
- `curl.exe -k -s -D - -o NUL -X POST -H "Cookie: __session=<sid>" https://client-portal.test:3000/api/auth/logout`
- Temporary browser cookie-matrix probe executed against response-based `GET /api/auth/login` endpoints on `http://localhost:3101` and `https://client-portal.test:3443`
- `npx jest tests/auth/auth.middleware.test.ts -t "should redirect to /login when session refresh token is expired" --runInBand --coverage=false`

## 12. Blast Radius Mapping

Component: `middleware.ts`

Failure:

- Protected-route session lookup returns redirect paths instead of a pass-through result.
- In the live run, a freshly issued `sid` still produced `GET /dashboard -> 307 -> /login`.

Impact:

- `/dashboard` remains inaccessible even after callback and session-init complete.
- Browser sessions are forced back to `/login` before protected content renders.

Downstream Impact:

- Users see an apparent sign-in success at the IdP but do not reach the portal.
- Any page behind middleware inherits the same forced redirect behavior.

Component: `lib/auth/session.ts`

Failure:

- Callback-created session state was not observed to become an accepted protected-route session in the live runtime.
- Storage remains process-local in-memory state only.

Impact:

- Session continuity is not observable across the full login-to-dashboard path.
- Runtime branch isolation for expiry and refresh is blocked by earlier session rejection.

Downstream Impact:

- Users cannot depend on a callback-issued session to unlock the dashboard.
- Restart and multi-instance scenarios remain vulnerable to session loss.

Component: `app/api/auth/callback/route.ts`

Failure:

- In an unassisted browser run, callback returned `invalid_state` because no `__state` cookie was present in the live browser store.
- A success-path callback required manual runtime seeding of `__state`.

Impact:

- The normal browser login chain does not complete without manual intervention.
- Callback integrity depends on browser state that was not retained in the live run.

Downstream Impact:

- End users are returned to `/login?error=invalid_state` after the IdP step.
- Support load increases because sign-in appears to fail after external authentication succeeds.

Component: `app/api/auth/session-init/route.ts`

Failure:

- Session-init emitted `Set-Cookie: __session=...` and redirected to `/dashboard`, but the live browser cookie jar remained empty afterward.
- The route also exposes the session identifier in the `sid` query string during the bridge step.

Impact:

- Session-init does not produce a usable browser session in the observed runtime.
- The opaque session identifier becomes visible in the browser URL during the bridge transition.

Downstream Impact:

- The user returns to `/login` instead of staying on `/dashboard`.
- Any log, history, or monitoring surface that records URLs can also record the bridge `sid`.

Component: `app/api/auth/logout/route.ts`

Failure:

- `POST /api/auth/logout` without a valid session returned `500 Internal Server Error`.
- Server logs showed `TypeError: Invalid URL` at `app/api/auth/logout/route.ts:31:32`.

Impact:

- Signed-out fallback is not deterministic in the no-session state.
- Automation or clients that expect a redirect receive a server error instead.

Downstream Impact:

- Logout monitoring and support flows see an application error rather than a clean signed-out path.
- Any caller invoking logout defensively while already signed out can trigger avoidable error handling.

## 13. Root Cause Isolation & Proof

### 13.1 Cookie Root Cause Analysis

Controlling code path:

- `/api/auth/login` sets `sameSite: "none"` and only sets `secure` when `process.env.NODE_ENV === "production"`. Evidence: `app/api/auth/login/route.ts:23-31`.

Falsifiable hypothesis:

- The browser is rejecting `__state` because the emitted cookie shape is `SameSite=None` without `Secure`, not because of Keycloak state generation, redirect status code, or callback parameter mismatch.

Discriminating browser response-matrix results:

| Case | Request Origin | Response Cookie Shape | Browser Stored `__state`? | Result |
| ---- | -------------- | --------------------- | ------------------------- | ------ |
| A | `http://localhost:3101/api/auth/login?case=A` | `SameSite=None` without `Secure` | No | Rejected |
| B | `http://localhost:3101/api/auth/login?case=B` | `SameSite=Lax` without `Secure` | Yes | Accepted |
| C | `https://client-portal.test:3443/api/auth/login?case=C` | `SameSite=None; Secure` | Yes | Accepted |
| D | `https://client-portal.test:3443/api/auth/login?case=D` | `SameSite=Lax` without `Secure` | Yes | Accepted |
| Control E | `https://client-portal.test:3443/api/auth/login?case=A` | `SameSite=None` without `Secure` | No | Rejected |

Direct app-header evidence on the real HTTPS app:

```text
GET https://client-portal.test:3000/api/auth/login
-> 307 Temporary Redirect
-> Set-Cookie: __state=<hex>; Path=/; Expires=<date>; Max-Age=300; HttpOnly; SameSite=none
```

Observed proof chain:

- The app's live HTTPS login response emitted the same rejected attribute shape as Control E: `SameSite=None` with no `Secure` attribute.
- In the unassisted live browser flow, the callback returned `/login?error=invalid_state` even though the IdP returned the same `state` value in the callback URL.
- Changing only the cookie attributes in the response matrix flipped persistence from rejected to accepted.

Root cause conclusion:

- `__state` rejection is caused by the login handler emitting `SameSite=None` without `Secure`.
- This is production-relevant because the behavior is coupled to `NODE_ENV`, not to whether the browser is actually on an HTTPS origin. Any real HTTPS environment running the non-production branch reproduces the rejection.

### 13.2 Session Root Cause Analysis

Controlling code path:

- `/api/auth/callback` creates the server-side session in `sessionStore.set(sessionId, session)`.
- `middleware.ts` later resolves that session with `sessionStore.get(sessionId)`.
- `/api/auth/logout` also resolves the session with `sessionStore.get(sessionId)`.
- The backing implementation is a process-local in-memory `Map<string, Session>`. Evidence: `app/api/auth/callback/route.ts:55-66`, `middleware.ts:31-48`, `app/api/auth/logout/route.ts:18-23`, `lib/auth/session.ts:13-32`.

Falsifiable hypothesis:

- The callback is successfully creating sessions, but the resulting session state is not reliably shared across the surfaces that later consume it. If true, the same `sid` should be visible in one surface and missing in another, and a process restart should erase it.

Discriminating runtime checks:

| Probe | Observation | Meaning |
| ----- | ----------- | ------- |
| Real Keycloak callback with matching `__state` | `307 -> /api/auth/session-init?sid=29d0f155-4581-4299-806b-dfc79d818ed8` | Callback created a server-side session successfully |
| Real `session-init` with that `sid` | `307 -> /dashboard` and `Set-Cookie: __session=29d0f155-4581-4299-806b-dfc79d818ed8; SameSite=lax` | Browser cookie bridge executed successfully |
| Immediate `GET /dashboard` with `Cookie: __session=29d0f155-4581-4299-806b-dfc79d818ed8` | `307 -> /login` | Middleware did not accept the same session |
| Immediate `POST /api/auth/logout` with the same cookie before restart | `307` to real Keycloak logout URL | Route-handler lookup could still resolve the same session |
| Same `POST /api/auth/logout` after app restart | `500 Internal Server Error` with `TypeError: Invalid URL` fallback | The session disappeared with process restart because the store is only in-memory |

Observed proof chain:

- Session creation is not the failing step: the real callback produced a fresh `sid`, and the same `sid` remained usable inside the logout route immediately afterward.
- Middleware rejection is not explained by a missing browser cookie alone: the exact same `sid` was supplied explicitly and still redirected `/dashboard` to `/login`.
- Restarting the app erased that same `sid`, proving the store has no durability beyond process memory.

Root cause conclusion:

- The session failure is caused by relying on a process-local in-memory `Map` as the authoritative session store.
- In the observed runtime, middleware and route handlers did not share one reliable session view for the same `sid`, and restart removed the session entirely. This is production-relevant because restart, multi-process, and multi-instance topologies all violate the assumptions of a local in-memory store.

### 13.3 Real IdP Validation

Environment used:

- Real `.env.local` values were used for `KEYCLOAK_URL=https://sso.skill-wanderer.com`, `KEYCLOAK_REALM=client-portal`, `KEYCLOAK_CLIENT_ID=client-portal-fe`, and `NEXT_PUBLIC_APP_URL=https://client-portal.test:3000`. Secrets were used at runtime but are not reproduced in this document.

Credentialed real-Keycloak sequence:

```text
GET https://client-portal.test:3000/api/auth/login
-> 307 -> https://sso.skill-wanderer.com/realms/client-portal/protocol/openid-connect/auth?...state=<real-state>

POST real Keycloak login form with testuser / password123
-> 302 Found
-> Location: https://client-portal.test:3000/api/auth/callback?state=<real-state>&session_state=<uuid>&iss=https%3A%2F%2Fsso.skill-wanderer.com%2Frealms%2Fclient-portal&code=<authorization-code>

GET /api/auth/callback with Cookie: __state=<real-state>
-> 307 -> https://client-portal.test:3000/api/auth/session-init?sid=29d0f155-4581-4299-806b-dfc79d818ed8

GET /api/auth/session-init?sid=29d0f155-4581-4299-806b-dfc79d818ed8
-> 307 -> https://client-portal.test:3000/dashboard
-> Set-Cookie: __session=29d0f155-4581-4299-806b-dfc79d818ed8; Path=/; HttpOnly; SameSite=lax

GET /dashboard with Cookie: __session=29d0f155-4581-4299-806b-dfc79d818ed8
-> 307 -> /login
```

Additional discriminator using the same real `sid`:

```text
POST /api/auth/logout with Cookie: __session=29d0f155-4581-4299-806b-dfc79d818ed8
before restart -> 307 -> real Keycloak logout URL
after restart  -> 500 Internal Server Error
```

Real-IdP conclusion:

- Real Keycloak authentication succeeded and returned a valid application callback.
- The callback/session-init path also succeeded against the real IdP.
- The failure remained inside the application's session boundary: the resulting real `sid` still did not unlock `/dashboard`.
- The mock IdP was therefore not the cause of the session failure.

### 13.4 Root Cause Summary

| Symptom | Proven Root Cause | Direct Proof |
| ------- | ----------------- | ------------ |
| Browser returns to `/login?error=invalid_state` after login | `__state` is rejected because the app emits `SameSite=None` without `Secure` | Response-matrix Cases A-E plus the live app login header |
| Callback creates a `sid`, but `/dashboard` still redirects to `/login` | Session state is stored in a process-local in-memory `Map` that did not provide one reliable shared view across middleware and route handlers | Same real `sid` was accepted by logout, rejected by middleware, and lost on restart |
| `POST /api/auth/logout` can return `500` | Missing-session fallback calls `new URL("/login")` with no base URL | Live server stack trace showed `TypeError: Invalid URL` at `app/api/auth/logout/route.ts:31:32` |
| Real IdP could have been the cause | Not supported by runtime evidence | Real Keycloak login succeeded; the failure reproduced after callback inside the app |

## 14. Final Validation Checklist

Before finishing:

- [x] No assumptions written
- [x] Every claim tied to file behavior
- [x] No solution proposed
- [x] No refactor suggested
- [x] No future-state design mixed in
- [x] Runtime evidence present
- [x] No inferred-only claims in runtime sections
- [x] All captured flows reproducible from commands or browser steps listed above
- [x] Failure cases proven or explicitly marked as blocked by an earlier observed runtime failure
- [x] Blast radius complete
- [x] Divergence severity added
- [x] Cookie rejection cause isolated with live browser response-matrix evidence
- [x] Session rejection cause isolated with same-`sid` cross-surface evidence
- [x] Real Keycloak credentials validated against the live IdP
- [x] Root cause proof includes restart durability check

## 🧠 FINAL RULE

This document must allow:

- ✔ audit without opening code
- ✔ gap detection
- ✔ deterministic reasoning
- ✔ reproducible understanding

If not -> rewrite until it does.

# Step 1.2 — Formal Gap Map

## 1. Gap Inventory

### GAP-001

Gap ID: GAP-001
Category: Security
Severity: CRITICAL
Priority: P0
Area: Cookie Handling

Description:
Normal browser login cannot persist the `__state` cookie.

Observed Behavior:
`/api/auth/login` emits `SameSite=None` without `Secure`, the browser rejects `__state`, and the unassisted callback returns `/login?error=invalid_state`.

Expected Behavior:
The `__state` cookie must persist across the IdP redirect and be present when callback validation runs.

Root Cause:
The login handler emits a cookie shape the browser rejects.

User Impact:
Users cannot complete sign-in through the normal browser flow.

System Impact:
State validation does not complete in the unassisted login path.

Security Impact:
The intended state-based CSRF control is not functioning in the live browser path.

Operational Impact:
This failure masks downstream auth issues and creates immediate support noise.

Evidence:
Section 8 (`Browser retention of __state`, `__state` cookie contract), Section 9, Section 13.1

### GAP-002

Gap ID: GAP-002
Category: Security
Severity: HIGH
Priority: P1
Area: State Lifecycle

Description:
Login initiation can reuse an existing `__state` value instead of generating a fresh one.

Observed Behavior:
`/api/auth/login` reads `__state` and immediately reuses it when the cookie already exists.

Expected Behavior:
Each auth initiation should generate a new random state value.

Root Cause:
The login route branches to cookie reuse instead of unconditional regeneration.

User Impact:
Repeated login attempts can stay coupled to stale browser state.

System Impact:
Retry behavior is tied to previous auth attempts rather than a fresh initiation.

Security Impact:
One-time state semantics are weakened.

Operational Impact:
Repeated login failures are harder to reason about because retries are not cleanly reset.

Evidence:
Section 8 (`Login state generation`)

### GAP-003

Gap ID: GAP-003
Category: Security
Severity: MEDIUM
Priority: P2
Area: State Cleanup

Description:
The missing-parameter callback branch does not clear `__state`.

Observed Behavior:
If `code` or `state` is missing, the callback redirects to `/login?error=invalid_state` without deleting the transient state cookie.

Expected Behavior:
Any invalid callback state path should clear `__state` before returning to `/login`.

Root Cause:
Cleanup exists only for the mismatch and token-exchange-failure branches.

User Impact:
Users can re-enter login with stale browser state still present.

System Impact:
Transient auth state can survive an already-invalid callback attempt.

Security Impact:
State lifecycle cleanup is incomplete.

Operational Impact:
This creates ambiguous retry behavior during callback failure investigation.

Evidence:
Section 8 (`Missing-state cleanup`)

### GAP-004

Gap ID: GAP-004
Category: Session
Severity: HIGH
Priority: P1
Area: Session Establishment

Description:
Session establishment is split across a public bridge route that exposes `sid` in the browser URL and sets `__session` without pre-validating the `sid`.

Observed Behavior:
The callback redirects to `/api/auth/session-init?sid=<sessionId>`, the `sid` becomes browser-visible, and `session-init` sets `__session` before middleware decides whether that `sid` is valid.

Expected Behavior:
Session establishment should remain opaque to the browser and should not issue a session cookie for an unvalidated `sid`.

Root Cause:
The auth flow is split between callback session creation and a second public cookie-bridge route.

User Impact:
The login chain gains an extra fragile hop before the user can reach the dashboard.

System Impact:
Session correctness depends on a bridge route plus later middleware rejection.

Security Impact:
The opaque session identifier is exposed in browser-visible URLs and can appear in logs or history.

Operational Impact:
More moving parts make the session boundary harder to audit and reproduce.

Evidence:
Section 8 (`Callback session establishment`, `Session identifier transport`), Section 9

### GAP-005

Gap ID: GAP-005
Category: Session
Severity: CRITICAL
Priority: P0
Area: Session Resolution

Description:
A fresh session created in callback does not resolve reliably in middleware and does not survive restart.

Observed Behavior:
The real Keycloak callback creates `sid=29d0f155-4581-4299-806b-dfc79d818ed8`, `session-init` sets `__session`, `/dashboard` still redirects to `/login`, the same `sid` resolves in `/api/auth/logout` before restart, and the same `sid` disappears after restart.

Expected Behavior:
One freshly issued `sid` should resolve consistently across callback, middleware, and logout until explicit expiry or logout.

Root Cause:
The authoritative session store is a process-local in-memory `Map` that does not provide one durable, shared session view across the observed request surfaces.

User Impact:
Users cannot reach `/dashboard` after successful sign-in.

System Impact:
Protected-route access is broken even after callback and session-init succeed.

Security Impact:
The session boundary behaves inconsistently across request surfaces.

Operational Impact:
Restart and multi-instance conditions cause guaranteed session loss.

Evidence:
Section 8 (`Fresh sid acceptance on protected route`, `Production session topology`), Section 9, Section 13.2, Section 13.3

### GAP-006

Gap ID: GAP-006
Category: Security
Severity: HIGH
Priority: P1
Area: Session Cookie Contract

Description:
The `__session` cookie contract is weaker than the target boundary.

Observed Behavior:
`__session` is written with `SameSite=Lax`, is only `Secure` in production mode, and has no configured TTL.

Expected Behavior:
`__session` should follow the approved `HttpOnly`, `Secure`, `SameSite=Strict`, bounded-lifetime contract.

Root Cause:
The `session-init` cookie writer does not implement the target cookie policy.

User Impact:
Session behavior differs by environment and browser context.

System Impact:
Browser session lifetime is decoupled from server-side expiry policy.

Security Impact:
The browser session boundary is more permissive than the target design.

Operational Impact:
Expiry and persistence behavior become harder to reproduce consistently.

Evidence:
Section 8 (`__session` cookie contract), Section 9

### GAP-007

Gap ID: GAP-007
Category: Flow
Severity: HIGH
Priority: P1
Area: Protected Route Lifecycle

Description:
Protected routes do not refresh expired access tokens while refresh state remains valid.

Observed Behavior:
`middleware.ts` checks only `refreshExpiresAt`, never inspects `accessExpiresAt`, and never calls `refreshAccessToken`.

Expected Behavior:
When refresh state remains valid, access-token expiry should be handled server-side instead of forcing flow degradation.

Root Cause:
The refresh helper exists but is disconnected from the active request path.

User Impact:
Authenticated sessions will degrade once access tokens expire.

System Impact:
The protected-route lifecycle is incomplete.

Security Impact:
There is no direct exposure, but controlled server-side renewal is absent.

Operational Impact:
Users will be forced into avoidable reauthentication or broken protected requests near token-expiry boundaries.

Evidence:
Section 8 (`Protected-route refresh behavior`), Section 9

### GAP-008

Gap ID: GAP-008
Category: Flow
Severity: HIGH
Priority: P1
Area: Logout Flow

Description:
Logout fails with HTTP `500` when no valid server-side session exists.

Observed Behavior:
`POST /api/auth/logout` falls back to `"/login"`, calls `new URL("/login")` with no base URL, throws `TypeError: Invalid URL`, and returns `500 Internal Server Error`.

Expected Behavior:
Logout should always return a deterministic signed-out redirect, including the no-session path.

Root Cause:
The missing-session fallback constructs an invalid relative URL.

User Impact:
Users or callers who invoke logout while already signed out receive an application error instead of a clean exit.

System Impact:
The logout path is not deterministic in all observable states.

Security Impact:
Signed-out state cleanup is not handled cleanly when the local session is already missing.

Operational Impact:
This creates server errors in a defensive flow that should be noise-free.

Evidence:
Section 8 (`Logout completion`), Section 9, Section 13.4

### GAP-009

Gap ID: GAP-009
Category: Infrastructure
Severity: MEDIUM
Priority: P2
Area: Identity Outage Handling

Description:
The approved `service_unavailable` contract is not implemented in the active auth routes.

Observed Behavior:
The login page can render `service_unavailable`, but observed auth routes do not emit that error and callback exchange failures collapse into `auth_failed`.

Expected Behavior:
Identity outage handling should have its own deterministic redirect or response contract.

Root Cause:
Outage-specific error mapping is absent from the active auth route behavior.

User Impact:
Users see generic auth failure instead of a clear outage state.

System Impact:
Identity outage behavior is indistinguishable from other auth failures.

Security Impact:
No direct security exposure was observed.

Operational Impact:
Incident classification and support triage degrade during IdP outages.

Evidence:
Section 8 (`Service-unavailable contract`), Section 9

### GAP-010

Gap ID: GAP-010
Category: Observability
Severity: MEDIUM
Priority: P2
Area: Auth Event Logging

Description:
The active auth system emits no auth-event logs.

Observed Behavior:
The observed runtime code has no login, callback, refresh, expiry, or logout event logging; only HTTPS server startup is logged.

Expected Behavior:
Auth entry, failure, refresh, expiry, and logout paths should be observable with explicit severity.

Root Cause:
Route handlers and middleware contain no auth-specific logging.

User Impact:
There is no direct user-facing effect until failures need investigation.

System Impact:
Failure analysis is delayed because the control path is silent.

Security Impact:
Auth anomalies are harder to detect and audit.

Operational Impact:
Diagnosis, monitoring, and incident reconstruction are weak.

Evidence:
Section 8 (`Auth event observability`)

### GAP-011

Gap ID: GAP-011
Category: Infrastructure
Severity: MEDIUM
Priority: P2
Area: Runtime Configuration

Description:
Local runtime host contracts do not align without overrides.

Observed Behavior:
`.env.local` points to `https://client-portal.test:3000`, `lib/env.ts` defaults to `http://localhost:3000`, and deterministic local validation required process-level overrides.

Expected Behavior:
App URL, redirect URL, and dev host behavior should align without special runtime overrides.

Root Cause:
The default app URL contract and the HTTPS wrapper host contract are defined by different assumptions.

User Impact:
There is no direct production user impact in the observed proof set.

System Impact:
Local auth execution depends on coordinated environment overrides.

Security Impact:
No direct security exposure was proven, but host mismatches complicate secure cookie and redirect validation.

Operational Impact:
Local reproduction becomes fragile and environment-sensitive.

Evidence:
Section 8 (`Dev URL contract`), Section 9

### GAP-012

Gap ID: GAP-012
Category: Flow
Severity: MEDIUM
Priority: P2
Area: Login UX Flow

Description:
Authenticated visits to `/login` are not redirected back to `/dashboard`.

Observed Behavior:
`/login` is always bypassed by middleware and the page itself performs no session check or redirect for authenticated users.

Expected Behavior:
Authenticated users should not remain on the login entry page.

Root Cause:
Authenticated-state handling is absent from the login route path.

User Impact:
Users can land on an unnecessary login screen even when already authenticated.

System Impact:
The auth UX path is incomplete.

Security Impact:
No direct security exposure was proven.

Operational Impact:
This creates low-grade UX confusion during auth validation and support reproduction.

Evidence:
Section 8 (`Login page authenticated behavior`)

### GAP-013

Gap ID: GAP-013
Category: Flow
Severity: LOW
Priority: P2
Area: Portal Navigation

Description:
The authenticated UI provides no logout entry point.

Observed Behavior:
The observed navigation exposes only `/dashboard` and no sign-out action.

Expected Behavior:
Authenticated navigation should expose a logout trigger.

Root Cause:
The navigation component omits logout from the active portal shell.

User Impact:
Users have no obvious UI path to sign out.

System Impact:
Logout exists only as a route-level capability, not as a visible portal action.

Security Impact:
Users are less likely to terminate sessions intentionally.

Operational Impact:
This increases user confusion without changing core runtime control flow.

Evidence:
Section 8 (`UI logout entry`)

### GAP-014

Gap ID: GAP-014
Category: Infrastructure
Severity: LOW
Priority: P2
Area: Auth Boundary Coherence

Description:
A dormant client-side auth abstraction remains in the repository alongside the active server-side auth boundary.

Observed Behavior:
`AuthProvider` and `useAuth` exist, but the observed runtime layouts do not mount that provider and the active auth path is server-side.

Expected Behavior:
The auth boundary should be singular and unambiguous.

Root Cause:
Client-side auth scaffolding remains present without participating in the live auth system.

User Impact:
No direct user-facing breakage was observed.

System Impact:
Future changes can drift into a split auth model.

Security Impact:
Boundary ambiguity raises future integration risk.

Operational Impact:
Maintenance and audit reasoning are less direct because two auth models coexist in the repository.

Evidence:
Section 9

## 2. Gap Classification

### Category Map

| Category | Gap IDs | Count |
| -------- | ------- | ----- |
| Security | GAP-001, GAP-002, GAP-003, GAP-006 | 4 |
| Flow | GAP-007, GAP-008, GAP-012, GAP-013 | 4 |
| Session | GAP-004, GAP-005 | 2 |
| Infrastructure | GAP-009, GAP-011, GAP-014 | 3 |
| Observability | GAP-010 | 1 |

### Severity Map

| Severity | Gap IDs | Count |
| -------- | ------- | ----- |
| CRITICAL | GAP-001, GAP-005 | 2 |
| HIGH | GAP-002, GAP-004, GAP-006, GAP-007, GAP-008 | 5 |
| MEDIUM | GAP-003, GAP-009, GAP-010, GAP-011, GAP-012 | 5 |
| LOW | GAP-013, GAP-014 | 2 |

### Impact Rule

Impact scoring is embedded in every gap record using four mandatory axes:

- User Impact
- System Impact
- Security Impact
- Operational Impact

Priority is derived from the intersection of severity, blast radius, and dependency blocking behavior.

## 3. Priority Matrix

Ordering rule:

- Blockers before amplifiers
- Runtime access blockers before policy-strengthening gaps
- Deterministic runtime failures before observability and UX gaps

P0 (Must Fix Immediately):

- GAP-001 (`__state` cookie rejection)
- GAP-005 (session-store visibility and durability failure)

P1:

- GAP-002 (state reuse on login initiation)
- GAP-004 (two-step session bridge with browser-visible `sid` and unvalidated cookie issuance)
- GAP-006 (weak `__session` cookie contract)
- GAP-007 (missing access-token refresh in middleware)
- GAP-008 (logout fallback failure)

P2:

- GAP-003 (incomplete `__state` cleanup)
- GAP-009 (missing `service_unavailable` contract)
- GAP-010 (missing auth observability)
- GAP-011 (dev runtime host/config mismatch)
- GAP-012 (authenticated `/login` does not redirect)
- GAP-013 (no logout entry in portal UI)
- GAP-014 (dormant client-side auth boundary risk)

### Deterministic Fix Order

1. GAP-001
2. GAP-005
3. GAP-004
4. GAP-006
5. GAP-008
6. GAP-007
7. GAP-002
8. GAP-003
9. GAP-009
10. GAP-010
11. GAP-011
12. GAP-012
13. GAP-013
14. GAP-014

### Dependency Graph

```text
GAP-001 -> blocks -> normal callback validation in the browser flow
GAP-001 -> masks -> GAP-005 during unassisted browser-only runs
GAP-004 -> amplifies -> GAP-005 by inserting a public session bridge before protected-route access
GAP-004 -> exposes -> browser-visible sid transport and unvalidated sid cookie issuance
GAP-005 -> blocks -> dashboard access
GAP-006 -> amplifies -> session-boundary weakness after session-init
GAP-007 -> blocks -> sustained authenticated access after access-token expiry
GAP-008 -> blocks -> deterministic logout when the local session is already missing
GAP-010 -> obscures -> fast diagnosis of GAP-001, GAP-005, and GAP-008
GAP-011 -> complicates -> deterministic local reproduction of GAP-001 and GAP-005 without overrides
```

## 4. Fix Readiness

Gap formalization status:

- Proven: Yes. Every gap above is tied directly to Sections 8, 9, and 13.
- Reproducible: Yes. Runtime gaps include captured request/response evidence or deterministic route behavior already documented in Step 1.1.
- Isolated: Yes. The root-cause path is explicitly isolated for GAP-001, GAP-005, and GAP-008, and the remaining gaps are non-overlapping structural or contract gaps with direct evidence.

Readiness verdict:

```text
All listed gaps are formalized, prioritized, and dependency-mapped.

-> READY for Step 1.3 (Fix Execution)
```

Completion rule check:

- clear fix order: yes
- no ambiguity: yes
- no overlapping confusion: yes

-> Step 1.2 COMPLETE

## Fix Validation — GAP-001

Before:

```text
GET /api/auth/login
-> Set-Cookie: __state=...; HttpOnly; SameSite=none

Observed runtime result:
- browser/client flow did not retain usable __state for callback validation
- unassisted callback returned /login?error=invalid_state
```

After:

```text
GET /api/auth/login
-> Set-Cookie: __state=...; Secure; HttpOnly; SameSite=lax; Max-Age=300

Observed runtime result:
- retained client cookie jar contains __state
- credentialed Keycloak post advanced to the application callback URL
- no invalid_state marker appeared in the returned callback URL
```

Evidence:

```text
Header check:
curl.exe -k -s -D - -o NUL https://client-portal.test:3000/api/auth/login

Observed Set-Cookie:
__state=<hex>; Path=/; Expires=<date>; Max-Age=300; Secure; HttpOnly; SameSite=lax

Focused test:
npx jest tests/auth/auth.login.test.ts --runInBand --coverage=false
-> PASS (3/3 tests)

Live client-session proof:
{"StateCookiePresent":true,"FinalUrl":"https://client-portal.test:3000/api/auth/callback?...","HasInvalidState":false,"SessionCookiePresent":false}
```

Result:

```text
GAP-001 root cause eliminated.

State persistence now reaches callback validation.
The remaining failure is downstream session resolution (GAP-005), not invalid_state.
```

## Fix Validation — GAP-005

Before:

```text
Valid callback and session-init could issue a fresh sid,
but the next protected request still returned /login.

Observed proof before fix:
- callback -> 307 -> /api/auth/session-init?sid=<uuid>
- session-init -> 307 -> /dashboard
- /dashboard -> 307 -> /login
- restart erased the same sid entirely
```

After:

```text
The auth gate now runs through proxy.ts only,
and session records are persisted in the shared durable session store.

Observed runtime result:
- callback advanced to session-init successfully
- session-init issued __session successfully
- protected dashboard request returned 200
- the same cookie-backed session still returned 200 after a full server restart
```

Evidence:

```text
Focused gate test:
npx jest tests/auth/auth.middleware.test.ts --runInBand --coverage=false
-> PASS (6/6 tests)

Live runtime proof:
GET /api/auth/callback?state=428c5ab7bb41110bba0362e1777196b467ad02fdb6ee076411e58927f8c9b9db&session_state=edb54e44-ff0d-4761-9072-fbb16d3a8a93&iss=https%3A%2F%2Fsso.skill-wanderer.com%2Frealms%2Fclient-portal&code=5e453f71-c198-4b56-bd2f-2259002a84dd.edb54e44-ff0d-4761-9072-fbb16d3a8a93.c731008c-7b59-4f20-a6bc-51ebb4554528
-> 307

GET /api/auth/session-init?sid=d7bda89f-9e6f-407e-b6c0-b026b54c31cb
-> 307

GET /dashboard
-> 200

Repeat GET /dashboard with the same cookie jar
-> 200

Restart durability proof:
kill existing HTTPS app process
node server.js
GET /dashboard with the pre-restart cookie jar
-> 200
```

Result:

```text
GAP-005 root cause eliminated.

Fresh sessions now resolve consistently in the request gate,
and the same session survives a full app restart.
```

## Fix Validation — GAP-004

Before:

```text
Successful callback redirected through /api/auth/session-init?sid=<uuid>.

Observed proof before fix:
- callback -> 307 -> /api/auth/session-init?sid=<uuid>
- the opaque sid became browser-visible in the URL
- session-init would set __session before any sid validation
```

After:

```text
Successful callback now sets __session directly and redirects straight to /dashboard.

Observed runtime result:
- callback no longer redirects to /api/auth/session-init?sid=...
- callback emits Set-Cookie: __session=...
- the live Keycloak flow terminates at /dashboard
- the legacy session-init path now rejects an invalid sid without issuing __session
```

Evidence:

```text
Focused auth slice:
npx jest tests/auth/auth.callback.test.ts tests/auth/auth.contract.behavior.test.ts tests/auth/auth.contract.test.ts tests/auth/auth.flow.test.ts --runInBand --coverage=false
-> PASS (4 suites, 28 tests, 2 snapshots)

Legacy bridge guard proof:
curl.exe -k -s -D - -o NUL "https://client-portal.test:3000/api/auth/session-init?sid=invalid-gap004-sid"
-> HTTP/1.1 307 Temporary Redirect
-> location: https://client-portal.test:3000/login
-> no Set-Cookie: __session

Real Keycloak end-to-end proof:
POST Keycloak login form with testuser / password123
-> FINAL_URL=https://client-portal.test:3000/dashboard
-> HTTP_CODE=200

Direct callback response proof:
HTTP/1.1 307 Temporary Redirect
location: https://client-portal.test:3000/dashboard
set-cookie: __session=8282c256-9339-4624-963d-d732d0080091; Path=/; HttpOnly; SameSite=lax
set-cookie: __state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT

Cookie jar after callback:
#HttpOnly_client-portal.test    FALSE   /       FALSE   0       __session       8282c256-9339-4624-963d-d732d0080091
```

Result:

```text
GAP-004 root cause eliminated.

The active auth flow no longer exposes sid in a browser-visible redirect,
and the legacy session-init path no longer mints __session for an unbacked sid.
```

## Fix Validation — GAP-006

Before:

```text
__session cookie:
- SameSite=Lax
- Secure conditional
- no TTL
```

After:

```text
The server-side session cookie contract is now enforced consistently.

Observed handler result:
- callback emits __session with HttpOnly
- callback emits __session with Secure
- callback emits __session with SameSite=Strict
- callback emits __session with Max-Age=1800
- legacy session-init emits the same contract using the remaining refresh TTL
```

Evidence:

```text
Focused cookie-contract proof:
npx jest tests/auth/auth.callback.test.ts tests/auth/auth.flow.test.ts --runInBand --coverage=false
-> PASS (2 suites, 12 tests)

Observed assertions in that slice:
- callback response set-cookie contains __session
- callback response set-cookie contains HttpOnly
- callback response set-cookie contains Secure
- callback response set-cookie matches SameSite=Strict
- callback response set-cookie contains Max-Age=1800
- session-init response set-cookie contains HttpOnly, Secure, SameSite=Strict, and Max-Age
```

Result:

```text
GAP-006 root cause eliminated.

The browser-facing session boundary now matches the approved strict cookie policy,
and cookie lifetime is bounded to the server-side refresh window.
```

## Fix Validation — GAP-008

Before:

```text
POST /api/auth/logout with no valid server-side session
-> 500 Internal Server Error

Observed cause:
- fallback path called new URL("/login") with no base URL
```

After:

```text
POST /api/auth/logout with no session now returns a clean redirect.

Observed handler result:
- status 307
- location http://localhost:3000/login
- no Invalid URL crash
```

Evidence:

```text
Focused logout regression proof:
npx jest tests/auth/auth.logout.test.ts --runInBand --coverage=false
-> PASS (1 suite, 1 test)

Observed assertions:
- response.status === 307
- response.headers.get("location") === "http://localhost:3000/login"
- __session deletion still executes
```

Result:

```text
GAP-008 root cause eliminated.

Logout now completes deterministically even when the local session is already absent.
```

## Fix Validation — GAP-007

Before:

```text
Protected requests ignored accessExpiresAt.

Observed behavior before fix:
- middleware checked only refreshExpiresAt
- refreshAccessToken existed but was not called
- expired access tokens could not be renewed in the active request gate
```

After:

```text
The request gate now refreshes the session when access is expired but refresh remains valid.

Observed handler result:
- expired access token does not force immediate login redirect
- refreshAccessToken is called with the stored refresh token
- server-side session is updated with new tokens and expiry timestamps
- __session is reissued with the refreshed TTL
```

Evidence:

```text
Focused middleware refresh proof:
npx jest tests/auth/auth.middleware.test.ts --runInBand --coverage=false
-> PASS (1 suite, 7 tests)

Observed assertions in the refresh branch:
- response has no redirect location
- refreshAccessToken called with rt-old
- sessionStore.set called with updated accessToken, refreshToken, idToken
- refreshed response set-cookie contains __session, Secure, SameSite=Strict, Max-Age=1800
```

Result:

```text
GAP-007 root cause eliminated.

Protected-route auth lifecycle now covers server-side token renewal instead of degrading at access-token expiry.
```

## Fix Validation — GAP-002

Before:

```text
Repeated login initiation could reuse a stale __state value.

Observed behavior before fix:
- GET /api/auth/login read an existing __state cookie
- handler redirected with the reused value instead of minting a new state
```

After:

```text
Each login initiation now generates a fresh state value.

Observed handler result:
- __state is set even when a prior cookie exists
- redirect to Keycloak uses the new deterministic test state
- old cookie value is not propagated into the redirect URL
```

Evidence:

```text
Focused login-state proof:
npx jest tests/auth/auth.login.test.ts --runInBand --coverage=false
-> PASS (1 suite, 3 tests)

Observed assertions:
- mockCookieStore.set called with a fresh __state value
- redirect location contains the fresh state
- redirect location does not contain the previous state value
```

Result:

```text
GAP-002 root cause eliminated.

Every auth initiation now starts from a fresh CSRF state boundary instead of carrying forward stale login state.
```

## Final Validation — Step 1.3

System verification target:

```text
✔ login works
✔ session persists
✔ logout safe
✔ token refresh works
✔ no stale state
```

Evidence:

```text
Final auth suite:
npm run test:auth -- --ci
-> PASS (9 suites, 54 tests, 2 snapshots)

Observed suite result:
- login tests passed
- callback tests passed
- session-init and contract tests passed
- middleware refresh and expiry tests passed
- logout regression test passed
- Jest auth coverage reported 100% across the enforced auth files
```

Result:

```text
Step 1.3 COMPLETE.

All P0 and P1 auth-system gaps scheduled for Step 1.3 are closed,
and the full auth validation suite passes with deterministic evidence.
```