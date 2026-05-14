"use client";

import { useLayoutEffect } from "react";
import { env } from "@/lib/env";
import { getCanonicalLoopbackUrl } from "@/lib/local-origin";

export function LoopbackOriginGuard() {
  useLayoutEffect(() => {
    const normalizedUrl = getCanonicalLoopbackUrl(
      window.location.href,
      env.apiBaseUrl
    );

    if (normalizedUrl) {
      window.location.replace(normalizedUrl);
    }
  }, []);

  return null;
}