// public/firebase-messaging-sw.js - ONLY THIS CONTENT
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Your Firebase config
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
    console.log('[SW] Received background message:', payload);

    // Use data from payload if notification is not present
    const notificationTitle = payload.notification?.title || payload.data?.title || 'New Message';
    const notificationBody = payload.notification?.body || payload.data?.body || 'You have a new message';
    
    const notificationOptions = {
        body: notificationBody,
        icon: '/logo.png',
        badge: '/logo.png',
        image: payload.notification?.image || payload.data?.imageUrl || '/logo.png',
        vibrate: [200, 100, 200],
        tag: payload.data?.chatId || 'message',
        requireInteraction: false, // true se false kiya - better for mobile
        data: payload.data || {} // Important: pass data for click handling
    };

    // Add actions only if supported
    if ('actions' in Notification.prototype) {
        notificationOptions.actions = [
            {
                action: 'open',
                title: '💬 Open Chat'
            },
            {
                action: 'close',
                title: '❌ Close'
            }
        ];
    }

    self.registration.showNotification(notificationTitle, notificationOptions)
        .then(() => console.log('[SW] Notification shown successfully'))
        .catch(err => console.error('[SW] Error showing notification:', err));
});

// Notification click handle करें
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click received:', event);
    
    event.notification.close();

    const senderId = event.notification.data?.senderId || event.notification.data?.fromId;
    let urlToOpen = '/';
    
    if (senderId) {
        urlToOpen = `/messages/${senderId}`;
    } else if (event.notification.data?.chatId) {
        // Extract user ID from chatId
        const chatId = event.notification.data.chatId;
        const users = chatId.split('_');
        // Find the other user (not current user)
        const currentUser = users.find(u => u.startsWith('guest_') || u.length > 10);
        if (currentUser && users.length === 2) {
            const otherUser = users.find(u => u !== currentUser);
            if (otherUser) {
                urlToOpen = `/messages/${otherUser}`;
            }
        }
    }

    console.log('[SW] Opening URL:', urlToOpen);

    event.waitUntil(
        clients.matchAll({ 
            type: 'window',
            includeUncontrolled: true 
        }).then((windowClients) => {
            // Check if app is already open
            for (let client of windowClients) {
                if (client.url.includes('/messages/') && 'focus' in client) {
                    console.log('[SW] Focusing existing window');
                    return client.focus();
                }
            }
            
            // Open new window/tab
            if (clients.openWindow) {
                console.log('[SW] Opening new window');
                return clients.openWindow(urlToOpen);
            }
        }).catch(err => {
            console.error('[SW] Error in notification click:', err);
        })
    );
});

// Notification close handle करें
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event);
});