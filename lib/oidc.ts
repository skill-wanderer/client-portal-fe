import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { env } from "@/lib/env";

export interface OidcRedirectState {
  returnTo?: string;
}

export interface OidcProfile extends Record<string, unknown> {
  sub: string;
  iss?: string;
  email?: string;
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<
    string,
    {
      roles?: string[];
    }
  >;
}

export const OIDC_CALLBACK_PATH = "/auth/callback";
export const OIDC_SILENT_CALLBACK_PATH = "/auth/silent-callback";

const DEFAULT_POST_LOGIN_PATH = "/dashboard";

let oidcUserManager: UserManager | null = null;

function buildOidcUserManager() {
  return new UserManager({
    authority: env.oidcIssuer,
    client_id: env.oidcClientId,
    redirect_uri: env.oidcRedirectUri,
    silent_redirect_uri: env.oidcSilentRedirectUri,
    post_logout_redirect_uri: buildSignedOutRedirectUri(),
    response_type: "code",
    scope: env.oidcScope,

    // Disabled intentionally.
    // The login page must not auto-renew stale refresh tokens before the user clicks sign in.
    // Production logs showed token endpoint 400 loops from signinSilent/exchangeRefreshToken.
    automaticSilentRenew: false,
    monitorSession: false,

    loadUserInfo: true,
    filterProtocolClaims: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
}

function ensureBrowser() {
  if (typeof window === "undefined") {
    throw new Error("OIDC browser APIs are only available in the browser runtime.");
  }
}

function readStateReturnTo(state: unknown) {
  if (
    typeof state !== "object" ||
    state === null ||
    !("returnTo" in state)
  ) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return normalizeReturnToPath((state as OidcRedirectState).returnTo);
}

export function normalizeReturnToPath(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_POST_LOGIN_PATH;
  }

  const trimmedValue = value.trim();

  if (trimmedValue === "" || !trimmedValue.startsWith("/") || trimmedValue.startsWith("//")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  try {
    const parsedUrl = new URL(trimmedValue, "https://client-portal.invalid");

    if (
      ["/login", OIDC_CALLBACK_PATH, OIDC_SILENT_CALLBACK_PATH].includes(
        parsedUrl.pathname
      )
    ) {
      return DEFAULT_POST_LOGIN_PATH;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }
}

export function getCurrentRelativeUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return normalizeReturnToPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

export function isOidcCallbackPath(pathname: string) {
  return pathname === OIDC_CALLBACK_PATH;
}

export function isOidcSilentCallbackPath(pathname: string) {
  return pathname === OIDC_SILENT_CALLBACK_PATH;
}

export function getPostLoginRedirectPath(user?: User | null) {
  return readStateReturnTo(user?.state);
}

export function buildSignedOutRedirectUri() {
  const logoutRedirectUrl = new URL(env.oidcLogoutRedirectUri);

  if (!logoutRedirectUrl.searchParams.has("error")) {
    logoutRedirectUrl.searchParams.set("error", "signed_out");
  }

  return logoutRedirectUrl.toString();
}

export function getOidcUserManager() {
  ensureBrowser();

  if (oidcUserManager === null) {
    oidcUserManager = buildOidcUserManager();
  }

  return oidcUserManager;
}

export function getStoredOidcUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const storageValue = window.localStorage.getItem(
    `oidc.user:${env.oidcIssuer}:${env.oidcClientId}`
  );

  if (!storageValue) {
    return null;
  }

  try {
    return User.fromStorageString(storageValue);
  } catch {
    return null;
  }
}

export function getStoredAccessToken() {
  const user = getStoredOidcUser();

  if (!user || user.expired) {
    return null;
  }

  return user.access_token;
}

export async function cleanupOidcBrowserState() {
  if (typeof window === "undefined") {
    return;
  }

  let userManager: UserManager | null = null;

  try {
    userManager = getOidcUserManager();
  } catch {
    userManager = null;
  }

  if (userManager) {
    try {
      await userManager.stopSilentRenew();
    } catch {
      // Ignore cleanup errors.
    }

    try {
      await userManager.removeUser();
    } catch {
      // Ignore cleanup errors.
    }

    try {
      await userManager.clearStaleState();
    } catch {
      // Ignore cleanup errors.
    }
  }

  try {
    window.sessionStorage.clear();
  } catch {
    // Ignore cleanup errors.
  }
}

export async function loadOidcUser() {
  const userManager = getOidcUserManager();

  return userManager.getUser();
}

export async function tryRestoreOidcUser() {
  const userManager = getOidcUserManager();

  try {
    const currentUser = await userManager.getUser();

    if (!currentUser) {
      await cleanupOidcBrowserState();
      return null;
    }

    if (!currentUser.expired) {
      return currentUser;
    }

    // Expired/stale refresh tokens must be treated as unauthenticated.
    // Do not call signinSilent automatically on the login page.
    await cleanupOidcBrowserState();
    return null;
  } catch {
    await cleanupOidcBrowserState();
    return null;
  }
}

export async function refreshOidcUser() {
  const userManager = getOidcUserManager();

  try {
    const currentUser = await userManager.getUser();

    if (!currentUser) {
      await cleanupOidcBrowserState();
      return null;
    }

    if (!currentUser.expired) {
      return currentUser;
    }

    // Avoid silent refresh loops when Keycloak rejects stale refresh tokens.
    await cleanupOidcBrowserState();
    return null;
  } catch {
    await cleanupOidcBrowserState();
    return null;
  }
}

export async function startOidcLogin(returnTo = getCurrentRelativeUrl()) {
  const userManager = getOidcUserManager();

  await userManager.signinRedirect({
    state: {
      returnTo: normalizeReturnToPath(returnTo),
    } satisfies OidcRedirectState,
  });
}

export async function recoverOidcSession(returnTo = getCurrentRelativeUrl()) {
  const restoredUser = await tryRestoreOidcUser();

  if (restoredUser && !restoredUser.expired) {
    return restoredUser;
  }

  await startOidcLogin(returnTo);

  return null;
}

export async function logoutOidcSession() {
  const userManager = getOidcUserManager();
  const currentUser = await userManager.getUser();

  await userManager.removeUser();
  await userManager.signoutRedirect({
    id_token_hint: currentUser?.id_token,
    post_logout_redirect_uri: buildSignedOutRedirectUri(),
  });
}

function clearOidcCallbackParams() {
  ensureBrowser();
  window.history.replaceState({}, document.title, window.location.pathname);
}

export async function completeOidcSigninCallback() {
  const userManager = getOidcUserManager();
  const user = await userManager.signinCallback(window.location.href);

  clearOidcCallbackParams();

  return user ?? null;
}

export async function completeOidcSilentCallback() {
  const userManager = getOidcUserManager();

  await userManager.signinCallback(window.location.href);
  clearOidcCallbackParams();
}