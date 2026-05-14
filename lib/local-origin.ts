const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function getCanonicalLoopbackUrl(currentHref: string, apiBaseUrl: string) {
  try {
    const currentUrl = new URL(currentHref);
    const apiUrl = new URL(apiBaseUrl);

    if (!LOOPBACK_HOSTS.has(currentUrl.hostname)) {
      return null;
    }

    if (!LOOPBACK_HOSTS.has(apiUrl.hostname)) {
      return null;
    }

    if (currentUrl.hostname === apiUrl.hostname) {
      return null;
    }

    currentUrl.hostname = apiUrl.hostname;
    return currentUrl.toString();
  } catch {
    return null;
  }
}