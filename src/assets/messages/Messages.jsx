// src/components/Messages/Messages.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref,
  onValue,
  push,
  serverTimestamp,
  remove,
  set,
  onDisconnect,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { IoVideocam } from "react-icons/io5";

export default function Messages() {
  const { uid } = useParams();
  const [currentUid, setCurrentUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const messagesEndRef = useRef(null);

  // Video call refs/states
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const processedCandidatesRef = useRef(new Set());
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("idle");

  const chatId = currentUid && uid ? [currentUid, uid].sort().join("_") : null;

  // Track login
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
  }, []);

  // Fetch chat partner
  useEffect(() => {
    if (!uid) return;
    return onValue(ref(db, `usersData/${uid}`), (snap) => {
      if (snap.exists()) setChatUser(snap.val());
    });
  }, [uid]);

  // Fetch messages
  useEffect(() => {
    if (!chatId) return;
    return onValue(ref(db, `chats/${chatId}/messages`), (snap) => {
      const data = snap.val();
      const msgs = data
        ? Object.entries(data).map(([id, m]) => ({
            id,
            ...m,
            timestamp:
              typeof m.timestamp === "number"
                ? m.timestamp
                : m.timestamp?.toMillis?.() || Date.now(),
          }))
        : [];
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    });
  }, [chatId]);

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !currentUid) return;
    await push(ref(db, `chats/${chatId}/messages`), {
      sender: currentUid,
      text: input.trim(),
      timestamp: serverTimestamp(),
    });
    setInput("");
  };

  // ------------- WebRTC helpers -------------

  const cleanupCall = async () => {
    setInCall(false);
    setCallStatus("idle");
    setIncomingCall(null);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    processedCandidatesRef.current.clear();
    if (chatId) await remove(ref(db, `calls/${chatId}`)).catch(() => {});
  };

  const createPC = (onRemoteTrack) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.ontrack = (e) => onRemoteTrack(e.streams[0]);
    pc.onicecandidate = (e) => {
      if (e.candidate && chatId && currentUid) {
        push(ref(db, `calls/${chatId}/candidates/${currentUid}`), e.candidate.toJSON());
      }
    };
    return pc;
  };

  // Listen for signaling
  useEffect(() => {
    if (!chatId) return;

    const unsubCall = onValue(ref(db, `calls/${chatId}`), async (snap) => {
      const data = snap.val();
      if (!data) return;

      const { offer, answer, status, from } = data;

      if (offer && from !== currentUid && !inCall && callStatus !== "ringing") {
        setIncomingCall({ from, offer });
        setCallStatus("ringing");
      }

      if (answer && answer.from !== currentUid && pcRef.current) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription({ type: answer.type, sdp: answer.sdp })
        );
        setCallStatus("in-call");
        setInCall(true);
      }

      if (status === "rejected") {
        alert("Call rejected");
        cleanupCall();
      }
      if (status === "ended") {
        cleanupCall();
      }
    });

    const unsubCand = onValue(ref(db, `calls/${chatId}/candidates`), (snap) => {
      if (!snap.val() || !pcRef.current) return;
      Object.entries(snap.val()).forEach(([uidKey, obj]) => {
        if (uidKey === currentUid) return;
        Object.entries(obj).forEach(([id, cand]) => {
          const key = uidKey + "|" + id;
          if (processedCandidatesRef.current.has(key)) return;
          processedCandidatesRef.current.add(key);
          pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        });
      });
    });

    return () => {
      unsubCall();
      unsubCand();
    };
  }, [chatId, currentUid]);

  // Caller: start call
  const startCall = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      localVideoRef.current.srcObject = localStream;

      const pc = createPC((remote) => (remoteVideoRef.current.srcObject = remote));
      pcRef.current = pc;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await set(ref(db, `calls/${chatId}`), {
        offer: { type: offer.type, sdp: offer.sdp },
        status: "calling",
        from: currentUid,
      });

      onDisconnect(ref(db, `calls/${chatId}`)).remove();
      setCallStatus("calling");
    } catch (err) {
      alert("Error starting call: " + err.message);
      cleanupCall();
    }
  };

  // Callee: accept
  const acceptCall = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      localVideoRef.current.srcObject = localStream;

      const pc = createPC((remote) => (remoteVideoRef.current.srcObject = remote));
      pcRef.current = pc;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: incomingCall.offer.type, sdp: incomingCall.offer.sdp })
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await set(ref(db, `calls/${chatId}/answer`), {
        type: answer.type,
        sdp: answer.sdp,
        from: currentUid,
      });
      await set(ref(db, `calls/${chatId}/status`), "accepted");

      setInCall(true);
      setCallStatus("in-call");
      setIncomingCall(null);
    } catch (err) {
      alert("Accept failed: " + err.message);
      cleanupCall();
    }
  };

  const declineCall = async () => {
    await set(ref(db, `calls/${chatId}/status`), "rejected");
    setIncomingCall(null);
    setCallStatus("idle");
  };

  const endCall = async () => {
    await set(ref(db, `calls/${chatId}/status`), "ended");
    cleanupCall();
  };

  // ----------- UI -----------
  if (!currentUid) return <p style={{ textAlign: "center" }}>Please login</p>;

  return (
    <div style={{ maxWidth: 600, margin: "20px auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", padding: 10 }}>
        <div>{chatUser?.username || "User"}</div>
        <div>
          <button onClick={startCall}><IoVideocam size={24} /></button>
          {inCall && <button onClick={endCall}>End</button>}
        </div>
      </header>

      <main style={{ height: 400, overflowY: "auto", padding: 10, background: "#fff" }}>
        {messages.map((m) => (
          <div key={m.id} style={{ margin: "6px 0", textAlign: m.sender === currentUid ? "right" : "left" }}>
            <span style={{ background: m.sender === currentUid ? "#1976d2" : "#eee", color: m.sender === currentUid ? "#fff" : "#000", padding: "6px 10px", borderRadius: 8 }}>
              {m.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef}></div>
      </main>

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{ display: "flex", padding: 10 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} />
        <button type="submit">Send</button>
      </form>

      {incomingCall && callStatus === "ringing" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0006", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#fff", padding: 20 }}>
            <p>{chatUser?.username} is calling</p>
            <button onClick={acceptCall}>Accept</button>
            <button onClick={declineCall}>Decline</button>
          </div>
        </div>
      )}

      {callStatus === "in-call" && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "#000" }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 300 }} />
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: 100, position: "absolute", bottom: 10, right: 10 }} />
        </div>
      )}
    </div>
  );
}
