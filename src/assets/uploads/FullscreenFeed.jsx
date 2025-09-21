// src/components/FullscreenFeed.jsx
import React, { useRef, useEffect } from "react";

const FullscreenFeed = ({
  filteredPosts,
  currentIndex,
  setShowFullscreen,
}) => {
  const videoRefs = useRef([]);
  const containerRef = useRef(null);

  // Auto play/pause videos on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          if (el.tagName === "VIDEO") {
            if (entry.isIntersecting) {
              el.muted = false;
              el.play().catch(() => {});
            } else {
              el.pause();
            }
          }
        });
      },
      { threshold: 0.7 }
    );

    videoRefs.current.forEach((v) => v && observer.observe(v));
    return () => {
      videoRefs.current.forEach((v) => v && observer.unobserve(v));
    };
  }, []);

  // Jump to clicked post
  useEffect(() => {
    if (containerRef.current) {
      const target = containerRef.current.children[currentIndex];
      if (target) {
        target.scrollIntoView({ behavior: "instant", block: "start" });
      }
    }
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="position-fixed top-0 start-0 w-100 h-100 bg-black text-white"
      style={{ overflowY: "scroll", zIndex: 1050 }}
    >
      {/* Close button */}
      <button
        className="btn btn-light position-absolute m-3"
        onClick={() => setShowFullscreen(false)}
        style={{ zIndex: 1100 }}
      >
        ✕ Close
      </button>

      {/* Posts loop */}
      {filteredPosts.map((post, i) => (
        <div
          key={post.id}
          className="d-flex flex-column align-items-center justify-content-center"
          style={{
            height: "100vh",
            width: "100%",
            position: "relative",
            padding: "10px",
          }}
        >
          {/* VIDEO */}
          {post.type === "video" && (
            <video
              ref={(el) => (videoRefs.current[i] = el)}
              src={post.src}
              style={{
                maxHeight: "100%",
                maxWidth: "100%",
                objectFit: "contain", // ✅ actual ratio maintain
              }}
              playsInline
              loop
              muted
              controls={false}
            />
          )}

          {/* IMAGE */}
          {post.type === "image" && (
            <img
              src={post.src}
              alt={post.caption}
              style={{
                maxHeight: "90%",
                maxWidth: "100%",
                objectFit: "contain",
                borderRadius: 12,
              }}
            />
          )}

          {/* PDF */}
          {post.type === "pdf" && (
            <iframe
              src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
                post.src
              )}`}
              title="pdf-view"
              style={{ width: "100%", height: "90%" }}
            />
          )}

          {/* Caption */}
          {post.caption && (
            <div className="mt-2 text-center text-light">{post.caption}</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FullscreenFeed;
