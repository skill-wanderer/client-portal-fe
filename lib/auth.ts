import { buildApiUrl } from "@/lib/api-client";

export function login() {
  window.location.assign(buildApiUrl("/v1/auth/login"));
}

export function redirectToLogin(errorCode?: string) {
  const target = errorCode
    ? `/login?error=${encodeURIComponent(errorCode)}`
    : "/login";

  window.location.assign(target);
}