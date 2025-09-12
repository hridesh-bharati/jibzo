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
  onChildAdded,
  onDisconnect,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { FaVideo } from "react-icons/fa";
import { MdVideoCall } from "react-icons/md";
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

  // Video call states & refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer }
  const [callStatus, setCallStatus] = useState(null); // "idle"|"calling"|"ringing"|"in-call"
  const processedCandidatesRef = useRef(new Set()); // to avoid double-adding
  const chatId = currentUid && uid ? [currentUid, uid].sort().join("_") : null;

  // Track current logged-in user
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

  // Fetch chat messages
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
    return () => unsub(); // cleanup
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

  // Long press / context menu
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

  // Remove message locally (for current user)
  const removeForMe = async () => {
    if (!selectedMsg || !currentUid) return;
    const msgRef = ref(db, `chats/${chatId}/messages/${selectedMsg.id}/deletedFor`);
    const updatedDeletedFor = selectedMsg.deletedFor
      ? [...selectedMsg.deletedFor, currentUid]
      : [currentUid];
    await set(msgRef, updatedDeletedFor);
    setSelectedMsg(null);
  };

  // Delete message for everyone
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

  //
  // -------------------- Video call logic (WebRTC + Firebase signaling) --------------------
  //

  // Helper: cleanup local streams and peer connection
  const cleanupCall = async () => {
    try {
      setInCall(false);
      setCallStatus("idle");
      setIncomingCall(null);

      // stop tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      // close RTCPeerConnection
      if (pcRef.current) {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        try { pcRef.current.close(); } catch (e) { }
        pcRef.current = null;
      }

      processedCandidatesRef.current.clear();

      // Remove call object from DB (so UI resets for both sides)
      if (chatId) {
        await remove(ref(db, `calls/${chatId}`)).catch(() => { });
      }
    } catch (err) {
      console.error("cleanupCall error:", err);
    }
  };

  // End call (user clicked End)
  const endCall = async () => {
    await set(ref(db, `calls/${chatId}/status`), "ended").catch(() => { });
    await cleanupCall();
  };

  // Create RTCPeerConnection and setup handlers
  const createPeerConnection = (onRemoteTrack) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        // you can add TURN servers here if you have them
      ],
    });

    pc.ontrack = (event) => {
      if (onRemoteTrack) onRemoteTrack(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && chatId && currentUid) {
        // push candidate under calls/{chatId}/candidates/{currentUid}/<randomId>
        const cRef = ref(db, `calls/${chatId}/candidates/${currentUid}`);
        push(cRef, event.candidate.toJSON()).catch((e) => console.error("push candidate err", e));
      }
    };

    return pc;
  };

  // Listen for signaling changes: offer / answer / status / candidates
  useEffect(() => {
    if (!chatId) return;

    const callRef = ref(db, `calls/${chatId}`);

    // listener for the whole call object
    const unsubCall = onValue(callRef, async (snap) => {
      const data = snap.val();
      if (!data) {
        // no active call
        return;
      }

      const { offer, answer, status, from } = data;

      // Handle incoming offer (someone started call)
      if (offer && offer.from && offer.from !== currentUid) {
        // if not already in call or ringing, set incoming
        if (!inCall && callStatus !== "ringing") {
          setIncomingCall({ from: offer.from, offer });
          setCallStatus("ringing");
        }
      }

      // Handle answer when we are the caller
      if (answer && answer.from && answer.from !== currentUid && pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setCallStatus("in-call");
          setInCall(true);
        } catch (err) {
          console.error("setRemoteDescription(answer) error:", err);
        }
      }

      // Handle status updates: accepted / rejected / ended
      if (status) {
        if (status === "accepted") {
          // if we started the call, answer will arrive separately. just set UI to in-call
          setCallStatus("in-call");
          setInCall(true);
        }
        if (status === "rejected") {
          // other side declined
          alert("Call declined");
          cleanupCall();
        }
        if (status === "ended") {
          // remote ended
          cleanupCall();
        }
      }
    });

    // Listener for candidates (all candidates under calls/{chatId}/candidates)
    const candidatesRef = ref(db, `calls/${chatId}/candidates`);
    const unsubCandidates = onValue(candidatesRef, async (snap) => {
      const val = snap.val();
      if (!val || !pcRef.current) return;

      // val structure: { uid1: { pushId1: candidateObj, ... }, uid2: { ... } }
      Object.entries(val).forEach(([uidKey, candidatesObj]) => {
        if (uidKey === currentUid) return; // skip our own candidates
        if (!candidatesObj) return;
        Object.entries(candidatesObj).forEach(([candId, candidateData]) => {
          // unique key: uidKey + '|' + candId
          const uniqueKey = `${uidKey}|${candId}`;
          if (processedCandidatesRef.current.has(uniqueKey)) return;
          processedCandidatesRef.current.add(uniqueKey);

          try {
            const iceCandidate = new RTCIceCandidate(candidateData);
            pcRef.current.addIceCandidate(iceCandidate).catch((e) => {
              // sometimes candidate add fails if pc not ready; still catch
              console.warn("addIceCandidate warn:", e);
            });
          } catch (err) {
            console.error("Error creating/adding ICE candidate", err);
          }
        });
      });
    });

    // cleanup listeners on unmount / chatId change
    return () => {
      try { unsubCall(); } catch (e) { }
      try { unsubCandidates(); } catch (e) { }
    };
  }, [chatId, currentUid, inCall, callStatus]);

  // Caller: start a call (create offer)
  const startCall = async () => {
    if (!currentUid || !chatId) return;
    try {
      setCallStatus("calling");

      // get local stream
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      // create pc and add tracks
      const pc = createPeerConnection((remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });
      pcRef.current = pc;

      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // create offer
      const offerDesc = await pc.createOffer();
      await pc.setLocalDescription(offerDesc);

      // write offer to DB under calls/{chatId}/offer and mark status calling/from
      await set(ref(db, `calls/${chatId}`), {
        offer: { sdp: offerDesc.sdp, type: offerDesc.type, from: currentUid },
        status: "calling",
        from: currentUid,
        createdAt: Date.now(),
      });

      // set onDisconnect to remove call when caller disconnects unexpectedly
      try {
        const callRef = ref(db, `calls/${chatId}`);
        onDisconnect(callRef).remove();
      } catch (err) {
        // onDisconnect may fail if rules/connection not available; not critical
        console.warn("onDisconnect error:", err);
      }

      // now wait: answer will be written by callee and onValue listener will setRemoteDescription
    } catch (err) {
      console.error("startCall error:", err);
      alert("Unable to start call: " + (err.message || err));
      await cleanupCall();
    }
  };

  // Callee: accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !chatId || !currentUid) return;
    try {
      // get local media
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      // create pc and add tracks
      const pc = createPeerConnection((remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });
      pcRef.current = pc;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // set remote description from offer
      const remoteOffer = incomingCall.offer;
      await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));

      // create answer
      const answerDesc = await pc.createAnswer();
      await pc.setLocalDescription(answerDesc);

      // write answer and status accepted
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
      console.error("acceptCall error:", err);
      alert("Unable to accept call: " + (err.message || err));
      await cleanupCall();
    }
  };

  // Callee: decline incoming call
  const declineCall = async () => {
    if (!chatId) return;
    try {
      await set(ref(db, `calls/${chatId}/status`), "rejected");
    } catch (err) {
      console.error("declineCall error:", err);
    } finally {
      setIncomingCall(null);
      setCallStatus("idle");
    }
  };

  // If component unmounts, clean up active call
  useEffect(() => {
    return () => {
      cleanupCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //
  // -------------------- END Video call logic --------------------
  //

  if (!currentUid)
    return (
      <p style={{ textAlign: "center", marginTop: 40, color: "#666", fontSize: 16 }}>
        Please log in to chat.
      </p>
    );

  return (
    <div
      style={{
        maxWidth: 600,
        height: "80vh",
        margin: "20px auto",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: "#333",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          borderRadius: 8,
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          backgroundColor: "#f9fafb",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            gap: 15,
            backgroundColor: "#fff",
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {chatUser ? (
              <>
                <img
                  src={chatUser.photoURL || "https://via.placeholder.com/40"}
                  alt={chatUser.username || "User"}
                  loading="lazy"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #1976d2",
                  }}
                />
                <span style={{ fontSize: 18, fontWeight: 600 }}>
                  {chatUser.username || "Unknown User"}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 16, color: "#999" }}>Loading...</span>
            )}
          </div>

          {/* Call buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={startCall}
              title="Start video call"
              style={{
                backgroundColor: "#1976d2",
                color: "#fff",
                border: "none",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <IoVideocam size={25} />

            </button>

            {/* If an active call exists and we are in call, show End button */}
            {inCall && (
              <button
                onClick={endCall}
                title="End call"
                style={{
                  backgroundColor: "#f44336",
                  color: "#fff",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ✖️ End
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <main
          style={{
            flexGrow: 1,
            overflowY: "auto",
            padding: "20px",
            backgroundColor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            scrollbarWidth: "thin",
          }}
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: "#999", marginTop: 60, fontStyle: "italic" }}>
              No messages yet. Say hi!
            </p>
          )}

          {messages.map((msg) => {
            const isDeleted = msg.deletedFor?.includes(currentUid);
            if (isDeleted) return null;

            const time = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            const isSentByCurrentUser = msg.sender === currentUid;

            return (
              <div
                key={msg.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  startLongPress(msg);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startLongPress(msg);
                }}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                style={{
                  alignSelf: isSentByCurrentUser ? "flex-end" : "flex-start",
                  maxWidth: "70%",
                  backgroundColor: isSentByCurrentUser ? "#1976d2" : "#e3e6eb",
                  color: isSentByCurrentUser ? "#fff" : "#222",
                  borderRadius: 14,
                  padding: "10px 15px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                  position: "relative",
                  wordBreak: "break-word",
                  userSelect: "none",
                  touchAction: "manipulation",
                  fontSize: 15,
                  lineHeight: 1.3,
                }}
              >
                {msg.text}
                <time
                  style={{
                    fontSize: 11,
                    color: isSentByCurrentUser ? "rgba(255,255,255,0.7)" : "#666",
                    position: "absolute",
                    bottom: 0,
                    right: 10,
                    userSelect: "none",
                  }}
                >
                  {time}
                </time>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </main>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          style={{
            display: "flex",
            gap: 12,
            padding: "15px 20px",
            borderTop: "1px solid #e0e0e0",
            backgroundColor: "#fafafa",
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
          aria-label="Send message form"
        >
          <input
            type="text"
            aria-label="Type your message"
            value={input}
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            style={{ flexGrow: 1, padding: "10px 15px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14 }}
          />
          <button
            type="submit"
            aria-label="Send message"
            style={{ backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 16 }}
          >
            Send
          </button>
        </form>
      </div>

      {/* Modal: message long-press menu */}
      {selectedMsg && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: 8,
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 15,
            }}
          >
            {selectedMsg.sender === currentUid ? (
              <>
                <button
                  onClick={removeForMe}
                  style={{
                    backgroundColor: "#f44336",
                    color: "#fff",
                    border: "none",
                    padding: "10px",
                    borderRadius: 8,
                    fontSize: 16,
                  }}
                >
                  Remove for Me
                </button>
                <button
                  onClick={deleteForEveryone}
                  style={{
                    backgroundColor: "#1976d2",
                    color: "#fff",
                    border: "none",
                    padding: "10px",
                    borderRadius: 8,
                    fontSize: 16,
                  }}
                >
                  Delete for Everyone
                </button>
              </>
            ) : (
              <button
                onClick={removeForMe}
                style={{
                  backgroundColor: "#f44336",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  borderRadius: 8,
                  fontSize: 16,
                }}
              >
                Remove for Me
              </button>
            )}
          </div>
        </div>
      )}

      {/* Incoming call modal */}
      {callStatus === "ringing" && incomingCall && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 1200,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 340,
              padding: 20,
              borderRadius: 10,
              backgroundColor: "#fff",
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: "8px 0" }}>Incoming Video Call</h3>
            <p style={{ color: "#666" }}>{chatUser?.username || "Unknown"} is calling</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
              <button
                onClick={acceptCall}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#1976d2",
                  color: "#fff",
                }}
              >
                Accept
              </button>
              <button
                onClick={declineCall}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#f44336",
                  color: "#fff",
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

          {/* In-call UI (video) */}
      {callStatus === "in-call" && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 1300,
            width: 360,
            background: "#000",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Remote video (big) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "240px",
              backgroundColor: "#000",
              borderRadius: 8,
              objectFit: "cover",
            }}
          />

          {/* Local video (small preview, muted) */}
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: 100,
              height: 70,
              position: "absolute",
              right: 25,
              bottom: 90,
              borderRadius: 8,
              objectFit: "cover",
              border: "2px solid #fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            }}
          />

          {/* Controls */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={endCall}
              style={{
                background: "#f44336",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              End Call
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
