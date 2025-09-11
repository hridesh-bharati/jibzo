// src/assets/Navbar/Navbar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../../assets/utils/firebaseConfig";
import { ref, onValue, get, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import './Navbar.css'
const Navbar = () => {
  const navigate = useNavigate();
  const [currentUid, setCurrentUid] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);
  const [isFriendReqOpen, setIsFriendReqOpen] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadUsers, setUnreadUsers] = useState([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

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
            photoURL: userData?.photoURL || `https://ui-avatars.com/api/?name=${userData?.username || "U"}`,
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
    } catch (err) {
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
    } catch (err) {
      toast.error("Failed to reject request ❌");
    }
  };

  // 🔹 Messages
  useEffect(() => {
    if (!currentUid) return;
    const messagesRef = ref(db, `chats`);
    const unsub = onValue(messagesRef, async (snapshot) => {
      let usersWithUnreadMessages = [];
      let count = 0;

      snapshot.forEach((chat) => {
        const chatData = chat.val();
        if (!chatData || !chatData.messages) return;
        Object.entries(chatData.messages).forEach(([id, msg]) => {
          if (!msg.read && msg.sender !== currentUid) {
            count++;
            const index = usersWithUnreadMessages.findIndex(u => u.uid === msg.sender);
            if (index === -1) usersWithUnreadMessages.push({ uid: msg.sender, username: "", unreadCount: 1 });
            else usersWithUnreadMessages[index].unreadCount += 1;
          }
        });
      });

      // fetch usernames
      for (const user of usersWithUnreadMessages) {
        try {
          const snap = await get(ref(db, `usersData/${user.uid}`));
          const data = snap.val();
          if (data?.username) user.username = data.username;
        } catch { }
      }

      setUnreadCount(count);
      setUnreadUsers(usersWithUnreadMessages);
    });
    return () => unsub();
  }, [currentUid]);

  const toggleInbox = () => {
    setIsInboxOpen(prev => {
      const next = !prev;
      if (next && unreadCount > 0) {
        unreadUsers.forEach(async (user) => {
          const chatPath = `chats/${[currentUid, user.uid].sort().join("_")}/messages`;
          const chatRef = ref(db, chatPath);
          const snap = await get(chatRef);
          if (snap.exists()) {
            const updates = {};
            snap.forEach((msg) => {
              if (!msg.val().read && msg.val().sender !== currentUid) updates[`${msg.key}/read`] = true;
            });
            if (Object.keys(updates).length) await update(chatRef, updates);
          }
        });
        setUnreadCount(0);
      }
      return next;
    });
  };

  // 🔹 Likes
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

  const toggleNotif = () => {
    setIsNotifOpen(prev => {
      const next = !prev;
      if (next && unreadLikes > 0) {
        notifications.forEach(n => update(ref(db, `notifications/${currentUid}/${n.id}`), { seen: true }));
        setUnreadLikes(0);
        setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
      }
      return next;
    });
  };

  const openChat = (uid) => { navigate(`/messages/${uid}`); setIsInboxOpen(false); };
  const openPost = (postId) => { navigate(`/post/${postId}`); setIsNotifOpen(false); };

  return (
  <nav className="navbar shadow-sm p-2 d-flex align-items-center justify-content-between">
  {/* Logo */}
  <Link to="/home" className="d-flex align-items-center">
    <img src="icons/logo.png" width={100} alt="logo" />
  </Link>

  <div className="d-flex align-items-center gap-3">

    {/* Friend Requests */}
    <div className="position-relative">
      <button className="icon-btn" onClick={() => setIsFriendReqOpen(prev => !prev)}>
        <i className="bi bi-person-plus-fill fs-4 text-success"></i>
        {friendRequests.length > 0 && (
          <span className="badge">{friendRequests.length > 99 ? "99+" : friendRequests.length}</span>
        )}
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
          {unreadUsers.length === 0 ? <p className="text-muted">No unread messages</p> :
            unreadUsers.map(user => (
              <div key={user.uid} className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => openChat(user.uid)}>
                <img src={`https://ui-avatars.com/api/?name=${user.username}&background=random`} className="avatar-sm" alt={user.username} />
                <div className="flex-grow-1">
                  <strong>{user.username}</strong>
                  <div className="text-muted small">{user.unreadCount} unread</div>
                </div>
                <span className="badge">{user.unreadCount}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>

    {/* Likes */}
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
              <div key={n.id} className="d-flex align-items-center justify-content-between mb-2 cursor-pointer" onClick={() => openPost(n.postId)}>
                <div>❤️ <strong>{n.likerName}</strong> liked <span>{n.postCaption}</span></div>
                <small className="text-muted">{new Date(n.timestamp).toLocaleTimeString()}</small>
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
