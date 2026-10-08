import type { HeadersFunction } from "react-router";
import { Link, useParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  jsonBoolean,
  jsonNumber,
  jsonString,
} from "app/components/DarkStoreWizard";
import {
  Banner,
  Button,
  PageHeader,
  Panel,
  PortalShell,
  StatCard,
} from "app/components/portal-ui";
import { getStore, listSkuMappings, listSkus } from "app/lib/dark-store/api";
import { useDarkStore } from "app/lib/dark-store/context";
import { darkStoreSessionKey, useAsyncData } from "app/lib/dark-store/use-async-data";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="qc-detail-row">
      <span className="qc-detail-label">{label}</span>
      <span className="qc-detail-value">{value}</span>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  to,
}: {
  icon: string;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link to={to} className="qc-nav-card">
      <div className="qc-nav-card-icon">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="qc-nav-card-body">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="material-symbols-outlined qc-nav-card-chevron">chevron_right</span>
    </Link>
  );
}

export default function StoreDetailPage() {
  const { storeId = "" } = useParams();
  const ds = useDarkStore();
  const sessionKey = darkStoreSessionKey(ds);

  const storeQuery = useAsyncData(
    `store:${storeId}:${sessionKey}`,
    () => getStore(storeId),
    ds.configured && Boolean(storeId),
  );
  const mappingsQuery = useAsyncData(
    `mappings:${storeId}:${sessionKey}`,
    () => listSkuMappings(storeId),
    ds.configured && Boolean(storeId),
  );
  const skusQuery = useAsyncData(
    `catalog-all:${sessionKey}`,
    () => listSkus(),
    ds.configured,
  );

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Dark Stores", "Detail"]} title="Store detail" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  if (storeQuery.loading) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Dark Stores"]} title="Loading…" />
        <p className="qc-muted" style={{ textAlign: "center", padding: "3rem 0" }}>
          Loading store…
        </p>
      </PortalShell>
    );
  }

  if (storeQuery.error || !storeQuery.data) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Management", "Dark Stores"]} title="Store detail" />
        <Banner tone="critical" title="Failed to load this store">
          {storeQuery.error ?? "Store not found"}
        </Banner>
        <Button variant="secondary" to="/app/stores">
          Back to Dark Stores
        </Button>
      </PortalShell>
    );
  }

  const store = storeQuery.data;
  const mappedCount = mappingsQuery.data?.data.length ?? 0;
  const totalCount = skusQuery.data?.data.length ?? 0;
  const coverage = totalCount > 0 ? Math.round((mappedCount / totalCount) * 100) : 0;

  const openTime = jsonString(store.operatingHours, "open");
  const closeTime = jsonString(store.operatingHours, "close");
  const capacityM3 = jsonNumber(store.facility, "capacityM3");
  const coldStorage = jsonBoolean(store.facility, "coldStorage");
  const contactNumber = jsonString(store.facility, "contactNumber");
  const country = jsonString(store.geofence, "country");
  const radiusKm = jsonNumber(store.geofence, "radiusKm");

  const managerTone =
    store.managerStatus === "active"
      ? "success"
      : store.managerStatus
        ? "warning"
        : "primary";

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Management", "Dark Stores", store.name]}
        title={store.name}
        subtitle={store.address}
        actions={
          <Button variant="secondary" to="/app/stores">
            Back to Dark Stores
          </Button>
        }
      />

      <div className="qc-stat-grid cols-4">
        <StatCard
          icon={store.status === "active" ? "check_circle" : "pending"}
          label="Status"
          value={store.status}
          tone={store.status === "active" ? "success" : "primary"}
        />
        <StatCard
          icon="person"
          label="Manager"
          value={store.managerName ?? "Unassigned"}
          tone={managerTone}
        />
        <StatCard icon="inventory_2" label="SKUs Mapped" value={`${mappedCount} / ${totalCount}`} />
        <StatCard icon="map_search" label="Coverage" value={`${coverage}%`} tone="success" />
      </div>

      <div className="qc-inventory-layout" style={{ marginTop: "1.5rem" }}>
        <Panel title="Store Details">
          <DetailRow label="Store Code" value={store.code ?? "—"} />
          <DetailRow label="Country" value={country || "—"} />
          <DetailRow
            label="Coverage Radius"
            value={radiusKm != null ? `${radiusKm} km` : "—"}
          />
          <DetailRow
            label="Working Hours"
            value={openTime && closeTime ? `${openTime} – ${closeTime}` : "—"}
          />
          <DetailRow
            label="Capacity"
            value={capacityM3 != null ? `${capacityM3} m³` : "—"}
          />
          <DetailRow label="Cold Storage" value={coldStorage ? "Yes" : "No"} />
          <DetailRow label="Manager Email" value={store.managerEmail ?? "—"} />
          <DetailRow label="Contact Number" value={contactNumber || "—"} />
        </Panel>

        <div className="qc-action-list">
          <ActionCard
            icon="info"
            title="Store Details"
            description="Name, status, manager, staffing, and operations."
            to={`/app/stores/${storeId}/edit?step=1`}
          />
          <ActionCard
            icon="location_on"
            title="Location & Logistics"
            description="Address, map pin, and delivery coverage radius."
            to={`/app/stores/${storeId}/edit?step=2`}
          />
          <ActionCard
            icon="inventory_2"
            title="Inventory"
            description={`Manage which SKUs are assigned to this store (${mappedCount} mapped).`}
            to={`/app/stores/${storeId}/edit?step=3`}
          />
          <ActionCard
            icon="shopping_cart"
            title="Orders"
            description="Active and fulfilled orders for this dark store."
            to={`/app/orders?storeId=${storeId}`}
          />
        </div>
      </div>
    </PortalShell>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
