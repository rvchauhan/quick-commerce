/**
 * Types for dark-store-api admin responses used by the Shopify admin UI.
 */

export type ApiUser = {
  userId: string;
  businessId: string;
  role: string;
  storeId: string | null;
  email: string;
  name: string;
};

export type SkuDimensions = {
  length: number;
  width: number;
  height: number;
};

export type VariantOption = {
  name: string;
  values: string[];
};

/** Alias used by Add SKU form — same shape as VariantOption. */
export type SkuVariantOption = VariantOption;

export type SkuSpec = {
  key: string;
  value: string;
};

export type SkuVariant = {
  id: string;
  options: Record<string, string>;
  price?: number;
  barcode?: string;
  stock?: number;
};

export type CatalogSku = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  barcode: string | null;
  basePrice: string;
  currency: string;
  compareAtPrice?: string | null;
  costPrice?: string | null;
  taxRate?: string;
  allowBackorder?: boolean;
  unitOfMeasure?: string;
  skuCode: string | null;
  isFragile?: boolean;
  requiresColdStorage?: boolean;
  weightKg?: string | null;
  dimensionsCm?: SkuDimensions | null;
  defaultReorderPoint?: number;
  defaultInitialStock?: number | null;
  variantOptions?: VariantOption[];
  variants?: SkuVariant[];
  images: string[];
  description?: string | null;
  specs?: SkuSpec[];
  status: "draft" | "active" | "archived";
  createdAt: string;
};

export type CatalogMeta = {
  brands: string[];
  categories: string[];
};

export type CreateSkuInput = {
  name: string;
  brand?: string;
  category?: string;
  barcode?: string;
  basePrice: number;
  currency?: string;
  compareAtPrice?: number;
  costPrice?: number;
  taxRate?: number;
  allowBackorder?: boolean;
  unitOfMeasure?: string;
  skuCode?: string;
  isFragile?: boolean;
  requiresColdStorage?: boolean;
  weightKg?: number;
  dimensionsCm?: SkuDimensions;
  defaultReorderPoint?: number;
  defaultInitialStock?: number;
  variantOptions?: VariantOption[];
  variants?: SkuVariant[];
  description?: string;
  images?: string[];
  specs?: SkuSpec[];
  status?: "draft" | "active";
};

export type Store = {
  id: string;
  name: string;
  code: string | null;
  address: string;
  status: "onboarding" | "active" | "inactive" | "closed";
  managerName: string | null;
  managerEmail: string | null;
  managerStatus?: string | null;
  geofence?: Record<string, unknown> | null;
  operatingHours?: Record<string, unknown> | null;
  facility?: Record<string, unknown> | null;
  createdAt: string;
};

export type CreateStoreInput = {
  name: string;
  code?: string;
  address: string;
  geofence: Record<string, unknown>;
  operatingHours: Record<string, unknown>;
  facility?: Record<string, unknown>;
  managerEmail?: string;
  managerName?: string;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
  precision: "exact" | "approximate";
};

export type SkuMapping = {
  id: string;
  storeId: string;
  skuId: string;
  priceOverride: string | null;
  isListed: boolean;
  reorderThreshold: number;
  skuName: string;
  brand: string | null;
  category: string | null;
  barcode: string | null;
  basePrice: string;
  catalogStatus: string;
};

export type InventoryRow = {
  skuId: string;
  skuName?: string;
  availableQty: number;
  reorderThreshold?: number;
};

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "fulfilled"
  | "cancelled";

export function formatOrderLabel(order: { id: string; orderNumber?: string | null }): string {
  return order.orderNumber ?? `#${order.id.slice(0, 8)}`;
}

export type NetworkOrder = {
  id: string;
  orderNumber: string | null;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  status: OrderStatus;
  paymentMethod: string;
  itemsTotal: string;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  itemCount: number;
  totalUnits: number;
};

export type NetworkOrderItem = {
  id: string;
  orderId: string;
  skuId: string;
  nameSnapshot: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  brand: string | null;
  category: string | null;
  images: string[] | null;
};

export type NetworkOrderDetail = {
  id: string;
  orderNumber: string | null;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  status: OrderStatus;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    phone: string;
  };
  paymentMethod: string;
  itemsTotal: string;
  deliveryFee: string;
  handlingFee: string;
  totalAmount: string;
  trackingName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerPhone: string | null;
};

export type StorePickedStat = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  pickedUnits: number;
};

export type DashboardStats = {
  since: string;
  activeStores: number;
  totalStores: number;
  skusInCatalog: number;
  totalPickedUnits24h: number;
  lowStockAlerts: number;
  perStorePicked: StorePickedStat[];
};

export type AnalyticsOverview = {
  windowDays: number;
  revenueTrend: { day: string; revenue: number; orderCount: number }[];
  unitsTrend: { day: string; units: number }[];
  topSkus: { skuId: string; name: string; unitsSold: number; revenue: number }[];
  slowMovers: { skuId: string; name: string; unitsSold: number; revenue: number }[];
  statusBreakdown: { status: string; count: number }[];
  avgFulfillmentMinutes: number | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Rewrite localhost upload URLs so the embedded HTTPS app can display them. */
export function toAppMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // already relative or invalid
  }
  return url;
}
