import { useState } from "react";
export default function Heart({ liked = false, onToggle }) {
  const [burst, setBurst] = useState(false);

  const handleClick = () => {
    if (onToggle) onToggle(); // toggle in parent
    setBurst(true);
    setTimeout(() => setBurst(false), 500);
  };

  return (
    <div className="heart-container">
      <button
        className={`heart-btn p-0 m-0 ${liked ? "liked" : ""}`}
        onClick={handleClick}
      >
        <span className="heart-icon"></span>
        {burst && <span className="burst"></span>}
      </button>

      <style>{`
        .heart-container { display: flex; align-items: center; justify-content: center; height: 100%; }
        .heart-btn { position: relative; width: 40px; height: 40px; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: transform 0.2s ease; }
        .heart-btn:active { transform: scale(0.9); }
        .heart-icon {
          width: 48px; height: 48px;
          background: url("data:image/svg+xml;utf8,<svg fill='gray' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>") no-repeat center/contain;
          transition: transform 0.3s cubic-bezier(0.25,0.8,0.25,1), background 0.3s ease;
        }
        .liked .heart-icon {
          background: url("data:image/svg+xml;utf8,<svg fill='red' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>") no-repeat center/contain;
          animation: bounce 0.4s cubic-bezier(0.25,0.8,0.25,1);
        }
        @keyframes bounce { 0% { transform: scale(1); } 30% { transform: scale(1.5); } 50% { transform: scale(1.3); } 70% { transform: scale(1.4); } 100% { transform: scale(1.35); } }
        .burst { position: absolute; width: 60px; height: 60px; border: 3px solid rgba(255, 0, 0, 0.6); border-radius: 50%; animation: burstAnim 0.5s ease-out forwards; }
        @keyframes burstAnim { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}
