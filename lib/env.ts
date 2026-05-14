function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function normalizeUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const env = {
  // Local plain `next dev` still falls back to loopback, but deployed environments must set NEXT_PUBLIC_API_BASE_URL explicitly.
  apiBaseUrl: normalizeUrl(
    optional("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8003")
  ),

  nodeEnv: optional("NODE_ENV", "development"),

  isProduction: process.env.NODE_ENV === "production",
} as const;
