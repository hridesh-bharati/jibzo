import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../../firebaseConfig";
import { db } from "../../firebaseConfig";
import { ref, onValue, get } from "firebase/database"; // Using get() instead of once
import "../Home/Home.css";
import InstallApp from "../Pwa/InstallApp";

const Navbar = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadUsers, setUnreadUsers] = useState([]);  // Store users with their unread message count
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const navigate = useNavigate();
  const currentUid = auth.currentUser?.uid;

  // Fetch unread messages count and users
  useEffect(() => {
    if (!currentUid) return;

    const messagesRef = ref(db, `chats`);
    onValue(messagesRef, async (snapshot) => {
      let usersWithUnreadMessages = [];
      let count = 0;

      // Iterate through chats and their messages
      snapshot.forEach((chat) => {
        const chatData = chat.val();
        Object.entries(chatData.messages || {}).forEach(([id, msg]) => {
          if (!msg.read && msg.sender !== currentUid) {
            count++; // Count unread messages for the global counter

            // Check if the sender is already in the list
            const userIndex = usersWithUnreadMessages.findIndex(
              (user) => user.uid === msg.sender
            );

            if (userIndex === -1) {
              // If it's the first unread message from this user, create the entry
              usersWithUnreadMessages.push({
                uid: msg.sender,
                username: "",
                unreadCount: 1,  // Initialize with one unread message
              });
            } else {
              // If this user is already in the list, just increment their unread message count
              usersWithUnreadMessages[userIndex].unreadCount += 1;
            }
          }
        });
      });

      // Fetch the usernames for users who sent unread messages
      for (const user of usersWithUnreadMessages) {
        const userRef = ref(db, `usersData/${user.uid}`);
        const userSnapshot = await get(userRef); // Use get() instead of once()
        const userData = userSnapshot.val();
        if (userData?.username) {
          user.username = userData.username; // Set the username
        }
      }

      setUnreadCount(count);  // Set the global unread count
      setUnreadUsers(usersWithUnreadMessages); // Store users and their unread message count
    });
  }, [currentUid]);

  const toggleInbox = () => {
    setIsInboxOpen((prev) => !prev);
  };

  const openChat = (uid) => {
    navigate(`/messages/${uid}`); // Navigate to the specific user's chat
    setIsInboxOpen(false); // Close inbox when a user is selected
  };

  return (
    <nav className="navbar bg-white shadow-sm border-0">
      <div className="container m-0 p-0">
        <Link to="/" className="fw-bold text-primary">
          <img src="icons/logo.png" className="img-fluid" width={120} alt="" />
        </Link>
        <InstallApp />
        {/* Inbox Button with Unread Badge */}
        <button
          type="button"
          className="btn btn-primary position-relative"
          onClick={toggleInbox}
          aria-label="Toggle Inbox"
        >
          <i className="bi bi-inbox-fill"></i> Inbox
          {unreadCount > 0 && (
            <span
              className={`position-absolute top-0 start-100 translate-middle badge rounded-pill ${unreadCount > 99 ? 'bg-warning' : 'bg-danger'}`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
              <span className="visually-hidden">unread messages</span>
            </span>
          )}
        </button>
      </div>

      {/* Inbox Dropdown */}
      {isInboxOpen && (
        <div className="inbox-dropdown border-0 py-1">
          <ul>
            {unreadUsers.map((user, index) => (
              <li
                key={index}
                onClick={() => openChat(user.uid)}
                className="cursor-pointer my-2"
              >
                <button type="button" className="btn btn-primary position-relative">
                  {user.username}
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {user.unreadCount}
                    <span className="visually-hidden">unread messages</span>
                  </span>
                </button>


              </li>
            ))}
          </ul>
        </div>
      )}

      <style>
        {`
    .cursor-pointer {
      cursor: pointer;
      list-style-type:none;
    }
    .inbox-dropdown {
      position: absolute;
      top: 50px;
      right: 0;
      border: 1px solid #ccc;
      background-color: white;
      width: 300px;
      max-height: 300px;
      overflow-y: auto;
      box-shadow: 0px 4px 6px rgba(0,0,0,0.1);
    }
    `}
      </style>
    </nav>

  );
};

export default Navbar;
