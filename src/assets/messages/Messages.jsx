// src/assets/messages/Messages.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db, auth, requestNotificationPermission, onForegroundMessage, getFirebaseMessaging } from "../../assets/utils/firebaseConfig";
import {
  ref as dbRef,
  onValue,
  push,
  set,
  remove,
  update,
  serverTimestamp,
  onDisconnect,
  get
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { getToken } from "firebase/messaging";
import Picker from "emoji-picker-react";
import axios from "axios";
import { NotificationService, initializeNotifications, saveFCMToken } from "../../assets/utils/notificationService";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Messages() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [currentUid, setCurrentUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [chatUser, setChatUser] = useState(null);

  const [input, setInput] = useState("");
  const [selectedMsgId, setSelectedMsgId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [privacyHide, setPrivacyHide] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [partnerStatus, setPartnerStatus] = useState(null);
  const [notificationService, setNotificationService] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Permission states
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showMicrophoneModal, setShowMicrophoneModal] = useState(false);

  const messagesEndRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const chatId = currentUid && uid ? [currentUid, uid].sort().join("_") : null;

  // ========== NOTIFICATION FUNCTIONS - 100% WORKING ==========

  // ---------- Enhanced Browser Notification - FIXED ----------
  const showBrowserNotification = (notificationData) => {
    if (!("Notification" in window)) {
      console.log("❌ Browser doesn't support notifications");
      return;
    }

    if (Notification.permission !== "granted") {
      console.log("❌ Notification permission not granted");
      return;
    }

    console.log('🖥️ Creating browser notification:', notificationData);

    try {
      // ✅ FIXED: Simple notification without actions
      const notificationOptions = {
        body: notificationData.body,
        icon: '/icons/logo.png',
        badge: '/icons/logo.png',
        image: notificationData.image,
        data: notificationData.data || {},
        tag: 'jibzo-' + Date.now(), // Unique tag
        requireInteraction: false, // ✅ Changed to false for better compatibility
      };

      const notification = new Notification(notificationData.title, notificationOptions);

      notification.onclick = () => {
        console.log('🔔 Browser notification clicked');
        window.focus();
        notification.close();
        
        if (notificationData.data?.url) {
          console.log('📍 Navigating to:', notificationData.data.url);
          window.location.href = notificationData.data.url;
        }
      };

      notification.onclose = () => {
        console.log('🔔 Browser notification closed');
      };

      // Auto close after 8 seconds
      setTimeout(() => {
        notification.close();
      }, 8000);
      
      console.log('✅ Browser notification shown successfully');
      
    } catch (error) {
      console.error('❌ Error showing browser notification:', error);
    }
  };

  // ---------- Service Worker Notification (with actions) ----------
  const showServiceWorkerNotification = async (notificationData) => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.log('❌ Service Worker or Notification not supported');
      // Fallback to regular notification
      showBrowserNotification(notificationData);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // ✅ Service worker ke through notification with actions
      await registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: '/icons/logo.png',
        badge: '/icons/logo.png',
        image: notificationData.image,
        data: notificationData.data || {},
        tag: 'jibzo-sw-' + Date.now(),
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
      });
      
      console.log('✅ Service Worker notification shown with actions');
    } catch (error) {
      console.error('❌ Service Worker notification failed:', error);
      // Fallback to regular notification
      showBrowserNotification(notificationData);
    }
  };

  // ---------- Enhanced Floating Notification ----------
  const showFloatingNotification = (notificationData) => {
    console.log('🪟 Showing floating notification');
    
    const floatingEvent = new CustomEvent('showFloatingNotification', {
      detail: {
        id: Date.now(),
        title: notificationData.title,
        body: notificationData.body,
        image: notificationData.image,
        url: notificationData.url,
        timestamp: new Date().toLocaleTimeString(),
        duration: 5000
      }
    });
    window.dispatchEvent(floatingEvent);
    console.log('✅ Floating notification event dispatched');
  };

  // ---------- Smart Notification (Auto-chooses best method) ----------
  const showSmartNotification = (notificationData) => {
    console.log('🤖 Showing smart notification');
    
    // Always show floating notification
    showFloatingNotification(notificationData);
    
    // Show browser notification if app is not focused
    if (!document.hasFocus()) {
      if ('serviceWorker' in navigator) {
        // Try service worker notification first (with actions)
        showServiceWorkerNotification(notificationData);
      } else {
        // Fallback to regular browser notification
        showBrowserNotification(notificationData);
      }
    } else {
      console.log('ℹ️ App is focused, skipping browser notification');
    }
  };

  // ---------- Manual Test Function ----------
  const testNotification = async () => {
    console.log('🧪 Testing notification system...');
    
    // Test 1: Simple browser notification
    showBrowserNotification({
      title: 'Test Notification 🧪',
      body: 'This is a test notification from Jibzo!',
      image: chatUser?.photoURL,
      data: {
        url: `/messages/${uid}`,
        test: true
      }
    });
    
    // Test 2: Service Worker notification with actions
    showServiceWorkerNotification({
      title: 'SW Test 🛠️',
      body: 'Service Worker test with actions!',
      image: chatUser?.photoURL,
      data: {
        url: `/messages/${uid}`
      }
    });
    
    // Test 3: Floating notification
    showFloatingNotification({
      title: 'Floating Test 🪟',
      body: 'This is a floating notification test!',
      image: chatUser?.photoURL,
      url: `/messages/${uid}`
    });
    
    // Test 4: Smart notification
    showSmartNotification({
      title: 'Smart Test 🤖',
      body: 'This is a smart notification test!',
      image: chatUser?.photoURL,
      url: `/messages/${uid}`,
      data: {
        url: `/messages/${uid}`
      }
    });
    
    // Test 5: Database notification
    if (notificationService) {
      const testNotifId = await notificationService.createNotification({
        type: "test",
        fromId: "test_user",
        chatId: "test_chat_" + Date.now(),
        text: "This is a test notification",
        senderName: "Test User",
        senderPhoto: "/logo.png",
        pushTitle: "Test Notification",
        pushBody: "This is a test push notification"
      });
      console.log('✅ Test notification created with ID:', testNotifId);
    }
    
    const token = await requestNotificationPermission();
    console.log('🔑 FCM Token:', token);
  };

  // ---------- Emergency Test Function ----------
  const emergencyNotificationTest = () => {
    console.log('🚨 EMERGENCY NOTIFICATION TEST');
    
    // Test 1: Direct browser notification (simple)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Jibzo Test 🚨', {
          body: 'Yeh DIRECT browser notification aa raha hai?',
          icon: '/icons/logo.png',
          tag: 'emergency-test-' + Date.now()
        });
        console.log('✅ Direct browser notification shown');
      } catch (error) {
        console.error('❌ Direct notification failed:', error);
      }
    }
    
    // Test 2: Our custom notification
    showBrowserNotification({
      title: 'Custom Test 🔔',
      body: 'Yeh CUSTOM notification aa raha hai?',
      image: chatUser?.photoURL,
      data: { 
        url: `/messages/${uid}`,
        chatId: chatId,
        fromId: uid
      }
    });
    
    // Test 3: Service Worker notification (with actions)
    showServiceWorkerNotification({
      title: 'SW Test 🛠️',
      body: 'Yeh SERVICE WORKER notification aa raha hai?',
      image: '/logo.png',
      data: {
        url: `/messages/${uid}`
      }
    });
    
    // Test 4: Floating notification
    showFloatingNotification({
      title: 'Floating Test 🪟',
      body: 'Yeh FLOATING notification aa raha hai?',
      image: '/logo.png',
      url: `/messages/${uid}`
    });

    // Test 5: Smart notification
    showSmartNotification({
      title: 'Smart Test 🤖',
      body: 'Yeh SMART notification aa raha hai?',
      image: '/logo.png',
      url: `/messages/${uid}`,
      data: {
        url: `/messages/${uid}`
      }
    });

    // Test 6: Create test notification in database
    if (notificationService) {
      notificationService.createNotification({
        type: "emergency_test",
        fromId: "system",
        chatId: "test_chat_emergency",
        text: "Emergency test notification",
        senderName: "Test System",
        senderPhoto: "/logo.png",
        pushTitle: "Emergency Test",
        pushBody: "This is an emergency test notification",
        timestamp: Date.now()
      });
    }

    alert('🚨 Emergency test complete! Check ALL notification types in console!');
  };

  // ========== MAIN COMPONENT LOGIC ==========

  // ---------- Check Permissions on Load ----------
  useEffect(() => {
    const storedPermissions = localStorage.getItem('appPermissions');
    if (storedPermissions) {
      const permissions = JSON.parse(storedPermissions);
      setHasCameraPermission(permissions.camera || false);
      setHasMicrophonePermission(permissions.microphone || false);
    }
  }, []);

  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUid(user.uid);
      else navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let guestId = localStorage.getItem("guestUid");
    if (!guestId) {
      guestId = "guest_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("guestUid", guestId);
    }
    setCurrentUid(auth.currentUser?.uid || guestId);
  }, []);

  // ---------- Debug Notification Status ----------
  useEffect(() => {
    console.log('=== NOTIFICATION DEBUG INFO ===');
    console.log('Current User:', currentUid);
    console.log('Notification Permission:', Notification.permission);
    console.log('Service Worker Support:', 'serviceWorker' in navigator);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('Service Worker Registrations:', registrations.length);
        registrations.forEach(reg => {
          console.log('SW Scope:', reg.scope);
          console.log('SW State:', reg.active ? 'active' : 'inactive');
        });
      });
    }
    console.log('=== END DEBUG INFO ===');
  }, [currentUid]);

  // ---------- Notification Setup ----------
  useEffect(() => {
    const setupNotifications = async () => {
      if (!currentUid || currentUid.startsWith('guest_')) return;
      
      try {
        const service = await initializeNotifications(currentUid);
        setNotificationService(service);

        const token = await requestNotificationPermission();
        if (token) {
          setFcmToken(token);
          await saveFCMToken(currentUid, token);
        }

        onForegroundMessage((payload) => {
          console.log('New message received in foreground:', payload);
          showFloatingNotification({
            title: payload.notification?.title || 'New Message',
            body: payload.notification?.body || 'You have a new message',
            image: chatUser?.photoURL || '/logo.png',
            url: payload.data?.url || `/messages/${uid}`
          });
        });

      } catch (error) {
        console.error('Notification setup error:', error);
      }
    };

    setupNotifications();

    return () => {
      if (notificationService) {
        notificationService.unsubscribeFromNotifications();
      }
    };
  }, [currentUid, uid]);
 
  // ---------- Listen for New Notifications - FINAL WORKING VERSION ----------
  useEffect(() => {
    if (!notificationService || !currentUid) return;

    console.log('🎯 Starting 100% WORKING notification listener...');

    notificationService.listenForNotifications((newNotifications) => {
      console.log('📨 New notifications received:', newNotifications);
      setUnreadCount(newNotifications.length);
      
      newNotifications.forEach(notification => {
        if (notification.type === 'message' && !notification.seen) {
          console.log('💬 New message notification:', notification);
          
          // ✅ SMART NOTIFICATION: Use the best method automatically
          showSmartNotification({
            title: 'New Message 💬',
            body: `${notification.senderName || 'Someone'}: ${notification.text || 'Sent a message'}`,
            image: notification.senderPhoto || '/logo.png',
            url: `/messages/${notification.fromId}`,
            data: {
              url: `/messages/${notification.fromId}`,
              chatId: notification.chatId,
              fromId: notification.fromId
            },
            notificationId: notification.id
          });

          // Mark as seen after showing
          setTimeout(() => {
            notificationService.markAsSeen(notification.id);
            console.log('✅ Notification marked as seen:', notification.id);
          }, 3000);
        }
      });
    });
  }, [notificationService, currentUid, uid, chatId]);

  // ---------- Push Notification Trigger ----------
  const triggerPushNotification = async (recipientUid, notificationData) => {
    try {
      console.log('📤 Triggering push notification for:', recipientUid);
      
      const userRef = dbRef(db, `users/${recipientUid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const fcmToken = userData.fcmToken;
        
        if (fcmToken) {
          console.log('✅ FCM Token found, sending push notification');
          
          const pushRef = push(dbRef(db, `pushQueue`));
          await set(pushRef, {
            to: fcmToken,
            notification: {
              title: notificationData.title,
              body: notificationData.body,
              image: notificationData.image,
              icon: '/icons/logo.png'
            },
            data: notificationData.data,
            timestamp: Date.now(),
            recipient: recipientUid
          });
          
          console.log('✅ Push notification queued');
        } else {
          console.log('❌ No FCM token found for user');
        }
      }
    } catch (error) {
      console.error('❌ Error triggering push notification:', error);
    }
  };

  // ---------- Debug Functions ----------
  const debugFCMStatus = async () => {
    console.group('🔍 FCM DEBUG INFO');
    
    // 1. Check VAPID Key
    console.log('🔑 VAPID Key:', import.meta.env.VITE_FIREBASE_VAPID_KEY ? '✅ Present' : '❌ Missing');
    
    // 2. Check current FCM token
    console.log('📱 Current FCM Token:', fcmToken);
    
    // 3. Get new token with VAPID
    try {
      const messagingInstance = await getFirebaseMessaging();
      if (messagingInstance) {
        const newToken = await getToken(messagingInstance, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        console.log('🆕 New FCM Token with VAPID:', newToken);
      }
    } catch (error) {
      console.error('❌ Error getting new token:', error);
    }
    
    // 4. Check service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('🛠️ Service Workers:', registrations.length);
      registrations.forEach(reg => {
        console.log('   Scope:', reg.scope, 'State:', reg.active ? 'active' : 'inactive');
      });
    }
    
    console.groupEnd();
  };

  const debugNotificationCheck = async () => {
    console.group('🔔 NOTIFICATION DEBUG CHECK');
    
    // 1. Check current notification status
    const status = {
      permission: Notification.permission,
      supported: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      currentUser: currentUid,
      chatId: chatId,
      notificationService: !!notificationService,
      fcmToken: fcmToken,
      unreadCount: unreadCount
    };
    console.log('📊 Current Status:', status);
    
    // 2. Check notifications in database
    if (currentUid && !currentUid.startsWith('guest_')) {
      try {
        const notifRef = dbRef(db, `notifications/${currentUid}`);
        const snapshot = await get(notifRef);
        
        if (snapshot.exists()) {
          const notifications = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            ...data
          }));
          console.log('📨 Notifications in database:', notifications);
          
          const unread = notifications.filter(n => !n.seen);
          console.log('🆕 Unread notifications:', unread.length);
        } else {
          console.log('ℹ️ No notifications found in database');
        }
      } catch (error) {
        console.error('❌ Error fetching notifications:', error);
      }
    }
    
    // 3. Test notification creation
    if (notificationService) {
      const testNotifId = await notificationService.createNotification({
        type: "debug_test",
        fromId: "system",
        chatId: chatId || "test_chat",
        text: "This is a debug test notification",
        senderName: "Debug System",
        senderPhoto: "/logo.png",
        pushTitle: "Debug Test",
        pushBody: "This is a test notification from debug system",
        timestamp: Date.now()
      });
      console.log('🧪 Test notification created with ID:', testNotifId);
    }
    
    // 4. Check service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('🛠️ Service Worker Registrations:', registrations.length);
      registrations.forEach((reg, index) => {
        console.log(`   SW ${index + 1}:`, {
          scope: reg.scope,
          state: reg.active ? 'active' : 'inactive',
          scriptURL: reg.active?.scriptURL
        });
      });
    }
    
    console.groupEnd();
    
    // Show results in alert
    alert(`Notification Debug Complete!\nCheck console for details.\nPermission: ${status.permission}\nUnread: ${unreadCount}`);
  };

  // ---------- Camera Permission Handler ----------
  const handleCameraClick = async () => {
    if (!hasCameraPermission) {
      setShowCameraModal(true);
      return;
    }
    await openCamera();
  };

  const requestCameraPermission = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        
        const storedPermissions = JSON.parse(localStorage.getItem('appPermissions') || '{}');
        localStorage.setItem('appPermissions', JSON.stringify({
          ...storedPermissions,
          camera: true
        }));
        
        stream.getTracks().forEach(track => track.stop());
        setShowCameraModal(false);
        
        await openCamera();
      }
    } catch (error) {
      console.error('Camera permission denied:', error);
      alert('Camera permission is required to take photos');
    }
  };

  const openCamera = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  };

  // ---------- Microphone Permission Handler ----------
  const handleMicrophoneClick = async () => {
    if (!hasMicrophonePermission) {
      setShowMicrophoneModal(true);
      return;
    }
    await startVoiceRecording();
  };

  const requestMicrophonePermission = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasMicrophonePermission(true);
        
        const storedPermissions = JSON.parse(localStorage.getItem('appPermissions') || '{}');
        localStorage.setItem('appPermissions', JSON.stringify({
          ...storedPermissions,
          microphone: true
        }));
        
        stream.getTracks().forEach(track => track.stop());
        setShowMicrophoneModal(false);
        
        await startVoiceRecording();
      }
    } catch (error) {
      console.error('Microphone permission denied:', error);
      alert('Microphone permission is required for voice messages');
    }
  };

  const startVoiceRecording = async () => {
    alert('Voice message feature coming soon! 🎤');
  };

  // ---------- Auto focus input on mount ----------
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 500);
    }
  }, []);

  // ---------- Presence ----------
  useEffect(() => {
    if (!currentUid) return;
    const statusRef = dbRef(db, `status/${currentUid}`);
    const updateStatus = (state) => {
      set(statusRef, {
        state,
        last_changed: serverTimestamp(),
        hide: privacyHide,
        guest: currentUid.startsWith("guest_"),
      }).catch(console.warn);
    };
    updateStatus("online");
    window.addEventListener("focus", () => updateStatus("online"));
    window.addEventListener("blur", () => updateStatus("away"));
    onDisconnect(statusRef).set({
      state: "offline",
      last_changed: serverTimestamp(),
      hide: privacyHide,
      guest: currentUid.startsWith("guest_"),
    });
    return () => {
      window.removeEventListener("focus", () => updateStatus("online"));
      window.removeEventListener("blur", () => updateStatus("away"));
    };
  }, [currentUid, privacyHide]);

  // ---------- Chat List ----------
  useEffect(() => {
    if (!currentUid) return;
    const chatsRef = dbRef(db, `userChats/${currentUid}`);
    return onValue(chatsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const chatArray = Object.entries(data).map(([chatId, chat]) => ({
          chatId,
          ...chat,
        }));
        setChats(chatArray);
      } else setChats([]);
    });
  }, [currentUid]);

  // ---------- Fetch chat partner ----------
  useEffect(() => {
    if (!uid) return;
    const userRef = dbRef(db, `usersData/${uid}`);
    return onValue(userRef, (snap) => {
      if (snap.exists()) {
        const userData = snap.val();
        setChatUser(userData);
        
        if (currentUid && !currentUid.startsWith('guest_')) {
          const chatRef = dbRef(db, `userChats/${currentUid}/${chatId}`);
          update(chatRef, {
            lastMessage: `Chat with ${userData.username}`,
            timestamp: serverTimestamp(),
            partnerPhoto: userData.photoURL,
            partnerName: userData.username
          }).catch(console.warn);
        }
      }
    });
  }, [uid, currentUid, chatId]);

  // ---------- Partner presence ----------
  useEffect(() => {
    if (!uid) return;
    const statusRef = dbRef(db, `status/${uid}`);
    return onValue(statusRef, (snap) => setPartnerStatus(snap.val()));
  }, [uid]);

  // ---------- Listen messages ----------
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    const messagesRef = dbRef(db, `chats/${chatId}/messages`);
    return onValue(messagesRef, (snap) => {
      const data = snap.val();
      const msgs = data
        ? Object.entries(data)
          .map(([id, msg]) => ({
            id,
            ...msg,
            timestamp: msg.timestamp || Date.now(),
          }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        : [];
      setMessages(msgs);
      markMessagesDeliveredOrSeen(msgs);
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    });
  }, [chatId]);

  // ---------- Typing ----------
  useEffect(() => {
    if (!chatId) return;
    const typingRef = dbRef(db, `chats/${chatId}/typing`);
    return onValue(typingRef, (snap) => setTypingUsers(snap.val() || {}));
  }, [chatId]);

  const setTyping = useCallback(
    (typing) => {
      if (!chatId || !currentUid) return;
      if (typing) {
        set(dbRef(db, `chats/${chatId}/typing/${currentUid}`), true).catch(
          console.warn
        );
      } else {
        remove(dbRef(db, `chats/${chatId}/typing/${currentUid}`)).catch(
          console.warn
        );
      }
    },
    [chatId, currentUid]
  );

  const handleInputChange = (text) => {
    setInput(text);
    if (!chatId || !currentUid) return;

    if (!isTyping && text) {
      setIsTyping(true);
      setTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTyping(false);
    }, 1500);
  };

  // ---------- Send Message with Enhanced Notifications ----------
  const sendMessage = async (opts = {}) => {
    if (!currentUid || !chatId) return;
    const text = opts.text ?? input.trim();
    if (!text && !opts.imageURL) return;

    setInput("");
    setReplyTo(null);
    setPreviewImage(null);
    setEditingMsgId(null);

    setIsTyping(false);
    setTyping(false);

    const msgPayload = {
      sender: currentUid,
      text: text || "",
      imageURL: opts.imageURL || null,
      replyTo: opts.replyTo || replyTo?.id || null,
      reactions: {},
      timestamp: serverTimestamp(),
      deletedFor: [],
      status: "sent",
      read: false,
    };

    try {
      if (editingMsgId) {
        await update(
          dbRef(db, `chats/${chatId}/messages/${editingMsgId}`),
          { text }
        );
      } else {
        const pushed = await push(dbRef(db, `chats/${chatId}/messages`), msgPayload);

        const recipientUid = uid;
        if (recipientUid && !recipientUid.startsWith("guest_")) {
          console.log('🚀 Sending notification to:', recipientUid);
          
          const notifRef = push(dbRef(db, `notifications/${recipientUid}`));
          const notifObj = {
            type: "message",
            fromId: currentUid,
            chatId: chatId,
            messageId: pushed.key,
            text: (text || (opts.imageURL ? "📷 Image" : "Message")).slice(0, 200),
            timestamp: serverTimestamp(),
            seen: false,
            senderName: chatUser?.username || "User",
            senderPhoto: chatUser?.photoURL || "/logo.png",
            pushTitle: "New Message",
            pushBody: `${chatUser?.username || "Someone"}: ${text || "Sent a photo"}`,
            pushImage: chatUser?.photoURL,
            pushUrl: `/messages/${currentUid}`
          };
          
          await set(notifRef, notifObj);
          console.log('✅ Notification saved to database');

          const updateChat = async (userId, partnerId, partnerData) => {
            const userChatRef = dbRef(db, `userChats/${userId}/${chatId}`);
            await set(userChatRef, {
              lastMessage: text || "📷 Image",
              timestamp: serverTimestamp(),
              partnerId: partnerId,
              partnerPhoto: partnerData?.photoURL,
              partnerName: partnerData?.username,
              unread: userId !== currentUid ? 1 : 0,
              lastMessageTime: Date.now()
            });
          };

          await updateChat(currentUid, uid, chatUser);
          
          if (currentUid && !currentUid.startsWith('guest_')) {
            const currentUserData = {
              username: auth.currentUser?.displayName || "You", 
              photoURL: auth.currentUser?.photoURL || "/logo.png"
            };
            await updateChat(uid, currentUid, currentUserData);
          }

          await triggerPushNotification(recipientUid, {
            title: "New Message 💬",
            body: `${chatUser?.username || "Someone"}: ${text || "Sent a photo"}`,
            image: chatUser?.photoURL,
            data: {
              url: `/messages/${currentUid}`,
              chatId: chatId,
              fromId: currentUid,
              type: "message"
            }
          });
        }
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error("sendMessage error:", err);
    }
  };

  // ---------- Cloudinary Upload ----------
  const handleImageUpload = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);

    setUploadProgress(0);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            setUploadProgress(percent);
          },
        }
      );
      await sendMessage({ imageURL: res.data.secure_url });
      setPreviewImage(null);
    } catch (err) {
      console.error(err);
      alert("Image upload failed. Please try again.");
    }
    setIsUploading(false);
  };

  // ---------- Long Press ----------
  const startLongPress = (e, msgId) => {
    e.preventDefault?.();
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsgId(msgId);
      setTimeout(() => setSelectedMsgId(null), 3000);
    }, 500);
  };
  const cancelLongPress = () => clearTimeout(longPressTimerRef.current);
  useEffect(() => {
    const handleClickOutside = () => setSelectedMsgId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // ---------- Delete ----------
  const removeForMe = async (msgId) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !currentUid || !chatId) return;
    const deletedForRef = dbRef(db, `chats/${chatId}/messages/${msg.id}/deletedFor`);
    const updated = msg.deletedFor?.includes(currentUid)
      ? msg.deletedFor
      : [...(msg.deletedFor || []), currentUid];
    await set(deletedForRef, updated);
    setSelectedMsgId(null);
  };

  const deleteForEveryone = async (msgId) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !chatId) return;
    if (msg.sender === currentUid) {
      await remove(dbRef(db, `chats/${chatId}/messages/${msg.id}`));
    } else {
      await removeForMe(msgId);
    }
    setSelectedMsgId(null);
  };

  // ---------- Status Update ----------
  const markMessagesDeliveredOrSeen = async (msgs) => {
    if (!chatId || !currentUid) return;
    const updates = {};
    msgs.forEach((m) => {
      if (m.sender === currentUid) return;
      if (m.status !== "seen") {
        updates[`chats/${chatId}/messages/${m.id}/status`] = "seen";
        updates[`chats/${chatId}/messages/${m.id}/read`] = true;
      }
    });
    if (Object.keys(updates).length) {
      await update(dbRef(db), updates);
    }
  };

  const renderStatus = (msg) => {
    if (msg.sender !== currentUid) return null;
    const s = msg.status || "sent";
    return s === "sent" ? "✓" : s === "delivered" ? "✓✓" : "✓✓ (seen)";
  };

  const formatTime = (ts) => {
    if (!ts) return "";

    let date;
    if (typeof ts === 'number') {
      date = new Date(ts);
    } else if (ts.toDate) {
      date = ts.toDate();
    } else if (ts.seconds) {
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(ts);
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const addEmoji = (emoji) => {
    setInput((prev) => prev + emoji.emoji);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev);
    if (window.innerWidth <= 768) {
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    }
  };

  // ---------- Reply Logic ----------
  const renderReplyPreview = (msg) => {
    if (!msg.replyTo) return null;

    const originalMsg = messages.find(m => m.id === msg.replyTo);
    if (!originalMsg) {
      return (
        <div className="border-start border-3 ps-2 mt-1" style={{ borderColor: '#6c757d !important' }}>
          <small className="text-muted fst-italic">
            Original message deleted
          </small>
        </div>
      );
    }

    const isOriginalDeleted = originalMsg.deletedFor?.includes(currentUid);
    if (isOriginalDeleted) {
      return (
        <div className="border-start border-3 ps-2 mt-1" style={{ borderColor: '#6c757d !important' }}>
          <small className="text-muted fst-italic">
            Original message deleted
          </small>
        </div>
      );
    }

    const userName = originalMsg.sender === currentUid ? "You" : chatUser?.username || "User";

    return (
      <div className="border-start border-3 ps-2 mt-1" style={{ borderColor: '#6c757d !important' }}>
        <small className="text-muted d-block">
          <strong>Reply to {userName}</strong>
        </small>
        <small className="text-muted">
          {originalMsg.text || (originalMsg.imageURL ? "📷 Image" : "Message")}
        </small>
      </div>
    );
  };

  // ---------- Typing Indicator ----------
  const renderTypingIndicator = () => {
    const typingUserIds = Object.keys(typingUsers).filter(
      (userId) => typingUsers[userId] && userId !== currentUid
    );

    if (typingUserIds.length === 0) return null;

    return (
      <div className="d-flex justify-content-start mb-2">
        <div className="p-2 rounded bg-light text-dark">
          <div className="d-flex align-items-center">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <small className="ms-2 text-muted">
              {typingUserIds.length > 1 ? 'Several people are typing...' : `${chatUser?.username || 'Someone'} is typing...`}
            </small>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Render ----------
  if (!currentUid) return <p className="text-center mt-5">Please login</p>;

  return (
    <div
      className="container border rounded d-flex flex-column p-0"
      style={{ height: "91vh", background: "#e6f0ff" }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center bg-success text-white p-2">

        <Link
          to={`/user-profile/${uid}`}
          className="d-flex align-items-center text-white text-decoration-none"
        >
          <img
            src={chatUser?.photoURL || "icons/avatar.jpg"}
            alt="DP"
            className="rounded-circle me-2"
            style={{ width: 44, height: 44, objectFit: "cover" }}
          />
          <div>
            <div>{chatUser?.username || "User"}</div>
            {!partnerStatus?.hide && (
              <small>
                {Object.keys(typingUsers).filter(
                  (k) => typingUsers[k] && k !== currentUid
                ).length
                  ? "typing..."
                  : partnerStatus?.state === "online"
                    ? "online"
                    : partnerStatus?.last_changed
                      ? formatLastSeen(partnerStatus.last_changed)
                      : "offline"}
              </small>
            )}
          </div>
        </Link>

        {/* Three-dot menu */}
        <div className="position-relative">
          <button
            className="btn btn-sm btn-transparent text-white position-relative"
            onClick={() => setShowMenu((prev) => !prev)}
          >
            <i className="bi bi-three-dots-vertical fs-5"></i>
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                {unreadCount}
              </span>
            )}
          </button>
          {showMenu && (
            <div
              className="position-absolute bg-white text-dark shadow rounded"
              style={{ right: 0, top: 40, zIndex: 9 }}
            >
              <button
                className="py-2 px-3 dropdown-item"
                onClick={() => {
                  messages.forEach((m) => removeForMe(m.id));
                  setShowMenu(false);
                }}
              >
                Clear Chat
              </button>
              <button
                className="py-2 px-3 dropdown-item"
                onClick={() => {
                  setPrivacyHide((prev) => !prev);
                  setShowMenu(false);
                }}
              >
                {privacyHide ? "Show Online / Last Seen" : "Hide Online / Last Seen"}
              </button>
              <button
                className="py-2 px-3 dropdown-item"
                onClick={() => {
                  notificationService?.markAllAsSeen();
                  setShowMenu(false);
                }}
              >
                Mark All as Read
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow-1 overflow-auto p-2 d-flex flex-column">
        {messages.length === 0 && (
          <div className="text-center text-muted mt-2">No messages yet 👋</div>
        )}

        {messages.map((msg) =>
          msg.deletedFor?.includes(currentUid) ? null : (
            <div
              key={msg.id}
              onMouseDown={(e) => startLongPress(e, msg.id)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={(e) => startLongPress(e, msg.id)}
              onTouchEnd={cancelLongPress}
              onTouchCancel={cancelLongPress}
              className={`d-flex mb-2 ${msg.sender === currentUid ? "justify-content-end" : "justify-content-start"}`}
              style={{ userSelect: "none", position: "relative" }}
            >
              <div
                className={`p-2 rounded ${msg.sender === currentUid ? "bg-success text-white" : "bg-white text-dark"}`}
                style={{ maxWidth: "75%" }}
              >
                {/* Reply Preview */}
                {renderReplyPreview(msg)}

                {/* Message Content */}
                {msg.text && <div>{msg.text}</div>}
                {msg.imageURL && (
                  <img
                    src={msg.imageURL}
                    alt="sent"
                    className="img-fluid rounded mt-1"
                    style={{ maxHeight: "200px" }}
                  />
                )}

                {/* Timestamp and Status */}
                <div className="d-flex justify-content-between align-items-center mt-1">
                  <small className={msg.sender === currentUid ? "text-white-50" : "text-muted"}>
                    {formatTime(msg.timestamp)}
                  </small>
                  {msg.sender === currentUid && (
                    <small className="ms-2">{renderStatus(msg)}</small>
                  )}
                </div>
              </div>

              {/* Message Actions Menu */}
              {selectedMsgId === msg.id && (
                <div
                  className="position-absolute bg-white border shadow rounded p-1 small d-flex flex-column"
                  style={{
                    top: "-10px",
                    right: msg.sender === currentUid ? "120px" : "unset",
                    left: msg.sender !== currentUid ? "50px" : "unset",
                    zIndex: 10,
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  <button className="btn btn-sm btn-danger" onClick={() => removeForMe(msg.id)}>Delete for me</button>
                  {msg.sender === currentUid && (
                    <>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setEditingMsgId(msg.id); setInput(msg.text || ""); setSelectedMsgId(null); inputRef.current?.focus(); }}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteForEveryone(msg.id)}>Delete for everyone</button>
                    </>
                  )}
                  <button className="btn btn-sm btn-success" onClick={() => { setReplyTo(msg); setSelectedMsgId(null); inputRef.current?.focus(); }}>Reply</button>
                </div>
              )}
            </div>
          )
        )}

        {/* Typing Indicator */}
        {renderTypingIndicator()}

        <div ref={messagesEndRef}></div>
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="p-2 border-top bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <small className="text-muted">Replying to:</small>
              <div className="small">{replyTo.text || "Image"}</div>
            </div>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setReplyTo(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-2 mb-5 pb-3" style={{ background: "#ccf" }}>
        {previewImage && (
          <div
            className="d-inline-block p-2 mb-2 border rounded shadow-sm position-relative"
            style={{ background: "#f0f0f0", maxWidth: "200px" }}
          >
            <img
              src={previewImage}
              alt="preview"
              className="img-fluid rounded"
              style={{ maxHeight: "150px", objectFit: "cover", userSelect: "none" }}
            />
            {isUploading && (
              <div className="progress mt-1">
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${uploadProgress}%` }}
                  aria-valuenow={uploadProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {uploadProgress}%
                </div>
              </div>
            )}
            <button
              className="btn btn-sm btn-danger position-absolute top-0 end-0"
              style={{ transform: "translate(50%, -50%)" }}
              onClick={() => setPreviewImage(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="d-flex align-items-center gap-2">
          {/* Camera Button with Permission Check */}
          <button
            className="btn btn-light"
            onClick={handleCameraClick}
            type="button"
            title={hasCameraPermission ? "Take Photo" : "Camera Permission Required"}
          >
            📷
          </button>

          {/* Emoji Button */}
          <button
            className="btn btn-light"
            onClick={toggleEmojiPicker}
            type="button"
          >
            😀
          </button>

          {/* Input Field */}
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder={editingMsgId ? "Editing message..." : replyTo ? "Type a reply..." : "Type a message..."}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            inputMode="text"
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
          />

          {/* Microphone Button with Permission Check */}
          <button
            className="btn btn-light"
            onClick={handleMicrophoneClick}
            type="button"
            title={hasMicrophonePermission ? "Voice Message" : "Microphone Permission Required"}
          >
            🎤
          </button>

          <label className="btn btn-light mb-0">
            📎
            <input
              type="file"
              accept="image/*"
              className="d-none"
              onChange={(e) => handleImageUpload(e.target.files[0])}
            />
          </label>

          <button
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={!input.trim() && !previewImage}
          >
            {editingMsgId ? "Update" : "➤"}
          </button>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && window.innerWidth > 768 && (
          <div
            className="position-absolute"
            style={{ bottom: "100%", left: 0, zIndex: 999 }}
          >
            <Picker onEmojiClick={addEmoji} />
          </div>
        )}
      </div>

      {/* Debug buttons */}
      <div className="position-fixed" style={{ bottom: '120px', right: '20px', zIndex: 1000 }}>
        <button 
          onClick={debugFCMStatus} 
          className="btn btn-info btn-sm me-2 mb-1"
          style={{ fontSize: '12px', padding: '5px 10px' }}
        >
          🔍 FCM Debug
        </button>
        <button 
          onClick={testNotification} 
          className="btn btn-warning btn-sm me-2 mb-1"
          style={{ fontSize: '12px', padding: '5px 10px' }}
        >
          🧪 Test Notifs
        </button>
        <button 
          onClick={debugNotificationCheck} 
          className="btn btn-secondary btn-sm me-2 mb-1"
          style={{ fontSize: '12px', padding: '5px 10px' }}
        >
          📨 Notif Check
        </button>
        <button 
          onClick={emergencyNotificationTest} 
          className="btn btn-danger btn-sm mb-1"
          style={{ fontSize: '12px', padding: '5px 10px' }}
        >
          🚨 Emergency Test
        </button>
      </div>

      {/* Camera Permission Modal */}
      {showCameraModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">📷 Camera Access Required</h5>
            </div>
            <div className="modal-body">
              <p>Jibzo needs camera access to let you take photos and share them with friends.</p>
              <div className="permission-features">
                <div className="feature">✅ Take photos in chat</div>
                <div className="feature">✅ Share instant pictures</div>
                <div className="feature">✅ Better messaging experience</div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowCameraModal(false)}
              >
                Not Now
              </button>
              <button 
                className="btn btn-primary" 
                onClick={requestCameraPermission}
              >
                Allow Camera Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Microphone Permission Modal */}
      {showMicrophoneModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">🎤 Microphone Access Required</h5>
            </div>
            <div className="modal-body">
              <p>Jibzo needs microphone access for voice messages and audio calls.</p>
              <div className="permission-features">
                <div className="feature">✅ Send voice messages</div>
                <div className="feature">✅ Make audio calls</div>
                <div className="feature">✅ Better communication</div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowMicrophoneModal(false)}
              >
                Not Now
              </button>
              <button 
                className="btn btn-primary" 
                onClick={requestMicrophonePermission}
              >
                Allow Microphone Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for typing dots and notifications */}
      <style>
        {`
          .typing-dots {
            display: inline-flex;
            gap: 2px;
          }
          .typing-dots span {
            height: 6px;
            width: 6px;
            border-radius: 50%;
            background-color: #6c757d;
            animation: typing 1.4s infinite ease-in-out;
          }
          .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
          .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
          @keyframes typing {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
          
          /* Mobile optimizations */
          @media (max-width: 768px) {
            .container {
              height: 100vh !important;
            }
            input.form-control {
              font-size: 16px;
            }
          }

          /* Notification badge */
          .badge {
            font-size: 0.6rem;
            padding: 0.25em 0.4em;
          }

          /* Custom scrollbar */
          .overflow-auto::-webkit-scrollbar {
            width: 6px;
          }
          .overflow-auto::-webkit-scrollbar-track {
            background: #f1f1f1;
          }
          .overflow-auto::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
          }
          .overflow-auto::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }

          /* Permission Modals */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
          }
          
          .modal-content {
            background: white;
            border-radius: 12px;
            padding: 0;
            max-width: 400px;
            width: 90%;
            animation: modalSlideIn 0.3s ease;
          }
          
          .modal-header {
            padding: 20px 20px 10px;
            border-bottom: none;
            text-align: center;
          }
          
          .modal-body {
            padding: 10px 20px;
          }
          
          .modal-footer {
            padding: 20px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
          }
          
          .permission-features {
            margin: 15px 0;
          }
          
          .feature {
            padding: 8px 0;
            color: #666;
          }
          
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
}

// ---------- Last Seen Formatter ----------
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "offline";

  let lastSeenDate;
  if (typeof timestamp === 'number') {
    lastSeenDate = new Date(timestamp);
  } else if (timestamp.toDate) {
    lastSeenDate = timestamp.toDate();
  } else if (timestamp.seconds) {
    lastSeenDate = new Date(timestamp.seconds * 1000);
  } else {
    lastSeenDate = new Date(timestamp);
  }

  const now = new Date();
  const diffMs = now - lastSeenDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "last seen just now";
  if (diffMins < 60) return `last seen ${diffMins} min ago`;
  if (diffHours < 24) return `last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `last seen ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return `last seen ${lastSeenDate.toLocaleDateString()}`;
};