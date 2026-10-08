import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getDarkStoreApiUrl, isDarkStoreConfigured } from "../services/dark-store.server";

/**
 * Same-origin proxy for browser → dark-store-api.
 * Embedded Shopify admin is HTTPS; calling http://localhost:3001 from the
 * browser is blocked as mixed content. This route keeps the JWT client-side
 * and forwards to the API from the Node server.
 */
async function proxy(request: Request, splat: string | undefined) {
  if (!isDarkStoreConfigured()) {
    return Response.json(
      { error: "Dark Store API is not configured", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const path = (splat ?? "").replace(/^\/+/, "");
  if (!path.startsWith("api/")) {
    return Response.json({ error: "Invalid proxy path" }, { status: 400 });
  }

  const incomingUrl = new URL(request.url);
  const target = `${getDarkStoreApiUrl()}/${path}${incomingUrl.search}`;

  const headers = new Headers();
  const auth = request.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream unreachable";
    return Response.json(
      { error: `Dark Store API unreachable: ${message}`, code: "UPSTREAM_UNREACHABLE" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("Content-Type");
  if (upstreamType) responseHeaders.set("Content-Type", upstreamType);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return proxy(request, params["*"]);
}

export async function action({ request, params }: ActionFunctionArgs) {
  return proxy(request, params["*"]);
}
