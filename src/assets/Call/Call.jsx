import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref,
  set,
  remove,
  onValue,
  serverTimestamp,
} from "firebase/database";
import { FaPhoneSlash } from "react-icons/fa";

export default function Call({ callerId, receiverId, callType, onEnd }) {
  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const peerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isCaller, setIsCaller] = useState(false);
  const callRef = ref(db, `calls/${receiverId}`);
  const myCallRef = ref(db, `calls/${callerId}`);

  // 🔹 Start call (caller side)
  useEffect(() => {
    const start = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: callType === "video",
          audio: true,
        });
        setStream(mediaStream);
        if (myVideo.current) {
          myVideo.current.srcObject = mediaStream;
        }

        // caller
        setIsCaller(true);
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: mediaStream,
        });

        peer.on("signal", (data) => {
          set(callRef, {
            from: callerId,
            type: callType,
            signal: data,
            createdAt: serverTimestamp(),
          });
        });

        peer.on("stream", (remoteStream) => {
          if (userVideo.current) {
            userVideo.current.srcObject = remoteStream;
          }
        });

        peerRef.current = peer;
      } catch (err) {
        console.error("Media error", err);
        endCall();
      }
    };

    start();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line
  }, []);

  // 🔹 Listen for incoming signal (receiver side)
  useEffect(() => {
    const unsub = onValue(callRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.from !== callerId) {
        // Receiver accepts
        handleAnswer(data.signal);
      }
    });

    return () => unsub();
    // eslint-disable-next-line
  }, []);

  // 🔹 Receiver accepts the call
  const handleAnswer = async (callerSignal) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: true,
      });
      setStream(mediaStream);
      if (myVideo.current) {
        myVideo.current.srcObject = mediaStream;
      }

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
      });

      peer.on("signal", (data) => {
        set(myCallRef, {
          from: callerId,
          type: callType,
          signal: data,
          createdAt: serverTimestamp(),
        });
      });

      peer.on("stream", (remoteStream) => {
        if (userVideo.current) {
          userVideo.current.srcObject = remoteStream;
        }
      });

      peer.signal(callerSignal);

      peerRef.current = peer;
    } catch (err) {
      console.error("Answer error", err);
      endCall();
    }
  };

  // 🔴 End Call
  const endCall = () => {
    cleanup();
    if (onEnd) onEnd();
  };

  // Cleanup streams + firebase
  const cleanup = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    remove(callRef);
    remove(myCallRef);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        position: "relative",
      }}
    >
      {/* Remote video */}
      <video
        ref={userVideo}
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* My video (small corner window) */}
      <video
        ref={myVideo}
        autoPlay
        muted
        playsInline
        style={{
          width: "150px",
          height: "200px",
          position: "absolute",
          bottom: 20,
          right: 20,
          borderRadius: "10px",
          background: "#000",
        }}
      />

      {/* End call button */}
      <button
        onClick={endCall}
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "red",
          borderRadius: "50%",
          padding: "15px",
          border: "none",
          cursor: "pointer",
        }}
      >
        <FaPhoneSlash color="#fff" size={24} />
      </button>
    </div>
  );
}
