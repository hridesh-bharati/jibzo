// src/assets/utils/PushNotification.jsx
import { db, ref, set, getFirebaseMessaging } from "../../assets/utils/firebaseConfig";
import { get, child } from "firebase/database";
import { getToken, onMessage } from "firebase/messaging";
import { toast } from "react-toastify";

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// ✅ Request FCM Token and save to Firebase
export const requestForToken = async (uid) => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const currentToken = await getToken(messaging, { vapidKey });
    if (currentToken) {
      await set(ref(db, `usersData/${uid}/fcmToken`), currentToken);
      console.log("FCM Token saved ✅", currentToken);
    } else {
      console.warn("No registration token available.");
    }
    return currentToken;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
};

// ✅ Foreground Notifications
export const onMessageListener = () =>
  new Promise(async (resolve) => {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log("Foreground notification:", payload);
      if (payload?.notification) {
        toast.info(`${payload.notification.title}: ${payload.notification.body}`);
      }
      resolve(payload);
    });
  });

// ✅ Send Push Notification
const sendNotification = async (uid, title, body) => {
  try {
    const snap = await get(ref(db, `usersData/${uid}/fcmToken`));
    const fcmToken = snap.exists() ? snap.val() : null;

    if (!fcmToken) {
      console.warn("No FCM token found for user:", uid);
      return;
    }

    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${import.meta.env.VITE_FIREBASE_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: {
          title,
          body,
        },
      }),
    });

    console.log("Notification sent ✅ to", uid);
  } catch (err) {
    console.error("Notification error:", err);
  }
};

// 🔔 Ready-to-use helpers
export const notifyFriendRequest = (uid, senderName) =>
  sendNotification(uid, "New Friend Request", `${senderName} sent you a friend request!`);

export const notifyLike = (uid, senderName, postTitle) =>
  sendNotification(uid, "New Like 👍", `${senderName} liked your post "${postTitle}"`);

export const notifyComment = (uid, senderName, postTitle) =>
  sendNotification(uid, "New Comment 💬", `${senderName} commented on your post "${postTitle}"`);

export const notifyFollow = (uid, senderName) =>
  sendNotification(uid, "New Follower", `${senderName} started following you!`);

export const notifyMessage = (uid, senderName) =>
  sendNotification(uid, "New Message 📩", `You received a new message from ${senderName}`);
