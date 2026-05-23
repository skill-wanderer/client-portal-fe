import { buildApiUrl } from "@/lib/api-client";
import {
  beginAuthRecoveryFlow,
  beginAuthRedirectFlow,
} from "@/lib/runtime-correlation";

function navigateToBackendLogin(context: {
  correlationId: string;
  authFlowId: string;
}) {
  const target = new URL(buildApiUrl("/v1/auth/login"));

  target.searchParams.set("cid", context.correlationId);
  target.searchParams.set("auth_flow_id", context.authFlowId);

  window.location.assign(target.toString());
}

export function login() {
  navigateToBackendLogin(beginAuthRedirectFlow());
}

export function recoverAuthSession() {
  navigateToBackendLogin(beginAuthRecoveryFlow());
}

export function redirectToLogin(errorCode?: string) {
  const target = errorCode
    ? `/login?error=${encodeURIComponent(errorCode)}`
    : "/login";

  window.location.assign(target);
}