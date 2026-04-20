/**
 * Auth Loop Detection Test
 * Validates: redirect chains do not produce infinite loops
 */

import { NextRequest, NextResponse } from "next/server";
import { followRedirects } from "../testServer";

describe("Auth Loop Detection", () => {
  it("should NOT loop when session-init has a valid sid", async () => {
    // Simulate: session-init with sid → dashboard (terminal, cookie-based auth)
    const handler = async (req: NextRequest) => {
      const url = new URL(req.url);

      if (url.pathname === "/api/auth/session-init" && url.searchParams.get("sid")) {
        return NextResponse.redirect(
          new URL("/dashboard", url.origin)
        );
      }

      // Dashboard is terminal when reached via proper redirect chain
      if (url.pathname === "/dashboard") {
        return new Response("OK", { status: 200 });
      }

      // Default: redirect to login
      return NextResponse.redirect(new URL("/login", url.origin));
    };

    const result = await followRedirects(
      handler,
      "http://localhost:3000/api/auth/session-init?sid=test-123"
    );

    expect(result.loopDetected).toBe(false);
    expect(result.chain.length).toBeLessThanOrEqual(3);
    expect(result.chain[result.chain.length - 1]).toContain("/dashboard");
  });

  it("should detect loop when session-init redirects back to login which redirects to session-init", async () => {
    // Simulate broken flow: session-init → login → session-init (loop)
    const handler = async (req: NextRequest) => {
      const url = new URL(req.url);

      if (url.pathname === "/api/auth/session-init") {
        return NextResponse.redirect(new URL("/login", url.origin));
      }

      if (url.pathname === "/login") {
        return NextResponse.redirect(
          new URL("/api/auth/session-init", url.origin)
        );
      }

      return new Response("OK", { status: 200 });
    };

    const result = await followRedirects(
      handler,
      "http://localhost:3000/api/auth/session-init"
    );

    expect(result.loopDetected).toBe(true);
  });

  it("should detect loop when middleware keeps redirecting to login", async () => {
    // Simulate: dashboard → login → dashboard → login (loop)
    const handler = async (req: NextRequest) => {
      const url = new URL(req.url);

      if (url.pathname === "/dashboard") {
        return NextResponse.redirect(new URL("/login", url.origin));
      }

      if (url.pathname === "/login") {
        return NextResponse.redirect(new URL("/dashboard", url.origin));
      }

      return new Response("OK", { status: 200 });
    };

    const result = await followRedirects(
      handler,
      "http://localhost:3000/dashboard"
    );

    expect(result.loopDetected).toBe(true);
  });

  it("should cap redirect chain at maxRedirects to prevent hangs", async () => {
    let counter = 0;
    const handler = async (req: NextRequest) => {
      counter++;
      const url = new URL(req.url);
      // Always redirect to a unique URL to avoid loop detection but test max cap
      return NextResponse.redirect(
        new URL(`/step-${counter}`, url.origin)
      );
    };

    const result = await followRedirects(
      handler,
      "http://localhost:3000/start",
      { maxRedirects: 5 }
    );

    // Should stop at max redirects without loop detection
    expect(result.chain.length).toBeLessThanOrEqual(6); // start + 5 redirects
    expect(result.loopDetected).toBe(false);
  });
});
