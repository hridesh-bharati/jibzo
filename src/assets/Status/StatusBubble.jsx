// src/components/StatusBubble.jsx
import React from "react";

export default function StatusBubble({ user, onClick, isSeen }) {
  const displayName = user.username || "User";
  const displayPic = user.photoURL || "icons/avatar.jpg";

  return (
    <div
      className={`status-bubble ${isSeen ? "seen" : "unseen"}`}
      onClick={onClick}
    >
      <img src={displayPic} alt="dp" className="status-thumb" />
      <small className="mt-1 d-block text-truncate" style={{ maxWidth: 70 }}>
        {displayName}
      </small>
      <style>{ `
      
      .status-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}
.status-bubble img {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid #ff006a;
}
.status-bubble.seen img {
  border-color: #ccc;
}
.status-bubble.unseen img {
  border-color: #ff006a;
}

      `}</style>
    </div>
  );
}
