import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { DarkStoreWizard } from "app/components/DarkStoreWizard";
import { Banner, PageHeader, PortalShell } from "app/components/portal-ui";
import { useDarkStore } from "app/lib/dark-store/context";

export default function NewStorePage() {
  const ds = useDarkStore();

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader
          crumbs={["Management", "Dark Stores", "Add New Store"]}
          title="Add New Dark Store"
        />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  return <DarkStoreWizard />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
