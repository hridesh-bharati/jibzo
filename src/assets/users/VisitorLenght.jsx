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
    <div
      className="card shadow-sm m-3 p-4 border rounded-4 text-center"
      style={{ maxWidth: "400px", margin: "auto", backgroundColor: "#ffffff" }}
    >

      <div className="mb-1">
        <div className="d-flex justify-content-between align-items-center mb-1 p-2 border rounded-2 bg-success bg-gradient">
          <span className="text-muted">Total Visits</span>
          <span className="fw-bold fs-5">{stats.totalVisits}</span>
        </div>
        <div className="d-flex justify-content-between align-items-center p-2 border rounded-2 bg-warning bg-gradient">
          <span className="text-muted">Total Unique Visitors</span>
          <span className="fw-bold fs-5">{stats.totalUnique}</span>
        </div>
      </div>
    </div>
  );
}

export default VisitorLenght;
