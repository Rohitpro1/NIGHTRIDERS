// frontend/src/components/MapView.jsx
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css"; 

// small helper component to draw polyline once map exists
function DrawRoute({ coords, color = "blue", weight = 5 }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !coords || coords.length === 0) return;
    const latlngs = coords.map((c) => [c.lat, c.lng]);
    const poly = L.polyline(latlngs, { color, weight, opacity: 0.8 }).addTo(map);
    // optionally fit bounds to route
    try { map.fitBounds(poly.getBounds(), { padding: [40, 40] }); } catch (e) {}
    return () => {
      map.removeLayer(poly);
    };
  }, [map, coords, color, weight]);
  return null;
}

export default function MapView({ routeIdToShow = "e93ea2bb-c548-4ec6-a388-2fa84f710341" }) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [buses, setBuses] = useState([]); // if you want to render bus markers
  const BACKEND_BASE = "https://nightriders.onrender.com/api"; // set your backend base

  useEffect(() => {
    // load buses (optional)
    fetch(`${BACKEND_BASE}/buses/live`)
      .then((r) => r.json())
      .then(setBuses)
      .catch(console.error);
  }, []);

  useEffect(() => {
    // load routes and extract the route with routeIdToShow
    fetch(`${BACKEND_BASE}/routes/search`)
      .then((r) => r.json())
      .then((routes) => {
        const route = routes.find((r) => r.id === routeIdToShow);
        if (route && Array.isArray(route.coordinates)) setRouteCoords(route.coordinates);
      })
      .catch(console.error);
  }, [routeIdToShow]);

  // center fallback
  const center = routeCoords.length ? [routeCoords[0].lat, routeCoords[0].lng] : [12.8251353, 77.5148474];

  // custom icon examples
  const defaultIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854866.png",
    iconSize: [34, 34]
  });
  const highlightedIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
    iconSize: [36, 36]
  });

  return (
   <MapContainer
  key={center.join(",")}     // <--- THIS IS IMPORTANT
  center={center}
  zoom={16}
  style={{ height: "100vh", width: "100%" }}
>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* draw the route polyline */}
      <DrawRoute coords={routeCoords} color="orange" weight={6} />

      {/* Render bus markers (optional) */}
      {buses.map((bus) => (
        <Marker
          key={bus.bus_id}
          position={[bus.latitude, bus.longitude]}
          icon={bus.bus_id === "V2BMTC" ? highlightedIcon : defaultIcon}
        />
      ))}

      {/* If you also want a non-React polyline, you can add Polyline react-leaflet component:
          <Polyline positions={routeCoords.map(c => [c.lat, c.lng])} pathOptions={{color:"orange", weight:6}} />
      */}
    </MapContainer>
  );
}



