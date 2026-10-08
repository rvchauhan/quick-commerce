import { lazy, Suspense, useEffect, useState } from "react";
import type { CoverageMapProps } from "./CoverageMapInner";

// Dynamic import so the `leaflet` package (which touches `window` at module
// load time) is never evaluated during SSR — only fetched once mounted in
// the browser.
const CoverageMapInner = lazy(() => import("./CoverageMapInner"));

function MapPlaceholder({ label = "Loading map…" }: { label?: string }) {
  return <div className="qc-map-placeholder">{label}</div>;
}

export function CoverageMap(props: CoverageMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <MapPlaceholder />;

  return (
    <Suspense fallback={<MapPlaceholder />}>
      <CoverageMapInner {...props} />
    </Suspense>
  );
}
