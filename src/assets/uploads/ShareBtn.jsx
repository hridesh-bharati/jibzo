// src/components/Gallery/ShareBtn.jsx
import React, { useState, useEffect } from "react";
import { db } from "../../assets/utils/firebaseConfig";
import { ref, set, get, onValue } from "firebase/database";

export default function ShareButton({ link, postId, title = "Check this out!", className }) {
  const url = link || window.location.href;
  const [open, setOpen] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  // Fetch share count when component mounts
  useEffect(() => {
    if (!postId) return;

    const shareCountRef = ref(db, `galleryImages/${postId}/shareCount`);

    const unsubscribe = onValue(shareCountRef, (snapshot) => {
      const count = snapshot.val() || 0;
      setShareCount(count);
    });

    return () => unsubscribe();
  }, [postId]);

  const shareLinks = [
    { name: "Instagram", icon: "bi-instagram", url: `https://www.instagram.com/?url=${encodeURIComponent(url)}`, color: "#C13584" },
    { name: "X", icon: "bi-twitter", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, color: "#1DA1F2" },
    { name: "Snapchat", icon: "bi-snapchat", url: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}`, color: "#FFFC00" },
    { name: "WhatsApp", icon: "bi-whatsapp", url: `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`, color: "#25D366" },
    { name: "Facebook", icon: "bi-facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, color: "#4267B2" },
    { name: "LinkedIn", icon: "bi-linkedin", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, color: "#0077b5" },
    { name: "Telegram", icon: "bi-telegram", url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, color: "#0088cc" },
    { name: "Email", icon: "bi-envelope", url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`, color: "#EA4335" },
  ];

  // Function to increment share count
  const incrementShareCount = async () => {
    if (!postId) return;

    try {
      const shareCountRef = ref(db, `galleryImages/${postId}/shareCount`);
      const snapshot = await get(shareCountRef);
      const currentCount = snapshot.val() || 0;
      await set(shareCountRef, currentCount + 1);
    } catch (error) {
      console.error("Error updating share count:", error);
    }
  };

  const handleShare = (platformUrl) => {
    // Increment share count
    incrementShareCount();

    // Open share window
    window.open(platformUrl, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      // Increment share count for copy link too
      incrementShareCount();
      setOpen(false);

      // Optional: Show a toast notification
      if (window.toast) {
        window.toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Failed to copy link:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      // Still increment share count
      incrementShareCount();
      setOpen(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        className={`btn share-btn border-0 ${className}`}
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.2rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        <i className="bi bi-share-fill"></i>

        {/* Share Count Badge - Only show if there are shares */}
        {shareCount > 0 && (
          <span
            style={{
              // backgroundColor: '#ff4444',
              color: 'white',
              width: '16px',
              height: '16px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin:"0 9px"
            }}
          >
            {shareCount > 99 ? '99+' : shareCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="share-backdrop"
            onClick={handleBackdropClick}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
              animation: 'fadeIn 0.3s ease'
            }}
          ></div>

          {/* Bottom Sheet */}
          <div
            className="share-bottom-sheet"
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'white',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '20px',
              zIndex: 9999,
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
              animation: 'slideUp 0.3s ease-out',
              maxHeight: '70vh',
              overflowY: 'auto'
            }}
          >
            {/* Header */}
            <div
              className="share-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e9ecef'
              }}
            >
              <div>
                <h5
                  className="share-title"
                  style={{
                    margin: 0,
                    fontWeight: '600',
                    color: '#212529',
                    fontSize: '1.1rem',
                    marginBottom: '4px'
                  }}
                >
                  Share this
                </h5>
                {shareCount > 0 && (
                  <small style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                    Shared {shareCount} {shareCount === 1 ? 'time' : 'times'}
                  </small>
                )}
              </div>
              <button
                className="share-close-btn"
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#6c757d',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Share Options Grid */}
            <div
              className="share-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                justifyItems: 'center'
              }}
            >
              {shareLinks.map((platform) => (
                <button
                  key={platform.name}
                  className="share-platform-btn"
                  onClick={() => handleShare(platform.url)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '72px',
                    height: '72px',
                    borderRadius: '16px',
                    backgroundColor: platform.color,
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    textDecoration: 'none',
                    padding: '12px 8px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <i
                    className={`bi ${platform.icon}`}
                    style={{
                      fontSize: '1.5rem',
                      marginBottom: '6px'
                    }}
                  ></i>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '500',
                      textAlign: 'center',
                      lineHeight: '1.2'
                    }}
                  >
                    {platform.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Copy Link Button */}
            <button
              className="copy-link-btn"
              onClick={handleCopyLink}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '12px 16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '12px',
                color: '#495057',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#f8f9fa'}
            >
              <i className="bi bi-link-45deg"></i>
              Copy Link
            </button>
          </div>

          {/* Animations */}
          <style>{`
            @keyframes slideUp {
              from {
                transform: translateY(100%);
              }
              to {
                transform: translateY(0);
              }
            }

            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }

            /* Mobile Responsive */
            @media (max-width: 480px) {
              .share-grid {
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 12px !important;
              }
              
              .share-platform-btn {
                width: 64px !important;
                height: 64px !important;
              }
              
              .share-platform-btn i {
                font-size: 1.25rem !important;
              }
              
              .share-platform-btn span {
                font-size: 0.65rem !important;
              }
            }

            @media (max-width: 360px) {
              .share-grid {
                gridTemplateColumns: repeat(3, 1fr) !important;
              }
            }
          `}</style>
        </>
      )}
    </>
  );
}