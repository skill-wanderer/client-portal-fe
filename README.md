# Client Portal Frontend

Client Portal Frontend is a thin Next.js 16 client for the Skill Wanderer workflow platform.

This repository owns presentation, routing, and browser-side interaction only. The backend owns authentication, session lifecycle, authorization, business invariants, workflow orchestration, and persistence.

## Runtime Model

- The browser never receives Keycloak, access, refresh, or ID tokens.
- The frontend never acts as the auth authority.
- The frontend calls backend endpoints with `credentials: "include"` and reacts to backend outcomes.
- The backend remains the single source of truth for user identity, permissions, workflow state, concurrency, and mutation validity.

The active browser-facing contract is:

- `GET /v1/auth/login`
- `GET /v1/auth/me`
- `GET /api/v1/client/dashboard`
- `GET /api/v1/client/projects/{projectId}`
- `GET /api/v1/client/projects/{projectId}/files`
- `GET /api/v1/client/projects/{projectId}/messages`
- `POST /api/v1/client/projects/{projectId}/messages`
- `POST /api/v1/client/tasks/{taskId}/complete`

All JSON API responses are expected to use the backend envelope documented in [docs/system-contract.md](docs/system-contract.md).

## Architecture

1. The user opens `/login` in the frontend.
2. The frontend sends browser navigation to `${NEXT_PUBLIC_API_BASE_URL}/v1/auth/login`.
3. The backend performs the Keycloak redirect, callback handling, and session creation.
4. The backend redirects the browser back to the frontend after login.
5. The frontend bootstraps authenticated user state with `GET /v1/auth/me`.
6. Protected pages fetch live data from `/api/v1/client/*`.
7. The frontend treats backend responses deterministically:
   - `401` -> signed-out or expired-session flow
   - `403` -> provisioned-but-not-authorized flow
   - `404` -> resource unavailable for this user
   - `409` or `412` -> stale write or replay-safe retry flow

`components/ProtectedRoute.tsx` is only a UI gate to avoid flashing protected content while `/auth/me` loads. It is not an authorization boundary. The backend still decides every authenticated request.

## Repository Layout

- `app/`: App Router pages and layouts
- `components/`: UI components and portal views
- `contexts/AuthContext.tsx`: browser bootstrap for backend auth state
- `lib/api-client.ts`: centralized credentialed backend fetch layer
- `lib/portal-runtime.ts`: shared auth redirect and backend error handling
- `lib/portal-api.ts`: typed client API wrappers
- `server.js`: local HTTPS development entrypoint only

## Environment

This frontend only requires one public runtime variable:

- `NEXT_PUBLIC_API_BASE_URL`
  - Local plain-dev example: `http://127.0.0.1:8003`
  - Deployed example: `https://api.skill-wanderer.com`

Notes:

- `NEXT_PUBLIC_APP_URL` is not used by this repository.
- Deployed runtimes must expose stable deployment metadata. Set `NEXT_PUBLIC_DEPLOYMENT_ID`, or let `next.config.ts` derive it from `NEXT_DEPLOYMENT_ID`, `CF_PAGES_COMMIT_SHA`, `SOURCE_VERSION`, or `GIT_SHA` during the build.
- Deployed runtimes should expose the frozen backend contract version through `NEXT_PUBLIC_CONTRACT_VERSION` or `CONTRACT_VERSION` so rollback checks remain diagnosable in the browser runtime.
- Database, Redis, Keycloak, and backend secret variables belong in the backend runtime, not this frontend repository.
- When the frontend is served over HTTPS, `NEXT_PUBLIC_API_BASE_URL` should also be HTTPS to avoid mixed-content failures.

Minimal `.env.local` example:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8003
```

## Local Development

The frontend assumes the backend is already running and reachable at `NEXT_PUBLIC_API_BASE_URL`.

### Option 1: Plain HTTP development

1. Install dependencies.

```powershell
npm install
```

2. Create `.env.local` with a backend API URL.

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8003
```

3. Start the frontend.

```powershell
npm run dev
```

4. Open `http://127.0.0.1:3000`.

If you open `http://localhost:3000` while `NEXT_PUBLIC_API_BASE_URL` points at `127.0.0.1`, the app now normalizes the browser origin to `127.0.0.1` before the auth bootstrap runs. This prevents the local CORS split between `localhost` and `127.0.0.1` from leaking into runtime behavior.

### Option 2: Local HTTPS development

Use this only when you need browser behavior that depends on HTTPS or secure cookies.

1. Install and trust `mkcert`.
2. Ensure certificate files exist at `certs/cert.pem` and `certs/key.pem`.

```powershell
mkcert -install
mkcert -cert-file certs/cert.pem -key-file certs/key.pem client-portal.test localhost 127.0.0.1 ::1
```

3. Add a hosts entry.

```text
127.0.0.1 client-portal.test
```

4. Point `NEXT_PUBLIC_API_BASE_URL` at an HTTPS backend origin or local HTTPS reverse proxy.

5. Start the HTTPS dev entrypoint.

```powershell
npm run dev:https
```

6. Open `https://client-portal.test:3000`.

`npm run dev:https` is a local-only convenience entrypoint. Production deployments should use `next build` and `next start` behind the platform's normal reverse proxy or ingress.

## Cloudflare Deployment

This repository is wired for Cloudflare Workers through the OpenNext adapter.

Tracked deployment files:

- `open-next.config.ts`
- `wrangler.jsonc`

Deployment commands:

- `npm run build:cloudflare:next`: prebuild the app for the Worker bundle with webpack
- `npm run build:cloudflare`: generate the OpenNext Cloudflare worker bundle
- `npm run preview`: run the app through the Cloudflare adapter locally on `http://127.0.0.1:3000`
- `npm run deploy`: build and deploy to Cloudflare Workers
- `npm run cf-typegen`: generate Wrangler environment typings if you add Worker bindings later

Required Cloudflare expectations:

1. Configure `NEXT_PUBLIC_API_BASE_URL` in Cloudflare build variables or Worker environment variables.
2. Provide stable deployment metadata through `NEXT_PUBLIC_DEPLOYMENT_ID` or one of the commit-derived fallbacks consumed by `next.config.ts`.
3. Keep `NEXT_PUBLIC_CONTRACT_VERSION` aligned with the backend `CONTRACT_VERSION`.
4. Keep `nodejs_compat` enabled in `wrangler.jsonc`.
5. Treat `server.js` and `npm run dev:https` as local-only helpers; Cloudflare uses the Worker bundle under `.open-next/`, not the custom Node HTTPS server.
6. The standard `npm run build` path stays on Next.js's default build pipeline. The Cloudflare bundle intentionally uses a webpack prebuild through `npm run build:cloudflare:next` because the current OpenNext preview path on Windows hit a Turbopack chunk-loading failure.
7. Use `npm run preview` to validate the Worker runtime locally before `npm run deploy`. The preview command is pinned to port `3000` so local auth flows use the same loopback origin already allowed by the backend.

Windows note:

- OpenNext currently warns that Windows support is not optimal. The Cloudflare build completed successfully in this repository on Windows, but WSL remains the safer path for repeated local Worker previews and deploy operations.

## Scripts

- `npm run dev`: start the standard Next.js development server
- `npm run dev:https`: start the local HTTPS development entrypoint
- `npm run build:cloudflare:next`: build the app with webpack for the Cloudflare adapter path
- `npm run build:cloudflare`: build the Cloudflare Worker bundle with OpenNext
- `npm run preview`: preview the app through the Cloudflare adapter
- `npm run deploy`: deploy the built Worker bundle to Cloudflare
- `npm run cf-typegen`: generate Wrangler environment typings
- `npm run lint`: run ESLint across the repo
- `npm test`: run Jest and pass when no tests are present
- `npm run test:ci`: CI-safe Jest invocation
- `npm run build`: run the production build
- `npm run validate`: run lint, tests, and production build

## Auth And Routing Behavior

- `/login` is the public sign-in entry page.
- `/dashboard` and `/projects/[projectId]` are protected frontend routes.
- Login is initiated by browser navigation to the backend's `/v1/auth/login` endpoint.
- Auth restoration happens by calling `GET /v1/auth/me` after the app mounts in the browser.
- Protected data is always re-read from the backend; the frontend does not invent workflow state.

The currently reachable local backend does not expose a logout route, so this frontend does not render a broken sign-out action.

## Deployment Requirements

To deploy this frontend safely, the platform must provide:

1. A backend API reachable at `NEXT_PUBLIC_API_BASE_URL`.
2. Credentialed CORS support for the frontend origin.
3. Backend-owned secure session cookies.
4. Reverse proxy or CDN behavior that preserves `Set-Cookie`, redirects, and `X-Correlation-ID` headers.
5. HTTPS wherever secure cookies are expected.

Cloudflare-specific requirements:

1. Deploy through OpenNext on Workers, not through the local `server.js` runtime.
2. Provide `NEXT_PUBLIC_API_BASE_URL` in the Cloudflare environment used for both build and runtime.
3. Keep the frontend origin allowed by backend credentialed CORS.
4. If you run rolling deployments, pass a stable deployment identifier through `NEXT_DEPLOYMENT_ID` or rely on the commit-based environment variables already read by `next.config.ts`.

Recommended deployment checks:

1. Set `NEXT_PUBLIC_API_BASE_URL` to the public backend URL.
2. Run `npm run validate`.
3. Run `npm run build` in the deployment environment.
4. Run `npm run build:cloudflare` or `npm run preview` before deploy.
5. Verify login, `/v1/auth/me`, dashboard load, project load, task completion, message send, and refresh-safe auth recovery against the real backend.

## Troubleshooting

### Redirects back to `/login`

- The backend session is missing, expired, or rejected.
- The backend may not be allowing credentialed requests from the frontend origin.
- The frontend may be pointed at the wrong backend base URL.

### Local `localhost` and `127.0.0.1` behave differently

- The app now normalizes `localhost` to the loopback host used by `NEXT_PUBLIC_API_BASE_URL` during local development.
- If the backend still rejects the normalized origin, fix backend CORS first.

### `403` provisioning or access errors

- The backend accepted the sign-in, but the user is not provisioned or not authorized for the requested client scope.

### Mixed-content failures in the browser

- An HTTPS frontend cannot call an HTTP backend API. Either use `npm run dev` for plain HTTP local development or expose the backend over HTTPS.

### Build succeeds but runtime calls fail

- Re-check `NEXT_PUBLIC_API_BASE_URL`, backend CORS, and whether the deployed backend is actually serving the documented `/v1/auth/*` and `/api/v1/client/*` endpoints.

### Cloudflare build works but deploy fails

- Confirm Wrangler authentication is configured.
- Confirm `wrangler.jsonc` uses a current compatibility date and `nodejs_compat`.
- Confirm Cloudflare has the same `NEXT_PUBLIC_API_BASE_URL` value during build and runtime.

## Non-Goals In This Repo

This repository does not implement:

- Keycloak configuration
- Redis session storage
- database migrations
- backend RBAC
- workflow orchestration
- mutation authority
- server-side BFF auth callbacks

Those responsibilities belong to the backend platform and must stay there.
