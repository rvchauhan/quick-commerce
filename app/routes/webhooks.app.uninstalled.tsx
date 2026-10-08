import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  isDarkStoreConfigured,
  partnerUninstall,
} from "../services/dark-store.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (isDarkStoreConfigured()) {
    try {
      await partnerUninstall(shop.toLowerCase());
    } catch (err) {
      console.error("[dark-store] uninstall failed", err);
    }
  }

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
