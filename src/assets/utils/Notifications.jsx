// src\assets\utiles\Notifications.jsx
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { db, ref, get, set } from "../../firebaseConfig";
import { toast } from "react-toastify";

const SERVER_KEY = "YOUR_FIREBASE_SERVER_KEY_HERE"; 
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// 🔹 Get and save FCM token
export const requestForToken = async (uid) => {
  try {
    const messaging = getMessaging();
    const currentToken = await getToken(messaging, { vapidKey });
    if (currentToken && uid) {
      await set(ref(db, `usersData/${uid}/fcmToken`), currentToken);
    }
    return currentToken;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
};

// 🔹 Listen for foreground messages
export const onMessageListener = () =>
  new Promise((resolve) => {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      toast.info(`${payload.notification.title}: ${payload.notification.body}`);
      resolve(payload);
    });
  });

// 🔹 Generic notification sender
const sendNotification = async (token, title, body) => {
  if (!token) return;
  try {
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${SERVER_KEY}`,
      },
      body: JSON.stringify({ to: token, notification: { title, body } }),
    });
  } catch (err) {
    console.error("FCM send error:", err);
  }
};

// 🔹 Notifications
export const notifyFriendRequest = async (recipientUid, senderName) => {
  const tokenSnap = await get(ref(db, `usersData/${recipientUid}/fcmToken`));
  if (!tokenSnap.exists()) return;
  await sendNotification(tokenSnap.val(), "New Friend Request", `You have a new friend request from ${senderName}!`);
};

export const notifyFollow = async (recipientUid, followerName) => {
  const tokenSnap = await get(ref(db, `usersData/${recipientUid}/fcmToken`));
  if (!tokenSnap.exists()) return;
  await sendNotification(tokenSnap.val(), "New Follower", `${followerName} started following you!`);
};

export const notifyLike = async (postOwnerUid, likerName, postTitle = "your post") => {
  const tokenSnap = await get(ref(db, `usersData/${postOwnerUid}/fcmToken`));
  if (!tokenSnap.exists()) return;
  await sendNotification(tokenSnap.val(), "New Like", `${likerName} liked ${postTitle}!`);
};

export const notifyComment = async (postOwnerUid, commenterName, postTitle = "your post") => {
  const tokenSnap = await get(ref(db, `usersData/${postOwnerUid}/fcmToken`));
  if (!tokenSnap.exists()) return;
  await sendNotification(tokenSnap.val(), "New Comment", `${commenterName} commented on ${postTitle}!`);
};

export const notifyMessage = async (recipientUid, senderName) => {
  const tokenSnap = await get(ref(db, `usersData/${recipientUid}/fcmToken`));
  if (!tokenSnap.exists()) return;
  await sendNotification(tokenSnap.val(), "New Message", `You received a message from ${senderName}!`);
};
