import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import {
  isDarkStoreConfigured,
  provisionPartner,
  DarkStorePartnerError,
} from "./services/dark-store.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  hooks: {
    /**
     * After Shopify OAuth / token exchange — register the merchant in dark-store-api.
     * Idempotent; safe to run on re-auth.
     */
    afterAuth: async ({ session, admin }) => {
      if (!isDarkStoreConfigured()) {
        console.warn(
          "[dark-store] PARTNER_API_KEY / DARK_STORE_API_URL not set — skip provision",
        );
        return;
      }

      const shop = session.shop.toLowerCase();
      let organizationName = shop.replace(/\.myshopify\.com$/, "");
      const associatedUser = session.onlineAccessInfo?.associated_user;
      let adminEmail = associatedUser?.email || `owner@${shop}`;
      let adminName =
        [associatedUser?.first_name, associatedUser?.last_name]
          .filter(Boolean)
          .join(" ") || "Store Owner";

      try {
        const response = await admin.graphql(
          `#graphql
          query ShopForProvision {
            shop {
              name
              email
              contactEmail
            }
          }`,
        );
        const json = await response.json();
        const shopData = json.data?.shop as
          | { name?: string; email?: string; contactEmail?: string }
          | undefined;
        if (shopData?.name) organizationName = shopData.name;
        if (shopData?.email || shopData?.contactEmail) {
          adminEmail = shopData.email || shopData.contactEmail || adminEmail;
        }
      } catch (err) {
        console.warn("[dark-store] Could not load shop profile for provision", err);
      }

      try {
        const offline = await unauthenticated.admin(shop);
        const shopifyAccessToken = offline.session.accessToken;

        await provisionPartner({
          externalId: shop,
          organizationName,
          displayName: organizationName,
          admin: { email: adminEmail, name: adminName },
          metadata: { shop, provisionedFrom: "shopify-afterAuth" },
          shopifyAccessToken,
        });
      } catch (err) {
        if (err instanceof DarkStorePartnerError) {
          console.error(
            `[dark-store] provision failed (${err.code ?? err.status}): ${err.message}`,
          );
        } else {
          console.error("[dark-store] provision failed", err);
        }
      }
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

/** Offline Admin API token — refreshed automatically when expiring. */
export async function getShopifyAdminAccessToken(shop: string): Promise<string | undefined> {
  try {
    const { session } = await unauthenticated.admin(shop.toLowerCase());
    return session.accessToken;
  } catch (err) {
    console.warn("[shopify] Could not load offline admin session", err);
    return undefined;
  }
}
