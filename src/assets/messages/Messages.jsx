import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref as dbRef,
  onValue,
  push,
  set,
  remove,
  update,
  serverTimestamp,
  onDisconnect,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Picker from "emoji-picker-react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

// Permissions Manager (Single File)
class PermissionsManager {
  constructor() {
    this.permissions = {
      camera: 'prompt',
      microphone: 'prompt', 
      notifications: 'prompt',
      location: 'prompt',
      storage: 'prompt'
    };
    this.listeners = new Map();
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    await this.checkAllPermissions();
    await this.requestEssentialPermissions();
  }

  async checkAllPermissions() {
    await Promise.allSettled([
      this.checkCameraPermission(),
      this.checkMicrophonePermission(),
      this.checkNotificationPermission(),
      this.checkLocationPermission(),
      this.checkStoragePermission()
    ]);
    return this.permissions;
  }

  async checkCameraPermission() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return this.permissions.camera = 'unsupported';
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      this.permissions.camera = hasCamera ? 'prompt' : 'unsupported';
      return this.permissions.camera;
    } catch (error) {
      return this.permissions.camera = 'error';
    }
  }

  async checkMicrophonePermission() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return this.permissions.microphone = 'unsupported';
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(device => device.kind === 'audioinput');
      this.permissions.microphone = hasMic ? 'prompt' : 'unsupported';
      return this.permissions.microphone;
    } catch (error) {
      return this.permissions.microphone = 'error';
    }
  }

  async checkNotificationPermission() {
    if (!('Notification' in window)) {
      return this.permissions.notifications = 'unsupported';
    }
    this.permissions.notifications = Notification.permission;
    return this.permissions.notifications;
  }

  async checkLocationPermission() {
    if (!navigator.geolocation) {
      return this.permissions.location = 'unsupported';
    }
    return this.permissions.location = 'prompt';
  }

  async checkStoragePermission() {
    if (!navigator.storage?.estimate) {
      return this.permissions.storage = 'unsupported';
    }
    return this.permissions.storage = 'granted';
  }

  async requestEssentialPermissions() {
    try {
      if (this.permissions.notifications === 'default') {
        setTimeout(async () => {
          try {
            await this.requestNotificationPermission();
          } catch (error) {
            console.log('User declined notifications');
          }
        }, 3000);
      }
      console.log('✅ Essential permissions initialized');
    } catch (error) {
      console.warn('Permission initialization warning:', error);
    }
  }

  async requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      this.permissions.camera = 'granted';
      this.notifyListeners('camera', 'granted');
      return 'granted';
    } catch (error) {
      const status = error.name === 'NotAllowedError' ? 'denied' : 'error';
      this.permissions.camera = status;
      this.notifyListeners('camera', status);
      throw error;
    }
  }

  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.permissions.microphone = 'granted';
      this.notifyListeners('microphone', 'granted');
      return 'granted';
    } catch (error) {
      const status = error.name === 'NotAllowedError' ? 'denied' : 'error';
      this.permissions.microphone = status;
      this.notifyListeners('microphone', status);
      throw error;
    }
  }

  async requestCameraAndMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      this.currentStream = stream;
      this.permissions.camera = 'granted';
      this.permissions.microphone = 'granted';
      this.notifyListeners('camera', 'granted');
      this.notifyListeners('microphone', 'granted');
      return stream;
    } catch (error) {
      const status = error.name === 'NotAllowedError' ? 'denied' : 'error';
      this.permissions.camera = status;
      this.permissions.microphone = status;
      this.notifyListeners('camera', status);
      this.notifyListeners('microphone', status);
      throw error;
    }
  }

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }
    const permission = await Notification.requestPermission();
    this.permissions.notifications = permission;
    this.notifyListeners('notifications', permission);
    return permission;
  }

  getPermission(permissionType) {
    return this.permissions[permissionType] || 'unknown';
  }

  getAllPermissions() {
    return { ...this.permissions };
  }

  isGranted(permissionType) {
    return this.permissions[permissionType] === 'granted';
  }

  async requestMultiplePermissions(permissions) {
    const results = {};
    for (const permission of permissions) {
      try {
        switch (permission) {
          case 'camera':
            results.camera = await this.requestCameraPermission();
            break;
          case 'microphone':
            results.microphone = await this.requestMicrophonePermission();
            break;
          case 'camera+microphone':
            await this.requestCameraAndMicrophone();
            results.camera = 'granted';
            results.microphone = 'granted';
            break;
          case 'notifications':
            results.notifications = await this.requestNotificationPermission();
            break;
        }
      } catch (error) {
        results[permission] = 'error';
      }
    }
    return results;
  }

  showPermissionPrompt(permissionType, callback) {
    const descriptions = {
      camera: { title: 'Camera Access', description: 'Required for video calls and photos', icon: '📷' },
      microphone: { title: 'Microphone Access', description: 'Required for audio calls and voice messages', icon: '🎤' },
      notifications: { title: 'Notifications', description: 'Get notified about new messages and calls', icon: '🔔' }
    };

    const desc = descriptions[permissionType];
    if (!desc) return;

    const userChoice = confirm(
      `${desc.icon} ${desc.title}\n\n${desc.description}\n\nClick OK to allow, Cancel to skip.`
    );

    if (userChoice) {
      callback(true);
    } else {
      callback(false);
    }
  }

  addListener(permissionType, callback) {
    if (!this.listeners.has(permissionType)) {
      this.listeners.set(permissionType, new Set());
    }
    this.listeners.get(permissionType).add(callback);
  }

  removeListener(permissionType, callback) {
    const listeners = this.listeners.get(permissionType);
    if (listeners) listeners.delete(callback);
  }

  notifyListeners(permissionType, status) {
    const listeners = this.listeners.get(permissionType);
    if (listeners) {
      listeners.forEach(callback => callback(status, permissionType));
    }
  }

  cleanup() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    this.listeners.clear();
  }
}

// Create global permissions instance
const permissionsManager = new PermissionsManager();

// Video/Audio Call Components
const CallModal = ({ 
  callType, 
  isIncoming, 
  callerInfo, 
  onAccept, 
  onReject, 
  onEndCall,
  callStatus 
}) => {
  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              {callType === 'video' ? '📹' : '📞'} 
              {isIncoming ? 'Incoming Call' : 'Outgoing Call'}
            </h5>
          </div>
          <div className="modal-body text-center">
            <img
              src={callerInfo?.photoURL || "icons/avatar.jpg"}
              alt="Caller"
              className="rounded-circle mb-3"
              style={{ width: 80, height: 80, objectFit: "cover" }}
            />
            <h4>{callerInfo?.username || "User"}</h4>
            <p className="text-muted">{callStatus}</p>
            
            {callType === 'video' ? (
              <p>Video Call {isIncoming ? 'from' : 'to'} {callerInfo?.username}</p>
            ) : (
              <p>Audio Call {isIncoming ? 'from' : 'to'} {callerInfo?.username}</p>
            )}
          </div>
          <div className="modal-footer justify-content-center">
            {isIncoming ? (
              <>
                <button 
                  className="btn btn-danger btn-lg rounded-circle mx-2"
                  onClick={onReject}
                >
                  ❌
                </button>
                <button 
                  className="btn btn-success btn-lg rounded-circle mx-2"
                  onClick={onAccept}
                >
                  📞
                </button>
              </>
            ) : (
              <button 
                className="btn btn-danger btn-lg"
                onClick={onEndCall}
              >
                End Call
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CallScreen = ({ 
  callType, 
  localStream, 
  remoteStream, 
  onEndCall, 
  isMuted, 
  onToggleMute,
  isVideoOff,
  onToggleVideo,
  callDuration,
  partnerInfo
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark" style={{ zIndex: 9999 }}>
      {/* Remote Video (Main) */}
      {callType === 'video' && remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-100 h-100"
          style={{ objectFit: 'cover' }}
        />
      )}
      
      {/* Local Video (Picture-in-picture) */}
      {callType === 'video' && localStream && (
        <div className="position-absolute top-0 end-0 m-3" style={{ width: '120px', height: '160px' }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-100 h-100 rounded shadow"
            style={{ objectFit: 'cover' }}
          />
        </div>
      )}
      
      {/* Audio Call UI */}
      {callType === 'audio' && (
        <div className="d-flex flex-column justify-content-center align-items-center h-100 text-white">
          <img
            src={partnerInfo?.photoURL || "icons/avatar.jpg"}
            alt="Caller"
            className="rounded-circle mb-3"
            style={{ width: 120, height: 120, objectFit: "cover" }}
          />
          <h3>{partnerInfo?.username || "User"}</h3>
          <p className="fs-5">{formatTime(callDuration)}</p>
          <p className="text-muted">Audio Call</p>
        </div>
      )}

      {/* Call Controls */}
      <div className="position-absolute bottom-0 start-50 translate-middle-x mb-4">
        <div className="d-flex gap-3">
          <button
            className={`btn btn-lg rounded-circle ${isMuted ? 'btn-danger' : 'btn-light'}`}
            onClick={onToggleMute}
          >
            {isMuted ? '🎤❌' : '🎤'}
          </button>
          
          {callType === 'video' && (
            <button
              className={`btn btn-lg rounded-circle ${isVideoOff ? 'btn-danger' : 'btn-light'}`}
              onClick={onToggleVideo}
            >
              {isVideoOff ? '📹❌' : '📹'}
            </button>
          )}
          
          <button
            className="btn btn-danger btn-lg rounded-circle"
            onClick={onEndCall}
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
};

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

  // Call States
  const [callState, setCallState] = useState(null);
  const [callType, setCallType] = useState(null);
  const [callData, setCallData] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);

  const messagesEndRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callDurationRef = useRef(null);

  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const chatId = currentUid && uid ? [currentUid, uid].sort().join("_") : null;

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize permissions when component mounts
  useEffect(() => {
    permissionsManager.init().then(() => {
      console.log('Permissions initialized in Messages component');
    });
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
    window.addEventListener("blur", () => updateStatus("offline"));
    onDisconnect(statusRef).set({
      state: "offline",
      last_changed: serverTimestamp(),
      hide: privacyHide,
      guest: currentUid.startsWith("guest_"),
    });
    return () => {
      window.removeEventListener("focus", () => updateStatus("online"));
      window.removeEventListener("blur", () => updateStatus("offline"));
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
      if (snap.exists()) setChatUser(snap.val());
    });
  }, [uid]);

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

  // ---------- Send Message ----------
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
          const floatingEvent = new CustomEvent('showFloatingNotification', {
            detail: {
              title: "New Message",
              body: `${chatUser?.username || "Someone"}: ${text || "Sent an image"}`,
              image: chatUser?.photoURL || '/logo.png',
              url: `/messages/${currentUid}`
            }
          });
          window.dispatchEvent(floatingEvent);

          const notifRef = push(dbRef(db, `notifications/${recipientUid}`));
          const notifObj = {
            type: "message",
            fromId: currentUid,
            chatId,
            text: (text || (opts.imageURL ? "Image" : "")).slice(0, 200),
            timestamp: serverTimestamp(),
            seen: false
          };
          await set(notifRef, notifObj);
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
      updates[`chats/${chatId}/messages/${m.id}/status`] = "seen";
      updates[`chats/${chatId}/messages/${m.id}/read`] = true;
    });
    if (Object.keys(updates).length) await update(dbRef(db), updates);
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

  // ---------- Enhanced Call Management with Permissions ----------
  const initializeCall = async (type) => {
    if (!chatId || !currentUid || !uid) return;

    try {
      // Check permissions first
      if (type === 'video') {
        if (!permissionsManager.isGranted('camera') || !permissionsManager.isGranted('microphone')) {
          permissionsManager.showPermissionPrompt('camera', async (allowed) => {
            if (allowed) {
              try {
                await permissionsManager.requestCameraAndMicrophone();
                proceedWithCall(type);
              } catch (error) {
                alert('Camera and microphone access is required for video calls.');
              }
            }
          });
          return;
        }
      } else {
        if (!permissionsManager.isGranted('microphone')) {
          permissionsManager.showPermissionPrompt('microphone', async (allowed) => {
            if (allowed) {
              try {
                await permissionsManager.requestMicrophonePermission();
                proceedWithCall(type);
              } catch (error) {
                alert('Microphone access is required for audio calls.');
              }
            }
          });
          return;
        }
      }

      await proceedWithCall(type);
    } catch (error) {
      console.error('Error initializing call:', error);
      alert('Error starting call. Please check your camera/microphone permissions.');
    }
  };

  const proceedWithCall = async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: true
    });
    
    setLocalStream(stream);
    setCallType(type);
    setCallState('outgoing');

    const callId = `call_${Date.now()}`;
    const callData = {
      callId,
      callerId: currentUid,
      receiverId: uid,
      type,
      status: 'calling',
      timestamp: serverTimestamp()
    };

    const callRef = dbRef(db, `calls/${chatId}/${callId}`);
    await set(callRef, callData);

    await createPeerConnection(stream, callId);
  };

  const createPeerConnection = async (stream, callId) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateRef = dbRef(db, `calls/${chatId}/${callId}/candidates/${currentUid}`);
          push(candidateRef, event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerRef = dbRef(db, `calls/${chatId}/${callId}/offer`);
      await set(offerRef, offer);

    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  };

  const answerCall = async (callData) => {
    try {
      // Check permissions before answering
      if (callData.type === 'video') {
        if (!permissionsManager.isGranted('camera') || !permissionsManager.isGranted('microphone')) {
          permissionsManager.showPermissionPrompt('camera', async (allowed) => {
            if (allowed) {
              try {
                await permissionsManager.requestCameraAndMicrophone();
                proceedWithAnswer(callData);
              } catch (error) {
                alert('Camera and microphone access is required for video calls.');
                rejectCall(callData);
              }
            } else {
              rejectCall(callData);
            }
          });
          return;
        }
      } else {
        if (!permissionsManager.isGranted('microphone')) {
          permissionsManager.showPermissionPrompt('microphone', async (allowed) => {
            if (allowed) {
              try {
                await permissionsManager.requestMicrophonePermission();
                proceedWithAnswer(callData);
              } catch (error) {
                alert('Microphone access is required for audio calls.');
                rejectCall(callData);
              }
            } else {
              rejectCall(callData);
            }
          });
          return;
        }
      }

      await proceedWithAnswer(callData);
    } catch (error) {
      console.error('Error answering call:', error);
      rejectCall(callData);
    }
  };

  const proceedWithAnswer = async (callData) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: callData.type === 'video',
      audio: true
    });

    setLocalStream(stream);
    setCallType(callData.type);
    setCallState('active');
    setCallData(callData);

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateRef = dbRef(db, `calls/${chatId}/${callData.callId}/candidates/${currentUid}`);
        push(candidateRef, event.candidate.toJSON());
      }
    };

    const offerRef = dbRef(db, `calls/${chatId}/${callData.callId}/offer`);
    onValue(offerRef, async (snap) => {
      if (snap.exists()) {
        await pc.setRemoteDescription(snap.val());
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const answerRef = dbRef(db, `calls/${chatId}/${callData.callId}/answer`);
        await set(answerRef, answer);
      }
    });

    const candidateRef = dbRef(db, `calls/${chatId}/${callData.callId}/candidates/${callData.callerId}`);
    onValue(candidateRef, (snap) => {
      snap.forEach((childSnap) => {
        const candidate = childSnap.val();
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
    });

    const callRef = dbRef(db, `calls/${chatId}/${callData.callId}`);
    await update(callRef, { status: 'active' });

    startCallTimer();
  };

  const endCall = async () => {
    if (callDurationRef.current) {
      clearInterval(callDurationRef.current);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);

    if (callData && chatId) {
      const callRef = dbRef(db, `calls/${chatId}/${callData.callId}`);
      await update(callRef, { 
        status: 'ended',
        endedAt: serverTimestamp(),
        duration: callDuration
      });
    }

    setCallState(null);
    setCallType(null);
    setCallData(null);
    setCallDuration(0);
    setCallStartTime(null);
  };

  const rejectCall = async (callData) => {
    if (callData && chatId) {
      const callRef = dbRef(db, `calls/${chatId}/${callData.callId}`);
      await update(callRef, { 
        status: 'rejected',
        endedAt: serverTimestamp()
      });
    }
    setCallState(null);
    setCallData(null);
  };

  const startCallTimer = () => {
    setCallStartTime(Date.now());
    callDurationRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // ---------- Listen for incoming calls ----------
  useEffect(() => {
    if (!chatId || !currentUid) return;

    const callsRef = dbRef(db, `calls/${chatId}`);
    return onValue(callsRef, (snap) => {
      if (snap.exists()) {
        const calls = snap.val();
        const activeCall = Object.entries(calls).find(([callId, call]) => 
          call.status === 'calling' && call.receiverId === currentUid
        );

        if (activeCall && callState === null) {
          const [callId, callData] = activeCall;
          setCallData({ ...callData, callId });
          setCallState('incoming');
          setCallType(callData.type);
        }
      }
    });
  }, [chatId, currentUid, callState]);

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

        <div className="d-flex align-items-center gap-2">
          {/* Call Buttons */}
          <button
            className="btn btn-sm btn-light rounded-circle"
            onClick={() => initializeCall('audio')}
            title="Audio Call"
            disabled={callState !== null}
          >
            📞
          </button>
          <button
            className="btn btn-sm btn-light rounded-circle"
            onClick={() => initializeCall('video')}
            title="Video Call"
            disabled={callState !== null}
          >
            📹
          </button>

          {/* Three-dot menu */}
          <div className="position-relative">
            <button
              className="btn btn-sm btn-transparent text-white"
              onClick={() => setShowMenu((prev) => !prev)}
            >
              <i className="bi bi-three-dots-vertical fs-5"></i>
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
              </div>
            )}
          </div>
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
          <button
            className="btn btn-light"
            onClick={toggleEmojiPicker}
            type="button"
          >
            😀
          </button>

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

        {showEmojiPicker && window.innerWidth > 768 && (
          <div
            className="position-absolute"
            style={{ bottom: "100%", left: 0, zIndex: 999 }}
          >
            <Picker onEmojiClick={addEmoji} />
          </div>
        )}
      </div>

      {/* Call Modals */}
      {callState === 'incoming' && (
        <CallModal
          callType={callType}
          isIncoming={true}
          callerInfo={chatUser}
          onAccept={() => answerCall(callData)}
          onReject={() => rejectCall(callData)}
          callStatus="Incoming Call"
        />
      )}

      {callState === 'outgoing' && (
        <CallModal
          callType={callType}
          isIncoming={false}
          callerInfo={chatUser}
          onEndCall={endCall}
          callStatus="Calling..."
        />
      )}

      {callState === 'active' && (
        <CallScreen
          callType={callType}
          localStream={localStream}
          remoteStream={remoteStream}
          onEndCall={endCall}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          isVideoOff={isVideoOff}
          onToggleVideo={toggleVideo}
          callDuration={callDuration}
          partnerInfo={chatUser}
        />
      )}

      {/* CSS for typing dots */}
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

          /* Call specific styles */
          .call-controls {
            backdrop-filter: blur(10px);
            background: rgba(0, 0, 0, 0.7);
          }

          .video-pip {
            border: 2px solid white;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }

          @keyframes ring {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(5deg); }
            75% { transform: rotate(-5deg); }
          }

          .ringing {
            animation: ring 0.5s ease-in-out infinite;
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