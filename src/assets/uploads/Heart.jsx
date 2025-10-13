import { useState } from "react";

export default function Heart({ liked = false, onToggle }) {
  const [burst, setBurst] = useState(false);

  const handleClick = () => {
    if (onToggle) onToggle();
    setBurst(true);
    setTimeout(() => setBurst(false), 400);
  };

  return (
    <button
      className={`heart-btn ${liked ? "liked" : ""}`}
      onClick={handleClick}
    >
      {burst && <span className="burst"></span>}

      <style>{`
        .heart-btn {
          position: relative;
          width: 30px;
          height: 30px;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .heart-btn::before {
          content: "";
          width: 38px;
          height: 38px;
          background: currentColor;
          -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>") no-repeat center / contain;
                  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>") no-repeat center / contain;
          transition: transform 0.3s, color 0.3s;
          color: gray;
        }
        .heart-btn.liked::before {
          color: red;
          animation: bounce 0.35s;
        }
        @keyframes bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.5); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1.3); }
        }
        .burst {
          position: absolute;
          width: 44px;
          height: 44px;
          border: 2px solid rgba(255,0,0,0.6);
          border-radius: 50%;
          animation: burstAnim 0.4s forwards;
        }
        @keyframes burstAnim {
          0% { transform: scale(0.7); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
