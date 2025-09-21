// src/components/Messages/Messages.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref as dbRef,
  onValue,
  push,
  set,
  remove,
  update,
  serverTimestamp,
  onDisconnect,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Picker from "emoji-picker-react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Messages() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [currentUid, setCurrentUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [chatUser, setChatUser] = useState(null);

  const [input, setInput] = useState("");
  const [selectedMsgId, setSelectedMsgId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [privacyHide, setPrivacyHide] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [partnerStatus, setPartnerStatus] = useState(null);

  const messagesEndRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const chatId =
    currentUid && uid ? [currentUid, uid].sort().join("_") : null;

  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
      else navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let guestId = localStorage.getItem("guestUid");
    if (!guestId) {
      guestId = "guest_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("guestUid", guestId);
    }
    setCurrentUid(auth.currentUser?.uid || guestId);
  }, []);

  // ---------- Presence ----------
  useEffect(() => {
    if (!currentUid) return;
    const statusRef = dbRef(db, `status/${currentUid}`);
    const updateStatus = (state) => {
      set(statusRef, {
        state,
        last_changed: serverTimestamp(),
        hide: privacyHide,
        guest: currentUid.startsWith("guest_"),
      });
    };
    updateStatus("online");
    window.addEventListener("focus", () => updateStatus("online"));
    window.addEventListener("blur", () => updateStatus("offline"));
    onDisconnect(statusRef).set({
      state: "offline",
      last_changed: serverTimestamp(),
      hide: privacyHide,
      guest: currentUid.startsWith("guest_"),
    });
    return () => {
      window.removeEventListener("focus", () => updateStatus("online"));
      window.removeEventListener("blur", () => updateStatus("offline"));
    };
  }, [currentUid, privacyHide]);

  // ---------- Chat List ----------
  useEffect(() => {
    if (!currentUid) return;
    const chatsRef = dbRef(db, `userChats/${currentUid}`);
    return onValue(chatsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const chatArray = Object.entries(data).map(([chatId, chat]) => ({
          chatId,
          ...chat,
        }));
        setChats(chatArray);
      } else setChats([]);
    });
  }, [currentUid]);

  // ---------- Fetch chat partner ----------
  useEffect(() => {
    if (!uid) return;
    const userRef = dbRef(db, `usersData/${uid}`);
    return onValue(userRef, (snap) => {
      if (snap.exists()) setChatUser(snap.val());
    });
  }, [uid]);

  // ---------- Partner presence ----------
  useEffect(() => {
    if (!uid) return;
    const statusRef = dbRef(db, `status/${uid}`);
    return onValue(statusRef, (snap) => setPartnerStatus(snap.val()));
  }, [uid]);

  // ---------- Listen messages ----------
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    const messagesRef = dbRef(db, `chats/${chatId}/messages`);
    return onValue(messagesRef, (snap) => {
      const data = snap.val();
      const msgs = data
        ? Object.entries(data)
          .map(([id, msg]) => ({
            id,
            ...msg,
            timestamp:
              typeof msg.timestamp === "number"
                ? msg.timestamp
                : msg.timestamp?.toMillis?.() || Date.now(),
          }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        : [];
      setMessages(msgs);
      markMessagesDeliveredOrSeen(msgs);
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    });
  }, [chatId]);

  // ---------- Typing ----------
  useEffect(() => {
    if (!chatId) return;
    const typingRef = dbRef(db, `chats/${chatId}/typing`);
    return onValue(typingRef, (snap) => setTypingUsers(snap.val() || {}));
  }, [chatId]);

  const setTyping = useCallback(
    (typing) => {
      if (!chatId || !currentUid) return;
      set(dbRef(db, `chats/${chatId}/typing/${currentUid}`), typing).catch(
        console.warn
      );
    },
    [chatId, currentUid]
  );

  const handleInputChange = (text) => {
    setInput(text);
    if (!chatId || !currentUid) return;
    setIsTyping(true);
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTyping(false);
    }, 1500);
  };

  // ---------- Send Message ----------
  const sendMessage = async (opts = {}) => {
    if (!currentUid || !chatId) return;
    const text = opts.text ?? input.trim();
    if (!text && !opts.imageURL) return;

    const msgPayload = {
      sender: currentUid,
      text: text || "",
      imageURL: opts.imageURL || null,
      replyTo: opts.replyTo || replyTo?.id || null,
      reactions: {},
      timestamp: serverTimestamp(),
      deletedFor: [],
      status: "sent",
    };

    if (editingMsgId) {
      await update(
        dbRef(db, `chats/${chatId}/messages/${editingMsgId}`),
        { text }
      );
      setEditingMsgId(null);
    } else {
      await push(dbRef(db, `chats/${chatId}/messages`), msgPayload);
    }

    setInput("");
    setReplyTo(null);
    setPreviewImage(null);
    setIsTyping(false);
    setTyping(false);
  };

  // ---------- Cloudinary Upload ----------
  const handleImageUpload = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);

    setUploadProgress(0);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percent);
          },
        }
      );
      sendMessage({ imageURL: res.data.secure_url });
      setPreviewImage(null);
    } catch (err) {
      console.error(err);
    }
    setIsUploading(false);
  };

  // ---------- Long Press ----------
  const startLongPress = (e, msgId) => {
    e.preventDefault?.();
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsgId(msgId);
      setTimeout(() => setSelectedMsgId(null), 3000);
    }, 500);
  };
  const cancelLongPress = () => clearTimeout(longPressTimerRef.current);
  useEffect(() => {
    const handleClickOutside = () => setSelectedMsgId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // ---------- Delete ----------
  const removeForMe = async (msgId) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !currentUid || !chatId) return;
    const deletedForRef = dbRef(db, `chats/${chatId}/messages/${msg.id}/deletedFor`);
    const updated = msg.deletedFor?.includes(currentUid)
      ? msg.deletedFor
      : [...(msg.deletedFor || []), currentUid];
    await set(deletedForRef, updated);
    setSelectedMsgId(null);
  };

  const deleteForEveryone = async (msgId) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !chatId) return;
    if (msg.sender === currentUid) {
      await remove(dbRef(db, `chats/${chatId}/messages/${msg.id}`));
    } else {
      await removeForMe(msgId);
    }
    setSelectedMsgId(null);
  };

  // ---------- Status Update ----------
  const markMessagesDeliveredOrSeen = async (msgs) => {
    if (!chatId || !currentUid) return;
    const updates = {};
    msgs.forEach((m) => {
      if (m.sender === currentUid) return;
      updates[`chats/${chatId}/messages/${m.id}/status`] = "seen";
    });
    if (Object.keys(updates).length) await update(dbRef(db), updates);
  };

  const renderStatus = (msg) => {
    if (msg.sender !== currentUid) return null;
    const s = msg.status || "sent";
    return s === "sent" ? "✓" : s === "delivered" ? "✓✓" : "✓✓ (seen)";
  };

  const formatTime = (ts) =>
    ts
      ? new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      : "";

  const addEmoji = (emoji) => setInput((prev) => prev + emoji.emoji);

  // ---------- Render ----------
  if (!currentUid) return <p className="text-center mt-5">Please login</p>;

  return (
    <div
      className="container border rounded d-flex flex-column p-0"
      style={{ height: "91vh", background: "#e6f0ff" }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center bg-success text-white p-2">
        <Link
          to={`/user-profile/${chatUser?.uid}`}
          className="d-flex align-items-center text-white text-decoration-none"
        >
          <img
            src={chatUser?.photoURL || "icons/avatar.jpg"}
            alt="DP"
            className="rounded-circle me-2"
            style={{ width: 44, height: 44, objectFit: "cover" }}
          />
          <div>
            <div>{chatUser?.username || "User"}</div>
            {!partnerStatus?.hide && (
              <small>
                {Object.keys(typingUsers).filter(
                  (k) => typingUsers[k] && k !== currentUid
                ).length
                  ? "typing..."
                  : partnerStatus?.state === "online"
                    ? "online"
                    : partnerStatus?.last_changed
                      ? "last seen " +
                      new Date(partnerStatus.last_changed).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })
                      : "offline"}
              </small>
            )}
          </div>
        </Link>

        {/* Three-dot menu */}
        <div className="position-relative">
          <button
            className="btn btn-sm btn-transparent text-white"
            onClick={() => setShowMenu((prev) => !prev)}
          >
            <i className="bi bi-three-dots-vertical fs-5"></i>
          </button>
          {showMenu && (
            <div
              className="position-absolute bg-white text-dark shadow rounded"
              style={{ right: 0, top: 40, zIndex: 9 }}
            >
              <button
                className="py-2 px-3 dropdown-item"
                onClick={() => {
                  messages.forEach((m) => removeForMe(m.id));
                  setShowMenu(false);
                }}
              >
                Clear Chat
              </button>
              <button
                className="py-2 px-3 dropdown-item"
                onClick={() => {
                  setPrivacyHide((prev) => !prev);
                  setShowMenu(false);
                }}
              >
                {privacyHide ? "Show Online / Last Seen" : "Hide Online / Last Seen"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow-1 overflow-auto p-2 d-flex flex-column">
        {messages.length === 0 && (
          <div className="text-center text-muted mt-2">No messages yet 👋</div>
        )}
        {messages.map((msg) =>
          msg.deletedFor?.includes(currentUid) ? null : (
            <div
              key={msg.id}
              onMouseDown={(e) => startLongPress(e, msg.id)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={(e) => startLongPress(e, msg.id)}
              onTouchEnd={cancelLongPress}
              onTouchCancel={cancelLongPress}
              className={`d-flex mb-2 ${msg.sender === currentUid ? "justify-content-end" : "justify-content-start"}`}
              style={{ userSelect: "none", position: "relative" }}
            >
              <div
                className={`p-2 rounded ${msg.sender === currentUid ? "bg-success text-white" : "bg-white text-dark"}`}
                style={{ maxWidth: "75%" }}
              >
                {msg.text}
                {msg.imageURL && (
                  <img
                    src={msg.imageURL}
                    alt="sent"
                    className="img-fluid rounded mt-1"
                  />
                )}
                {msg.replyTo &&
                  (() => {
                    const original = messages.find((m) => m.id === msg.replyTo);
                    const userName = original?.sender === currentUid ? "You" : chatUser?.username || "User";
                    return (
                      <div className="border-start ps-2 mt-1">
                        <small className="text-muted">
                          Reply to <strong>{userName}:</strong> {original?.text || "Message deleted"}
                        </small>
                      </div>
                    );
                  })()}
                <div className="d-flex justify-content-between align-items-center mt-1">
                  <small>{formatTime(msg.timestamp)}</small>
                  {msg.sender === currentUid && <small className="ms-1">{renderStatus(msg)}</small>}
                </div>
              </div>

              {selectedMsgId === msg.id && (
                <div
                  className="position-absolute bg-white border shadow rounded p-1 small d-flex flex-column"
                  style={{
                    top: "-10px",
                    right: msg.sender === currentUid ? "120px" : "unset",
                    left: msg.sender !== currentUid ? "50px" : "unset",
                    zIndex: 10,
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  <button className="btn btn-sm btn-danger" onClick={() => removeForMe(msg.id)}>Delete for me</button>
                  {msg.sender === currentUid && (
                    <>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setEditingMsgId(msg.id); setInput(msg.text || ""); setSelectedMsgId(null); }}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteForEveryone(msg.id)}>Delete for everyone</button>
                    </>
                  )}
                  <button className="btn btn-sm btn-success" onClick={() => { setReplyTo(msg); setSelectedMsgId(null); }}>Reply</button>
                </div>
              )}
            </div>
          )
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input */}
      {/* Input */}
      <div className="p-2 position-relative" style={{ background: "#ccf" }}>
        {previewImage && (
          <div
            className="d-inline-block p-2 mb-2 border rounded shadow-sm position-relative"
            style={{ background: "#f0f0f0", maxWidth: "200px" }}
          >
            <img
              src={previewImage}
              alt="preview"
              className="img-fluid rounded"
              style={{ maxHeight: "150px", objectFit: "cover", userSelect: "none" }}
            />
            {isUploading && (
              <div className="progress mt-1">
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${uploadProgress}%` }}
                  aria-valuenow={uploadProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {uploadProgress}%
                </div>
              </div>
            )}
            <button
              className="btn btn-sm btn-danger position-absolute top-0 end-0"
              style={{ transform: "translate(50%, -50%)" }}
              onClick={() => setPreviewImage(null)}
            >
              ✕
            </button>
          </div>
        )}
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-light"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            😀
          </button>
          <input
            type="text"
            className="form-control"
            placeholder="Type a message"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <label className="btn btn-light mb-0">
            📎
            <input
              type="file"
              accept="image/*"
              className="d-none"
              onChange={(e) => handleImageUpload(e.target.files[0])}
            />
          </label>
          <button className="btn btn-primary" onClick={() => sendMessage()}>
            ➤
          </button>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            className="position-absolute"
            style={{ bottom: "100%", left: 0, zIndex: 999 }}
          >
            <Picker onEmojiClick={addEmoji} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Last Seen Formatter ----------
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "offline";

  const lastSeenDate = new Date(timestamp);
  const now = new Date();

  const isToday = lastSeenDate.toDateString() === now.toDateString();
  const isYesterday =
    lastSeenDate.toDateString() ===
    new Date(new Date().setDate(now.getDate() - 1)).toDateString();

  const timeString = lastSeenDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `last seen today at ${timeString}`;
  if (isYesterday) return `last seen yesterday at ${timeString}`;

  const dateString = lastSeenDate.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `last seen ${dateString} at ${timeString}`;
};
