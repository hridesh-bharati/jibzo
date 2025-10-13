import React, { useState, useEffect } from "react";
import { db } from "../../assets/utils/firebaseConfig";
import { ref, set, get, onValue } from "firebase/database";

export default function DownloadBtn({ link, postId, layout = "vertical" }) {
  const [isLoading, setIsLoading] = useState(false);
  const [count, setCount] = useState(0);

  if (!link || !postId) return null;

  // 🔹 Fetch current download count
  useEffect(() => {
    const countRef = ref(db, `downloadStats/${postId}/count`);
    const unsubscribe = onValue(countRef, (snapshot) => {
      setCount(snapshot.val() || 0);
    });
    return () => unsubscribe();
  }, [postId]);

  // 🔹 Update count in Firebase
  const updateDownloadCount = async () => {
    try {
      const countRef = ref(db, `downloadStats/${postId}/count`);
      const snapshot = await get(countRef);
      const currentCount = snapshot.exists() ? snapshot.val() : 0;
      await set(countRef, currentCount + 1);
    } catch (error) {
      console.error("Error updating download count:", error);
    }
  };

  // 🔹 Extract file name
  const getFileName = (url) => {
    try {
      return url.split("/").pop().split("?")[0] || "file";
    } catch {
      return "file";
    }
  };

  // 🔹 Handle file download
  const handleDownload = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(link);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = getFileName(link);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      await updateDownloadCount();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Vertical layout (Reels) - Count niche
  if (layout === "vertical") {
    return (
      <div className="d-flex flex-column align-items-center">
        <button
          className="btn border-0 bg-transparent p-0 text-white"
          onClick={handleDownload}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="spinner-border spinner-border-sm text-white" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          ) : (
            <i className="bi bi-download fs-4 text-white"></i>
          )}
        </button>
        <small className="text-white mt-1">{count}</small>
      </div>
    );
  }

  // Horizontal layout (Posts) - Count side mein
  return (
    <div className="d-flex align-items-center gap-2">
      <button
        className="btn border-0 bg-transparent p-0 text-primary"
        onClick={handleDownload}
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        ) : (
          <i className="bi bi-download fs-4"></i>
        )}
      </button>
      <small className="text-muted">{count}</small>
    </div>
  );
}