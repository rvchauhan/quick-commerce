import type { LoaderFunctionArgs } from "react-router";
import { getDarkStoreApiUrl, isDarkStoreConfigured } from "../services/dark-store.server";

/**
 * Proxy product images from dark-store-api /uploads so the HTTPS Shopify embed
 * can display them without mixed-content blocks.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!isDarkStoreConfigured()) {
    return new Response("Uploads unavailable", { status: 503 });
  }

  const splat = (params["*"] ?? "").replace(/^\/+/, "");
  if (!splat || splat.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const target = `${getDarkStoreApiUrl()}/uploads/${splat}`;
  try {
    const upstream = await fetch(target, {
      headers: { Accept: request.headers.get("Accept") ?? "*/*" },
    });
    const headers = new Headers();
    const contentType = upstream.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    const cacheControl = upstream.headers.get("Cache-Control");
    if (cacheControl) headers.set("Cache-Control", cacheControl);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
}
