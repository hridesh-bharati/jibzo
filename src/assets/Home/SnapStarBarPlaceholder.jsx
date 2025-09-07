import React from "react";

export function SnapStarBarPlaceholder() {
  const placeholders = Array.from({ length: 10 });

  return (
    <div className="d-flex overflow-auto gap-3 px-2 pb-3 snap-star-bar">
      {placeholders.map((_, index) => (
        <div
          key={index}
          className="d-flex flex-column align-items-center justify-content-center"
          style={{
            minWidth: 100,
            padding: 8,
            borderRadius: 12,
            backgroundColor: "#f8f9fa",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div
            className="placeholder rounded-circle mb-2"
            style={{ width: 70, height: 70 }}
          ></div>
          <div
            className="placeholder col-6 mb-1"
            style={{ height: "13px", borderRadius: 4 }}
          ></div>
          <div
            className="btn btn-sm disabled placeholder col-6"
            style={{ fontSize: "12px", padding: "2px 8px" }}
          ></div>
        </div>
      ))}
    </div>
  );
}
