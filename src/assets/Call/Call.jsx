import React, { useEffect, useRef, useState } from "react";
import { db } from "../../assets/utils/firebaseConfig";
import {
  ref,
  push,
  set,
  onChildAdded,
  remove,
  get,
} from "firebase/database";

export default function Call({ chatUid, callType = "video", onClose }) {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const [started, setStarted] = useState(false);
  const [roomId] = useState(chatUid); // chatId as room

  const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const initPeer = async () => {
    pc.current = new RTCPeerConnection(servers);

    // Local Media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: callType === "video",
      audio: true,
    });
    localVideo.current.srcObject = stream;
    stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

    // Remote stream
    pc.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    // ICE candidates
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        push(ref(db, `calls/${roomId}/candidates`), event.candidate.toJSON());
      }
    };

    setStarted(true);
  };

  const startCall = async () => {
    await initPeer();
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    await set(ref(db, `calls/${roomId}/offer`), offer);

    // Listen for answer
    onChildAdded(ref(db, `calls/${roomId}/answer`), async (snap) => {
      if (!pc.current.remoteDescription) {
        const answer = snap.val();
        await pc.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    });

    // Listen ICE
    onChildAdded(ref(db, `calls/${roomId}/candidates`), async (snap) => {
      try {
        const candidate = new RTCIceCandidate(snap.val());
        await pc.current.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE add error", err);
      }
    });
  };

  const answerCall = async () => {
    await initPeer();

    // Get Offer
    const offerSnap = await get(ref(db, `calls/${roomId}/offer`));
    if (!offerSnap.exists()) return alert("No offer found!");
    const offer = offerSnap.val();
    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

    // Create Answer
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    await set(ref(db, `calls/${roomId}/answer/ans`), answer);

    // Listen ICE
    onChildAdded(ref(db, `calls/${roomId}/candidates`), async (snap) => {
      try {
        const candidate = new RTCIceCandidate(snap.val());
        await pc.current.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE add error", err);
      }
    });
  };

  const endCall = async () => {
    try {
      pc.current?.close();
      pc.current = null;
      if (roomId) {
        await remove(ref(db, `calls/${roomId}`));
      }
    } catch (err) {
      console.error(err);
    }
    onClose?.();
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        ref={localVideo}
        autoPlay
        playsInline
        muted
        style={{ width: "40%", border: "2px solid #fff", borderRadius: 8 }}
      />
      <video
        ref={remoteVideo}
        autoPlay
        playsInline
        style={{ width: "40%", border: "2px solid #fff", borderRadius: 8 }}
      />

      <div style={{ marginTop: 20, display: "flex", gap: 20 }}>
        <button onClick={startCall} disabled={started}>
          Start Call
        </button>
        <button onClick={answerCall}>Answer</button>
        <button
          onClick={endCall}
          style={{ background: "red", color: "#fff", padding: "6px 12px" }}
        >
          End
        </button>
      </div>
    </div>
  );
}
