import { useMemo } from "react";
import type { HeadersFunction } from "react-router";
import { Link, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useDarkStore } from "../lib/dark-store/context";
import { listSkuMappings, listSkus, listStores } from "../lib/dark-store/api";
import { useAsyncData, darkStoreSessionKey } from "../lib/dark-store/use-async-data";
import type { Store } from "../lib/dark-store/types";
import {
  Banner,
  Button,
  EmptyState,
  PageHeader,
  PortalShell,
  StatCard,
} from "../components/portal-ui";

type CoverageRow = {
  store: Store;
  mapped: number;
  coverage: number;
  gaps: number;
};

function coverageTone(coverage: number) {
  if (coverage >= 85) return "high";
  if (coverage >= 70) return "mid";
  return "low";
}

export default function InventoryPage() {
  const ds = useDarkStore();
  const navigate = useNavigate();
  const sessionKey = darkStoreSessionKey(ds);

  const storesQuery = useAsyncData(
    `inv-stores:${sessionKey}`,
    () => listStores(),
    ds.configured,
  );
  const skusQuery = useAsyncData(
    `inv-catalog:${sessionKey}`,
    () => listSkus(),
    ds.configured,
  );

  const stores = storesQuery.data?.data ?? [];
  const catalogTotal = skusQuery.data?.data.length ?? 0;
  const storeIdsKey = stores.map((s) => s.id).join(",");

  const mappingsQuery = useAsyncData(
    `inv-mappings:${sessionKey}:${storeIdsKey}:${catalogTotal}`,
    async () => {
      const results = await Promise.all(
        stores.map(async (store) => {
          const res = await listSkuMappings(store.id);
          return { storeId: store.id, mapped: res.data.length };
        }),
      );
      return results;
    },
    ds.configured && stores.length > 0,
  );

  const mappedByStore = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of mappingsQuery.data ?? []) {
      map.set(row.storeId, row.mapped);
    }
    return map;
  }, [mappingsQuery.data]);

  const rows: CoverageRow[] = stores.map((store) => {
    const mapped = mappedByStore.get(store.id) ?? 0;
    const coverage = catalogTotal > 0 ? Math.round((mapped / catalogTotal) * 100) : 0;
    const gaps = Math.max(catalogTotal - mapped, 0);
    return { store, mapped, coverage, gaps };
  });

  const totalMappings = rows.reduce((sum, r) => sum + r.mapped, 0);
  const avgCoverage =
    rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.coverage, 0) / rows.length)
      : 0;
  const totalGaps = rows.reduce((sum, r) => sum + r.gaps, 0);
  const loading =
    storesQuery.loading ||
    skusQuery.loading ||
    (stores.length > 0 && mappingsQuery.loading);
  const loadError = storesQuery.error || skusQuery.error || mappingsQuery.error;

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Inventory Mapping"]} title="Inventory" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Management", "Inventory Mapping"]}
        title="Inventory"
        subtitle="Map SKUs to fulfillment hubs and monitor coverage gaps."
        actions={
          <Button icon="add_business" to="/app/stores/new">
            Map New Store
          </Button>
        }
      />

      <div className="qc-stat-grid cols-4">
        <StatCard icon="hub" label="Total Mappings" value={String(totalMappings)} />
        <StatCard
          icon="check_circle"
          label="Avg. Coverage"
          value={`${avgCoverage}%`}
          tone="success"
        />
        <StatCard
          icon="warning"
          label="Coverage Gaps"
          value={String(totalGaps)}
          tone="warning"
        />
        <StatCard icon="sync" label="Catalog SKUs" value={String(catalogTotal)} />
      </div>

      {loadError && (
        <Banner tone="critical" title="Failed to load mapping data">
          {loadError}
        </Banner>
      )}
      {loading && <p className="qc-muted" style={{ marginBottom: "1rem" }}>Loading coverage…</p>}

      <div className="qc-inventory-layout">
        <section className="qc-panel">
          <div className="qc-panel-body">
            <h3 className="qc-panel-title" style={{ marginBottom: "0.75rem" }}>
              Bulk map SKUs
            </h3>
            <p className="qc-muted" style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
              Open a store onboarding wizard to assign SKUs one-by-one or upload a CSV batch.
            </p>
            <div className="qc-action-list">
              <Link className="qc-action-row" to="/app/stores/new">
                <span className="qc-action-row-left">
                  <span className="material-symbols-outlined">upload_file</span>
                  Upload CSV (per store)
                </span>
                <span className="material-symbols-outlined qc-action-chevron">chevron_right</span>
              </Link>
              <Link className="qc-action-row" to="/app/catalog">
                <span className="qc-action-row-left">
                  <span className="material-symbols-outlined">category</span>
                  Review Master Catalog
                </span>
                <span className="material-symbols-outlined qc-action-chevron">chevron_right</span>
              </Link>
              <Link className="qc-action-row" to="/app/stores">
                <span className="qc-action-row-left">
                  <span className="material-symbols-outlined">store</span>
                  Browse Dark Stores
                </span>
                <span className="material-symbols-outlined qc-action-chevron">chevron_right</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="qc-panel">
          <div className="qc-panel-head">
            <h3 className="qc-panel-title">Coverage by store</h3>
            <Link className="qc-text-link" to="/app/stores" style={{ padding: 0 }}>
              View all →
            </Link>
          </div>
          <div className="qc-panel-body flush">
            {!loading && rows.length === 0 ? (
              <EmptyState>
                No stores yet.{" "}
                <Link to="/app/stores/new">Add a dark store</Link>
              </EmptyState>
            ) : (
              <div className="qc-table-wrap">
                <table className="qc-table">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th>SKUs</th>
                      <th>Coverage</th>
                      <th>Gaps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.store.id}
                        className="qc-click-row"
                        onClick={() => navigate(`/app/stores/${row.store.id}`)}
                      >
                        <td>
                          <strong>{row.store.name}</strong>
                          {row.store.code ? (
                            <span className="qc-muted" style={{ display: "block", fontSize: "0.75rem" }}>
                              {row.store.code}
                            </span>
                          ) : null}
                        </td>
                        <td>{row.mapped.toLocaleString()}</td>
                        <td className="qc-coverage-cell">
                          <div className="qc-coverage">
                            <div className="qc-coverage-track">
                              <div
                                className={`qc-coverage-fill ${coverageTone(row.coverage)}`}
                                style={{ width: `${row.coverage}%` }}
                              />
                            </div>
                            <span className="qc-coverage-pct">{row.coverage}%</span>
                          </div>
                        </td>
                        <td className="qc-gaps">{row.gaps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
