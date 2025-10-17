import React, { useState } from "react";

export default function VideoDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleDownload = async () => {
        if (!url.trim()) {
            setError("Please enter a video URL");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            console.log('Fetching from:', proxyUrl);

            const response = await fetch(proxyUrl);
            const contentType = response.headers.get('content-type');

            // Check if response is JSON error
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || 'Download failed');
            }

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            // Check if it's a video
            if (!contentType || !contentType.includes('video')) {
                const text = await response.text();
                throw new Error(`Unexpected response: ${text.substring(0, 100)}`);
            }

            const blob = await response.blob();

            if (blob.size === 0) {
                throw new Error("Received empty file");
            }

            // Create download
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = url.includes('instagram') ? "instagram_video.mp4" : "downloaded_video.mp4";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            setSuccess("Video downloaded successfully!");

        } catch (err) {
            console.error("Download error:", err);
            setError(err.message || "Error downloading video!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "2rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
            <h3>Video Downloader</h3>

            <input
                type="text"
                placeholder="Paste Instagram Reel or Video URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                    width: "100%",
                    padding: "0.75rem",
                    margin: "1rem 0",
                    border: error ? "2px solid #ff4444" : "2px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "16px"
                }}
            />

            <button
                onClick={handleDownload}
                disabled={loading}
                style={{
                    padding: "0.75rem 2rem",
                    fontSize: "16px",
                    backgroundColor: loading ? "#ccc" : "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: loading ? "not-allowed" : "pointer",
                    width: "100%"
                }}
            >
                {loading ? "⏳ Downloading..." : "⬇️ Download Video"}
            </button>

            {error && (
                <div style={{
                    color: "#ff4444",
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: "#ffe6e6",
                    borderRadius: "8px",
                    border: "1px solid #ff4444"
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {success && (
                <div style={{
                    color: "#00c851",
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: "#e6ffe6",
                    borderRadius: "8px",
                    border: "1px solid #00c851"
                }}>
                    <strong>Success:</strong> {success}
                </div>
            )}

            <div style={{
                marginTop: "2rem",
                fontSize: "0.9rem",
                color: "#666",
                textAlign: "left",
                padding: "1rem",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px"
            }}>
                <strong>Supported URLs:</strong>
            </div>
        </div>
    );
}