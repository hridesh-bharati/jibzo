// src/assets/Navbar/Navbar.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../../assets/utils/firebaseConfig";
import { ref, onValue, get, update, remove, push, set } from "firebase/database";
import { requestFcmToken, onForegroundMessage, showLocalNotification } from "../utils/fcmClient";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import "./Navbar.css";
import EnableNotifications from "./EnableNotifications"; 

// ✅ ADD THIS MISSING FUNCTION AT THE TOP
const saveFcmTokenToBackend = async (userId, token) => {
  try {
    console.log("💾 Saving FCM token to backend for user:", userId);

    const response = await fetch('/api/saveAndPush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        token: token,
        title: 'Device Registered',
        body: 'Your device is ready to receive notifications'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Token saved to backend successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Failed to save token to backend:", error);
    throw new Error('Failed to save token: ' + error.message);
  }
};

// Custom hook for dropdown state management
const useDropdownState = () => {
  const [states, setStates] = useState({
    friendReq: false,
    inbox: false,
    notifications: false,
    userProfile: false
  });

  const toggleDropdown = useCallback((dropdown) => {
    setStates(prev => ({
      friendReq: false,
      inbox: false,
      notifications: false,
      userProfile: false,
      [dropdown]: !prev[dropdown]
    }));
  }, []);

  const closeAll = useCallback(() => {
    setStates({ friendReq: false, inbox: false, notifications: false, userProfile: false });
  }, []);

  return { ...states, toggleDropdown, closeAll };
};

// Custom hook for user authentication and FCM
const useAuthAndFCM = () => {
  const [currentUid, setCurrentUid] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUid(user?.uid || null);

      if (user) {
        // Fetch user data
        try {
          const userSnap = await get(ref(db, `usersData/${user.uid}`));
          if (userSnap.exists()) {
            setUserData(userSnap.val());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return { currentUid, userData };
};

// Utility functions
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "Just now";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

const getChatId = (a, b) => a && b ? [a, b].sort().join("_") : null;

// Function to send push notification via your API
const sendPushNotification = async (userId, title, body) => {
  try {
    const response = await fetch('/api/saveAndPush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        title: title,
        body: body
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    const result = await response.json();
    console.log('Push notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

const Navbar = () => {
  const navigate = useNavigate();
  const { currentUid, userData } = useAuthAndFCM();
  const {
    friendReq: isFriendReqOpen,
    inbox: isInboxOpen,
    notifications: isNotifOpen,
    userProfile: isUserProfileOpen,
    toggleDropdown,
    closeAll
  } = useDropdownState();

  // Friend requests state
  const [friendRequests, setFriendRequests] = useState([]);

  // Messages state
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatHistory, setChatHistory] = useState([]);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadLikes, setUnreadLikes] = useState(0);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-card') && !event.target.closest('.icon-btn') && !event.target.closest('.user-avatar-btn')) {
        closeAll();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [closeAll]);

  // Initialize FCM when user logs in - FIXED
  useEffect(() => {
    if (currentUid) {
      const initializeFCMForUser = async () => {
        try {
          console.log("🔄 Initializing FCM for user:", currentUid);

          const token = await requestFcmToken();
          if (token) {
            // ✅ NOW USING THE LOCAL FUNCTION
            await saveFcmTokenToBackend(currentUid, token);
            console.log('✅ FCM initialized successfully for user:', currentUid);
          } else {
            console.log('ℹ️ FCM token not available');
          }
        } catch (error) {
          console.error('❌ FCM initialization failed:', error);
          if (!error.message.includes('permission') && !error.message.includes('denied')) {
            console.warn('FCM setup warning:', error.message);
          }
        }
      };

      initializeFCMForUser();

      // Setup foreground message listener
      const unsubscribe = onForegroundMessage((payload) => {
        console.log('📱 Foreground message received:', payload);

        if (payload.notification) {
          showLocalNotification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/logo.png'
          });
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [currentUid]);

  // Friend Requests
  useEffect(() => {
    if (!currentUid) return;

    const reqRef = ref(db, `usersData/${currentUid}/followRequests/received`);
    const unsub = onValue(reqRef, async (snap) => {
      if (!snap.exists()) {
        setFriendRequests([]);
        return;
      }

      const requests = Object.entries(snap.val());
      const detailedRequests = await Promise.all(
        requests.map(async ([uid, requestData]) => {
          try {
            const userSnap = await get(ref(db, `usersData/${uid}`));
            const userData = userSnap.val();

            // Send push notification for new friend request
            if (requestData.timestamp > Date.now() - 10000) {
              await sendPushNotification(
                currentUid,
                "New Friend Request",
                `${userData?.username || "Someone"} sent you a friend request!`
              );
            }

            return {
              uid,
              username: userData?.username || "Someone",
              photoURL: userData?.photoURL || `https://ui-avatars.com/api/?name=${userData?.username || "U"}&background=random`,
              timestamp: requestData.timestamp
            };
          } catch {
            return {
              uid,
              username: "Someone",
              photoURL: "https://ui-avatars.com/api/?name=U&background=ccc",
              timestamp: Date.now()
            };
          }
        })
      );

      detailedRequests.sort((a, b) => b.timestamp - a.timestamp);
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

      await sendPushNotification(
        uid,
        "Friend Request Accepted",
        `${userData?.username || "Someone"} accepted your friend request!`
      );
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
      if (!snapshot.exists()) {
        setChatHistory([]);
        setUnreadCount(0);
        return;
      }

      let totalUnread = 0;
      const chats = [];

      snapshot.forEach((chatSnap) => {
        const chatData = chatSnap.val();
        if (!chatData?.messages) return;

        const messages = Object.entries(chatData.messages)
          .map(([id, msg]) => ({ id, ...msg }))
          .sort((a, b) => b.timestamp - a.timestamp);

        const unreadMsgs = messages.filter(msg => !msg.read && msg.sender !== currentUid);
        totalUnread += unreadMsgs.length;

        const otherUserId = chatSnap.key.split("_").find(uid => uid !== currentUid);
        const lastMessage = messages[0];

        chats.push({
          chatId: chatSnap.key,
          otherUserId,
          messages,
          unreadCount: unreadMsgs.length,
          lastMessage: lastMessage?.text || "Media message",
          lastTimestamp: lastMessage?.timestamp
        });
      });

      await Promise.all(chats.map(async (chat) => {
        try {
          const snap = await get(ref(db, `usersData/${chat.otherUserId}`));
          const userData = snap.val();
          chat.username = userData?.username || "Someone";
          chat.userPhoto = userData?.photoURL || `https://ui-avatars.com/api/?name=${chat.username}&background=random`;

          const newMessages = chat.messages.filter(msg =>
            !msg.read && msg.sender !== currentUid && msg.timestamp > Date.now() - 10000
          );

          if (newMessages.length > 0) {
            await sendPushNotification(
              currentUid,
              "New Message",
              `New message from ${chat.username}`
            );
          }
        } catch {
          chat.username = "Someone";
          chat.userPhoto = "https://ui-avatars.com/api/?name=U&background=ccc";
        }
      }));

      chats.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
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

  const handleInboxToggle = async (e) => {
    e.stopPropagation();
    toggleDropdown('inbox');

    if (!isInboxOpen && unreadCount > 0) {
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
          let actorPhoto = "https://ui-avatars.com/api/?name=U&background=ccc";

          if (actorId) {
            const userSnap = await get(ref(db, `usersData/${actorId}`));
            const userData = userSnap.val();
            actorName = userData?.username || "Someone";
            actorPhoto = userData?.photoURL || `https://ui-avatars.com/api/?name=${actorName}&background=random`;
          }

          const notification = {
            id,
            type: notif.type || "like",
            likerId: actorId,
            likerName: actorName,
            likerPhoto: actorPhoto,
            postCaption: notif.postCaption || "your post",
            postId: notif.postId || null,
            text: notif.text || null,
            chatId: notif.chatId || null,
            timestamp: notif.timestamp || Date.now(),
            seen: notif.seen || false
          };

          notifList.push(notification);
          if (!notification.seen) unread++;

          if (notif.timestamp > Date.now() - 10000 && !notif.seen) {
            let title = "New Notification";
            let body = "";

            if (notification.type === "like") {
              title = "New Like";
              body = `${actorName} liked your post`;
            } else if (notification.type === "message") {
              title = "New Message";
              body = `Message from ${actorName}`;
            } else if (notification.type === "comment") {
              title = "New Comment";
              body = `${actorName} commented on your post`;
            }

            await sendPushNotification(currentUid, title, body);
          }
        } catch {
          notifList.push({
            id,
            type: notif.type || "like",
            likerId: notif.likerId || notif.fromId || null,
            likerName: "Someone",
            likerPhoto: "https://ui-avatars.com/api/?name=U&background=ccc",
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

  const handleNotificationToggle = async (e) => {
    e.stopPropagation();
    toggleDropdown('notifications');

    if (!isNotifOpen && unreadLikes > 0) {
      await Promise.all(notifications.map(async (n) => {
        if (!n.seen) {
          await update(ref(db, `notifications/${currentUid}/${n.id}`), { seen: true });
        }
      }));

      setUnreadLikes(0);
      setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
    }
  };

  const handleUserProfileToggle = (e) => {
    e.stopPropagation();
    toggleDropdown('userProfile');
  };

  const openPost = (postId) => {
    if (!postId) {
      toast.info("Post not found");
      return;
    }
    navigate(`/post/${postId}`);
    closeAll();
  };

  const deleteNotification = async (notif, e) => {
    e.stopPropagation();
    if (!currentUid) return;

    try {
      await remove(ref(db, `notifications/${currentUid}/${notif.id}`));
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      toast.success("Notification deleted");
    } catch {
      toast.error("Failed to delete notification ❌");
    }
  };

  // Dropdown components
  const FriendRequestsDropdown = () => (
    <div className="dropdown-card" onClick={(e) => e.stopPropagation()}>
      <div className="dropdown-header">
        <h6>Friend Requests</h6>
        <span className="badge bg-primary">{friendRequests.length}</span>
      </div>
      <div className="dropdown-content">
        {friendRequests.length === 0 ? (
          <p className="text-muted no-items">No pending requests</p>
        ) : (
          friendRequests.map((req) => (
            <div key={req.uid} className="friend-request-item">
              <div className="d-flex align-items-center gap-2 mb-2">
                <img src={req.photoURL} className="avatar-sm" alt={req.username} />
                <div className="flex-grow-1">
                  <div className="username">{req.username}</div>
                  <small className="text-muted">{formatTimestamp(req.timestamp)}</small>
                </div>
              </div>
              <div className="btn-group-sm d-flex gap-1">
                <button className="btn btn-sm btn-success" onClick={() => handleFriendRequest(req.uid, 'accept')}>
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
    </div>
  );

  const InboxDropdown = () => (
    <div className="dropdown-card" onClick={(e) => e.stopPropagation()}>
      <div className="dropdown-header">
        <h6>Messages</h6>
        {unreadCount > 0 && <span className="badge bg-danger">{unreadCount}</span>}
      </div>
      <div className="dropdown-content">
        {chatHistory.length === 0 ? (
          <p className="text-muted no-items">No messages yet</p>
        ) : (
          chatHistory.slice(0, 5).map((chat) => (
            <div key={chat.chatId} className="message-item" onClick={() => openChat(chat.otherUserId)}>
              <div className="d-flex align-items-center gap-2">
                <img src={chat.userPhoto} className="avatar-sm" alt={chat.username} />
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="username">{chat.username}</span>
                    {chat.unreadCount > 0 && (
                      <span className="badge bg-danger badge-sm">{chat.unreadCount}</span>
                    )}
                  </div>
                  <p className="message-preview">{chat.lastMessage}</p>
                  <small className="text-muted">{formatTimestamp(chat.lastTimestamp)}</small>
                </div>
              </div>
            </div>
          ))
        )}
        {chatHistory.length > 5 && (
          <div className="view-all" onClick={() => navigate('/messages')}>
            View all messages →
          </div>
        )}
      </div>
    </div>
  );

  const NotificationsDropdown = () => (
    <div className="dropdown-card" onClick={(e) => e.stopPropagation()}>
      <div className="dropdown-header">
        <h6>Notifications</h6>
        {unreadLikes > 0 && <span className="badge bg-primary">{unreadLikes}</span>}
      </div>
      <div className="dropdown-content">
        {notifications.length === 0 ? (
          <p className="text-muted no-items">No notifications yet</p>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <div key={n.id} className="notification-item" onClick={() => n.type === "message" ? openChat(n.likerId) : openPost(n.postId)}>
              <div className="d-flex align-items-center gap-2">
                <img src={n.likerPhoto} className="avatar-sm" alt={n.likerName} />
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="notification-text">
                      {n.type === "message" ? "💬" : n.type === "comment" ? "💭" : "❤️"}{" "}
                      <strong>{n.likerName}</strong>{" "}
                      {n.type === "message" ? `sent a message` :
                        n.type === "comment" ? `commented on ${n.postCaption}` :
                          `liked ${n.postCaption}`}
                    </span>
                    <button className="btn btn-sm btn-outline-danger delete-btn" onClick={(e) => deleteNotification(n, e)}>
                      ×
                    </button>
                  </div>
                  <small className="text-muted">{formatTimestamp(n.timestamp)}</small>
                </div>
              </div>
            </div>
          ))
        )}
        {notifications.length > 10 && (
          <div className="view-all" onClick={() => navigate('/notifications')}>
            View all notifications →
          </div>
        )}
      </div>
    </div>
  );

  // Icon Button component
  const IconButton = ({ icon, badgeCount, onClick, title, badgeClass = "nav-badge" }) => (
    <button className="icon-btn" onClick={onClick} title={title}>
      <i className={icon}></i>
      {badgeCount > 0 && (
        <span className={badgeClass}>
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </button>
  );

  // User profile dropdown
  const UserProfileDropdown = () => (
    <div className="dropdown-card user-profile-dropdown" onClick={(e) => e.stopPropagation()}>
      <div className="user-info">
        <img src={userData?.photoURL || "https://ui-avatars.com/api/?name=User&background=007bff"}
          className="avatar-md" alt="Profile" />
        <div>
          <div className="username">{userData?.username || "User"}</div>
          <small className="text-muted">{userData?.email || ""}</small>
        </div>
      </div>
      <div className="dropdown-menu">
        <button className="dropdown-item" onClick={() => { navigate('/profile'); closeAll(); }}>
          <i className="bi bi-person me-2"></i>Profile
        </button>
        <button className="dropdown-item" onClick={() => { navigate('/settings'); closeAll(); }}>
          <i className="bi bi-gear me-2"></i>Settings
        </button>
        <hr />
        <button className="dropdown-item text-danger" onClick={() => auth.signOut()}>
          <i className="bi bi-box-arrow-right me-2"></i>Logout
        </button>
      </div>
    </div>
  );

  if (!currentUid) {
    return (
      <nav className="navbar shadow-sm p-2 d-flex align-items-center border justify-content-between">
        <Link to="/" className="d-flex align-items-center">
          <img src="icons/logo.png" width={100} alt="logo" />
        </Link>
        <div>
          <button className="btn btn-primary me-2" onClick={() => navigate('/login')}>Login</button>
          <button className="btn btn-outline-primary" onClick={() => navigate('/signup')}>Sign Up</button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navbar shadow-sm p-2 d-flex align-items-center border justify-content-between">
      {/* Logo on left */}
      <Link to="/home" className="d-flex align-items-center navbar-brand">
        <img src="icons/logo.png" width={100} alt="logo" />
      </Link>

      <div className="d-flex align-items-center gap-3">
        {/* Enable Notifications Button */}
        <EnableNotifications userId={currentUid} onEnabled={() => {
          toast.success("🔔 Notifications ready!");
        }} />

        {/* Friend Requests */}
        <div className="position-relative">
          <IconButton
            icon="bi bi-person-add fs-5"
            badgeCount={friendRequests.length}
            onClick={(e) => {
              e.stopPropagation();
              toggleDropdown('friendReq');
            }}
            title="Friend Requests"
          />
          {isFriendReqOpen && <FriendRequestsDropdown />}
        </div>

        {/* Messages */}
        <div className="position-relative">
          <IconButton
            icon="bi bi-chat-dots fs-5"
            badgeCount={unreadCount}
            onClick={handleInboxToggle}
            title="Messages"
          />
          {isInboxOpen && <InboxDropdown />}
        </div>

        {/* Notifications */}
        <div className="position-relative">
          <IconButton
            icon="bi bi-bell fs-5"
            badgeCount={unreadLikes}
            onClick={handleNotificationToggle}
            title="Notifications"
          />
          {isNotifOpen && <NotificationsDropdown />}
        </div>

        {/* User Profile */}
        <div className="position-relative">
          <button
            className="user-avatar-btn"
            onClick={handleUserProfileToggle}
          >
            <img
              src={userData?.photoURL || "https://ui-avatars.com/api/?name=User&background=007bff"}
              className="avatar-sm"
              alt="Profile"
            />
          </button>
          {isUserProfileOpen && <UserProfileDropdown />}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;