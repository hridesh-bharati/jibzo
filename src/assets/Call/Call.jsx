import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";

export default function Call({ chatUid, callType, onClose }) {
  const [peer, setPeer] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    const start = async () => {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({
          video: callType === "video",
          audio: true,
        });
        setStream(userStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = userStream;
        }

        const p = new Peer({
          initiator: true, // demo ke liye initiator fix, real app me signaling chahiye
          trickle: false,
          stream: userStream,
        });

        p.on("stream", (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        setPeer(p);
      } catch (err) {
        alert("Media error: " + err.message);
        onClose();
      }
    };
    start();

    return () => {
      peer?.destroy();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [callType]);

  return (
    <div style={{ background: "#000", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      {/* Remote video large */}
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "60vh", background: "#333", borderRadius: 10 }} />
      {/* Local video small */}
      {callType === "video" && (
        <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 120, height: 150, position: "absolute", bottom: 80, right: 20, borderRadius: 10, background: "#222" }} />
      )}
      <button onClick={onClose} style={{ marginTop: 20, padding: "10px 20px", borderRadius: 30, background: "#f44336", color: "#fff", border: "none" }}>
        End Call
      </button>
    </div>
  );
}
