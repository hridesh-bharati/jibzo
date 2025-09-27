
// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:"AIzaSyBmnp_8dW9hJ23ZSUFnadB4NHw-89MfN_k",
  authDomain:"portfolio-dfe5c.firebaseapp.com",
  databaseURL:"https://portfolio-dfe5c-default-rtdb.firebaseio.com",
  projectId:"portfolio-dfe5c",
  storageBucket:"portfolio-dfe5c.appspot.com",
  messagingSenderId:"1001469015630",
  appId:"1:1001469015630:web:79fe0cfb9ffe9f0a60b51f",
  measurementId:"G-4ZXSHCYXRF",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("📨 Received background message ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icons/logo.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
