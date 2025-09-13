import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, push, remove } from "firebase/database";

export default function Call({ chatUid, callType, onClose }) {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const [peer, setPeer] = useState(null);
  const streamRef = useRef();
  const callId = [auth.currentUser.uid, chatUid].sort().join("_");

  // Send signal to Firebase
  const sendSignal = async (data) => {
    await push(ref(db, `calls/${callId}/signals`), {
      from: auth.currentUser.uid,
      data,
    });
  };

  useEffect(() => {
    async function init() {
      try {
        // ✅ get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === "video",
          audio: true,
        });
        streamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;

        // ✅ create peer
        const newPeer = new Peer({
          initiator: true,
          trickle: false,
          stream,
        });

        newPeer.on("signal", (data) => {
          sendSignal(JSON.stringify(data));
        });

        newPeer.on("stream", (remoteStream) => {
          if (remoteVideo.current) {
            remoteVideo.current.srcObject = remoteStream;
          }
        });

        setPeer(newPeer);
      } catch (err) {
        console.error("Media error:", err);
        onClose();
      }
    }
    init();

    // cleanup
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (peer) peer.destroy();
      remove(ref(db, `calls/${callId}`));
    };
  }, []);

  // ✅ listen for remote signals
  useEffect(() => {
    const signalsRef = ref(db, `calls/${callId}/signals`);
    return onValue(signalsRef, (snap) => {
      if (!snap.exists()) return;
      const signals = Object.values(snap.val() || {});
      signals.forEach((s) => {
        if (s.from !== auth.currentUser.uid) {
          peer?.signal(JSON.parse(s.data));
        }
      });
    });
  }, [peer]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      }}
    >
      {/* Remote Video (Large) */}
      <video
        ref={remoteVideo}
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* Local Video (Small) */}
      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        style={{
          width: 200,
          height: 150,
          position: "absolute",
          bottom: 20,
          right: 20,
          border: "2px solid white",
          borderRadius: 10,
          objectFit: "cover",
        }}
      />
      {/* End Call */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "red",
          color: "#fff",
          padding: "10px 20px",
          border: "none",
          borderRadius: 50,
          fontSize: 16,
        }}
      >
        End Call
      </button>
    </div>
  );
}
