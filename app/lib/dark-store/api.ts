import { ApiError } from "./types";
import type {
  AnalyticsOverview,
  CatalogMeta,
  CatalogSku,
  CreateSkuInput,
  CreateStoreInput,
  DashboardStats,
  GeocodeResult,
  InventoryRow,
  NetworkOrder,
  NetworkOrderDetail,
  NetworkOrderItem,
  SkuMapping,
  Store,
} from "./types";

/**
 * Browser client for dark-store-api.
 * Uses the staff JWT from partner /session (never the platform partner key).
 */

let apiBase = "";
let bearerToken: string | null = null;

export function configureDarkStoreClient(opts: { apiUrl: string; token: string }) {
  apiBase = opts.apiUrl.replace(/\/$/, "");
  bearerToken = opts.token;
}

export function resetDarkStoreClient() {
  apiBase = "";
  bearerToken = null;
}

export function isDarkStoreClientReady() {
  return Boolean(apiBase && bearerToken);
}

export function getDarkStoreToken(): string | null {
  return bearerToken;
}

async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!apiBase || !bearerToken) {
    throw new ApiError(401, "Dark Store session not ready", "NO_SESSION");
  }

  const { method = "GET", body } = options;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearerToken}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let code: string | undefined;
    try {
      const data = (await res.json()) as { error?: string; code?: string };
      if (data.error) message = data.error;
      code = data.code;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listSkus(params?: { status?: string; search?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return apiRequest<{ data: CatalogSku[] }>(`/api/catalog/skus${qs ? `?${qs}` : ""}`);
}

export function getCatalogMeta() {
  return apiRequest<CatalogMeta>("/api/catalog/meta");
}

export function createSku(body: CreateSkuInput) {
  return apiRequest<CatalogSku>("/api/catalog/skus", { method: "POST", body });
}

export function updateSku(
  skuId: string,
  body: Partial<Omit<CreateSkuInput, "status">> & {
    status?: "draft" | "active" | "archived";
  },
) {
  return apiRequest<CatalogSku>(`/api/catalog/skus/${skuId}`, { method: "PATCH", body });
}

/** Soft-delete: archives the SKU so it can no longer be assigned to stores. */
export function deleteSku(skuId: string) {
  return updateSku(skuId, { status: "archived" });
}

/** Uploads a product image as base64 JSON; resolves to its public URL. */
export async function uploadCatalogImage(file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  return apiRequest<{ url: string }>("/api/catalog/uploads", {
    method: "POST",
    body: { fileName: file.name, mimeType: file.type, data },
  });
}

export function listStores() {
  return apiRequest<{ data: Store[] }>("/api/stores");
}

export function getStore(storeId: string) {
  return apiRequest<Store>(`/api/stores/${storeId}`);
}

export function getDashboardStats() {
  return apiRequest<DashboardStats>("/api/stores/dashboard-stats");
}

export function getAnalyticsOverview() {
  return apiRequest<AnalyticsOverview>("/api/analytics/overview");
}

export function createStore(body: CreateStoreInput) {
  return apiRequest<Store>("/api/stores", { method: "POST", body });
}

export function updateStore(storeId: string, body: Partial<CreateStoreInput>) {
  return apiRequest<Store>(`/api/stores/${storeId}`, { method: "PATCH", body });
}

export function activateStore(storeId: string) {
  return apiRequest<Store>(`/api/stores/${storeId}/activate`, { method: "POST" });
}

export function inviteManager(body: { email: string; name: string; storeId: string }) {
  return apiRequest<{
    user: { id: string; email: string; name: string };
    inviteToken: string;
    inviteLink: string;
    expiresAt: string;
    emailSent: boolean;
  }>("/api/auth/invite-manager", { method: "POST", body });
}

export function checkManagerEmail(body: { email: string; storeId?: string }) {
  return apiRequest<{ available: boolean }>("/api/auth/check-manager-email", {
    method: "POST",
    body,
  });
}

export function geocodeAddress(input: {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}) {
  const q = new URLSearchParams();
  if (input.street) q.set("street", input.street);
  if (input.city) q.set("city", input.city);
  if (input.postalCode) q.set("postalCode", input.postalCode);
  if (input.country) q.set("country", input.country);
  return apiRequest<GeocodeResult>(`/api/geo/lookup?${q}`);
}

export function listSkuMappings(storeId: string) {
  return apiRequest<{ data: SkuMapping[] }>(`/api/stores/${storeId}/sku-mappings`);
}

export function assignSkuMapping(
  storeId: string,
  body: {
    skuId: string;
    priceOverride?: number | null;
    isListed?: boolean;
    reorderThreshold?: number;
  },
) {
  return apiRequest<SkuMapping>(`/api/stores/${storeId}/sku-mappings`, {
    method: "POST",
    body,
  });
}

export function updateSkuMapping(
  storeId: string,
  skuId: string,
  body: {
    priceOverride?: number | null;
    isListed?: boolean;
    reorderThreshold?: number;
  },
) {
  return apiRequest<SkuMapping>(`/api/stores/${storeId}/sku-mappings/${skuId}`, {
    method: "PATCH",
    body,
  });
}

export function bulkSkuMappings(
  storeId: string,
  body: {
    mappings?: Array<{
      skuId?: string;
      barcode?: string;
      priceOverride?: number | null;
      isListed?: boolean;
      reorderThreshold?: number;
    }>;
    csv?: string;
  },
) {
  return apiRequest<{ assigned: number; data: SkuMapping[] }>(
    `/api/stores/${storeId}/sku-mappings/bulk`,
    { method: "POST", body },
  );
}

export function stockIn(
  storeId: string,
  body: { skuId: string; quantity: number; source?: string },
) {
  return apiRequest(`/api/stores/${storeId}/inventory/stock-in`, { method: "POST", body });
}

export function listInventory(storeId: string) {
  return apiRequest<{ data: InventoryRow[] }>(`/api/stores/${storeId}/inventory`);
}

export function listNetworkOrders(params?: {
  status?: "active" | "all" | "fulfilled";
  storeId?: string;
}) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.storeId) q.set("storeId", params.storeId);
  const qs = q.toString();
  return apiRequest<{ data: NetworkOrder[] }>(
    `/api/stores/network-orders${qs ? `?${qs}` : ""}`,
  );
}

export function getNetworkOrder(orderId: string) {
  return apiRequest<{ order: NetworkOrderDetail; items: NetworkOrderItem[] }>(
    `/api/stores/network-orders/${orderId}`,
  );
}
