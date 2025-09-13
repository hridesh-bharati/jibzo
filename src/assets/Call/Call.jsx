// src/assets/Call/Call.jsx
import React, { useRef, useState } from "react";
import { db } from "../../assets/utils/firebaseConfig";
import { ref, push, onChildAdded, set, remove } from "firebase/database";

export default function Call({ chatUid, callType, onClose }) {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const [started, setStarted] = useState(false);

  // STUN server
  const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // pending ICE candidates queue
  const pendingCandidates = [];

  // Start a new call (offerer)
  const startCall = async () => {
    pc.current = new RTCPeerConnection(servers);

    // Local media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: callType === "video",
      audio: true,
    });
    localVideo.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));

    // Remote media
    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    // Send ICE candidates
    pc.current.onicecandidate = (e) => {
      if (e.candidate) {
        push(ref(db, `calls/${chatUid}/candidates`), e.candidate.toJSON());
      }
    };

    // Create offer
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    await set(ref(db, `calls/${chatUid}/offer`), offer);

    // Listen for answer
    onChildAdded(ref(db, `calls/${chatUid}/answer`), async (snap) => {
      if (!pc.current.currentRemoteDescription) {
        const answer = snap.val();
        await pc.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );

        // flush queued ICE candidates
        while (pendingCandidates.length) {
          const cand = pendingCandidates.shift();
          try {
            await pc.current.addIceCandidate(cand);
          } catch (err) {
            console.error("ICE add error (flushed)", err);
          }
        }
      }
    });

    setStarted(true);
  };

  // Answer an incoming call
  const answerCall = async () => {
    pc.current = new RTCPeerConnection(servers);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: callType === "video",
      audio: true,
    });
    localVideo.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));

    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    pc.current.onicecandidate = (e) => {
      if (e.candidate) {
        push(ref(db, `calls/${chatUid}/candidates`), e.candidate.toJSON());
      }
    };

    // Listen for offer
    onChildAdded(ref(db, `calls/${chatUid}/offer`), async (snap) => {
      const offer = snap.val();
      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

      // flush queued ICE
      while (pendingCandidates.length) {
        const cand = pendingCandidates.shift();
        try {
          await pc.current.addIceCandidate(cand);
        } catch (err) {
          console.error("ICE add error (flushed)", err);
        }
      }

      // Create answer
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      await set(ref(db, `calls/${chatUid}/answer`), answer);
    });

    setStarted(true);
  };

  // Listen for ICE candidates
  onChildAdded(ref(db, `calls/${chatUid}/candidates`), async (snap) => {
    const candidate = new RTCIceCandidate(snap.val());
    if (pc.current && pc.current.remoteDescription) {
      try {
        await pc.current.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE add error", err);
      }
    } else {
      pendingCandidates.push(candidate);
    }
  });

  // End call
  const endCall = async () => {
    pc.current?.close();
    pc.current = null;

    // cleanup firebase room
    await remove(ref(db, `calls/${chatUid}`));

    if (onClose) onClose();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: "10px" }}>
        <video
          ref={localVideo}
          autoPlay
          playsInline
          muted
          style={{ width: "40%", background: "#000" }}
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          style={{ width: "40%", background: "#000" }}
        />
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        {!started ? (
          <>
            <button onClick={startCall}>Start Call</button>
            <button onClick={answerCall}>Answer Call</button>
          </>
        ) : (
          <button onClick={endCall} style={{ background: "red", color: "#fff" }}>
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
