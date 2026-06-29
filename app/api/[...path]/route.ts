const DEFAULT_API_UPSTREAM_URL = "https://client-portal-api.skill-wanderer.com";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const FORWARDED_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "x-session-id",
  "x-deployment-id",
  "x-contract-version",
  "x-correlation-id",
  "x-request-id",
  "x-idempotency-key",
  "cookie",
] as const;

const RESPONSE_HEADER_BLOCKLIST = new Set([
  ...HOP_BY_HOP_HEADERS,
  "content-encoding",
  "content-length",
  "set-cookie",
]);

type ProxyRequestInit = RequestInit & {
  duplex?: "half";
};

function getApiUpstreamUrl() {
  const rawUpstreamUrl =
    process.env.API_UPSTREAM_URL?.trim() || DEFAULT_API_UPSTREAM_URL;

  return new URL(rawUpstreamUrl);
}

function joinPathname(basePathname: string, requestPathname: string) {
  const normalizedBasePathname = basePathname.replace(/\/+$/, "");
  const normalizedRequestPathname = requestPathname.startsWith("/")
    ? requestPathname
    : `/${requestPathname}`;

  if (!normalizedBasePathname || normalizedBasePathname === "/") {
    return normalizedRequestPathname;
  }

  return `${normalizedBasePathname}${normalizedRequestPathname}`;
}

function buildUpstreamRequestUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const upstreamUrl = getApiUpstreamUrl();

  upstreamUrl.pathname = joinPathname(
    upstreamUrl.pathname,
    requestUrl.pathname
  );
  upstreamUrl.search = requestUrl.search;

  return upstreamUrl;
}

function getOriginalHost(request: Request) {
  return (
    request.headers.get("host")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    new URL(request.url).host
  );
}

function buildUpstreamRequestHeaders(request: Request) {
  const headers = new Headers();

  for (const headerName of FORWARDED_REQUEST_HEADERS) {
    if (HOP_BY_HOP_HEADERS.has(headerName)) {
      continue;
    }

    const headerValue = request.headers.get(headerName);

    if (headerValue !== null) {
      headers.set(headerName, headerValue);
    }
  }

  const originalHost = getOriginalHost(request);

  headers.set("X-Forwarded-Host", originalHost);
  headers.set("X-Forwarded-Proto", "https");
  headers.set("X-Original-Host", originalHost);

  return headers;
}

function buildUpstreamRequestInit(request: Request): ProxyRequestInit {
  const method = request.method.toUpperCase();
  const hasRequestBody = method !== "GET" && method !== "HEAD";
  const requestInit: ProxyRequestInit = {
    method,
    headers: buildUpstreamRequestHeaders(request),
    redirect: "manual",
  };

  if (hasRequestBody) {
    requestInit.body = request.body;
    requestInit.duplex = "half";
  }

  return requestInit;
}

function buildProxyResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers();

  upstreamHeaders.forEach((headerValue, headerName) => {
    if (!RESPONSE_HEADER_BLOCKLIST.has(headerName.toLowerCase())) {
      headers.set(headerName, headerValue);
    }
  });

  return headers;
}

async function proxyApiRequest(request: Request) {
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(
      buildUpstreamRequestUrl(request),
      buildUpstreamRequestInit(request)
    );
  } catch {
    return new Response("Bad Gateway", { status: 502 });
  }

  const responseBody =
    upstreamResponse.status === 204 || upstreamResponse.status === 304
      ? null
      : upstreamResponse.body;

  return new Response(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildProxyResponseHeaders(upstreamResponse.headers),
  });
}

export function GET(request: Request) {
  return proxyApiRequest(request);
}

export function POST(request: Request) {
  return proxyApiRequest(request);
}

export function PUT(request: Request) {
  return proxyApiRequest(request);
}

export function PATCH(request: Request) {
  return proxyApiRequest(request);
}

export function DELETE(request: Request) {
  return proxyApiRequest(request);
}

export function OPTIONS(request: Request) {
  return proxyApiRequest(request);
}
