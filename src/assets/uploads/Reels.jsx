// src/pages/Reels.jsx
import React from "react";
import GetPost from "./GetPost";

export default function Reels() {
  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>
      <GetPost showFilter={false} defaultFilter="video" />
    </div>
  );
}