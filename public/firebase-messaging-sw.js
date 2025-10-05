// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBmnp_8dW9hJ23ZSUFnadB4NHw-89MfN_k",
    authDomain: "portfolio-dfe5c.firebaseapp.com",
    projectId: "portfolio-dfe5c",
    storageBucket: "portfolio-dfe5c.firebasestorage.app",
    messagingSenderId: "1001469015630",
    appId: "1:1001469015630:web:79fe0cfb9ffe9f0a60b51f",
});

const messaging = firebase.messaging();

// Background messages handle करें
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.image || '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200],
        tag: payload.data?.chatId || 'message',
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Open Chat'
            }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handle करें
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const senderId = event.notification.data?.senderId;
    const urlToOpen = senderId ? `/messages/${senderId}` : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            // Check if app is already open
            for (let client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});