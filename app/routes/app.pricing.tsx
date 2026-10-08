import { useState } from "react";
import type { HeadersFunction } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useDarkStore } from "../lib/dark-store/context";
import { listSkuMappings, listStores, updateSkuMapping } from "../lib/dark-store/api";
import { useAsyncData, darkStoreSessionKey } from "../lib/dark-store/use-async-data";
import { ApiError, type SkuMapping } from "../lib/dark-store/types";
import {
  Banner,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  PortalShell,
} from "../components/portal-ui";

function PriceRow({
  mapping,
  storeId,
  onSaved,
}: {
  mapping: SkuMapping;
  storeId: string;
  onSaved: () => void;
}) {
  const shopify = useAppBridge();
  const [draft, setDraft] = useState(mapping.priceOverride ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = draft !== (mapping.priceOverride ?? "");

  const onSave = async () => {
    setSaving(true);
    try {
      const priceOverride = draft.trim() === "" ? null : Number(draft);
      if (priceOverride !== null && Number.isNaN(priceOverride)) {
        shopify.toast.show("Invalid price");
        return;
      }
      await updateSkuMapping(storeId, mapping.skuId, { priceOverride });
      shopify.toast.show("Price updated");
      onSaved();
    } catch (err) {
      shopify.toast.show(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td>
        <strong>{mapping.skuName}</strong>
        <div className="qc-muted">{mapping.brand ?? "—"}</div>
      </td>
      <td>{Number(mapping.basePrice).toFixed(2)}</td>
      <td style={{ minWidth: "9rem" }}>
        <input
          className="qc-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Override"
        />
      </td>
      <td>
        <Button onClick={onSave} disabled={!dirty || saving} variant={dirty ? "primary" : "secondary"}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </td>
    </tr>
  );
}

export default function PricingPage() {
  const ds = useDarkStore();
  const [storeId, setStoreId] = useState("");

  const stores = useAsyncData(
    `stores-pricing:${darkStoreSessionKey(ds)}`,
    () => listStores(),
    ds.configured,
  );
  const mappings = useAsyncData(
    `pricing:${storeId}:${darkStoreSessionKey(ds)}`,
    () => listSkuMappings(storeId),
    ds.configured && Boolean(storeId),
  );

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Operations", "Pricing"]} title="Store Pricing" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Operations", "Pricing"]}
        title="Store Pricing"
        subtitle="Override catalog list prices for a selected dark store."
      />

      <Panel title="Select store">
        <Field label="Dark store">
          <select
            className="qc-select"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">Choose a store</option>
            {(stores.data?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </Panel>

      <Panel
        title="Price overrides"
        meta={storeId ? `${mappings.data?.data?.length ?? 0} mapped SKUs` : "Pick a store first"}
        flush
      >
        {!storeId && <EmptyState>Pick a store to edit listing prices.</EmptyState>}
        {storeId && mappings.loading && <EmptyState>Loading…</EmptyState>}
        {storeId && mappings.error && (
          <div style={{ padding: "1rem 1.25rem" }}>
            <Banner tone="critical" title="Failed to load mappings">
              {mappings.error}
            </Banner>
          </div>
        )}
        {storeId && !mappings.loading && (mappings.data?.data?.length ?? 0) === 0 && (
          <EmptyState>No mapped SKUs for this store yet.</EmptyState>
        )}
        {storeId && !mappings.loading && (mappings.data?.data?.length ?? 0) > 0 && (
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Catalog price</th>
                  <th>Override</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(mappings.data?.data ?? []).map((m) => (
                  <PriceRow
                    key={m.id}
                    mapping={m}
                    storeId={storeId}
                    onSaved={() => void mappings.reload()}
                  />
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
