import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { db, auth } from "../../firebaseConfig";
import { ref, onValue, push, serverTimestamp, remove, set } from "firebase/database";

export default function Messages() {
  const { uid } = useParams(); // Get the user id from the URL
  const currentUid = auth.currentUser?.uid;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const longPressTimerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const chatId = [currentUid, uid].sort().join("_"); // Chat identifier

  useEffect(() => {
    if (!uid) return;
    const userRef = ref(db, `usersData/${uid}`);
    return onValue(userRef, (snap) => {
      if (snap.exists()) setChatUser(snap.val());
    });
  }, [uid]);

  // Fetch messages for the selected chat
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    return onValue(messagesRef, (snap) => {
      const data = snap.val();
      const msgs = data ? Object.entries(data).map(([id, msg]) => ({ id, ...msg })) : [];
      setMessages(msgs);
      setTimeout(() => scrollToBottom(), 100);
    });
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Send a new message
  const sendMessage = async () => {
    if (!input.trim()) return;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    await push(messagesRef, {
      sender: currentUid,
      text: input.trim(),
      timestamp: serverTimestamp(),
    });
    setInput("");
  };

  // Start long press for message options
  const startLongPress = (msg) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsg(msg);
    }, 700); // Trigger after 700ms
  };

  // Cancel long press
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Remove message for the current user
  const removeForMe = () => {
    if (!selectedMsg) return;
    setMessages((prev) => prev.filter((msg) => msg.id !== selectedMsg.id));
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

  // Close the modal if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".modal-content")) {
        setSelectedMsg(null);
      }
    };

    if (selectedMsg) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [selectedMsg]);

  if (!currentUid) return <p style={{ textAlign: "center", marginTop: 40, color: "#666", fontSize: 16 }}>Please log in to chat.</p>;

  return (
    <div style={{ maxWidth: 600, height: "80vh", margin: "20px auto", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: "#333" }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.1)", backgroundColor: "#f9fafb" }}>

        {/* Header */}
        <header style={{ padding: "12px 20px", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 15, backgroundColor: "#ffffff", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          {chatUser ? (
            <>
              <img
                src={chatUser.photoURL || "https://via.placeholder.com/40"}
                alt={chatUser.username || "User"}
                loading="lazy"
                style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #1976d2" }}
              />
              <span style={{ fontSize: 18, fontWeight: 600 }}>{chatUser.username || "Unknown User"}</span>
            </>
          ) : (
            <span style={{ fontSize: 16, color: "#999" }}>Loading...</span>
          )}
        </header>

        {/* Messages */}
        <main
          style={{ flexGrow: 1, overflowY: "auto", padding: "20px", backgroundColor: "#fff", display: "flex", flexDirection: "column", gap: 12, scrollbarWidth: "thin" }}
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: "#999", marginTop: 60, fontStyle: "italic" }}>No messages yet. Say hi!</p>
          )}

          {messages.map((msg) => {
            const time = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            const isSentByCurrentUser = msg.sender === currentUid;

            return (
              <div
                key={msg.id}
                onMouseDown={() => startLongPress(msg)}
                onTouchStart={() => startLongPress(msg)}
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
          style={{ display: "flex", gap: 12, padding: "15px 20px", borderTop: "1px solid #e0e0e0", backgroundColor: "#fafafa", borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}
          aria-label="Send message form"
        >
          <input
            type="text"
            aria-label="Type your message"
            value={input}
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

      {/* Modal for long press options */}
      {selectedMsg && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999
        }}>
          <div className="modal-content" style={{
            backgroundColor: "#fff", padding: "20px", borderRadius: 8, boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", gap: 15
          }}>
            {selectedMsg.sender === currentUid ? (
              <>
                <button
                  onClick={removeForMe}
                  style={{
                    backgroundColor: "#f44336", color: "#fff", border: "none", padding: "10px", borderRadius: 8,
                    fontSize: 16
                  }}
                >
                  Remove for Me
                </button>
                <button
                  onClick={deleteForEveryone}
                  style={{
                    backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px", borderRadius: 8,
                    fontSize: 16
                  }}
                >
                  Delete for Everyone
                </button>
              </>
            ) : (
              <button
                onClick={removeForMe}
                style={{
                  backgroundColor: "#f44336", color: "#fff", border: "none", padding: "10px", borderRadius: 8,
                  fontSize: 16
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
