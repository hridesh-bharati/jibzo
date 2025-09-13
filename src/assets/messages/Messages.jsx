import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, push, serverTimestamp, remove, set } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { FaPhone, FaVideo } from "react-icons/fa";
import Call from "../../assets/Call/Call";

export default function Messages() {
  const { uid } = useParams();
  const [currentUid, setCurrentUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showCall, setShowCall] = useState(null); // "audio" | "video"
  const longPressTimerRef = useRef(null);
  const messagesEndRef = useRef(null);

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

  // Long press / context menu
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
    await remove(msgRef).catch((err) => alert("Error deleting message: " + err.message));
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

  if (!currentUid) return <p style={{ textAlign: "center", marginTop: 40 }}>Please login</p>;

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

        {/* Call Buttons */}
        <div style={{ display: "flex", gap: 15, fontSize: 18 }}>
          <FaPhone
            style={{ cursor: "pointer" }}
            onClick={() => setShowCall("audio")}
            title="Audio Call"
          />
          <FaVideo
            style={{ cursor: "pointer" }}
            onClick={() => setShowCall("video")}
            title="Video Call"
          />
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

      {/* Call Modal */}
      {showCall && (
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
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 10,
              width: "90%",
              maxWidth: 500,
            }}
          >
            <Call chatUid={uid} callType={showCall} />
            <button
              onClick={() => setShowCall(null)}
              style={{
                marginTop: 10,
                padding: "8px 16px",
                borderRadius: 6,
                background: "#f44336",
                color: "#fff",
                border: "none",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}
