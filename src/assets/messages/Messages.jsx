import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { FaPhone, FaVideo } from "react-icons/fa";
import Call from "../../assets/Call/Call";

export default function Messages() {
  const { uid } = useParams();
  const [currentUid, setCurrentUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [showCall, setShowCall] = useState(null); // audio | video
  const messagesEndRef = useRef(null);

  const chatId = currentUid && uid ? [currentUid, uid].sort().join("_") : null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const userRef = ref(db, `usersData/${uid}`);
    return onValue(userRef, (snap) => {
      if (snap.exists()) setChatUser(snap.val());
    });
  }, [uid]);

  useEffect(() => {
    if (!chatId) return;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    return onValue(messagesRef, (snap) => {
      const data = snap.val();
      const msgs = data
        ? Object.entries(data).map(([id, msg]) => ({
            id,
            ...msg,
            timestamp: msg.timestamp || Date.now(),
          }))
        : [];
      setMessages(msgs);
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    });
  }, [chatId]);

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

  if (!currentUid)
    return <p style={{ textAlign: "center", marginTop: 40 }}>Please login</p>;

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "20px auto",
        height: "90vh",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #ccc",
        borderRadius: 10,
        overflow: "hidden",
        fontFamily: "Arial",
        background: "#f0f0f0",
        position: "relative",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 10,
          background: "#075E54",
          color: "#fff",
        }}
      >
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
            }}
          />
          <span>{chatUser?.username || "User"}</span>
        </Link>
        <div style={{ display: "flex", gap: 15, fontSize: 18 }}>
          <FaPhone
            onClick={() => setShowCall("audio")}
            style={{ cursor: "pointer" }}
          />
          <FaVideo
            onClick={() => setShowCall("video")}
            style={{ cursor: "pointer" }}
          />
        </div>
      </header>

      {/* Messages */}
      <main style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {messages.map((msg) => {
          if (msg.deletedFor?.includes(currentUid)) return null;
          const isMe = msg.sender === currentUid;
          return (
            <div
              key={msg.id}
              style={{
                margin: "6px 0",
                alignSelf: isMe ? "flex-end" : "flex-start",
                maxWidth: "70%",
              }}
            >
              <span
                style={{
                  background: isMe ? "#dcf8c6" : "#fff",
                  padding: "8px 12px",
                  borderRadius: 20,
                  display: "inline-block",
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
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Call
            chatUid={uid}
            callType={showCall}
            onClose={() => setShowCall(null)}
          />
        </div>
      )}
    </div>
  );
}
