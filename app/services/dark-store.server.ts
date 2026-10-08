/**
 * Server-only dark-store-api partner client.
 * Holds the platform PARTNER_API_KEY — never import this from client components.
 */

export type DarkStoreUser = {
  userId: string;
  businessId: string;
  role: string;
  storeId: string | null;
  email: string;
  name: string;
};

export type DarkStoreSession = {
  token: string;
  user: DarkStoreUser;
  business: { id: string; name: string };
  stores: Array<{ id: string; name: string; status: string; address: string }>;
  passwordSet: boolean;
};

type PartnerErrorBody = {
  error?: string;
  code?: string;
};

export class DarkStorePartnerError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "DarkStorePartnerError";
  }
}

function apiBase(): string {
  const url = process.env.DARK_STORE_API_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error("DARK_STORE_API_URL is not set");
  }
  return url;
}

function partnerKey(): string {
  const key = process.env.PARTNER_API_KEY;
  if (!key) {
    throw new Error("PARTNER_API_KEY is not set");
  }
  return key;
}

async function partnerPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": partnerKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = res.statusText || "Partner API request failed";
    let code: string | undefined;
    try {
      const data = (await res.json()) as PartnerErrorBody;
      if (data.error) message = data.error;
      code = data.code;
    } catch {
      // ignore non-JSON
    }
    throw new DarkStorePartnerError(res.status, message, code);
  }

  return (await res.json()) as T;
}

export type ProvisionInput = {
  externalId: string;
  organizationName: string;
  displayName?: string;
  admin: { email: string; name: string; password?: string };
  store?: { name: string; address: string; activate?: boolean };
  metadata?: Record<string, unknown>;
  shopifyAccessToken?: string;
};

/** First install — idempotent on (shopify, shop domain). */
export async function provisionPartner(input: ProvisionInput) {
  return partnerPost<DarkStoreSession & { created: boolean }>("/api/partner/provision", {
    provider: "shopify",
    ...input,
  });
}

/** App-open login — returns a fresh business_admin JWT. */
export async function partnerSession(
  externalId: string,
  adminEmail?: string,
  shopifyAccessToken?: string,
) {
  return partnerPost<DarkStoreSession>("/api/partner/session", {
    provider: "shopify",
    externalId,
    ...(adminEmail ? { adminEmail } : {}),
    ...(shopifyAccessToken ? { shopifyAccessToken } : {}),
  });
}

/** Soft-unlink Shopify installation. */
export async function partnerUninstall(externalId: string) {
  return partnerPost<{ id: string }>("/api/partner/uninstall", {
    provider: "shopify",
    externalId,
  });
}

/** Forward Shopify orders/create webhook payload into dark-store. */
export async function partnerIngestShopifyOrder(shop: string, order: unknown) {
  return partnerPost<{
    skipped: boolean;
    reason?: string;
    created?: boolean;
    orderId?: string;
    orderNumber?: string | null;
    storeId?: string;
    shopifyOrderId?: string;
  }>("/api/partner/shopify/orders", {
    provider: "shopify",
    externalId: shop.toLowerCase(),
    order,
  });
}

/**
 * Resolve a staff JWT for this shop.
 * Tries /session; on INSTALLATION_NOT_FOUND runs /provision then /session.
 */
export async function ensureDarkStoreSession(opts: {
  shop: string;
  organizationName: string;
  adminEmail: string;
  adminName: string;
  shopifyAccessToken?: string;
}): Promise<DarkStoreSession> {
  const externalId = opts.shop.trim().toLowerCase();

  try {
    return await partnerSession(externalId, opts.adminEmail, opts.shopifyAccessToken);
  } catch (err) {
    if (!(err instanceof DarkStorePartnerError) || err.code !== "INSTALLATION_NOT_FOUND") {
      throw err;
    }
  }

  await provisionPartner({
    externalId,
    organizationName: opts.organizationName,
    displayName: opts.organizationName,
    admin: {
      email: opts.adminEmail,
      name: opts.adminName,
    },
    metadata: { shop: opts.shop },
    shopifyAccessToken: opts.shopifyAccessToken,
  });

  return partnerSession(externalId, opts.adminEmail, opts.shopifyAccessToken);
}

export function isDarkStoreConfigured(): boolean {
  return Boolean(process.env.DARK_STORE_API_URL && process.env.PARTNER_API_KEY);
}

export function getDarkStoreApiUrl(): string {
  return process.env.DARK_STORE_API_URL?.replace(/\/$/, "") ?? "";
}
