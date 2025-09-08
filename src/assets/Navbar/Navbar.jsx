// src/assets/Navbar/Navbar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../../firebaseConfig";
import { ref, onValue, get, update } from "firebase/database";

const Navbar = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadUsers, setUnreadUsers] = useState([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadLikes, setUnreadLikes] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const navigate = useNavigate();
  const currentUid = auth.currentUser?.uid;

  // 🔹 Fetch unread messages
  useEffect(() => {
    if (!currentUid) return;
    const messagesRef = ref(db, `chats`);
    const unsub = onValue(messagesRef, async (snapshot) => {
      let usersWithUnreadMessages = [];
      let count = 0;
      snapshot.forEach((chat) => {
        const chatData = chat.val();
        if (!chatData || !chatData.messages) return;
        Object.entries(chatData.messages || {}).forEach(([id, msg]) => {
          if (!msg.read && msg.sender !== currentUid) {
            count++;
            const userIndex = usersWithUnreadMessages.findIndex(
              (u) => u.uid === msg.sender
            );
            if (userIndex === -1) {
              usersWithUnreadMessages.push({
                uid: msg.sender,
                username: "",
                unreadCount: 1,
              });
            } else {
              usersWithUnreadMessages[userIndex].unreadCount += 1;
            }
          }
        });
      });
      // fetch usernames
      for (const user of usersWithUnreadMessages) {
        try {
          const userRef = ref(db, `usersData/${user.uid}`);
          const userSnapshot = await get(userRef);
          const userData = userSnapshot.val();
          if (userData?.username) user.username = userData.username;
        } catch (err) {
          console.warn("Failed to fetch user", user.uid, err);
        }
      }
      setUnreadCount(count);
      setUnreadUsers(usersWithUnreadMessages);
    });

    return () => unsub();
  }, [currentUid]);

  // 🔹 Fetch likes notifications
  useEffect(() => {
    if (!currentUid) return;

    const notifRef = ref(db, `notifications/${currentUid}`);
    const unsub = onValue(notifRef, async (snapshot) => {
      let notifList = [];
      let unread = 0;
      const data = snapshot.val();
      if (data) {
        for (const [id, notif] of Object.entries(data)) {
          try {
            const userRef = ref(db, `usersData/${notif.likerId}`);
            const userSnap = await get(userRef);
            const likerData = userSnap.val();
            notifList.push({
              id,
              postId: notif.postId,
              likerId: notif.likerId,
              likerName:
                likerData?.username || likerData?.displayName || "Someone",
              postCaption: notif.postCaption || "your post",
              timestamp: notif.timestamp || Date.now(),
              seen: notif.seen || false,
            });
          } catch {
            notifList.push({
              id,
              postId: notif.postId,
              likerId: notif.likerId,
              likerName: "Someone",
              postCaption: notif.postCaption || "your post",
              timestamp: notif.timestamp || Date.now(),
              seen: notif.seen || false,
            });
          }
        }
      }

      notifList.forEach((n) => {
        if (!n.seen) unread++;
      });

      notifList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      setNotifications(notifList);
      setUnreadLikes(unread);
    });

    return () => unsub();
  }, [currentUid]);

 const toggleInbox = () => {
  setIsInboxOpen((prev) => {
    const next = !prev;
    if (next && unreadCount > 0) {
      // Har user ke unread msgs ko mark as read
      unreadUsers.forEach(async (user) => {
        const chatPath = `chats/${[currentUid, user.uid].sort().join("_")}/messages`;
        const chatRef = ref(db, chatPath);
        const snap = await get(chatRef);

        if (snap.exists()) {
          const updates = {};
          snap.forEach((msg) => {
            if (msg.val().sender !== currentUid && !msg.val().read) {
              updates[`${msg.key}/read`] = true;
            }
          });
          if (Object.keys(updates).length > 0) {
            await update(chatRef, updates);
          }
        }
      });

      setUnreadCount(0); // UI counter reset
    }
    return next;
  });
};


  // 🔹 Open Likes → mark all as seen (remove counter, keep history)
  const toggleNotif = () => {
    setIsNotifOpen((prev) => {
      const next = !prev;
      if (next && unreadLikes > 0) {
        notifications.forEach((notif) => {
          if (!notif.seen) {
            update(ref(db, `notifications/${currentUid}/${notif.id}`), {
              seen: true,
            });
          }
        });
        setUnreadLikes(0);
        // local update bhi karein
        setNotifications((prevNotifs) =>
          prevNotifs.map((n) => ({ ...n, seen: true }))
        );
      }
      return next;
    });
  };

  const openChat = (uid) => {
    navigate(`/messages/${uid}`);
    setIsInboxOpen(false);
  };

  const openPost = (postId) => {
    navigate(`/post/${postId}`);
    setIsNotifOpen(false);
  };

  return (
    <nav className="navbar bg-white shadow-sm border-0" style={{ position: "relative", zIndex: 3000 }}>
      <div className="container m-0 p-0 d-flex align-items-center">
        <Link to="/home" className="fw-bold text-primary d-inline-flex align-items-center">
          <img src="icons/logo.png" className="img-fluid" width={120} alt="logo" />
        </Link>

        <div className="ms-auto d-flex align-items-center">
          {/* Inbox */}
          <div className="me-2 position-relative">
            <button
              type="button"
              className="btn position-relative btn-sm p-0 m-0"
              onClick={toggleInbox}
              aria-label="Toggle Inbox"
              style={{ border: "0", outline: "none", background: "transparent" }}
            >
              <i className="bi bi-chat-dots-fill fs-3" style={{ color: "#009dff" }}></i>
              {unreadCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {isInboxOpen && (
              <div className="inbox-dropdown border-0 py-2 px-2">
                <h6 className="fw-bold mb-2">Messages</h6>
                <ul className="list-unstyled m-0">
                  {unreadUsers.length === 0 ? (
                    <li className="text-center text-muted py-2">
                      No unread messages
                    </li>
                  ) : (
                    unreadUsers.map((user, index) => (
                      <li
                        key={index}
                        onClick={() => openChat(user.uid)}
                        className="cursor-pointer d-flex align-items-center p-2 rounded mb-1 hover-bg"
                      >
                        <img
                          src={`https://ui-avatars.com/api/?name=${user.username}&background=random`}
                          alt="avatar"
                          width={35}
                          height={35}
                          className="rounded-circle me-2"
                        />
                        <div className="flex-grow-1">
                          <strong>{user.username || "Someone"}</strong>
                          <div className="text-muted small">
                            {user.unreadCount} unread
                          </div>
                        </div>
                        <span className="badge bg-danger">{user.unreadCount}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Likes */}
          <div className="position-relative">
            <button
              type="button"
              className="btn position-relative btn-sm p-0 m-0"
              onClick={toggleNotif}
              aria-label="Toggle Likes"
              style={{ border: "0", outline: "none", background: "transparent" }}
            >
              <i className="bi bi-heart-fill fs-3" style={{ color: "red" }}></i>
              {unreadLikes > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {unreadLikes > 99 ? "99+" : unreadLikes}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="inbox-dropdown border-0 py-1">
                <ul className="p-2 m-0">
                  {notifications.length === 0 ? (
                    <li className="text-center text-muted py-2">No likes yet</li>
                  ) : (
                    notifications.map((notif) => (
                      <li key={notif.id} onClick={() => openPost(notif.postId)} className="cursor-pointer my-2 px-2" role="button">
                        <div className="d-flex align-items-center">
                          <div style={{ flex: 1 }}>
                            ❤️ <strong>{notif.likerName}</strong> liked{" "}
                            <span>{notif.postCaption}</span>
                          </div>
                          <div style={{ marginLeft: 8 }}>
                            <small className="text-muted">
                              {notif.timestamp ? new Date(notif.timestamp).toLocaleString() : ""}
                            </small>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>
        {`
          .cursor-pointer { cursor: pointer; list-style-type:none; }
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
          }
        `}
      </style>
    </nav>
  );
};

export default Navbar;
