import { useState } from "react";
import { useNavigate, type HeadersFunction } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useDarkStore } from "../lib/dark-store/context";
import { deleteSku, listSkus } from "../lib/dark-store/api";
import { useAsyncData, darkStoreSessionKey } from "../lib/dark-store/use-async-data";
import { ApiError, toAppMediaUrl } from "../lib/dark-store/types";
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
} from "../components/portal-ui";

export default function CatalogIndexPage() {
  const ds = useDarkStore();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsyncData(
    `catalog:${darkStoreSessionKey(ds)}`,
    () => listSkus(),
    ds.configured,
  );

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Catalog Management", "Master Catalog"]} title="Inventory List" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  const products = data?.data ?? [];
  const query = search.trim().toLowerCase();
  const visible = query
    ? products.filter((product) =>
        `${product.name} ${product.brand ?? ""} ${product.category ?? ""} ${product.barcode ?? ""} ${product.skuCode ?? ""}`
          .toLowerCase()
          .includes(query),
      )
    : products;

  const live = products.filter((product) => product.status === "active").length;
  const draft = products.filter((product) => product.status === "draft").length;
  const archived = products.filter((product) => product.status === "archived").length;

  const onDelete = async (skuId: string, name: string) => {
    const ok = window.confirm(
      `Delete "${name}" from the master catalog?\n\nThis archives the SKU so it can no longer be assigned to new stores.`,
    );
    if (!ok) return;

    setDeletingId(skuId);
    try {
      await deleteSku(skuId);
      shopify.toast.show("SKU deleted");
      await reload();
    } catch (err) {
      shopify.toast.show(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Catalog Management", "Master Catalog"]}
        title="Inventory List"
        subtitle="Manage and monitor all stock keeping units across the entire ecosystem."
        actions={
          <Button icon="add" onClick={() => navigate("/app/catalog/new")}>
            Add SKU
          </Button>
        }
      />

      <div className="qc-stat-grid cols-4">
        <StatCard icon="inventory_2" label="Total SKUs" value={String(products.length)} />
        <StatCard icon="check_circle" label="Live" value={String(live)} tone="success" />
        <StatCard icon="edit_note" label="Draft" value={String(draft)} />
        <StatCard icon="block" label="Archived" value={String(archived)} tone="warning" />
      </div>

      <Panel
        title="Catalog"
        meta={
          loading
            ? "Loading catalog…"
            : query
              ? `${visible.length} of ${products.length} SKUs match "${search}"`
              : `${products.length} SKUs from API`
        }
        actions={
          <div className="qc-search">
            <span className="material-symbols-outlined">search</span>
            <input
              className="qc-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Master Catalog…"
            />
          </div>
        }
        flush
      >
        {error ? (
          <div style={{ padding: "1rem 1.25rem" }}>
            <Banner tone="critical" title="Failed to load catalog">
              {error}
            </Banner>
          </div>
        ) : null}

        {!loading && !error && visible.length === 0 ? (
          <EmptyState>
            No SKUs yet —{" "}
            <button
              type="button"
              className="qc-btn qc-btn-ghost"
              onClick={() => navigate("/app/catalog/new")}
            >
              create one
            </button>
            .
          </EmptyState>
        ) : null}

        {!loading && !error && visible.length > 0 ? (
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>SKU ID</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>List Price</th>
                  <th>Barcode</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {product.images?.[0] ? (
                        <img
                          className="qc-thumb"
                          src={toAppMediaUrl(product.images[0])}
                          alt={product.name}
                        />
                      ) : (
                        <span className="qc-thumb placeholder">
                          <span className="material-symbols-outlined">image</span>
                        </span>
                      )}
                    </td>
                    <td>{product.skuCode ?? product.id.slice(0, 8)}</td>
                    <td>
                      <strong>{product.name}</strong>
                      <div className="qc-muted">{product.brand ?? "—"}</div>
                    </td>
                    <td>{product.category ?? "—"}</td>
                    <td>
                      {product.currency} {Number(product.basePrice).toFixed(2)}
                    </td>
                    <td>{product.barcode ?? "—"}</td>
                    <td>
                      <Badge tone={statusTone(product.status)}>{product.status}</Badge>
                    </td>
                    <td>
                      {product.status === "archived" ? (
                        <span className="qc-muted">—</span>
                      ) : (
                        <button
                          type="button"
                          className="qc-icon-btn danger"
                          disabled={deletingId === product.id}
                          title="Delete SKU"
                          aria-label={`Delete ${product.name}`}
                          onClick={() => void onDelete(product.id, product.name)}
                        >
                          <span className="material-symbols-outlined">
                            {deletingId === product.id ? "hourglass_top" : "delete"}
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </PortalShell>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
