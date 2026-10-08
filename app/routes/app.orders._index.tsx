import { useState } from "react";
import type { HeadersFunction } from "react-router";
import { Link, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PortalShell,
  StatCard,
  statusTone,
} from "app/components/portal-ui";
import { listNetworkOrders, listStores } from "app/lib/dark-store/api";
import { useDarkStore } from "app/lib/dark-store/context";
import type { NetworkOrder, OrderStatus } from "app/lib/dark-store/types";
import { formatOrderLabel } from "app/lib/dark-store/types";
import { darkStoreSessionKey, useAsyncData } from "app/lib/dark-store/use-async-data";

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Shipped",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

type StatusFilter = "active" | "fulfilled" | "all";

function formatMoney(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return `₹${Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const ds = useDarkStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get("status") as StatusFilter | null) ?? "all";
  const storeId = searchParams.get("storeId") ?? "";
  const [search, setSearch] = useState("");
  const sessionKey = darkStoreSessionKey(ds);

  const ordersQuery = useAsyncData(
    `network-orders:${status}:${storeId}:${sessionKey}`,
    () =>
      listNetworkOrders({
        status,
        storeId: storeId || undefined,
      }),
    ds.configured,
  );
  const storesQuery = useAsyncData(
    `stores-for-orders:${sessionKey}`,
    () => listStores(),
    ds.configured,
  );

  const orders = ordersQuery.data?.data ?? [];
  const stores = storesQuery.data?.data ?? [];
  const q = search.trim().toLowerCase();
  const visible = !q
    ? orders
    : orders.filter((o) =>
        `${o.id} ${o.customerName} ${o.storeName} ${o.storeCode ?? ""}`
          .toLowerCase()
          .includes(q),
      );

  const activeCount = orders.filter((o) =>
    ["placed", "confirmed", "preparing", "out_for_delivery"].includes(o.status),
  ).length;
  const fulfilledCount = orders.filter(
    (o) => o.status === "fulfilled" || o.status === "cancelled",
  ).length;

  const setFilter = (next: Partial<{ status: StatusFilter; storeId: string }>) => {
    const params = new URLSearchParams(searchParams);
    if (next.status) params.set("status", next.status);
    if (next.storeId !== undefined) {
      if (next.storeId) params.set("storeId", next.storeId);
      else params.delete("storeId");
    }
    setSearchParams(params);
  };

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Orders"]} title="Orders" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Management", "Orders"]}
        title="Orders"
        subtitle="Network-wide view of dark store orders — status, quantities, and totals."
        actions={
          <div className="qc-search">
            <span className="material-symbols-outlined">search</span>
            <input
              className="qc-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, customer, store…"
            />
          </div>
        }
      />

      {ordersQuery.error ? (
        <Banner tone="critical" title="Failed to load orders">
          {ordersQuery.error}
        </Banner>
      ) : null}

      <div className="qc-stat-grid cols-3">
        <StatCard
          icon="shopping_bag"
          label="Showing"
          value={ordersQuery.loading ? "—" : String(visible.length)}
        />
        <StatCard
          icon="pending_actions"
          label="Active in view"
          value={ordersQuery.loading ? "—" : String(activeCount)}
          tone="warning"
        />
        <StatCard
          icon="check_circle"
          label="Fulfilled in view"
          value={ordersQuery.loading ? "—" : String(fulfilledCount)}
          tone="success"
        />
      </div>

      <Panel
        title="Order list"
        meta={
          <div className="qc-filter-bar">
            <div className="qc-status-pills">
              {(["all", "active", "fulfilled"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`qc-status-pill ${status === option ? "active" : ""}`}
                  onClick={() => setFilter({ status: option })}
                >
                  <span className="dot" />
                  {option === "all" ? "All" : option === "active" ? "Active" : "Fulfilled"}
                </button>
              ))}
            </div>
            <select
              className="qc-input"
              style={{ maxWidth: "14rem" }}
              value={storeId}
              onChange={(e) => setFilter({ storeId: e.target.value })}
            >
              <option value="">All dark stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        }
        flush
      >
        {ordersQuery.loading ? (
          <EmptyState>Loading orders…</EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState>No orders match these filters.</EmptyState>
        ) : (
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Store</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Placed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((order: NetworkOrder) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/app/orders/${order.id}`}>{formatOrderLabel(order)}</Link>
                    </td>
                    <td>
                      <Link to={`/app/stores/${order.storeId}`}>{order.storeName}</Link>
                      {order.storeCode ? (
                        <div className="qc-muted" style={{ fontSize: "0.75rem" }}>
                          {order.storeCode}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={statusTone(order.status)}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </td>
                    <td>{order.customerName}</td>
                    <td>
                      {order.totalUnits}{" "}
                      <span className="qc-muted">
                        ({order.itemCount} line{order.itemCount === 1 ? "" : "s"})
                      </span>
                    </td>
                    <td>{formatMoney(order.totalAmount)}</td>
                    <td>{formatWhen(order.createdAt)}</td>
                    <td>
                      <Button variant="secondary" to={`/app/orders/${order.id}`}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PortalShell>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
