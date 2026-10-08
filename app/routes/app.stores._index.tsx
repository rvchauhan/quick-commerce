import { useState } from "react";
import { Link, useNavigate, type HeadersFunction } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useDarkStore } from "../lib/dark-store/context";
import { activateStore, listStores } from "../lib/dark-store/api";
import { useAsyncData, darkStoreSessionKey } from "../lib/dark-store/use-async-data";
import { ApiError } from "../lib/dark-store/types";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  PageHeader,
  PortalShell,
  StatCard,
  statusTone,
} from "../components/portal-ui";

export default function StoresIndexPage() {
  const ds = useDarkStore();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, error, loading, reload } = useAsyncData(
    `stores:${darkStoreSessionKey(ds)}`,
    () => listStores(),
    ds.configured,
  );

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Dark Stores"]} title="Dark Store Network" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  const stores = data?.data ?? [];
  const active = stores.filter((s) => s.status === "active").length;
  const onboarding = stores.filter((s) => s.status === "onboarding").length;
  const q = search.trim().toLowerCase();
  const visible = q
    ? stores.filter((s) => `${s.name} ${s.code ?? ""} ${s.id}`.toLowerCase().includes(q))
    : stores;

  const onActivate = async (storeId: string) => {
    try {
      await activateStore(storeId);
      shopify.toast.show("Store activated");
      await reload();
    } catch (err) {
      shopify.toast.show(err instanceof ApiError ? err.message : "Activate failed");
    }
  };

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Management", "Dark Stores"]}
        title="Dark Store Network"
        subtitle="Monitor hubs, activate onboarding stores, and jump into store detail."
        actions={
          <>
            <div className="qc-search">
              <span className="material-symbols-outlined">search</span>
              <input
                className="qc-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Store Name or ID…"
              />
            </div>
            <Button icon="add_business" onClick={() => navigate("/app/stores/new")}>
              Add Dark Store
            </Button>
          </>
        }
      />

      <div className="qc-stat-grid cols-3">
        <StatCard icon="mediation" label="Total Stores" value={String(stores.length)} />
        <StatCard icon="check_circle" label="Active Hubs" value={String(active)} tone="success" />
        <StatCard icon="pending" label="Onboarding" value={String(onboarding)} />
      </div>

      {error && (
        <Banner tone="critical" title="Failed to load stores">
          {error}
        </Banner>
      )}
      {loading && <p className="qc-muted">Loading stores…</p>}
      {!loading && q && (
        <p className="qc-muted" style={{ marginBottom: "1rem" }}>
          {visible.length} of {stores.length} stores match "{search}"
        </p>
      )}

      <div className="qc-store-grid">
        {visible.map((s) => (
          <div key={s.id} className="qc-store-card" style={{ cursor: "default" }}>
            <div className="qc-store-card-hero">
              <div className="qc-store-card-badge">
                <Badge tone={statusTone(s.status)}>{s.status}</Badge>
              </div>
              <div className="qc-store-card-icon">
                <span className="material-symbols-outlined">store</span>
              </div>
            </div>
            <div className="qc-store-card-body">
              <h3>
                <Link to={`/app/stores/${s.id}`}>{s.name}</Link>
              </h3>
              <p className="qc-muted">{s.code ?? s.id.slice(0, 8)}</p>
              <p className="qc-muted" style={{ marginTop: "0.55rem" }}>
                {s.address}
              </p>
              <div className="qc-actions" style={{ marginTop: "auto", paddingTop: "1rem" }}>
                {s.status === "onboarding" ? (
                  <Button onClick={() => onActivate(s.id)} icon="bolt">
                    Activate
                  </Button>
                ) : (
                  <Button to={`/app/stores/${s.id}`} variant="secondary" icon="open_in_new">
                    Open
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="qc-store-card qc-store-card-add"
          onClick={() => navigate("/app/stores/new")}
        >
          <div className="bubble">
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
              add_business
            </span>
          </div>
          <h3>Add New Dark Store</h3>
        </button>
      </div>

      {!loading && !error && visible.length === 0 && (
        <EmptyState>No stores match your search.</EmptyState>
      )}
    </PortalShell>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
