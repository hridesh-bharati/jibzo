import React, { useEffect, useRef, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, set, onValue, remove, onDisconnect } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import SimplePeer from "simple-peer";

export default function Call({ chatUid, callType = "video" }) {
  const [currentUid, setCurrentUid] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  const chatId =
    currentUid && chatUid ? [currentUid, chatUid].sort().join("_") : null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
    return () => unsub();
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!chatId) return;
    const callRef = ref(db, `calls/${chatId}`);
    const unsub = onValue(callRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      if (data.offer && data.offer.from !== currentUid && !inCall) {
        setIncomingCall(data.offer);
      }
    });
    return () => unsub();
  }, [chatId, currentUid, inCall]);

  const startCall = async () => {
    if (!chatId || !currentUid) return;
    const mediaConfig =
      callType === "video"
        ? { video: true, audio: true }
        : { video: false, audio: true };

    const stream = await navigator.mediaDevices.getUserMedia(mediaConfig);
    if (callType === "video") {
      localVideoRef.current.srcObject = stream;
    }

    const peer = new SimplePeer({ initiator: true, trickle: false, stream });
    peerRef.current = peer;

    peer.on("signal", async (signalData) => {
      await set(ref(db, `calls/${chatId}/offer`), {
        from: currentUid,
        type: callType,
        signal: signalData,
      });
      onDisconnect(ref(db, `calls/${chatId}`)).remove();
    });

    peer.on("stream", (remoteStream) => {
      remoteVideoRef.current.srcObject = remoteStream;
    });

    setInCall(true);
  };

  const answerCall = async () => {
    if (!incomingCall || !chatId || !currentUid) return;
    const mediaConfig =
      incomingCall.type === "video"
        ? { video: true, audio: true }
        : { video: false, audio: true };

    const stream = await navigator.mediaDevices.getUserMedia(mediaConfig);
    if (incomingCall.type === "video") {
      localVideoRef.current.srcObject = stream;
    }

    const peer = new SimplePeer({ initiator: false, trickle: false, stream });
    peerRef.current = peer;

    peer.on("signal", async (signalData) => {
      await set(ref(db, `calls/${chatId}/answer`), {
        from: currentUid,
        signal: signalData,
      });
    });

    peer.on("stream", (remoteStream) => {
      remoteVideoRef.current.srcObject = remoteStream;
    });

    peer.signal(incomingCall.signal);
    setInCall(true);
    setIncomingCall(null);
  };

  // Listen for answer
  useEffect(() => {
    if (!chatId || !currentUid) return;
    const answerRef = ref(db, `calls/${chatId}/answer`);
    const unsub = onValue(answerRef, (snap) => {
      const data = snap.val();
      if (!data || data.from === currentUid) return;
      if (peerRef.current) peerRef.current.signal(data.signal);
    });
    return () => unsub();
  }, [chatId, currentUid]);

  const endCall = async () => {
    if (peerRef.current) peerRef.current.destroy();
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
    }
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
    }
    peerRef.current = null;
    setInCall(false);
    setIncomingCall(null);
    if (chatId) await remove(ref(db, `calls/${chatId}`));
  };

  return (
    <div style={{ textAlign: "center", marginTop: 10 }}>
      {/* Video only when video call */}
      {callType === "video" && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            style={{
              width: 200,
              borderRadius: 8,
              background: "#000",
            }}
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            style={{
              width: 200,
              borderRadius: 8,
              background: "#000",
            }}
          />
        </div>
      )}

      {!inCall && !incomingCall && (
        <button
          onClick={startCall}
          style={{
            marginTop: 10,
            padding: "8px 16px",
            borderRadius: 6,
            background: "#075E54",
            color: "#fff",
            border: "none",
          }}
        >
          {callType === "video" ? "Start Video Call" : "Start Audio Call"}
        </button>
      )}

      {incomingCall && !inCall && (
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button
            onClick={answerCall}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              background: "#4caf50",
              color: "#fff",
              border: "none",
            }}
          >
            Answer {incomingCall.type === "video" ? "Video" : "Audio"} Call
          </button>
          <button
            onClick={() => setIncomingCall(null)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              background: "#f44336",
              color: "#fff",
              border: "none",
            }}
          >
            Decline
          </button>
        </div>
      )}

      {inCall && (
        <button
          onClick={endCall}
          style={{
            marginTop: 10,
            padding: "8px 16px",
            borderRadius: 6,
            background: "#f44336",
            color: "#fff",
            border: "none",
          }}
        >
          End Call
        </button>
      )}
    </div>
  );
}
