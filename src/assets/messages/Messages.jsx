// src\assets\messages\Messages.jsx
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
  const inputRef = useRef(null);

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

  // ---------- Auto focus input on mount ----------
  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 500);
    }
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
      }).catch(console.warn);
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
            timestamp: msg.timestamp || Date.now(),
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
      if (typing) {
        set(dbRef(db, `chats/${chatId}/typing/${currentUid}`), true).catch(
          console.warn
        );
      } else {
        remove(dbRef(db, `chats/${chatId}/typing/${currentUid}`)).catch(
          console.warn
        );
      }
    },
    [chatId, currentUid]
  );

  const handleInputChange = (text) => {
    setInput(text);
    if (!chatId || !currentUid) return;

    if (!isTyping && text) {
      setIsTyping(true);
      setTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTyping(false);
    }, 1500);
  };

  // ---------- Send Message (FIXED: Immediate input clear) ----------
  const sendMessage = async (opts = {}) => {
    if (!currentUid || !chatId) return;
    const text = opts.text ?? input.trim();
    if (!text && !opts.imageURL) return;

    // ✅ IMMEDIATELY clear input and states
    setInput("");
    setReplyTo(null);
    setPreviewImage(null);
    setEditingMsgId(null);

    // Clear typing when sending
    setIsTyping(false);
    setTyping(false);

    const msgPayload = {
      sender: currentUid,
      text: text || "",
      imageURL: opts.imageURL || null,
      replyTo: opts.replyTo || replyTo?.id || null,
      reactions: {},
      timestamp: serverTimestamp(),
      deletedFor: [],
      status: "sent",
      read: false,
    };

    try {
      if (editingMsgId) {
        await update(
          dbRef(db, `chats/${chatId}/messages/${editingMsgId}`),
          { text }
        );
      } else {
        const pushed = await push(dbRef(db, `chats/${chatId}/messages`), msgPayload);

        // ✅ FIXED: Floating notification for new messages
        const recipientUid = uid;
        if (recipientUid && !recipientUid.startsWith("guest_")) {
          // Floating notification trigger
          const floatingEvent = new CustomEvent('showFloatingNotification', {
            detail: {
              title: "New Message",
              body: `${chatUser?.username || "Someone"}: ${text || "Sent an image"}`,
              image: chatUser?.photoURL || '/logo.png',
              url: `/messages/${currentUid}`
            }
          });
          window.dispatchEvent(floatingEvent);

          // Existing notification save
          const notifRef = push(dbRef(db, `notifications/${recipientUid}`));
          const notifObj = {
            type: "message",
            fromId: currentUid,
            chatId,
            text: (text || (opts.imageURL ? "Image" : "")).slice(0, 200),
            timestamp: serverTimestamp(),
            seen: false
          };
          await set(notifRef, notifObj);
        }
      }

      // Refocus input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error("sendMessage error:", err);
    }
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
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            setUploadProgress(percent);
          },
        }
      );
      await sendMessage({ imageURL: res.data.secure_url });
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
      updates[`chats/${chatId}/messages/${m.id}/read`] = true;
    });
    if (Object.keys(updates).length) await update(dbRef(db), updates);
  };

  const renderStatus = (msg) => {
    if (msg.sender !== currentUid) return null;
    const s = msg.status || "sent";
    return s === "sent" ? "✓" : s === "delivered" ? "✓✓" : "✓✓ (seen)";
  };

  const formatTime = (ts) => {
    if (!ts) return "";

    let date;
    if (typeof ts === 'number') {
      date = new Date(ts);
    } else if (ts.toDate) {
      // Firebase timestamp
      date = ts.toDate();
    } else if (ts.seconds) {
      // Firebase timestamp with seconds
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(ts);
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const addEmoji = (emoji) => {
    setInput((prev) => prev + emoji.emoji);
    // Focus input after adding emoji
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // ---------- Handle emoji picker visibility (FIXED for mobile) ----------
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev);
    // On mobile, we want to focus input but not show emoji picker that blocks keyboard
    if (window.innerWidth <= 768) {
      // On mobile, don't show emoji picker that blocks the keyboard
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    }
  };

  // ---------- Reply Logic ----------
  const renderReplyPreview = (msg) => {
    if (!msg.replyTo) return null;

    const originalMsg = messages.find(m => m.id === msg.replyTo);
    if (!originalMsg) {
      return (
        <div className="border-start border-3 ps-2 mt-1" style={{ borderColor: '#6c757d !important' }}>
          <small className="text-muted fst-italic">
            Original message deleted
          </small>
        </div>
      );
    }

    const isOriginalDeleted = originalMsg.deletedFor?.includes(currentUid);
    if (isOriginalDeleted) {
      return (
        <div className="border-start border-3 ps-2 mt-1" style={{ borderColor: '#6c757d !important' }}>
          <small className="text-muted fst-italic">
            Original message deleted
          </small>
        </div>
      );
    }

    const userName = originalMsg.sender === currentUid ? "You" : chatUser?.username || "User";

    return (
      <div className="border-start border-3 ps-2 mt-1" style={{ borderColor: '#6c757d !important' }}>
        <small className="text-muted d-block">
          <strong>Reply to {userName}</strong>
        </small>
        <small className="text-muted">
          {originalMsg.text || (originalMsg.imageURL ? "📷 Image" : "Message")}
        </small>
      </div>
    );
  };

  // ---------- Typing Indicator ----------
  const renderTypingIndicator = () => {
    const typingUserIds = Object.keys(typingUsers).filter(
      (userId) => typingUsers[userId] && userId !== currentUid
    );

    if (typingUserIds.length === 0) return null;

    return (
      <div className="d-flex justify-content-start mb-2">
        <div className="p-2 rounded bg-light text-dark">
          <div className="d-flex align-items-center">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <small className="ms-2 text-muted">
              {typingUserIds.length > 1 ? 'Several people are typing...' : `${chatUser?.username || 'Someone'} is typing...`}
            </small>
          </div>
        </div>
      </div>
    );
  };

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
          to={`/user-profile/${uid}`}
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
                      ? formatLastSeen(partnerStatus.last_changed)
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
                {/* Reply Preview */}
                {renderReplyPreview(msg)}

                {/* Message Content */}
                {msg.text && <div>{msg.text}</div>}
                {msg.imageURL && (
                  <img
                    src={msg.imageURL}
                    alt="sent"
                    className="img-fluid rounded mt-1"
                    style={{ maxHeight: "200px" }}
                  />
                )}

                {/* Timestamp and Status */}
                <div className="d-flex justify-content-between align-items-center mt-1">
                  <small className={msg.sender === currentUid ? "text-white-50" : "text-muted"}>
                    {formatTime(msg.timestamp)}
                  </small>
                  {msg.sender === currentUid && (
                    <small className="ms-2">{renderStatus(msg)}</small>
                  )}
                </div>
              </div>

              {/* Message Actions Menu */}
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
                      <button className="btn btn-sm btn-secondary" onClick={() => { setEditingMsgId(msg.id); setInput(msg.text || ""); setSelectedMsgId(null); inputRef.current?.focus(); }}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteForEveryone(msg.id)}>Delete for everyone</button>
                    </>
                  )}
                  <button className="btn btn-sm btn-success" onClick={() => { setReplyTo(msg); setSelectedMsgId(null); inputRef.current?.focus(); }}>Reply</button>
                </div>
              )}
            </div>
          )
        )}

        {/* Typing Indicator */}
        {renderTypingIndicator()}

        <div ref={messagesEndRef}></div>
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="p-2 border-top bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <small className="text-muted">Replying to:</small>
              <div className="small">{replyTo.text || "Image"}</div>
            </div>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setReplyTo(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input Area - FIXED for mobile keyboard */}
      <div className="p-2 mb-5 pb-3" style={{ background: "#ccf" }}>
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
          {/* Emoji Button - Fixed for mobile */}
          <button
            className="btn btn-light"
            onClick={toggleEmojiPicker}
            type="button"
          >
            😀
          </button>

          {/* Input Field - FIXED: Proper mobile keyboard */}
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder={editingMsgId ? "Editing message..." : replyTo ? "Type a reply..." : "Type a message..."}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            // Mobile optimizations
            inputMode="text"
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
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

          <button
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={!input.trim() && !previewImage}
          >
            {editingMsgId ? "Update" : "➤"}
          </button>
        </div>

        {/* Emoji Picker - FIXED: Only show on desktop, not on mobile */}
        {showEmojiPicker && window.innerWidth > 768 && (
          <div
            className="position-absolute"
            style={{ bottom: "100%", left: 0, zIndex: 999 }}
          >
            <Picker onEmojiClick={addEmoji} />
          </div>
        )}
      </div>

      {/* CSS for typing dots */}
      <style>
        {`
          .typing-dots {
            display: inline-flex;
            gap: 2px;
          }
          .typing-dots span {
            height: 6px;
            width: 6px;
            border-radius: 50%;
            background-color: #6c757d;
            animation: typing 1.4s infinite ease-in-out;
          }
          .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
          .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
          @keyframes typing {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
          
          /* Mobile optimizations */
          @media (max-width: 768px) {
            .container {
              height: 100vh !important;
            }
            input.form-control {
              font-size: 16px; /* Prevents zoom on iOS */
            }
          }
        `}
      </style>
    </div>
  );
}

// ---------- Last Seen Formatter ----------
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "offline";

  let lastSeenDate;
  if (typeof timestamp === 'number') {
    lastSeenDate = new Date(timestamp);
  } else if (timestamp.toDate) {
    lastSeenDate = timestamp.toDate();
  } else if (timestamp.seconds) {
    lastSeenDate = new Date(timestamp.seconds * 1000);
  } else {
    lastSeenDate = new Date(timestamp);
  }

  const now = new Date();
  const diffMs = now - lastSeenDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "last seen just now";
  if (diffMins < 60) return `last seen ${diffMins} min ago`;
  if (diffHours < 24) return `last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `last seen ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return `last seen ${lastSeenDate.toLocaleDateString()}`;
};