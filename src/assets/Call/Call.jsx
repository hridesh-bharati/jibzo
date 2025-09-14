// src/assets/Call/Call.jsx
import React, { useEffect, useRef, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref as dbRef, set, onValue, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

export default function Call({ partnerUid, chatId, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);

  const [currentUid, setCurrentUid] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [offerData, setOfferData] = useState(null);
  const [localStream, setLocalStream] = useState(null);

  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
    return () => unsubscribe();
  }, []);

  // ---------- Init Local Stream ----------
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Cannot access camera/microphone", err);
      alert("Allow camera/microphone permissions");
      return null;
    }
  };

  // ---------- Create PeerConnection ----------
  const createPeerConnection = async () => {
    if (!localStream) return null;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcRef.current = pc;

    // Add local tracks
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Remote tracks
    const remoteStream = new MediaStream();
    remoteVideoRef.current.srcObject = remoteStream;
    pc.ontrack = (event) => event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        set(dbRef(db, `calls/${chatId}/candidates/${currentUid}`), event.candidate.toJSON());
      }
    };

    // Listen remote ICE
    const otherCandidateRef = dbRef(db, `calls/${chatId}/candidates/${partnerUid}`);
    onValue(otherCandidateRef, (snap) => {
      const data = snap.val();
      if (data) pc.addIceCandidate(new RTCIceCandidate(data));
    });

    return pc;
  };

  // ---------- Start Call (Outgoing) ----------
  const startCall = async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    const pc = await createPeerConnection();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await set(dbRef(db, `calls/${chatId}/offer`), { sdp: offer.sdp, type: offer.type, sender: currentUid });
    setCallActive(true);
  };

  // ---------- Listen Incoming Call ----------
  useEffect(() => {
    if (!currentUid) return;
    const offerRef = dbRef(db, `calls/${chatId}/offer`);
    const answerRef = dbRef(db, `calls/${chatId}/answer`);

    const unsubscribe = onValue(offerRef, async (snap) => {
      const offer = snap.val();
      if (offer && offer.sender !== currentUid && !callActive) {
        setIncomingCall(true);
        setOfferData(offer);
      }
    });

    return () => unsubscribe();
  }, [currentUid, chatId, callActive, partnerUid]);

  const acceptCall = async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    const pc = await createPeerConnection();

    // Set remote description
    await pc.setRemoteDescription({ type: "offer", sdp: offerData.sdp });

    // Create and send answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await set(dbRef(db, `calls/${chatId}/answer`), { sdp: answer.sdp, type: answer.type, sender: currentUid });

    setCallActive(true);
    setIncomingCall(false);
  };

  // ---------- Listen for Answer (for caller) ----------
  useEffect(() => {
    if (!currentUid) return;
    const answerRef = dbRef(db, `calls/${chatId}/answer`);
    const unsubscribe = onValue(answerRef, async (snap) => {
      const answer = snap.val();
      if (answer && pcRef.current && !callActive && answer.sender !== currentUid) {
        await pcRef.current.setRemoteDescription({ type: "answer", sdp: answer.sdp });
        setCallActive(true);
      }
    });
    return () => unsubscribe();
  }, [currentUid, chatId, callActive]);

  // ---------- End Call ----------
  const endCall = () => {
    pcRef.current?.close();
    localStream?.getTracks().forEach((t) => t.stop());
    remove(dbRef(db, `calls/${chatId}`)); // remove offer, answer, candidates
    setCallActive(false);
    setIncomingCall(false);
    onClose?.();
  };

  // ---------- Listen for Call End (from partner) ----------
  useEffect(() => {
    if (!chatId) return;
    const callRef = dbRef(db, `calls/${chatId}`);
    const unsubscribe = onValue(callRef, (snap) => {
      if (!snap.exists() && callActive) {
        // Partner ended the call
        pcRef.current?.close();
        localStream?.getTracks().forEach((t) => t.stop());
        setCallActive(false);
        onClose?.();
      }
    });
    return () => unsubscribe();
  }, [chatId, callActive, localStream, onClose]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Large Partner Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        style={{ width: "100%", height: "80vh", backgroundColor: "#000" }}
      />

      {/* Small Local Video Overlay */}
      {localStream && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          style={{
            width: "150px",
            height: "150px",
            position: "absolute",
            bottom: "20px",
            right: "20px",
            border: "2px solid white",
            borderRadius: "10px",
            objectFit: "cover",
            backgroundColor: "#000",
          }}
        />
      )}

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "80vh",
            backgroundColor: "rgba(0,0,0,0.7)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
          }}
        >
          <h3>Incoming Call...</h3>
          <div style={{ display: "flex", gap: "20px" }}>
            <button className="btn btn-success btn-lg" onClick={acceptCall}>
              Accept
            </button>
            <button className="btn btn-danger btn-lg" onClick={endCall}>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Call Controls */}
      {callActive && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "20px",
          }}
        >
          <button className="btn btn-danger btn-lg" onClick={endCall}>
            End Call
          </button>
        </div>
      )}

      {/* Start Call Button for Caller */}
      {!callActive && !incomingCall && (
        <button
          className="btn btn-success"
          style={{ position: "absolute", top: "10px", right: "10px" }}
          onClick={startCall}
        >
          Start Call
        </button>
      )}
    </div>
  );
}
