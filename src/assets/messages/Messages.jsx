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
  const { uid } = useParams(); // Chat partner uid
  const [currentUid, setCurrentUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const longPressTimerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Video call refs & states
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  const processedCandidatesRef = useRef(new Set());
  const chatId = currentUid && uid ? [currentUid, uid].sort().join("_") : null;

  // Track logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
    return () => unsubscribe();
  }, []);

  // Fetch chat partner info
  useEffect(() => {
    if (!uid) return;
    const userRef = ref(db, `usersData/${uid}`);
    return onValue(userRef, (snap) => {
      if (snap.exists()) setChatUser(snap.val());
    });
  }, [uid]);

  // Fetch messages
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    const unsub = onValue(messagesRef, (snap) => {
      const data = snap.val();
      const msgs = data
        ? Object.entries(data).map(([id, msg]) => ({
            id,
            ...msg,
            timestamp:
              typeof msg.timestamp === "number"
                ? msg.timestamp
                : msg.timestamp?.toMillis?.() || Date.now(),
          }))
        : [];
      setMessages(msgs);
      setTimeout(() => scrollToBottom(), 100);
    });
    return () => unsub();
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !currentUid) return;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    await push(messagesRef, {
      sender: currentUid,
      text: input.trim(),
      timestamp: serverTimestamp(),
      deletedFor: [],
    });
    setInput("");
  };

  // Long press handler
  const startLongPress = (msg) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsg(msg);
    }, 700);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Remove message for me
  const removeForMe = async () => {
    if (!selectedMsg || !currentUid) return;
    const msgRef = ref(db, `chats/${chatId}/messages/${selectedMsg.id}/deletedFor`);
    const updatedDeletedFor = selectedMsg.deletedFor
      ? [...selectedMsg.deletedFor, currentUid]
      : [currentUid];
    await set(msgRef, updatedDeletedFor);
    setSelectedMsg(null);
  };

  // Delete for everyone
  const deleteForEveryone = async () => {
    if (!selectedMsg) return;
    const msgRef = ref(db, `chats/${chatId}/messages/${selectedMsg.id}`);
    try {
      await remove(msgRef);
      setSelectedMsg(null);
    } catch (error) {
      alert("Error deleting message: " + error.message);
    }
  };

  // Click outside modal closes it
  useEffect(() => {
    if (!selectedMsg) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest(".modal-content")) setSelectedMsg(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [selectedMsg]);

  // -------------------- Video call logic (WebRTC + Firebase signaling) --------------------
  const cleanupCall = async () => {
    try {
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
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        try {
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }

      processedCandidatesRef.current.clear();
      if (chatId) {
        await remove(ref(db, `calls/${chatId}`)).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const endCall = async () => {
    await set(ref(db, `calls/${chatId}/status`), "ended").catch(() => {});
    await cleanupCall();
  };

  const createPeerConnection = (onRemoteTrack) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.ontrack = (event) => {
      if (onRemoteTrack) onRemoteTrack(event.streams[0]);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && chatId && currentUid) {
        const cRef = ref(db, `calls/${chatId}/candidates/${currentUid}`);
        push(cRef, event.candidate.toJSON()).catch(console.error);
      }
    };
    return pc;
  };

  // Signaling listener
  useEffect(() => {
    if (!chatId) return;
    const callRef = ref(db, `calls/${chatId}`);
    const unsubCall = onValue(callRef, async (snap) => {
      const data = snap.val();
      if (!data) return;
      const { offer, answer, status } = data;

      if (offer && offer.from !== currentUid && !inCall && callStatus !== "ringing") {
        setIncomingCall({ from: offer.from, offer });
        setCallStatus("ringing");
      }

      if (answer && answer.from !== currentUid && pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setCallStatus("in-call");
          setInCall(true);
        } catch (err) {
          console.error(err);
        }
      }

      if (status) {
        if (status === "accepted") {
          setCallStatus("in-call");
          setInCall(true);
        }
        if (status === "rejected") cleanupCall();
        if (status === "ended") cleanupCall();
      }
    });

    const candidatesRef = ref(db, `calls/${chatId}/candidates`);
    const unsubCandidates = onValue(candidatesRef, async (snap) => {
      const val = snap.val();
      if (!val || !pcRef.current) return;
      Object.entries(val).forEach(([uidKey, cObj]) => {
        if (uidKey === currentUid) return;
        if (!cObj) return;
        Object.entries(cObj).forEach(([cid, candData]) => {
          const key = `${uidKey}|${cid}`;
          if (processedCandidatesRef.current.has(key)) return;
          processedCandidatesRef.current.add(key);
          try {
            pcRef.current.addIceCandidate(new RTCIceCandidate(candData)).catch(console.warn);
          } catch (err) {
            console.error(err);
          }
        });
      });
    });

    return () => {
      try { unsubCall(); } catch {}
      try { unsubCandidates(); } catch {}
    };
  }, [chatId, currentUid, inCall, callStatus]);

  const startCall = async () => {
    if (!currentUid || !chatId) return;
    try {
      setCallStatus("calling");
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      const pc = createPeerConnection((remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });
      pcRef.current = pc;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      const offerDesc = await pc.createOffer();
      await pc.setLocalDescription(offerDesc);

      await set(ref(db, `calls/${chatId}`), {
        offer: { sdp: offerDesc.sdp, type: offerDesc.type, from: currentUid },
        status: "calling",
        from: currentUid,
        createdAt: Date.now(),
      });

      try {
        const callRef = ref(db, `calls/${chatId}`);
        onDisconnect(callRef).remove();
      } catch {}
    } catch (err) {
      console.error(err);
      await cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !chatId || !currentUid) return;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      const pc = createPeerConnection((remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });
      pcRef.current = pc;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      const answerDesc = await pc.createAnswer();
      await pc.setLocalDescription(answerDesc);

      await set(ref(db, `calls/${chatId}/answer`), {
        sdp: answerDesc.sdp,
        type: answerDesc.type,
        from: currentUid,
      });
      await set(ref(db, `calls/${chatId}/status`), "accepted");

      setCallStatus("in-call");
      setInCall(true);
      setIncomingCall(null);
    } catch (err) {
      console.error(err);
      await cleanupCall();
    }
  };

  const declineCall = async () => {
    if (!chatId) return;
    try {
      await set(ref(db, `calls/${chatId}/status`), "rejected");
    } finally {
      setIncomingCall(null);
      setCallStatus("idle");
    }
  };

  useEffect(() => {
    return () => cleanupCall();
  }, []);

  if (!currentUid)
    return <p style={{ textAlign: "center", marginTop: 40, color: "#666", fontSize: 16 }}>Please log in to chat.</p>;

  return (
    <div style={{ maxWidth: 600, height: "80vh", margin: "20px auto", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: "#333" }}>
      {/* Chat container */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.1)", backgroundColor: "#f9fafb" }}>
        {/* Header */}
        <header style={{ padding: "12px 20px", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 15, backgroundColor: "#fff", borderTopLeftRadius: 8, borderTopRightRadius: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {chatUser ? (
              <>
                <img src={chatUser.photoURL || "https://via.placeholder.com/40"} alt={chatUser.username || "User"} loading="lazy"
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #1976d2" }} />
                <span style={{ fontSize: 18, fontWeight: 600 }}>{chatUser.username || "Unknown User"}</span>
              </>
            ) : <span style={{ fontSize: 16, color: "#999" }}>Loading...</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={startCall} title="Start video call" style={{ backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>
              <IoVideocam size={25} />
            </button>
            {inCall && <button onClick={endCall} title="End call" style={{ backgroundColor: "#f44336", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>✖️ End</button>}
          </div>
        </header>

        {/* Messages */}
        <main style={{ flexGrow: 1, overflowY: "auto", padding: "20px", backgroundColor: "#fff", display: "flex", flexDirection: "column", gap: 12, scrollbarWidth: "thin" }} aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && <p style={{ textAlign: "center", color: "#999", marginTop: 60, fontStyle: "italic" }}>No messages yet. Say hi!</p>}
          {messages.map((msg) => {
            const isDeleted = msg.deletedFor?.includes(currentUid);
            if (isDeleted) return null;
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
            const isSentByCurrentUser = msg.sender === currentUid;
            return (
              <div key={msg.id} onMouseDown={() => startLongPress(msg)} onTouchStart={() => startLongPress(msg)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress} onTouchEnd={cancelLongPress} onTouchCancel={cancelLongPress}
                style={{ alignSelf: isSentByCurrentUser ? "flex-end" : "flex-start", maxWidth: "70%", backgroundColor: isSentByCurrentUser ? "#1976d2" : "#e3e6eb", color: isSentByCurrentUser ? "#fff" : "#222", borderRadius: 14, padding: "10px 15px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", position: "relative", wordBreak: "break-word", userSelect: "none", touchAction: "manipulation", fontSize: 15, lineHeight: 1.3 }}>
                {msg.text}
                <time style={{ fontSize: 11, color: isSentByCurrentUser ? "rgba(255,255,255,0.7)" : "#666", position: "absolute", bottom: 0, right: 10, userSelect: "none" }}>{time}</time>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </main>

        {/* Input */}
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{ display: "flex", gap: 12, padding: "15px 20px", borderTop: "1px solid #e0e0e0", backgroundColor: "#fafafa", borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
          <input type="text" value={input} autoFocus onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." style={{ flexGrow: 1, padding: "10px 15px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14 }} />
          <button type="submit" style={{ backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 16 }}>Send</button>
        </form>
      </div>

      {/* Long press modal */}
      {selectedMsg && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
          <div className="modal-content" style={{ backgroundColor: "#fff", padding: "20px", borderRadius: 8, boxShadow: "0 4px 10px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 15 }}>
            {selectedMsg.sender === currentUid ? (
              <>
                <button onClick={removeForMe} style={{ backgroundColor: "#f44336", color: "#fff", border: "none", padding: "10px", borderRadius: 8, fontSize: 16 }}>Remove for Me</button>
                <button onClick={deleteForEveryone} style={{ backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px", borderRadius: 8, fontSize: 16 }}>Delete for Everyone</button>
              </>
            ) : (
              <button onClick={removeForMe} style={{ backgroundColor: "#f44336", color: "#fff", border: "none", padding: "10px", borderRadius: 8, fontSize: 16 }}>Remove for Me</button>
            )}
          </div>
        </div>
      )}

      {/* Incoming call modal */}
      {callStatus === "ringing" && incomingCall && (
        <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, zIndex: 1200, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 340, padding: 20, borderRadius: 10, backgroundColor: "#fff", textAlign: "center" }}>
            <h3 style={{ margin: "8px 0" }}>Incoming Video Call</h3>
            <p style={{ color: "#666" }}>{chatUser?.username || "Unknown"} is calling</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
              <button onClick={acceptCall} style={{ padding: "10px 16px", borderRadius: 8, border: "none", backgroundColor: "#1976d2", color: "#fff" }}>Accept</button>
              <button onClick={declineCall} style={{ padding: "10px 16px", borderRadius: 8, border: "none", backgroundColor: "#f44336", color: "#fff" }}>Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* In-call UI */}
      {callStatus === "in-call" && (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1300, width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <div style={{ width: "100%", display: "flex", gap: 8 }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: 100, height: 80, borderRadius: 8, objectFit: "cover", backgroundColor: "#000" }} />
            <video ref={remoteVideoRef} autoPlay playsInline style={{ flex: 1, height: 120, borderRadius: 8, objectFit: "cover", backgroundColor: "#000" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={endCall} style={{ backgroundColor: "#f44336", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8 }}>End Call</button>
          </div>
        </div>
      )}
    </div>
  );
}
