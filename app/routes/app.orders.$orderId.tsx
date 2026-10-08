import type { HeadersFunction } from "react-router";
import { Link, useParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PortalShell,
  statusTone,
} from "app/components/portal-ui";
import { getNetworkOrder } from "app/lib/dark-store/api";
import { useDarkStore } from "app/lib/dark-store/context";
import { formatOrderLabel, type OrderStatus } from "app/lib/dark-store/types";
import { darkStoreSessionKey, useAsyncData } from "app/lib/dark-store/use-async-data";

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Shipped",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

function formatMoney(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return `₹${Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
}

export default function OrderDetailPage() {
  const { orderId = "" } = useParams();
  const ds = useDarkStore();
  const sessionKey = darkStoreSessionKey(ds);

  const detailQuery = useAsyncData(
    `network-order:${orderId}:${sessionKey}`,
    () => getNetworkOrder(orderId),
    ds.configured && Boolean(orderId),
  );

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Orders", "Detail"]} title="Order detail" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  if (detailQuery.loading) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Orders"]} title="Loading…" />
        <EmptyState>Loading order…</EmptyState>
      </PortalShell>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Orders"]} title="Order detail" />
        <Banner tone="critical" title="Failed to load order">
          {detailQuery.error ?? "Order not found"}
        </Banner>
        <Button variant="secondary" to="/app/orders">
          Back to Orders
        </Button>
      </PortalShell>
    );
  }

  const { order, items } = detailQuery.data;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Management", "Orders", formatOrderLabel(order)]}
        title={`Order ${formatOrderLabel(order)}`}
        subtitle={`${order.customerName} · ${order.storeName}`}
        actions={
          <>
            <Badge tone={statusTone(order.status)}>{STATUS_LABEL[order.status]}</Badge>
            <Button variant="secondary" to="/app/orders">
              Back to Orders
            </Button>
          </>
        }
      />

      <div className="qc-split">
        <Panel title="Line items" meta={`${totalUnits} units · ${items.length} lines`} flush>
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nameSnapshot}</strong>
                      {item.brand ? (
                        <div className="qc-muted" style={{ fontSize: "0.75rem" }}>
                          {item.brand}
                          {item.category ? ` · ${item.category}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice)}</td>
                    <td>{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="qc-stack">
          <Panel title="Fulfillment">
            <div className="qc-detail-row">
              <span className="qc-detail-label">Status</span>
              <span className="qc-detail-value">
                <Badge tone={statusTone(order.status)}>{STATUS_LABEL[order.status]}</Badge>
              </span>
            </div>
            <div className="qc-detail-row">
              <span className="qc-detail-label">Dark store</span>
              <span className="qc-detail-value">
                <Link to={`/app/stores/${order.storeId}`}>{order.storeName}</Link>
              </span>
            </div>
            <div className="qc-detail-row">
              <span className="qc-detail-label">Payment</span>
              <span className="qc-detail-value">{order.paymentMethod}</span>
            </div>
            <div className="qc-detail-row">
              <span className="qc-detail-label">Placed</span>
              <span className="qc-detail-value">
                {new Date(order.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="qc-detail-row">
              <span className="qc-detail-label">Updated</span>
              <span className="qc-detail-value">
                {new Date(order.updatedAt).toLocaleString()}
              </span>
            </div>
          </Panel>

          <Panel title="Delivery">
            <p style={{ margin: 0, fontWeight: 600 }}>{order.customerName}</p>
            {order.customerPhone ? (
              <p className="qc-muted" style={{ margin: "0.35rem 0 0" }}>
                {order.customerPhone}
              </p>
            ) : null}
            <p className="qc-muted" style={{ margin: "0.75rem 0 0" }}>
              {order.deliveryAddress.line1}
              {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ""}
              <br />
              {order.deliveryAddress.city}, {order.deliveryAddress.postalCode}
              <br />
              {order.deliveryAddress.phone}
            </p>
            {(order.trackingName || order.trackingNumber || order.trackingUrl) && (
              <div style={{ marginTop: "1rem" }}>
                {order.trackingName ? (
                  <div className="qc-detail-row">
                    <span className="qc-detail-label">Carrier</span>
                    <span className="qc-detail-value">{order.trackingName}</span>
                  </div>
                ) : null}
                {order.trackingNumber ? (
                  <div className="qc-detail-row">
                    <span className="qc-detail-label">Tracking ID</span>
                    <span className="qc-detail-value">{order.trackingNumber}</span>
                  </div>
                ) : null}
                {order.trackingUrl ? (
                  <div className="qc-detail-row">
                    <span className="qc-detail-label">Link</span>
                    <span className="qc-detail-value">
                      <a href={order.trackingUrl} target="_blank" rel="noreferrer">
                        View tracking
                      </a>
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel title="Totals">
            <div className="qc-detail-row">
              <span className="qc-detail-label">Items</span>
              <span className="qc-detail-value">{formatMoney(order.itemsTotal)}</span>
            </div>
            <div className="qc-detail-row">
              <span className="qc-detail-label">Delivery</span>
              <span className="qc-detail-value">{formatMoney(order.deliveryFee)}</span>
            </div>
            <div className="qc-detail-row">
              <span className="qc-detail-label">Handling</span>
              <span className="qc-detail-value">{formatMoney(order.handlingFee)}</span>
            </div>
            <div className="qc-detail-row">
              <span className="qc-detail-label">Total</span>
              <span className="qc-detail-value">{formatMoney(order.totalAmount)}</span>
            </div>
          </Panel>
        </div>
      </div>
    </PortalShell>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
