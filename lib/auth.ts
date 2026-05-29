export function login() {
  window.location.assign("/login");
}

export function recoverAuthSession() {
  window.location.assign("/login?error=session_expired");
}

export function logout() {
  window.location.assign("/login?error=signed_out");
}

export function redirectToLogin(errorCode?: string) {
  const target = errorCode
    ? `/login?error=${encodeURIComponent(errorCode)}`
    : "/login";

  window.location.assign(target);
}