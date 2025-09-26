// src/assets/Navbar/Navbar.jsx
import React, { useEffect, useState, useCallback ,useRef} from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../../assets/utils/firebaseConfig";
import { ref, onValue, get, update, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import { initOneSignal, sendPushNotification, showLocalNotification } from "../utils/NotificationService";

import "./Navbar.css";

const useDropdownState = () => {
  const [states, setStates] = useState({
    friendReq: false,
    inbox: false,
    notifications: false
  });

  const toggleDropdown = useCallback((dropdown) => {
    setStates(prev => ({
      friendReq: false,
      inbox: false,
      notifications: false,
      [dropdown]: !prev[dropdown]
    }));
  }, []);

  const closeAll = useCallback(() => {
    setStates({ friendReq: false, inbox: false, notifications: false });
  }, []);

  return { ...states, toggleDropdown, closeAll };
};

// Custom hook for user authentication
const useAuth = () => {
  const [currentUid, setCurrentUid] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  return currentUid;
};

// Utility functions
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${time}`;
};

const getChatId = (a, b) => a && b ? [a, b].sort().join("_") : null;

const Navbar = () => {
  const navigate = useNavigate();
  const currentUid = useAuth();
  const { friendReq: isFriendReqOpen, inbox: isInboxOpen, notifications: isNotifOpen, toggleDropdown, closeAll } = useDropdownState();

  // Friend requests state
  const [friendRequests, setFriendRequests] = useState([]);

  // Messages state
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatHistory, setChatHistory] = useState([]);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadLikes, setUnreadLikes] = useState(0);
  const notifiedRequests = useRef(new Set());

  useEffect(() => {
    if (!currentUid) return;

    const reqRef = ref(db, `usersData/${currentUid}/followRequests/received`);
    const unsub = onValue(reqRef, async (snap) => {
      if (!snap.exists()) return setFriendRequests([]);

      const requests = Object.entries(snap.val());
      const detailedRequests = await Promise.all(
        requests.map(async ([uid]) => {
          try {
            const userSnap = await get(ref(db, `usersData/${uid}`));
            const userData = userSnap.val();

            if (!notifiedRequests.current.has(uid)) {
              await sendPushNotification(
                "New Friend Request",
                `${userData?.username || "Someone"} sent you a friend request`,
                { type: "friend_request" },
                currentUid
              );
              notifiedRequests.current.add(uid);
            }

            return {
              uid,
              username: userData?.username || "Someone",
              photoURL: userData?.photoURL || `https://ui-avatars.com/api/?name=${userData?.username || "U"}`,
            };
          } catch {
            return { uid, username: "Someone", photoURL: "" };
          }
        })
      );

      setFriendRequests(detailedRequests);
    });

    return () => unsub();
  }, [currentUid]);

  const handleFriendRequest = async (uid, action) => {
    if (!currentUid) return;

    const updates = {
      [`usersData/${currentUid}/followRequests/received/${uid}`]: null,
      [`usersData/${uid}/followRequests/sent/${currentUid}`]: null
    };

    if (action === 'accept') {
      updates[`usersData/${currentUid}/friends/${uid}`] = true;
      updates[`usersData/${uid}/friends/${currentUid}`] = true;
    }

    try {
      await update(ref(db), updates);
      toast.success(action === 'accept' ? "Friend request accepted ✅" : "Friend request rejected ❌");
    } catch {
      toast.error(`Failed to ${action} request ❌`);
    }
  };

  // Messages
  useEffect(() => {
    if (!currentUid) return;

    const messagesRef = ref(db, `chats`);
    const unsub = onValue(messagesRef, async (snapshot) => {
      let totalUnread = 0;
      const chats = [];

      snapshot.forEach((chatSnap) => {
        const chatData = chatSnap.val();
        if (!chatData?.messages) return;

        const messages = Object.entries(chatData.messages).map(([id, msg]) => ({ id, ...msg }));
        const unreadMsgs = messages.filter(msg => !msg.read && msg.sender !== currentUid);
        totalUnread += unreadMsgs.length;

        const otherUserId = chatSnap.key.split("_").find(uid => uid !== currentUid);
        chats.push({ chatId: chatSnap.key, otherUserId, messages, unreadCount: unreadMsgs.length });
      });

      // Fetch usernames
      await Promise.all(chats.map(async (chat) => {
        try {
          const snap = await get(ref(db, `usersData/${chat.otherUserId}`));
          chat.username = snap.val()?.username || "Someone";
        } catch {
          chat.username = "Someone";
        }
      }));

      setChatHistory(chats);
      setUnreadCount(totalUnread);
    });

    return () => unsub();
  }, [currentUid]);

  const clearMessageNotifications = async (otherUid) => {
    if (!currentUid || !otherUid) return;

    try {
      const notifRef = ref(db, `notifications/${currentUid}`);
      const snap = await get(notifRef);
      if (!snap.exists()) return;

      const updates = {};
      const chatId = getChatId(currentUid, otherUid);

      Object.entries(snap.val()).forEach(([id, n]) => {
        if (n?.type === "message" && n?.fromId === otherUid && n?.chatId === chatId) {
          updates[id] = null;
        }
      });

      if (Object.keys(updates).length) {
        await update(notifRef, updates);
      }
    } catch (err) {
      console.warn("Clear message notifications failed:", err);
    }
  };

  const handleInboxToggle = async () => {
    toggleDropdown('inbox');

    if (!isInboxOpen && unreadCount > 0) {
      // Mark all messages as read
      await Promise.all(chatHistory.map(async (chat) => {
        const updates = {};
        chat.messages.forEach(msg => {
          if (!msg.read && msg.sender !== currentUid) {
            updates[`${msg.id}/read`] = true;
          }
        });

        if (Object.keys(updates).length) {
          await update(ref(db, `chats/${chat.chatId}/messages`), updates);
        }
      }));

      setUnreadCount(0);
    }
  };

  const openChat = async (uid) => {
    await clearMessageNotifications(uid);
    navigate(`/messages/${uid}`);
    closeAll();
  };

  // Notifications
  useEffect(() => {
    if (!currentUid) return;

    const notifRef = ref(db, `notifications/${currentUid}`);
    const unsub = onValue(notifRef, async (snap) => {
      const data = snap.val() || {};
      let unread = 0;
      const notifList = [];

      for (const [id, notif] of Object.entries(data)) {
        try {
          const actorId = notif.likerId || notif.fromId;
          let actorName = "Someone";

          if (actorId) {
            const userSnap = await get(ref(db, `usersData/${actorId}`));
            actorName = userSnap.val()?.username || "Someone";
          }

          const notification = {
            id,
            type: notif.type || "like",
            likerId: actorId,
            likerName: actorName,
            postCaption: notif.postCaption || "your post",
            postId: notif.postId || null,
            text: notif.text || null,
            chatId: notif.chatId || null,
            timestamp: notif.timestamp || Date.now(),
            seen: notif.seen || false
          };

          notifList.push(notification);
          if (!notification.seen) unread++;
        } catch {
          // Fallback for error case
          notifList.push({
            id,
            type: notif.type || "like",
            likerId: notif.likerId || notif.fromId || null,
            likerName: "Someone",
            postCaption: notif.postCaption || "your post",
            postId: notif.postId || null,
            text: notif.text || null,
            chatId: notif.chatId || null,
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
  // Init OneSignal after login
  useEffect(() => {
    if (!currentUid) return;
    initOneSignal(currentUid);
  }, [currentUid]);

  const handleNotificationToggle = async () => {
    toggleDropdown('notifications');

    if (!isNotifOpen && unreadLikes > 0) {
      // Mark all notifications as seen
      await Promise.all(notifications.map(async (n) => {
        if (!n.seen) {
          await update(ref(db, `notifications/${currentUid}/${n.id}`), { seen: true });
        }
      }));

      setUnreadLikes(0);
      setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
    }
  };

  const openPost = (postId) => {
    if (!postId) {
      toast.info("Post not found");
      return;
    }
    navigate(`/post/${postId}`);
    closeAll();
  };

  const deleteNotification = async (notif) => {
    if (!currentUid) return;

    try {
      await remove(ref(db, `notifications/${currentUid}/${notif.id}`));
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch {
      toast.error("Failed to delete notification ❌");
    }
  };

  // Dropdown components for better organization
  const FriendRequestsDropdown = () => (
    <div className="dropdown-card">
      <h6>Friend Requests</h6>
      {friendRequests.length === 0 ? (
        <p className="text-muted">No requests</p>
      ) : (
        friendRequests.map((req) => (
          <div key={req.uid} className="d-flex align-items-center justify-content-between mb-2">
            <div className="d-flex align-items-center gap-2">
              <img src={req.photoURL} className="avatar-sm" alt={req.username} />
              <span>{req.username}</span>
            </div>
            <div className="btn-group-sm">
              <button className="btn btn-sm btn-primary" onClick={() => handleFriendRequest(req.uid, 'accept')}>
                Accept
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => handleFriendRequest(req.uid, 'reject')}>
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const NotificationsDropdown = () => (
    <div className="dropdown-card">
      <h6>Likes & Notifications</h6>
      {notifications.length === 0 ? (
        <p className="text-muted">No notifications yet</p>
      ) : (
        notifications.map((n) => (
          <div key={n.id} className="d-flex align-items-center justify-content-between mb-2 cursor-pointer">
            <div onClick={() => n.type === "message" ? openChat(n.likerId) : openPost(n.postId)}>
              {n.type === "message" ? "💬" : "❤️"} <strong>{n.likerName}</strong>{" "}
              {n.type === "message" ? `: ${n.text || "Message"}` : `liked ${n.postCaption}`}
            </div>
            <div className="d-flex gap-1 align-items-center">
              <small className="text-muted">{formatTimestamp(n.timestamp)}</small>
              <button className="btn btn-sm btn-outline-danger p-1 me-1" onClick={() => deleteNotification(n)}>
                🗑
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // Icon Button component
  const IconButton = ({ icon, badgeCount, onClick, badgeClass = "badge" }) => (
    <button className="icon-btn" onClick={onClick}>
      <i className={icon}></i>
      {badgeCount > 0 && (
        <span className={badgeClass}>
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </button>
  );

  return (
    <nav className="navbar shadow-sm p-1 d-flex align-items-center border justify-content-between">
      <Link to="/home" className="d-flex align-items-center">
        <img src="icons/logo.png" width={100} alt="logo" />
      </Link>

      <div className="d-flex align-items-center gap-3">
        {/* Friend Requests */}
        <div className="position-relative">
          <IconButton
            icon="bi bi-people-fill fs-2 text-danger"
            badgeCount={friendRequests.length}
            onClick={() => toggleDropdown('friendReq')}
            badgeClass="badge m-2"
          />
          {isFriendReqOpen && <FriendRequestsDropdown />}
        </div>

        {/* Notifications */}
        <div className="position-relative">
          <IconButton
            icon="bi bi-bell-fill fs-3 me-3 text-primary"
            badgeCount={unreadLikes}
            onClick={handleNotificationToggle}
            badgeClass="badge me-4 mt-2"
          />
          {isNotifOpen && <NotificationsDropdown />}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;