import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  isDarkStoreConfigured,
  partnerIngestShopifyOrder,
  DarkStorePartnerError,
} from "../services/dark-store.server";

/**
 * Shopify orders/create → dark-store ingest.
 * Brings Online Store (and other channel) orders into QC / portal.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!isDarkStoreConfigured()) {
    console.warn("[dark-store] not configured — skip order ingest");
    return new Response();
  }

  try {
    const result = await partnerIngestShopifyOrder(shop.toLowerCase(), payload);
    console.log("[dark-store] order ingest result", result);
  } catch (err) {
    if (err instanceof DarkStorePartnerError) {
      console.error(
        `[dark-store] order ingest failed (${err.code ?? err.status}): ${err.message}`,
      );
    } else {
      console.error("[dark-store] order ingest failed", err);
    }
    // Return 200 so Shopify does not retry endlessly for mapping/config errors.
    // Transient failures can be re-synced manually if needed.
  }

  return new Response();
};
