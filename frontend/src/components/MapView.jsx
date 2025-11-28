// frontend/src/components/MapView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fit map to polyline bounds
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !positions || positions.length === 0) return;
    try {
      map.fitBounds(positions, { padding: [40, 40] });
    } catch (e) {
      // ignore
    }
  }, [map, positions]);
  return null;
}

// Simple icon shortcuts
const createIcon = (url, size = [34, 34]) =>
  new L.Icon({
    iconUrl: url,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2]
  });

const DEFAULT_ICON = createIcon("https://cdn-icons-png.flaticon.com/512/854/854866.png", [34, 34]);
const HIGHLIGHT_ICON = createIcon("https://cdn-icons-png.flaticon.com/512/2972/2972185.png", [36, 36]);

// utility: normalize coordinate object to {lat:number,lng:number} or null
function normalizePoint(raw) {
  if (!raw || typeof raw !== "object") return null;

  // possible keys with extra spaces or swapped fields
  const rawLat = raw.lat ?? raw["lat "] ?? raw["latitude"] ?? raw["Latitude"] ?? raw["Lat"];
  const rawLng = raw.lng ?? raw["lng "] ?? raw["longitude"] ?? raw["Longitude"] ?? raw["Lng"];

  let lat = rawLat;
  let lng = rawLng;

  // try other ordering if missing
  if (lat === undefined && lng !== undefined && typeof lng === "object") {
    // edge case: nested object
    lat = lng.lat;
    lng = lng.lng;
  }

  // coerce to numbers
  lat = typeof lat === "string" ? lat.trim() : lat;
  lng = typeof lng === "string" ? lng.trim() : lng;
  lat = Number(lat);
  lng = Number(lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  // detect possible swapped lat/lng (rare) — lat must be within [-90,90], lng within [-180,180]
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    // swap
    [lat, lng] = [lng, lat];
  }

  // reject obviously invalid numbers
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
}

export default function MapView({
  routeIdToShow = "e93ea2bb-c548-4ec6-a388-2fa84f710341",
  BACKEND_BASE = "https://nightriders.onrender.com/api"
}) {
  const [rawBuses, setRawBuses] = useState([]);
  const [rawRoutes, setRawRoutes] = useState([]);

  // load buses
  useEffect(() => {
    fetch(`${BACKEND_BASE}/buses/live`)
      .then((r) => r.json())
      .then(setRawBuses)
      .catch((err) => console.error("Failed to load buses:", err));
  }, [BACKEND_BASE]);

  // load routes
  useEffect(() => {
    fetch(`${BACKEND_BASE}/routes/search`)
      .then((r) => r.json())
      .then(setRawRoutes)
      .catch((err) => console.error("Failed to load routes:", err));
  }, [BACKEND_BASE]);

  // pick requested route
  const route = useMemo(() => rawRoutes.find((r) => r?.id === routeIdToShow) ?? null, [rawRoutes, routeIdToShow]);

  // sanitize coordinates array
  const routeCoords = useMemo(() => {
    if (!route || !Array.isArray(route.coordinates)) return [];
    const normalized = route.coordinates
      .map(normalizePoint)
      .filter(Boolean)
      // remove duplicates (optional)
      .filter((p, i, arr) => {
        if (i === 0) return true;
        const prev = arr[i - 1];
        return !(Math.abs(prev.lat - p.lat) < 1e-6 && Math.abs(prev.lng - p.lng) < 1e-6);
      });
    return normalized;
  }, [route]);

  // positions for Polyline: array of [lat,lng]
  const polylinePositions = routeCoords.map((p) => [p.lat, p.lng]);

  // center fallback (first route coord or default)
  const center = routeCoords.length ? [routeCoords[0].lat, routeCoords[0].lng] : [12.8251353, 77.5148474];

  return (
    // using key to force remount when polylinePositions change (helps leaflet fit/reset)
    <MapContainer key={JSON.stringify(polylinePositions)} center={center} zoom={16} style={{ height: "100vh", width: "100%" }}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Polyline (draws sanitized positions) */}
      {polylinePositions.length > 0 && (
        <>
          <Polyline positions={polylinePositions} pathOptions={{ color: "orange", weight: 6, opacity: 0.9 }} />
          <FitBounds positions={polylinePositions} />
        </>
      )}

      {/* Bus markers */}
      {Array.isArray(rawBuses) &&
        rawBuses
          .map((b) => {
            // ensure numbers
            const lat = Number(b.latitude);
            const lng = Number(b.longitude);
            if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
            return { ...b, latitude: lat, longitude: lng };
          })
          .filter(Boolean)
          .map((bus) => (
            <Marker key={bus.bus_id} position={[bus.latitude, bus.longitude]} icon={bus.bus_id === "V2BMTC" ? HIGHLIGHT_ICON : DEFAULT_ICON} />
          ))}
    </MapContainer>
  );
}
