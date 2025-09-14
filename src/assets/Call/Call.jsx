//src\assets\Call\Call.jsx
import React, { useEffect, useRef, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref as dbRef, set, onValue, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

export default function Call({ partnerUid, chatId, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const [callActive, setCallActive] = useState(false);
  const [currentUid, setCurrentUid] = useState(null);

  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
    return () => unsubscribe();
  }, []);

const startCall = async () => {
  if (!currentUid || !chatId) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Your browser does not support audio/video calls.");
    return;
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  pcRef.current = pc;

  try {
    // Local stream
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideoRef.current.srcObject = localStream;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  } catch (err) {
    console.error("Error accessing camera/microphone:", err);
    alert("Cannot access camera/microphone. Please allow permission.");
    return;
  }

  // Remote stream
  const remoteStream = new MediaStream();
  remoteVideoRef.current.srcObject = remoteStream;
  pc.ontrack = (event) => event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));

  // ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateRef = dbRef(db, `calls/${chatId}/candidates/${currentUid}`);
      set(candidateRef, event.candidate.toJSON());
    }
  };

  // Listen for remote ICE
  const otherCandidateRef = dbRef(db, `calls/${chatId}/candidates/${partnerUid}`);
  onValue(otherCandidateRef, (snap) => {
    const data = snap.val();
    if (data) pc.addIceCandidate(new RTCIceCandidate(data));
  });

  // Create offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const offerRef = dbRef(db, `calls/${chatId}/offer`);
  await set(offerRef, { sdp: offer.sdp, type: offer.type, sender: currentUid });

  setCallActive(true);
};

  // ---------- Accept Call ----------
  useEffect(() => {
    if (!currentUid || !chatId) return;

    const offerRef = dbRef(db, `calls/${chatId}/offer`);
    const answerRef = dbRef(db, `calls/${chatId}/answer`);
    const candidatesRef = dbRef(db, `calls/${chatId}/candidates`);

    const unsubscribe = onValue(offerRef, async (snap) => {
      const offer = snap.val();
      if (offer && offer.sender !== currentUid && !callActive) {
        // Accept incoming offer
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        // Local stream
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideoRef.current.srcObject = localStream;
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

        // Remote stream
        const remoteStream = new MediaStream();
        remoteVideoRef.current.srcObject = remoteStream;
        pc.ontrack = (event) =>
          event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));

        // ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidateRef = dbRef(db, `calls/${chatId}/candidates/${currentUid}`);
            set(candidateRef, event.candidate.toJSON());
          }
        };

        // Listen for remote ICE
        const otherCandidateRef = dbRef(db, `calls/${chatId}/candidates/${offer.sender}`);
        onValue(otherCandidateRef, (snap) => {
          const data = snap.val();
          if (data) pc.addIceCandidate(new RTCIceCandidate(data));
        });

        // Set remote description
        await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await set(answerRef, { sdp: answer.sdp, type: answer.type, sender: currentUid });

        setCallActive(true);
      }
    });

    return () => unsubscribe();
  }, [currentUid, chatId, callActive, partnerUid]);

  // ---------- End Call ----------
  const endCall = () => {
    pcRef.current?.close();
    remove(dbRef(db, `calls/${chatId}`));
    setCallActive(false);
    onClose?.();
  };

  return (
    <div className="call-container" style={{ display: "flex", gap: "10px" }}>
      <div>
        <video ref={localVideoRef} autoPlay muted style={{ width: "300px" }} />
        <p>Me</p>
      </div>
      <div>
        <video ref={remoteVideoRef} autoPlay style={{ width: "300px" }} />
        <p>Partner</p>
      </div>
      {!callActive && (
        <button className="btn btn-success " onClick={startCall}>
          Start Call
        </button>
      )}
      {callActive && (
        <button className="btn btn-danger" onClick={endCall}>
          End Call
        </button>
      )}
    </div>
  );
}
