"use client";

import { useEffect, useState } from "react";
import { completeOidcSilentCallback } from "@/lib/oidc";

export default function SilentAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await completeOidcSilentCallback();
      } catch (cause) {
        const message =
          cause instanceof Error && cause.message.trim() !== ""
            ? cause.message
            : "Silent sign-in failed.";

        setError(message);
      }
    })();
  }, []);

  return (
    <p className="sr-only">
      {error ? `Silent sign-in failed: ${error}` : "Completing silent sign-in..."}
    </p>
  );
}