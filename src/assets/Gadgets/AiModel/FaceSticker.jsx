// src\assets\Gadgets\AiModel\FaceSticker.jsx
import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

export default function FaceSticker() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [sticker, setSticker] = useState("😎");
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);

  const stickers = ["😎", "🤓", "👻", "🦊", "🐶", "👑", "😈", "👽"];

  useEffect(() => {
    const initializeFaceMesh = async () => {
      if (!webcamRef.current || !canvasRef.current) return;

      // Wait for webcam to be ready
      if (webcamRef.current.video.readyState !== 4) {
        setTimeout(initializeFaceMesh, 100);
        return;
      }

      // Initialize FaceMesh
      faceMeshRef.current = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      faceMeshRef.current.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMeshRef.current.onResults(onResults);

      // Initialize Camera
      cameraRef.current = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (faceMeshRef.current) {
            await faceMeshRef.current.send({ image: webcamRef.current.video });
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current.start();
    };

    const onResults = (results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (!canvas || !ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw webcam feed
      if (results.image) {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      }

      // Draw stickers on face landmarks
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // Nose tip (landmark 1)
        const noseX = landmarks[1].x * canvas.width;
        const noseY = landmarks[1].y * canvas.height;
        
        // Forehead (landmark 10)
        const foreheadX = landmarks[10].x * canvas.width;
        const foreheadY = landmarks[10].y * canvas.height;
        
        // Between eyes (landmark 168)
        const betweenEyesX = landmarks[168].x * canvas.width;
        const betweenEyesY = landmarks[168].y * canvas.height;

        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        
        switch(sticker) {
          case "👑": // Crown on forehead
            ctx.fillText("👑", foreheadX, foreheadY - 50);
            break;
          case "🤓": // Nerd glasses between eyes
            ctx.fillText("🤓", betweenEyesX, betweenEyesY);
            break;
          case "👻": // Ghost above head
            ctx.fillText("👻", foreheadX, foreheadY - 80);
            break;
          case "🦊": // Fox on nose
            ctx.fillText("🦊", noseX, noseY);
            break;
          case "🐶": // Dog on nose
            ctx.fillText("🐶", noseX, noseY);
            break;
          default: // Default on nose
            ctx.fillText(sticker, noseX, noseY);
        }
      }

      ctx.restore();
    };

    initializeFaceMesh();

    // Cleanup function
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, [sticker]);

  return (
    <div className="container mt-5">
      {/* Sticker Selection */}
      <div className="text-center mb-3">
        <h5>Choose a Sticker:</h5>
        <div className="d-flex flex-wrap justify-content-center gap-2">
          {stickers.map((stickerEmoji) => (
            <button
              key={stickerEmoji}
              className={`btn btn-outline-primary ${sticker === stickerEmoji ? 'active' : ''}`}
              onClick={() => setSticker(stickerEmoji)}
              style={{ fontSize: "24px" }}
            >
              {stickerEmoji}
            </button>
          ))}
        </div>
      </div>

      {/* Camera View */}
      <div 
        className="mx-auto border rounded overflow-hidden bg-dark" 
        style={{ 
          position: "relative", 
          width: 640, 
          height: 480,
          maxWidth: "100%"
        }}
      >
        <Webcam
          ref={webcamRef}
          audio={false}
          width={640}
          height={480}
          style={{ 
            position: "absolute", 
            left: 0, 
            top: 0, 
            zIndex: 0,
            width: "100%",
            height: "100%"
          }}
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ 
            position: "absolute", 
            left: 0, 
            top: 0, 
            zIndex: 1,
            width: "100%",
            height: "100%"
          }}
        />
      </div>

      <div className="text-center mt-3 text-muted">
        <small>Move your face to see the sticker follow you! 👆</small>
      </div>
    </div>
  );
}