import React, { useState } from "react";

export default function ShareButton({ link, title = "Check this out!" }) {
  const url = link || window.location.href;
  const [open, setOpen] = useState(false);

  const shareLinks = [
    { name: "Instagram", icon: "bi-instagram", url: `https://www.instagram.com/?url=${encodeURIComponent(url)}`, color: "#C13584" },
    { name: "X", icon: "bi-twitter", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, color: "#1DA1F2" },
    { name: "Snapchat", icon: "bi-snapchat", url: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}`, color: "#d1ce00ff" },
    { name: "WhatsApp", icon: "bi-whatsapp", url: `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`, color: "#25D366" },
    { name: "Facebook", icon: "bi-facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, color: "#4267B2" },
    { name: "LinkedIn", icon: "bi-linkedin", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, color: "#0077b5" },
    { name: "Telegram", icon: "bi-telegram", url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, color: "#0088cc" },
    { name: "Email", icon: "bi-envelope", url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`, color: "#EA4335" },
  ];

  return (
    <>
      <button className="share-btn fs-4" onClick={() => setOpen(true)}>
        <i className="bi bi-share-fill"></i>
      </button>

      {open && (
        <>
          <div className="share-backdrop" onClick={() => setOpen(false)}></div>

          <div className="share-offcanvas">
            <h5 className="share-title">Share this</h5>
            <div className="share-grid">
              {shareLinks.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-item"
                  style={{ backgroundColor: s.color }}
                  onClick={() => setOpen(false)}
                >
                  <i className={`bi ${s.icon} share-icon`}></i>
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        .share-btn {
          background: none;
          border: none;
          font-size: 42px; 
          cursor: pointer;
          padding: 8px;
          transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .share-btn:active {
          transform: scale(0.9);
        }
        .share-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          z-index: 100;
        }
        .share-offcanvas {
          position: fixed;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 40vh;
          background: #fff;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          padding: 16px;
          z-index: 101;
          transform: translateY(100%);
          animation: slideUp 0.3s forwards;
          text-align: center;
        }
        @keyframes slideUp { to { transform: translateY(0); } }
        .share-title { font-weight: bold; margin-bottom: 16px; }
        .share-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
        }
        .share-item {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #fff;
          text-decoration: none;
          transition: transform 0.2s ease;
        }
        .share-item:hover { transform: scale(1.1); }
        .share-icon { font-size: 28px; }
      `}</style>
    </>
  );
}