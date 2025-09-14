// src/components/Messages/Messages.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref as dbRef,
  onValue,
  push,
  serverTimestamp,
  remove,
  set,
  update,
  onDisconnect,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import "bootstrap/dist/css/bootstrap.min.css";
import Picker from "emoji-picker-react";
import axios from "axios";

export default function Messages() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [currentUid, setCurrentUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [chatUser, setChatUser] = useState(null);

  const [input, setInput] = useState("");
  const [selectedMsgId, setSelectedMsgId] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [privacyHide, setPrivacyHide] = useState(false);

  const [partnerStatus, setPartnerStatus] = useState(null);

  const longPressTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const [previewImage, setPreviewImage] = useState(null);

  const chatId = currentUid && uid ? [currentUid, uid].sort().join("_") : null;



  const [uploadProgress, setUploadProgress] = useState(0);

  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
    });
    return () => unsubscribe();
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
      });
    };
    updateStatus("online");

    window.addEventListener("focus", () => updateStatus("online"));
    window.addEventListener("blur", () => updateStatus("offline"));

    onDisconnect(statusRef).set({
      state: "offline",
      last_changed: serverTimestamp(),
      hide: privacyHide,
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

  const deleteChatForMe = async (chatId) => {
    if (!currentUid) return;
    await remove(dbRef(db, `userChats/${currentUid}/${chatId}`));
    setSelectedChatId(null);
  };

  const deleteChatForEveryone = async (chatId) => {
    await remove(dbRef(db, `chats/${chatId}`));
    await remove(dbRef(db, `userChats/${currentUid}/${chatId}`));
    setSelectedChatId(null);
    navigate("/messages");
  };

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
        80
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
      await update(dbRef(db, `chats/${chatId}/messages/${editingMsgId}`), {
        text,
      });
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

  // ---------- Cloudinary Image Upload ----------
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
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
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


  // ---------- Long press ----------
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

  // ---------- Status update ----------
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

  const formatTime = (ts) =>
    ts
      ? new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      : "";

  const addEmoji = (emoji) => setInput((prev) => prev + emoji.emoji);

  // ---------------- RENDER ----------------
  if (!currentUid) return <p className="text-center mt-5">Please login</p>;

  // Chat screen
  return (
    <div className="container border rounded d-flex flex-column p-0" style={{ height: "84vh", background: "#e6f0ff" }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center bg-success text-white p-2">
        <Link
          to={`/user-profile/${chatUser?.uid}`}
          className="d-flex align-items-center text-white text-decoration-none"
        >
          <img src={chatUser?.photoURL || "icons/avatar.jpg"} alt="DP" className="rounded-circle me-2" style={{ width: 44, height: 44, objectFit: "cover" }} />
          <div>
            <div>{chatUser?.username || "User"}</div>
            {!partnerStatus?.hide && (
              <small>
                {Object.keys(typingUsers).filter((k) => typingUsers[k] && k !== currentUid).length
                  ? "typing..."
                  : partnerStatus?.state === "online"
                    ? "online"
                    : partnerStatus?.last_changed
                      ? "last seen " + new Date(partnerStatus.last_changed).toLocaleTimeString()
                      : "offline"}
              </small>
            )}
          </div>
        </Link>

        {/* Three-dot menu */}
        <div className="position-relative">
          <button className="btn btn-sm btn-transparent text-white" onClick={() => setShowMenu((prev) => !prev)}>
            <i className="bi bi-three-dots-vertical fs-5"></i>
          </button>
          {showMenu && (
            <div className="position-absolute bg-white text-dark shadow rounded" style={{ right: 0, top: 40, zIndex: 9 }}>
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
        {messages.length === 0 && <div className="text-center text-muted mt-2">No messages yet 👋</div>}
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
              <div className={`p-2 rounded ${msg.sender === currentUid ? "bg-success text-white" : "bg-white text-dark"}`} style={{ maxWidth: "75%" }}>
                {msg.text}
                {msg.imageURL && <img src={msg.imageURL} alt="sent" className="img-fluid rounded mt-1" />}
                {msg.replyTo && (() => {
                  const original = messages.find((m) => m.id === msg.replyTo);
                  const userName = original?.sender === currentUid ? "You" : chatUser?.username || "User";
                  return <div className="border-start ps-2 mt-1"><small className="text-muted">Reply to <strong>{userName}:</strong> {original?.text || "Message deleted"}</small></div>;
                })()}
                <div className="d-flex justify-content-between align-items-center mt-1">
                  <small>{formatTime(msg.timestamp)}</small>
                  {msg.sender === currentUid && <small className="ms-1">{renderStatus(msg)}</small>}
                </div>
              </div>

              {selectedMsgId === msg.id && (
                <div className="position-absolute bg-white border shadow rounded p-1 small d-flex flex-column" style={{ top: "-10px", right: msg.sender === currentUid ? "120px" : "unset", left: msg.sender !== currentUid ? "50px" : "unset", zIndex: 10, display: "flex", gap: "4px" }}>
                  <button className="btn btn-sm btn-danger" onClick={() => removeForMe(msg.id)}>Delete for me</button>
                  {msg.sender === currentUid && <>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setEditingMsgId(msg.id); setInput(msg.text || ""); setSelectedMsgId(null); }}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteForEveryone(msg.id)}>Delete for everyone</button>
                  </>}
                  <button className="btn btn-sm btn-success" onClick={() => { setReplyTo(msg); setSelectedMsgId(null); }}>Reply</button>
                </div>
              )}
            </div>
          )
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input */}
      <div className="p-2" style={{ background: "#ccf" }}>
        {previewImage && (
          <div
            className="d-inline-block p-2 mb-2 border rounded shadow-sm"
            style={{
              background: "#f0f0f0",
              maxWidth: "200px",
              position: "relative",
            }}
          >
            <img
              src={previewImage}
              alt="preview"
              className="img-fluid rounded"
              style={{ maxHeight: "150px", objectFit: "cover" }}
            />
            {isUploading && (
              <div className="progress mt-1" style={{ height: "6px", borderRadius: "3px" }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated"
                  style={{
                    width: `${uploadProgress}%`,
                    backgroundColor: "#4caf50",
                  }}
                />
              </div>
            )}

            {/* Optional: remove image button */}
            <button
              className="btn btn-sm btn-danger position-absolute"
              style={{ top: "4px", right: "4px", padding: "0 6px" }}
              onClick={() => setPreviewImage(null)}
            >
              &times;
            </button>
          </div>
        )}

        {replyTo && (
          <div className="mb-1 p-1 border rounded bg-light d-flex justify-content-between align-items-center">
            <small>Replying to: {replyTo.text}</small>
            <button className="btn btn-sm btn-close" onClick={() => setReplyTo(null)}></button>
          </div>
        )}

        {showEmojiPicker && <Picker onEmojiClick={addEmoji} />}

        <form
          className="d-flex align-items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isUploading && (input.trim() || previewImage)) sendMessage();
          }}
        >
          <label className="btn btn-white bg-white border m-0 p-2 d-flex align-items-center justify-content-center">
            <i className="bi bi-paperclip"></i>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </label>

          <button
            type="button"
            className="btn btn-white p-2 d-flex align-items-center justify-content-center"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            😀
          </button>

          <input
            className="form-control flex-grow-1"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message"
          />

          <button
            className="btn btn-primary p-2"
            type="submit"
            disabled={!input.trim() && !previewImage}
          >
            <i className="bi bi-send-fill"></i>
          </button>
        </form>
      </div>

    </div>
  );
}
