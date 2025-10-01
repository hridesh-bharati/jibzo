 // public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey:"AIzaSyBmnp_8dW9hJ23ZSUFnadB4NHw-89MfN_k",
  authDomain:"portfolio-dfe5c.firebaseapp.com",
  projectId:"portfolio-dfe5c",
  storageBucket:"portfolio-dfe5c.appspot.com",
  messagingSenderId:"1001469015630",
  appId:"1:1001469015630:web:79fe0cfb9ffe9f0a60b51f",

};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Background messages handle karo
messaging.onBackgroundMessage((payload) => {
  console.log('📱 [Firebase SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Jibzo';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/icons/logo.png',
    badge: '/icons/logo.png',
    image: payload.notification?.image,
    data: payload.data || {},
    tag: 'jibzo-message',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: '💬 Open Chat'
      },
      {
        action: 'close', 
        title: '❌ Close'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});