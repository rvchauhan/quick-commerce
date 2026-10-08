import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate, getShopifyAdminAccessToken } from "../shopify.server";
import {
  DarkStorePartnerError,
  ensureDarkStoreSession,
  isDarkStoreConfigured,
} from "../services/dark-store.server";
import { DarkStoreProvider, type DarkStoreAppContext } from "../lib/dark-store/context";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  if (!isDarkStoreConfigured()) {
    return {
      apiKey,
      darkStore: {
        configured: false as const,
        error:
          "Set PARTNER_API_KEY and DARK_STORE_API_URL in the app env to connect dark-store-api.",
      } satisfies DarkStoreAppContext,
    };
  }

  const shop = session.shop.toLowerCase();
  const organizationName = shop.replace(/\.myshopify\.com$/, "");
  const associatedUser = session.onlineAccessInfo?.associated_user;
  const adminEmail = associatedUser?.email || `owner@${shop}`;
  const adminName =
    [associatedUser?.first_name, associatedUser?.last_name]
      .filter(Boolean)
      .join(" ") || "Store Owner";

  try {
    const shopifyAccessToken = await getShopifyAdminAccessToken(shop);

    const ds = await ensureDarkStoreSession({
      shop,
      organizationName,
      adminEmail,
      adminName,
      shopifyAccessToken,
    });

    return {
      apiKey,
      darkStore: {
        configured: true as const,
        // Browser must not call http://localhost from an HTTPS admin embed
        // (mixed content). Proxy through this app instead.
        apiUrl: "/api/dark-store",
        token: ds.token,
        user: ds.user,
        business: ds.business,
      } satisfies DarkStoreAppContext,
    };
  } catch (err) {
    const message =
      err instanceof DarkStorePartnerError
        ? `${err.message}${err.code ? ` (${err.code})` : ""}`
        : err instanceof Error
          ? err.message
          : "Failed to connect to dark-store-api";

    return {
      apiKey,
      darkStore: {
        configured: false as const,
        error: message,
      } satisfies DarkStoreAppContext,
    };
  }
};

export default function App() {
  const { apiKey, darkStore } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/orders">Orders</s-link>
        <s-link href="/app/catalog">Master Catalog</s-link>
        <s-link href="/app/stores">Dark Stores</s-link>
        <s-link href="/app/inventory">Inventory</s-link>
        <s-link href="/app/pricing">Pricing</s-link>
        <s-link href="/app/analytics">Analytics</s-link>
      </s-app-nav>
      <DarkStoreProvider value={darkStore}>
        <Outlet />
      </DarkStoreProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
