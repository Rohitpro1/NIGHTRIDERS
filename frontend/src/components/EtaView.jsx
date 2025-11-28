// frontend/src/components/EtaView.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function EtaView() {
  const { busId } = useParams();   // ✅ dynamic bus ID from URL
  const BACKEND_BASE = "https://nightriders.onrender.com/api";

  const [etaData, setEtaData] = useState(null);
  const [error, setError] = useState(null);

  // FETCH ETA FUNCTION
  const fetchETA = () => {
    if (!busId) return;  // safety check

    fetch(`${BACKEND_BASE}/eta/${busId}`)
      .then((r) => r.json())
      .then((data) => {
        setEtaData(data);
        setError(null);
      })
      .catch(() => setError("Could not fetch ETA"));
  };

  // AUTO-REFRESH EVERY 10 SECONDS
  useEffect(() => {
    fetchETA();
    const interval = setInterval(fetchETA, 10000);
    return () => clearInterval(interval);
  }, [busId]);

  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!etaData) return <div className="p-4">Loading ETA...</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Bus ETA Dashboard — {busId}</h1>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Current Speed</h2>
        <p style={styles.speed}>
          {etaData.current_speed_kmph
            ? etaData.current_speed_kmph.toFixed(2)
            : "0.00"} km/h
        </p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Estimated Arrival for Each Stop</h2>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Stop</th>
              <th style={styles.th}>Distance</th>
              <th style={styles.th}>ETA</th>
            </tr>
          </thead>
          <tbody>
            {etaData.eta.map((stop, index) => {
              const dist = stop.distance_meters;
              const etaSec = stop.eta_seconds;

              const mins = etaSec ? Math.floor(etaSec / 60) : "-";
              const secs = etaSec ? Math.floor(etaSec % 60) : "-";

              return (
                <tr key={index} style={styles.tr}>
                  <td style={styles.td}>{stop.stop}</td>
                  <td style={styles.td}>{dist.toFixed(1)} m</td>
                  <td style={styles.td}>
                    {etaSec ? `${mins}m ${secs}s` : "N/A"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------
const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial",
    background: "#f5f7fa",
    minHeight: "100vh",
  },
  title: {
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "20px",
  },
  card: {
    background: "white",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "20px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  },
  cardTitle: {
    fontSize: "22px",
    fontWeight: "600",
    marginBottom: "10px",
  },
  speed: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#007bff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "10px",
    background: "#007bff",
    color: "white",
    textAlign: "left",
  },
  tr: {
    borderBottom: "1px solid #ddd",
  },
  td: {
    padding: "10px",
  },
};
