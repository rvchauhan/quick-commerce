import type { HeadersFunction } from "react-router";
import { useParams, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { DarkStoreWizard } from "app/components/DarkStoreWizard";
import { Banner, PageHeader, PortalShell } from "app/components/portal-ui";
import { useDarkStore } from "app/lib/dark-store/context";

export default function EditStorePage() {
  const { storeId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const ds = useDarkStore();

  const stepRaw = searchParams.get("step");
  const initialStep = stepRaw === "2" ? 2 : stepRaw === "3" ? 3 : 1;

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader
          crumbs={["Management", "Dark Stores", "Edit Store"]}
          title="Edit Store"
        />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  return <DarkStoreWizard storeId={storeId} initialStep={initialStep} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
