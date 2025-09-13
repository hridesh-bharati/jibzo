import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, set, onValue, remove } from "firebase/database";

export default function Call({ callerId, receiverId }) {
  const [incoming, setIncoming] = useState(null);
  const [inCall, setInCall] = useState(false);
  const myVideo = useRef();
  const userVideo = useRef();
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  // ✅ Start call (caller)
  const startCall = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Your browser does not support calls!");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    myVideo.current.srcObject = stream;
    streamRef.current = stream;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (data) => {
      set(ref(db, `calls/${receiverId}`), {
        from: callerId,
        signal: data,
      });
    });

    peer.on("stream", (remoteStream) => {
      userVideo.current.srcObject = remoteStream;
    });

    peerRef.current = peer;
    setInCall(true);
  };

  // ✅ Listen for incoming call
  useEffect(() => {
    const callRef = ref(db, `calls/${callerId}`);
    onValue(callRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setIncoming(data);
      }
    });

    return () => remove(callRef);
  }, [callerId]);

  // ✅ Accept call (receiver)
  const acceptCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    myVideo.current.srcObject = stream;
    streamRef.current = stream;

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (data) => {
      set(ref(db, `calls/${incoming.from}/answer`), { signal: data });
    });

    peer.on("stream", (remoteStream) => {
      userVideo.current.srcObject = remoteStream;
    });

    peer.signal(incoming.signal);
    peerRef.current = peer;
    setInCall(true);
    setIncoming(null);
  };

  // ✅ Listen for answer (caller side)
  useEffect(() => {
    const answerRef = ref(db, `calls/${callerId}/answer`);
    onValue(answerRef, (snap) => {
      if (snap.exists() && peerRef.current) {
        peerRef.current.signal(snap.val().signal);
      }
    });
    return () => remove(answerRef);
  }, [callerId]);

  // ✅ End call
  const endCall = () => {
    if (peerRef.current) peerRef.current.destroy();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setInCall(false);
    setIncoming(null);
    remove(ref(db, `calls/${callerId}`));
    remove(ref(db, `calls/${receiverId}`));
  };

  return (
    <div style={{ padding: 20 }}>
      {!inCall && !incoming && (
        <button
          onClick={startCall}
          style={{ padding: 10, background: "#4caf50", color: "#fff" }}
        >
          📞 Start Call
        </button>
      )}

      {incoming && !inCall && (
        <div>
          <p>📲 Incoming call from {incoming.from}</p>
          <button
            onClick={acceptCall}
            style={{ padding: 10, background: "blue", color: "#fff" }}
          >
            ✅ Accept
          </button>
          <button
            onClick={endCall}
            style={{ padding: 10, background: "red", color: "#fff" }}
          >
            ❌ Reject
          </button>
        </div>
      )}

      {inCall && (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100vh",
            background: "#000",
          }}
        >
          {/* Remote video (large) */}
          <video
            ref={userVideo}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* My video (small floating window) */}
          <video
            ref={myVideo}
            autoPlay
            muted
            playsInline
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              width: 150,
              height: 200,
              borderRadius: 10,
              border: "2px solid #fff",
              objectFit: "cover",
            }}
          />

          <button
            onClick={endCall}
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "red",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: "50%",
            }}
          >
            🛑 End
          </button>
        </div>
      )}
    </div>
  );
}
