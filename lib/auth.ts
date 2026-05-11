import { buildApiUrl } from "@/lib/api-client";

export function login() {
  window.location.href = buildApiUrl("/v1/auth/login");
}