// src/assets/Navbar/Navbar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../../assets/utils/firebaseConfig";
import { ref, onValue, get, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";

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
    <nav className="navbar bg-white shadow-sm border-0 position-relative" style={{ zIndex: 3000 }}>
      <div className="container d-flex align-items-center m-0 p-0">
        <Link to="/home" className="fw-bold text-primary d-inline-flex align-items-center">
          <img src="icons/logo.png" className="img-fluid" width={120} alt="logo" />
        </Link>

        <div className="ms-auto d-flex align-items-center gap-3">
          {/* Friend Requests */}
          <div className="position-relative">
            <button className="btn btn-sm position-relative p-0 m-0" onClick={() => setIsFriendReqOpen(prev => !prev)} style={{ border: 0, background: "transparent" }}>
              <i className="bi bi-person-plus-fill fs-3 text-success"></i>
              {friendRequests.length > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{friendRequests.length}</span>}
            </button>
            {isFriendReqOpen && (
              <div className="inbox-dropdown">
                <h6 className="fw-bold mb-2">Friend Requests</h6>
                {friendRequests.length === 0 ? <p className="text-center text-muted">No requests</p> :
                  friendRequests.map(req => (
                    <div key={req.uid} className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center">
                        <img src={req.photoURL} width={35} height={35} className="rounded-circle me-2" alt={req.username} />
                        <span>{req.username}</span>
                      </div>
                      <div className="btn-group btn-sm">
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
            <button className="btn btn-sm position-relative p-0 m-0" onClick={toggleInbox} style={{ border: 0, background: "transparent" }}>
              <i className="bi bi-chat-dots-fill fs-3 text-primary"></i>
              {unreadCount > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
            {isInboxOpen && (
              <div className="inbox-dropdown">
                <h6 className="fw-bold mb-2">Messages</h6>
                {unreadUsers.length === 0 ? <p className="text-center text-muted">No unread messages</p> :
                  unreadUsers.map(user => (
                    <div key={user.uid} className="cursor-pointer d-flex align-items-center p-2 rounded mb-1 hover-bg" onClick={() => openChat(user.uid)}>
                      <img src={`https://ui-avatars.com/api/?name=${user.username}&background=random`} width={35} height={35} className="rounded-circle me-2" alt={user.username} />
                      <div className="flex-grow-1">
                        <strong>{user.username}</strong>
                        <div className="text-muted small">{user.unreadCount} unread</div>
                      </div>
                      <span className="badge bg-danger">{user.unreadCount}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Likes */}
          <div className="position-relative">
            <button className="btn btn-sm position-relative p-0 m-0" onClick={toggleNotif} style={{ border: 0, background: "transparent" }}>
              <i className="bi bi-heart-fill fs-3 text-danger"></i>
              {unreadLikes > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{unreadLikes > 99 ? "99+" : unreadLikes}</span>}
            </button>
            {isNotifOpen && (
              <div className="inbox-dropdown">
                <h6 className="fw-bold mb-2">Likes</h6>
                {notifications.length === 0 ? <p className="text-center text-muted">No likes yet</p> :
                  notifications.map(notif => (
                    <div key={notif.id} className="d-flex align-items-center justify-content-between mb-2 cursor-pointer" onClick={() => openPost(notif.postId)}>
                      <div>❤️ <strong>{notif.likerName}</strong> liked <span>{notif.postCaption}</span></div>
                      <small className="text-muted">{new Date(notif.timestamp).toLocaleString()}</small>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

        </div>
      </div>

      <style>
        {`
          .inbox-dropdown {
            position: absolute;
            top: 56px;
            right: 0;
            border: 1px solid #ccc;
            background-color: white;
            width: 320px;
            max-height: 360px;
            overflow-y: auto;
            box-shadow: 0px 8px 18px rgba(0,0,0,0.12);
            z-index: 2500;
            border-radius: 8px;
            padding: 8px;
          }
          .cursor-pointer { cursor: pointer; list-style:none; }
          .hover-bg:hover { background-color: #f8f9fa; }
        `}
      </style>
    </nav>
  );
};

export default Navbar;
