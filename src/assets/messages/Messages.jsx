// src/components/Messages/Messages.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
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

  const longPressTimerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Video call refs
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
    return () => unsubscribe();
  }, []);

  // Fetch chat partner
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
      setTimeout(scrollToBottom, 100);
    });
    return () => unsub();
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

  // Long press
  const startLongPress = (msg) => {
    longPressTimerRef.current = setTimeout(() => setSelectedMsg(msg), 700);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const removeForMe = async () => {
    if (!selectedMsg || !currentUid) return;
    const msgRef = ref(db, `chats/${chatId}/messages/${selectedMsg.id}/deletedFor`);
    const updatedDeletedFor = selectedMsg.deletedFor
      ? [...selectedMsg.deletedFor, currentUid]
      : [currentUid];
    await set(msgRef, updatedDeletedFor);
    setSelectedMsg(null);
  };

  const deleteForEveryone = async () => {
    if (!selectedMsg) return;
    const msgRef = ref(db, `chats/${chatId}/messages/${selectedMsg.id}`);
    await remove(msgRef).catch((err) =>
      alert("Error deleting message: " + err.message)
    );
    setSelectedMsg(null);
  };

  useEffect(() => {
    if (!selectedMsg) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest(".modal-content")) setSelectedMsg(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [selectedMsg]);

  // ----------------- WebRTC -----------------
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
      } catch { }
      pcRef.current = null;
    }

    processedCandidatesRef.current.clear();

    if (chatId) await remove(ref(db, `calls/${chatId}`)).catch(() => { });
  };

  const createPC = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Remote stream
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate && chatId && currentUid) {
        push(
          ref(db, `calls/${chatId}/candidates/${currentUid}`),
          e.candidate.toJSON()
        );
      }
    };

    return pc;
  };

  // Listen for incoming calls & ICE candidates
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
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus("in-call");
        setInCall(true);
      }

      if (status === "rejected") cleanupCall();
      if (status === "ended") cleanupCall();
    });

    const unsubCand = onValue(ref(db, `calls/${chatId}/candidates`), (snap) => {
      if (!snap.val() || !pcRef.current) return;
      Object.entries(snap.val()).forEach(([uidKey, obj]) => {
        if (uidKey === currentUid) return;
        Object.entries(obj).forEach(([id, cand]) => {
          const key = uidKey + "|" + id;
          if (processedCandidatesRef.current.has(key)) return;
          processedCandidatesRef.current.add(key);
          pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => { });
        });
      });
    });

    return () => {
      unsubCall();
      unsubCand();
    };
  }, [chatId, currentUid, inCall, callStatus]);

  const startCall = async () => {
    try {
      // 1. Get local media
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      // 2. Create peer connection
      const pc = createPC();
      pcRef.current = pc;

      // 3. Add tracks
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // 4. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Send offer to DB
      await set(ref(db, `calls/${chatId}`), {
        offer: { type: offer.type, sdp: offer.sdp, from: currentUid },
        status: "calling",
        from: currentUid,
      });

      onDisconnect(ref(db, `calls/${chatId}`)).remove();
      setCallStatus("calling");
      setInCall(true); // show local video immediately
    } catch (err) {
      alert("Error starting call: " + err.message);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      const pc = createPC();
      pcRef.current = pc;

      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

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
    if (!chatId) return;
    await set(ref(db, `calls/${chatId}/status`), "rejected");
    setIncomingCall(null);
    setCallStatus("idle");
  };

  const endCall = async () => {
    if (chatId) await set(ref(db, `calls/${chatId}/status`), "ended");
    cleanupCall();
  };

  // ----------------- UI -----------------
  if (!currentUid)
    return <p style={{ textAlign: "center", marginTop: 40 }}>Please login</p>;

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "20px auto",
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        border: "1px solid #ccc",
        borderRadius: 10,
        overflow: "hidden",
        fontFamily: "Arial, sans-serif",
        background: "#f0f0f0",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 15px",
          background: "#075E54",
          color: "#fff",
          fontWeight: "bold",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            to={`/user-profile/${chatUser?.uid}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <img
              src={chatUser?.photoURL || "icons/avatar.jpg"}
              alt="DP"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid #fff",
              }}
            />
            <span>{chatUser?.username || "User"}</span>
          </Link>
        </div>
        <div>
          <button
            onClick={startCall}
            style={{ background: "transparent", border: "none", color: "#fff" }}
          >
            <IoVideocam size={24} />
          </button>
          {inCall && (
            <button
              onClick={endCall}
              style={{
                marginLeft: 10,
                padding: "4px 8px",
                borderRadius: 5,
                background: "#d32f2f",
                color: "#fff",
                border: "none",
              }}
            >
              End
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages.map((msg) => {
          if (msg.deletedFor?.includes(currentUid)) return null;
          const isSentByCurrentUser = msg.sender === currentUid;
          return (
            <div
              key={msg.id}
              onMouseDown={() => startLongPress(msg)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => startLongPress(msg)}
              onTouchEnd={cancelLongPress}
              onTouchCancel={cancelLongPress}
              style={{
                margin: "6px 0",
                alignSelf: isSentByCurrentUser ? "flex-end" : "flex-start",
                maxWidth: "70%",
              }}
            >
              <span
                style={{
                  background: isSentByCurrentUser ? "#dcf8c6" : "#fff",
                  color: "#000",
                  padding: "8px 12px",
                  borderRadius: 20,
                  display: "inline-block",
                  wordBreak: "break-word",
                }}
              >
                {msg.text}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef}></div>
      </main>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        style={{
          display: "flex",
          padding: 10,
          background: "#fff",
          borderTop: "1px solid #ccc",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          style={{
            flex: 1,
            padding: "10px 15px",
            borderRadius: 20,
            border: "1px solid #ccc",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: 10,
            padding: "0 16px",
            borderRadius: 20,
            background: "#075E54",
            color: "#fff",
            border: "none",
          }}
        >
          Send
        </button>
      </form>

      {/* Long-press modal */}
      {selectedMsg && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#0008",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {selectedMsg.sender === currentUid ? (
              <>
                <button
                  onClick={removeForMe}
                  style={{
                    background: "#f44336",
                    color: "#fff",
                    border: "none",
                    padding: 10,
                    borderRadius: 5,
                  }}
                >
                  Remove for Me
                </button>
                <button
                  onClick={deleteForEveryone}
                  style={{
                    background: "#1976d2",
                    color: "#fff",
                    border: "none",
                    padding: 10,
                    borderRadius: 5,
                  }}
                >
                  Delete for Everyone
                </button>
              </>
            ) : (
              <button
                onClick={removeForMe}
                style={{
                  background: "#f44336",
                  color: "#fff",
                  border: "none",
                  padding: 10,
                  borderRadius: 5,
                }}
              >
                Remove for Me
              </button>
            )}
          </div>
        </div>
      )}

      {/* Incoming call overlay */}
      {incomingCall && callStatus === "ringing" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#0008",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <p style={{ fontWeight: "bold" }}>
              {chatUser?.username} is calling
            </p>
            <button
              onClick={acceptCall}
              style={{
                marginRight: 10,
                padding: 6,
                borderRadius: 5,
                background: "#4caf50",
                color: "#fff",
                border: "none",
              }}
            >
              Accept
            </button>
            <button
              onClick={declineCall}
              style={{
                padding: 6,
                borderRadius: 5,
                background: "#f44336",
                color: "#fff",
                border: "none",
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Video overlay */}
      {callStatus !== "idle" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#000",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: 160,
              height: 220,
              position: "absolute",
              top: 20,
              right: 20,
              borderRadius: 10,
              background: "#000",
              border: "2px solid #075E54",
              objectFit: "cover",
            }}
          />
          {inCall && (
            <button
              onClick={endCall}
              style={{
                position: "absolute",
                bottom: 30,
                left: "50%",
                transform: "translateX(-50%)",
                padding: "10px 20px",
                background: "#d32f2f",
                color: "#fff",
                border: "none",
                borderRadius: 20,
                fontWeight: "bold",
                zIndex: 10001,
              }}
            >
              End Call
            </button>
          )}
        </div>
      )}
    </div>
  );
}
