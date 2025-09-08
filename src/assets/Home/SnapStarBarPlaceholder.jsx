import React from "react";
import "./SnapStarBarPlaceholder.css";

export function SnapStarBarPlaceholder() {
  const placeholders = Array.from({ length: 10 });

  return (
    <div className="d-flex overflow-auto gap-3 px-2 pb-3 snap-star-bar">
      {placeholders.map((_, index) => (
        <div
          key={index}
          className="d-flex flex-column align-items-center justify-content-center placeholder-card"
        >
          {/* Circle avatar shimmer */}
          <div className="placeholder rounded-circle mb-2 placeholder-glow" style={{ width: 70, height: 70 }}></div>

          {/* Username shimmer */}
          <div className="placeholder col-6 mb-1 placeholder-glow" style={{ height: "13px", borderRadius: 4 }}></div>

          {/* Follow button shimmer */}
          <div className="btn btn-sm disabled placeholder col-6 placeholder-glow" style={{ fontSize: "12px", padding: "2px 8px" }}></div>
        </div>
      ))}
    </div>
  );
}
