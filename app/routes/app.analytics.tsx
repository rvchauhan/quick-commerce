import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useDarkStore } from "../lib/dark-store/context";
import { getAnalyticsOverview } from "../lib/dark-store/api";
import { useAsyncData, darkStoreSessionKey } from "../lib/dark-store/use-async-data";
import {
  Banner,
  EmptyState,
  PageHeader,
  Panel,
  PortalShell,
  SimpleBars,
  StatCard,
} from "../components/portal-ui";

export default function AnalyticsPage() {
  const ds = useDarkStore();
  const { data, error, loading } = useAsyncData(
    `analytics:${darkStoreSessionKey(ds)}`,
    () => getAnalyticsOverview(),
    ds.configured,
  );

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Insights", "Analytics"]} title="Analytics" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  const orderCount = (data?.statusBreakdown ?? []).reduce((sum, row) => sum + row.count, 0);
  const trendItems = (data?.revenueTrend ?? []).slice(-8).map((row) => ({
    key: row.day,
    label: row.day.slice(5),
    value: Math.round(row.revenue),
  }));

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Insights", "Analytics"]}
        title="Analytics"
        subtitle={`Performance snapshot for the last ${data?.windowDays ?? "—"} days.`}
      />

      {error && (
        <Banner tone="critical" title="Failed to load analytics">
          {error}
        </Banner>
      )}

      <div className="qc-stat-grid cols-3">
        <StatCard
          icon="timer"
          label="Avg fulfillment (min)"
          value={
            loading && !data
              ? "—"
              : data?.avgFulfillmentMinutes != null
                ? Math.round(data.avgFulfillmentMinutes).toString()
                : "—"
          }
        />
        <StatCard
          icon="shopping_cart"
          label="Orders (window)"
          value={loading && !data ? "—" : String(orderCount)}
          tone="success"
        />
        <StatCard
          icon="monitoring"
          label="Top SKUs tracked"
          value={loading && !data ? "—" : String(data?.topSkus?.length ?? 0)}
        />
      </div>

      <div className="qc-split">
        <Panel title="Revenue trend" meta="Recent days">
          {loading && !data ? (
            <EmptyState>Loading…</EmptyState>
          ) : trendItems.length === 0 ? (
            <EmptyState>No revenue data yet.</EmptyState>
          ) : (
            <SimpleBars items={trendItems} />
          )}
        </Panel>

        <Panel title="Order status" flush>
          {(data?.statusBreakdown?.length ?? 0) === 0 ? (
            <EmptyState>No order status data.</EmptyState>
          ) : (
            <div className="qc-table-wrap">
              <table className="qc-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.statusBreakdown ?? []).map((row) => (
                    <tr key={row.status}>
                      <td>{row.status}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Top SKUs" flush>
        {(data?.topSkus?.length ?? 0) === 0 ? (
          <EmptyState>No sales data yet.</EmptyState>
        ) : (
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Units</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topSkus ?? []).map((row) => (
                  <tr key={row.skuId}>
                    <td>{row.name}</td>
                    <td>{row.unitsSold}</td>
                    <td>{row.revenue.toFixed(2)}</td>
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
