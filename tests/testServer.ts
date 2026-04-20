/**
 * Test server utilities for auth flow testing.
 * Simulates Next.js request/response lifecycle without starting the real server.
 */

import { NextRequest } from "next/server";

/**
 * Creates a NextRequest for testing with configurable URL, cookies, and headers.
 */
export function createTestRequest(
  url: string,
  options: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const request = new NextRequest(new URL(url, "http://localhost:3000"), {
    headers: new Headers(options.headers || {}),
  });

  if (options.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      request.cookies.set(name, value);
    }
  }

  return request;
}

/**
 * Extracts redirect location from a NextResponse.
 */
export function getRedirectLocation(response: Response): string | null {
  // Next.js redirects use Location header
  const location = response.headers.get("location");
  if (location) return location;

  // Some redirects are encoded in the response body for client-side routing
  return null;
}

/**
 * Simulates a redirect chain and detects loops.
 * Returns the chain of URLs visited.
 */
export async function followRedirects(
  handler: (req: NextRequest) => Promise<Response>,
  startUrl: string,
  options: {
    cookies?: Record<string, string>;
    maxRedirects?: number;
  } = {}
): Promise<{ chain: string[]; loopDetected: boolean }> {
  const maxRedirects = options.maxRedirects ?? 10;
  const chain: string[] = [startUrl];
  const visited = new Set<string>();
  visited.add(startUrl);

  let currentUrl = startUrl;

  for (let i = 0; i < maxRedirects; i++) {
    const request = createTestRequest(currentUrl, {
      cookies: options.cookies,
    });

    const response = await handler(request);
    const location = getRedirectLocation(response);

    if (!location) break;

    const absoluteLocation = location.startsWith("http")
      ? location
      : new URL(location, "http://localhost:3000").toString();

    chain.push(absoluteLocation);

    if (visited.has(absoluteLocation)) {
      return { chain, loopDetected: true };
    }

    visited.add(absoluteLocation);
    currentUrl = absoluteLocation;
  }

  return { chain, loopDetected: false };
}
