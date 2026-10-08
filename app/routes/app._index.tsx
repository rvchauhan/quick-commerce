import { Link } from "react-router";
import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useDarkStore } from "../lib/dark-store/context";
import { getDashboardStats, listNetworkOrders } from "../lib/dark-store/api";
import { useAsyncData, darkStoreSessionKey } from "../lib/dark-store/use-async-data";
import { formatOrderLabel, type OrderStatus } from "../lib/dark-store/types";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PortalShell,
  SessionChip,
  SimpleBars,
  StatCard,
  statusTone,
} from "../components/portal-ui";

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Shipped",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export default function Dashboard() {
  const ds = useDarkStore();
  const sessionKey = darkStoreSessionKey(ds);
  const { data, error, loading } = useAsyncData(
    `dashboard:${sessionKey}`,
    () => getDashboardStats(),
    ds.configured,
  );
  const activeOrdersQuery = useAsyncData(
    `dashboard-active-orders:${sessionKey}`,
    () => listNetworkOrders({ status: "active" }),
    ds.configured,
  );

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Dashboard"]} title="Operations Overview" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  const stats = data;
  const perStorePicked = stats?.perStorePicked ?? [];
  const topPerformers = perStorePicked.slice(0, 4);
  const chartItems = perStorePicked.slice(0, 8).map((row) => ({
    key: row.storeId,
    label: row.storeCode || row.storeName.slice(0, 8),
    value: row.pickedUnits,
  }));
  const attentionOrders = (activeOrdersQuery.data?.data ?? []).slice(0, 5);

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Management", "Dashboard"]}
        title="Operations Overview"
        subtitle="Network-wide fulfillment performance at a glance."
        actions={
          <>
            <SessionChip name={ds.user.name} email={ds.user.email} />
            <Button variant="secondary" to="/app/orders">
              View Orders
            </Button>
            <Button icon="add_business" to="/app/stores/new">
              Add Dark Store
            </Button>
          </>
        }
      />

      {error && (
        <Banner tone="critical" title="Could not load dashboard">
          <p>{error}</p>
          <p>Ensure dark-store-api is running (default http://localhost:3001).</p>
        </Banner>
      )}

      <div className="qc-stat-grid cols-4">
        <StatCard
          icon="storefront"
          label="Active Dark Stores"
          value={loading && !stats ? "—" : String(stats?.activeStores ?? 0)}
        />
        <StatCard
          icon="inventory_2"
          label="SKUs in Catalog"
          value={loading && !stats ? "—" : String(stats?.skusInCatalog ?? 0)}
          tone="success"
        />
        <StatCard
          icon="local_shipping"
          label="Units Picked (24h)"
          value={loading && !stats ? "—" : (stats?.totalPickedUnits24h ?? 0).toLocaleString()}
        />
        <StatCard
          icon="warning"
          label="Low Stock Alerts"
          value={loading && !stats ? "—" : String(stats?.lowStockAlerts ?? 0)}
          tone="warning"
          to="/app/inventory"
        />
      </div>

      <div className="qc-split">
        <Panel title="Units picked by store" meta="Last 24h">
          {loading && !stats ? (
            <EmptyState>Loading…</EmptyState>
          ) : chartItems.length === 0 ? (
            <EmptyState>No stores yet.</EmptyState>
          ) : (
            <SimpleBars items={chartItems} />
          )}
        </Panel>

        <Panel title="Top performers" meta="Ranked by units picked">
          {loading && !stats ? (
            <EmptyState>Loading…</EmptyState>
          ) : topPerformers.length === 0 ? (
            <EmptyState>No stores yet.</EmptyState>
          ) : (
            <ul className="qc-list">
              {topPerformers.map((row) => (
                <li key={row.storeId}>
                  <span className="qc-list-name">{row.storeName}</span>
                  <span className="qc-list-value">{row.pickedUnits.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="qc-muted" style={{ marginTop: "0.85rem" }}>
            Business: {ds.business.name}.{" "}
            <Link to="/app/stores">Open dark stores</Link>
          </p>
        </Panel>
      </div>

      <Panel
        title="Active orders needing attention"
        meta={
          <Link to="/app/orders?status=active" className="qc-text-link">
            View all active
          </Link>
        }
        flush
      >
        {activeOrdersQuery.loading ? (
          <EmptyState>Loading…</EmptyState>
        ) : attentionOrders.length === 0 ? (
          <EmptyState>No active orders right now.</EmptyState>
        ) : (
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Store</th>
                  <th>Status</th>
                  <th>Qty</th>
                  <th>Customer</th>
                </tr>
              </thead>
              <tbody>
                {attentionOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/app/orders/${order.id}`}>{formatOrderLabel(order)}</Link>
                    </td>
                    <td>{order.storeName}</td>
                    <td>
                      <Badge tone={statusTone(order.status)}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </td>
                    <td>{order.totalUnits}</td>
                    <td>{order.customerName}</td>
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
