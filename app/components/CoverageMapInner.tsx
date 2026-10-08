import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

/**
 * Real Leaflet implementation. Never imported at module-eval time on the
 * server — `leaflet` touches `window` as soon as it's required, which
 * crashes SSR. CoverageMap.tsx lazy-loads this file client-only.
 */

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [20, 0];

/** Recenters the map whenever lat/lng change from outside (typed fields / geocode). */
function RecenterOnPropChange({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  const lastCentered = useRef<string | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    const key = `${lat},${lng}`;
    if (key === lastCentered.current) return;
    lastCentered.current = key;
    map.setView([lat, lng], map.getZoom() < 10 ? 13 : map.getZoom());
  }, [lat, lng, map]);

  return null;
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function InvalidateOnResize({ watch }: { watch: unknown }) {
  const map = useMap();

  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [watch, map]);

  return null;
}

export type CoverageMapProps = {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  onChange: (lat: number, lng: number) => void;
};

export default function CoverageMapInner({ lat, lng, radiusKm, onChange }: CoverageMapProps) {
  const [expanded, setExpanded] = useState(false);
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  return (
    <>
      {expanded ? <div className="qc-map-backdrop" onClick={() => setExpanded(false)} /> : null}
      <div className={`qc-map-frame ${expanded ? "expanded" : ""}`}>
        <button
          type="button"
          className="qc-map-expand"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Collapse map" : "Expand map"}
          aria-label={expanded ? "Collapse map" : "Expand map"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {expanded ? "close_fullscreen" : "open_in_full"}
          </span>
        </button>
        <MapContainer
          center={center}
          zoom={lat != null && lng != null ? 13 : 2}
          scrollWheelZoom
          className="qc-map-leaflet"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={onChange} />
          <RecenterOnPropChange lat={lat} lng={lng} />
          <InvalidateOnResize watch={expanded} />
          {lat != null && lng != null ? (
            <>
              <Marker
                position={[lat, lng]}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target as L.Marker;
                    const pos = marker.getLatLng();
                    onChange(pos.lat, pos.lng);
                  },
                }}
              />
              <Circle
                center={[lat, lng]}
                radius={radiusKm * 1000}
                pathOptions={{ color: "#0f6636", fillOpacity: 0.08 }}
              />
            </>
          ) : null}
        </MapContainer>
      </div>
    </>
  );
}
