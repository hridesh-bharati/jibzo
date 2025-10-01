import React, { useEffect, useState } from "react";
import { trackVisitor, getVisitorStats } from "../utils/TrackVisitor";

function VisitorLenght() {
  const [stats, setStats] = useState({ totalVisits: 0, totalUnique: 0 });

  useEffect(() => {
    getVisitorStats(setStats);

    const handleVisit = () => trackVisitor();

    window.addEventListener("beforeunload", handleVisit);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleVisit();
    });

    return () => {
      window.removeEventListener("beforeunload", handleVisit);
    };
  }, []);

  return (
    <div className="visitor-card p-3 rounded-3 shadow-sm">
      <div className="visitor-item visitor-visits mb-2 p-3 rounded-2 d-flex justify-content-between align-items-center">
        <span>Total Visits</span>
        <span className="fw-bold">{stats.totalVisits}</span>
      </div>
      <div className="visitor-item visitor-unique p-3 rounded-2 d-flex justify-content-between align-items-center">
        <span>Total Unique Visitors</span>
        <span className="fw-bold">{stats.totalUnique}</span>
      </div>

      {/* Telegram-style CSS */}
      <style>
        {`
.visitor-card {
  background: #e6e6e6; /* soft Telegram gray */
  max-width: 380px;
  margin: auto;
  transition: all 0.3s ease;
}

.visitor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.visitor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 500;
  color: #333; /* dark text on light bg */
  cursor: default;
  transition: all 0.2s ease;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
}

.visitor-item + .visitor-item {
  margin-top: 8px;
}

.visitor-visits {
  border-left: 4px solid #34ace0; /* soft Telegram blue */
}

.visitor-unique {
  border-left: 4px solid #33d9b2; /* soft Telegram green */
}
        `}
      </style>
    </div>
  );
}

export default VisitorLenght;
