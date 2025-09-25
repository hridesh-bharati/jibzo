// src/assets/Navbar/Navbar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../../assets/utils/firebaseConfig";
import { ref, onValue, get, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const [currentUid, setCurrentUid] = useState(null);

  // Friend requests
  const [friendRequests, setFriendRequests] = useState([]);
  const [isFriendReqOpen, setIsFriendReqOpen] = useState(false);

  // Messages
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatHistory, setChatHistory] = useState([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  // Likes / Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadLikes, setUnreadLikes] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // ✅ Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
      else setCurrentUid(null);
    });
    return () => unsubscribe();
  }, []);

  // 🔹 Friend Requests
  useEffect(() => {
    if (!currentUid) return;
    const reqRef = ref(db, `usersData/${currentUid}/followRequests/received`);
    const unsub = onValue(reqRef, async (snap) => {
      const data = snap.exists() ? Object.entries(snap.val()) : [];
      const detailedData = [];

      for (const [uid] of data) {
        try {
          const userSnap = await get(ref(db, `usersData/${uid}`));
          const userData = userSnap.val();
          detailedData.push({
            uid,
            username: userData?.username || "Someone",
            photoURL: userData?.photoURL || `https://ui-avatars.com/api/?name=${userData?.username || "U"}`
          });
        } catch {
          detailedData.push({ uid, username: "Someone", photoURL: "" });
        }
      }
      setFriendRequests(detailedData);
    });
    return () => unsub();
  }, [currentUid]);

  const acceptRequest = async (uid) => {
    if (!currentUid) return;
    const updates = {};
    updates[`usersData/${currentUid}/followRequests/received/${uid}`] = null;
    updates[`usersData/${uid}/followRequests/sent/${currentUid}`] = null;
    updates[`usersData/${currentUid}/friends/${uid}`] = true;
    updates[`usersData/${uid}/friends/${currentUid}`] = true;

    try {
      await update(ref(db), updates);
      toast.success("Friend request accepted ✅");
    } catch {
      toast.error("Failed to accept request ❌");
    }
  };

  const rejectRequest = async (uid) => {
    if (!currentUid) return;
    const updates = {};
    updates[`usersData/${currentUid}/followRequests/received/${uid}`] = null;
    updates[`usersData/${uid}/followRequests/sent/${currentUid}`] = null;

    try {
      await update(ref(db), updates);
      toast.info("Friend request rejected ❌");
    } catch {
      toast.error("Failed to reject request ❌");
    }
  };

  // 🔹 Messages (Unread notifications & history)
  useEffect(() => {
    if (!currentUid) return;
    const messagesRef = ref(db, `chats`);
    const unsub = onValue(messagesRef, async (snapshot) => {
      const chats = [];
      let count = 0;

      snapshot.forEach((chatSnap) => {
        const chatData = chatSnap.val();
        if (!chatData || !chatData.messages) return;

        const messages = Object.entries(chatData.messages).map(([id, msg]) => ({ id, ...msg }));
        const unreadMsgs = messages.filter(msg => !msg.read && msg.sender !== currentUid);
        if (unreadMsgs.length) count += unreadMsgs.length;

        const chatUsers = chatSnap.key.split("_");
        const otherUserId = chatUsers.find(uid => uid !== currentUid);

        chats.push({
          chatId: chatSnap.key,
          otherUserId,
          messages,
          unreadCount: unreadMsgs.length,
        });
      });

      // Fetch usernames for other users
      await Promise.all(chats.map(async (chat) => {
        try {
          const snap = await get(ref(db, `usersData/${chat.otherUserId}`));
          const data = snap.val();
          chat.username = data?.username || "Someone";
        } catch {
          chat.username = "Someone";
        }
      }));

      setChatHistory(chats);
      setUnreadCount(count);
    });
    return () => unsub();
  }, [currentUid]);

  const toggleInbox = async () => {
    setIsInboxOpen(prev => {
      const next = !prev;
      if (next) {
        chatHistory.forEach(async (chat) => {
          const chatRef = ref(db, `chats/${chat.chatId}/messages`);
          const updates = {};
          chat.messages.forEach(msg => {
            if (!msg.read && msg.sender !== currentUid) updates[`${msg.id}/read`] = true;
          });
          if (Object.keys(updates).length) await update(chatRef, updates);
        });
        setUnreadCount(0);
      }
      return next;
    });
  };

  const openChat = (uid) => { navigate(`/messages/${uid}`); setIsInboxOpen(false); };

  // 🔹 Likes / Notifications
  useEffect(() => {
    if (!currentUid) return;
    const notifRef = ref(db, `notifications/${currentUid}`);
    const unsub = onValue(notifRef, async (snap) => {
      const data = snap.val() || {};
      const notifList = [];
      let unread = 0;

      for (const [id, notif] of Object.entries(data)) {
        try {
          const userSnap = await get(ref(db, `usersData/${notif.likerId}`));
          const liker = userSnap.val();

          notifList.push({
            id,
            likerId: notif.likerId,
            likerName: liker?.username || "Someone",
            postCaption: notif.postCaption || "your post",
            postId: notif.postId || null,
            timestamp: notif.timestamp || Date.now(),
            seen: notif.seen || false
          });

          if (!notif.seen) unread++;
        } catch {
          notifList.push({
            id,
            likerId: notif.likerId,
            likerName: "Someone",
            postCaption: notif.postCaption || "your post",
            postId: notif.postId || null,
            timestamp: notif.timestamp || Date.now(),
            seen: notif.seen || false
          });
          if (!notif.seen) unread++;
        }
      }

      notifList.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(notifList);
      setUnreadLikes(unread);
    });

    return () => unsub();
  }, [currentUid]);

  const toggleNotif = async () => {
    setIsNotifOpen(prev => {
      const next = !prev;
      if (next && unreadLikes > 0) {
        notifications.forEach(n => {
          if (!n.seen) update(ref(db, `notifications/${currentUid}/${n.id}`), { seen: true });
        });
        setUnreadLikes(0);
        setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
      }
      return next;
    });
  };

  const openPost = (postId) => {
    if (!postId) return toast.info("Post not found");
    navigate(`/post/${postId}`);
    setIsNotifOpen(false);
  };

  // Delete chat completely
  const deleteChat = async (chat) => {
    if (!currentUid) return;
    try {
      await update(ref(db, `chats/${chat.chatId}`), null);
      setChatHistory(prev => prev.filter(c => c.chatId !== chat.chatId));
      toast.success("Chat deleted ✅");
    } catch {
      toast.error("Failed to delete chat ❌");
    }
  };

  // Delete notification completely
  const deleteNotif = async (notif) => {
    if (!currentUid) return;
    try {
      await update(ref(db, `notifications/${currentUid}/${notif.id}`), null);
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      toast.success("Notification deleted ✅");
    } catch {
      toast.error("Failed to delete notification ❌");
    }
  };

  // WhatsApp/Instagram style timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const pad = (n) => n.toString().padStart(2, "0");
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (isToday) return time;
    if (isYesterday) return `Yesterday ${time}`;
    return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()} ${time}`;
  };

  return (
    <nav className="navbar shadow-sm p-2 d-flex align-items-center justify-content-between">
      <Link to="/home" className="d-flex align-items-center">
        <img src="icons/logo.png" width={100} alt="logo" />
      </Link>

      <div className="d-flex align-items-center gap-1">

        {/* Friend Requests */}
        <div className="position-relative">
          <button className="icon-btn" onClick={() => setIsFriendReqOpen(prev => !prev)}>
            <i className="bi bi-person-plus-fill fs-4 text-success"></i>
            {friendRequests.length > 0 && <span className="badge">{friendRequests.length > 99 ? "99+" : friendRequests.length}</span>}
          </button>

          {isFriendReqOpen && (
            <div className="dropdown-card">
              <h6>Friend Requests</h6>
              {friendRequests.length === 0 ? <p className="text-muted">No requests</p> :
                friendRequests.map(req => (
                  <div key={req.uid} className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <img src={req.photoURL} className="avatar-sm" alt={req.username} />
                      <span>{req.username}</span>
                    </div>
                    <div className="btn-group-sm">
                      <button className="btn btn-sm btn-primary" onClick={() => acceptRequest(req.uid)}>Accept</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => rejectRequest(req.uid)}>Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="position-relative">
          <button className="icon-btn" onClick={toggleInbox}>
            <i className="bi bi-chat-dots-fill fs-4 text-primary"></i>
            {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>

          {isInboxOpen && (
            <div className="dropdown-card">
              <h6>Messages</h6>
              {chatHistory.length === 0 ? <p className="text-muted">No chats yet</p> :
                chatHistory.map(chat => (
                  <div key={chat.chatId} className="d-flex align-items-center gap-2 mb-2">
                    <img src={`https://ui-avatars.com/api/?name=${chat.username}&background=random`} className="avatar-sm" alt={chat.username} />
                    <div className="flex-grow-1 cursor-pointer" onClick={() => openChat(chat.otherUserId)}>
                      <strong>{chat.username}</strong>
                      {chat.messages.length > 0 && (
                        <div className="text-muted small">
                          {chat.messages[chat.messages.length - 1].text || "Image/Media"} • {chat.unreadCount > 0 ? `${chat.unreadCount} unread` : "read"} • {formatTimestamp(chat.messages[chat.messages.length - 1].timestamp)}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-sm btn-outline-danger p-1" onClick={() => deleteChat(chat)}>🗑</button>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Likes / Notifications */}
        <div className="position-relative">
          <button className="icon-btn" onClick={toggleNotif}>
            <i className="bi bi-heart-fill fs-4 text-danger"></i>
            {unreadLikes > 0 && <span className="badge">{unreadLikes > 99 ? "99+" : unreadLikes}</span>}
          </button>
          {isNotifOpen && (
            <div className="dropdown-card">
              <h6>Likes</h6>
              {notifications.length === 0 ? <p className="text-muted">No likes yet</p> :
                notifications.map(n => (
                  <div key={n.id} className="d-flex align-items-center justify-content-between mb-2 cursor-pointer">
                    <div onClick={() => openPost(n.postId)}>
                      ❤️ <strong>{n.likerName}</strong> liked <span>{n.postCaption}</span>
                    </div>
                    <div className="d-flex gap-1 align-items-center">
                      <small className="text-muted">{formatTimestamp(n.timestamp)}</small>
                      <button className="btn btn-sm btn-outline-danger p-1" onClick={() => deleteNotif(n)}>🗑</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

      </div>
    </nav>
  );
};

export default Navbar;
