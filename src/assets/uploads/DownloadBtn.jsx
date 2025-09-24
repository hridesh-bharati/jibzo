import React from "react";

export default function DownloadBtn({ link }) {
  if (!link) return null;

  // Dynamically get filename from URL
  const getFileName = (url) => {
    try {
      const parts = url.split("/").pop().split("?")[0];
      return parts || "file";
    } catch {
      return "file";
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(link, { mode: "cors" });
      const blob = await response.blob();
      const urlBlob = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = urlBlob;
      a.download = getFileName(link);

      // ✅ Mobile fallback
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.open(urlBlob, "_blank"); // open in new tab
      } else {
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      window.URL.revokeObjectURL(urlBlob);
    } catch (err) {
      console.error("Download failed:", err);
      alert("⚠️ Download failed. Try again.");
    }
  };



  return (
    <button className="download-btn" onClick={handleDownload}>
      <i className="bi bi-download ms-3"></i>
      <style>{`
        .download-btn {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          padding: 8px;
          transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .download-btn:active {
          transform: scale(0.9);
        }
      `}</style>
    </button>
  );
}
