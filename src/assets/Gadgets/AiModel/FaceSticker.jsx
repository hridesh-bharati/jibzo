// src\assets\Gadgets\AiModel\FaceSticker.jsx
import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import "./FaceSticker.css"; // We'll create this CSS file

export default function FaceSticker() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [selectedFilter, setSelectedFilter] = useState("sunglasses");
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const animationRef = useRef(null);
  const lastLandmarksRef = useRef(null);

  const filters = [
    { id: "sunglasses", name: "Sunglasses", emoji: "😎" },
    { id: "nerd", name: "Nerd Glasses", emoji: "🤓" },
    { id: "crown", name: "Crown", emoji: "👑" },
    { id: "dog", name: "Dog Ears", emoji: "🐶" },
    { id: "cat", name: "Cat Ears", emoji: "🐱" },
    { id: "flower", name: "Flower Crown", emoji: "🌸" },
    { id: "party", name: "Party Hat", emoji: "🎉" },
    { id: "heart", name: "Heart Eyes", emoji: "😍" },
    { id: "clown", name: "Clown Nose", emoji: "🤡" },
    { id: "alien", name: "Alien", emoji: "👽" },
    { id: "viking", name: "Viking", emoji: "⚔️" },
    { id: "pirate", name: "Pirate", emoji: "🏴‍☠️" },
  ];

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
      if (!canvasRef.current || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        lastLandmarksRef.current = null;
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const landmarks = results.multiFaceLandmarks[0];
      
      // Smooth landmarks to reduce jitter
      if (lastLandmarksRef.current) {
        for (let i = 0; i < landmarks.length; i++) {
          landmarks[i].x = landmarks[i].x * 0.3 + lastLandmarksRef.current[i].x * 0.7;
          landmarks[i].y = landmarks[i].y * 0.3 + lastLandmarksRef.current[i].y * 0.7;
        }
      }
      lastLandmarksRef.current = landmarks;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw webcam feed
      if (results.image) {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      }

      // Apply selected filter
      applyFilter(ctx, landmarks, canvas.width, canvas.height);
    };

    const applyFilter = (ctx, landmarks, width, height) => {
      // Calculate key face points
      const noseTip = { x: landmarks[1].x * width, y: landmarks[1].y * height };
      const forehead = { x: landmarks[10].x * width, y: landmarks[10].y * height };
      const leftEye = { x: landmarks[33].x * width, y: landmarks[33].y * height };
      const rightEye = { x: landmarks[263].x * width, y: landmarks[263].y * height };
      const leftEar = { x: landmarks[234].x * width, y: landmarks[234].y * height };
      const rightEar = { x: landmarks[454].x * width, y: landmarks[454].y * height };
      const mouthLeft = { x: landmarks[61].x * width, y: landmarks[61].y * height };
      const mouthRight = { x: landmarks[291].x * width, y: landmarks[291].y * height };
      
      // Calculate face dimensions for scaling
      const faceWidth = Math.abs(leftEye.x - rightEye.x) * 2.5;
      const eyeDistance = Math.abs(leftEye.x - rightEye.x);

      ctx.save();
      
      switch(selectedFilter) {
        case "sunglasses":
          drawSunglasses(ctx, leftEye, rightEye, eyeDistance);
          break;
        case "nerd":
          drawNerdGlasses(ctx, leftEye, rightEye, eyeDistance);
          break;
        case "crown":
          drawCrown(ctx, forehead, faceWidth);
          break;
        case "dog":
          drawDogEars(ctx, leftEar, rightEar, faceWidth);
          break;
        case "cat":
          drawCatEars(ctx, leftEar, rightEar, faceWidth);
          break;
        case "flower":
          drawFlowerCrown(ctx, forehead, faceWidth);
          break;
        case "party":
          drawPartyHat(ctx, forehead, faceWidth);
          break;
        case "heart":
          drawHeartEyes(ctx, leftEye, rightEye, eyeDistance);
          break;
        case "clown":
          drawClownNose(ctx, noseTip, faceWidth);
          break;
        case "alien":
          drawAlien(ctx, forehead, faceWidth);
          break;
        case "viking":
          drawVikingHelmet(ctx, forehead, faceWidth);
          break;
        case "pirate":
          drawPirate(ctx, leftEye, rightEye, eyeDistance);
          break;
        default:
          // Default sunglasses
          drawSunglasses(ctx, leftEye, rightEye, eyeDistance);
      }
      
      ctx.restore();
    };

    // Filter drawing functions
    const drawSunglasses = (ctx, leftEye, rightEye, eyeDistance) => {
      const frameWidth = eyeDistance * 1.2;
      const frameHeight = frameWidth * 0.3;
      const bridgeWidth = eyeDistance * 0.2;
      
      // Draw lenses
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(leftEye.x - frameWidth/2, leftEye.y - frameHeight/2, frameWidth, frameHeight);
      ctx.fillRect(rightEye.x - frameWidth/2, rightEye.y - frameHeight/2, frameWidth, frameHeight);
      
      // Draw bridge
      ctx.fillRect((leftEye.x + rightEye.x)/2 - bridgeWidth/2, leftEye.y - frameHeight/4, bridgeWidth, frameHeight/2);
      
      // Draw arms (simplified)
      ctx.lineWidth = 5;
      ctx.strokeStyle = "black";
      ctx.beginPath();
      ctx.moveTo(leftEye.x - frameWidth/2, leftEye.y);
      ctx.lineTo(leftEye.x - frameWidth, leftEye.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(rightEye.x + frameWidth/2, rightEye.y);
      ctx.lineTo(rightEye.x + frameWidth, rightEye.y);
      ctx.stroke();
    };

    const drawNerdGlasses = (ctx, leftEye, rightEye, eyeDistance) => {
      const frameWidth = eyeDistance * 0.8;
      const frameHeight = frameWidth * 0.6;
      
      // Draw frames
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(leftEye.x, leftEye.y, frameWidth/2, frameHeight/2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(rightEye.x, rightEye.y, frameWidth/2, frameHeight/2, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw bridge
      ctx.beginPath();
      ctx.moveTo(leftEye.x + frameWidth/2, leftEye.y);
      ctx.lineTo(rightEye.x - frameWidth/2, rightEye.y);
      ctx.stroke();
      
      // Draw tape
      ctx.fillStyle = "silver";
      ctx.fillRect((leftEye.x + rightEye.x)/2 - 5, leftEye.y - 10, 10, 5);
    };

    const drawCrown = (ctx, forehead, faceWidth) => {
      const crownWidth = faceWidth * 1.5;
      const crownHeight = crownWidth * 0.4;
      
      ctx.fillStyle = "gold";
      ctx.strokeStyle = "orange";
      ctx.lineWidth = 2;
      
      // Draw crown base
      ctx.beginPath();
      ctx.moveTo(forehead.x - crownWidth/2, forehead.y - crownHeight/2);
      ctx.lineTo(forehead.x + crownWidth/2, forehead.y - crownHeight/2);
      ctx.lineTo(forehead.x + crownWidth/2, forehead.y + crownHeight/2);
      ctx.lineTo(forehead.x - crownWidth/2, forehead.y + crownHeight/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Draw crown points
      const pointCount = 5;
      const pointWidth = crownWidth / pointCount;
      
      ctx.fillStyle = "gold";
      for (let i = 0; i < pointCount; i++) {
        const x = forehead.x - crownWidth/2 + i * pointWidth + pointWidth/2;
        ctx.beginPath();
        ctx.moveTo(x, forehead.y - crownHeight/2);
        ctx.lineTo(x - pointWidth/3, forehead.y - crownHeight);
        ctx.lineTo(x + pointWidth/3, forehead.y - crownHeight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Add jewel to each point
        ctx.fillStyle = i % 2 === 0 ? "red" : "blue";
        ctx.beginPath();
        ctx.arc(x, forehead.y - crownHeight + 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "gold";
      }
    };

    const drawDogEars = (ctx, leftEar, rightEar, faceWidth) => {
      const earWidth = faceWidth * 0.3;
      const earHeight = earWidth * 1.2;
      
      // Left ear
      ctx.fillStyle = "brown";
      ctx.beginPath();
      ctx.ellipse(leftEar.x - earWidth/2, leftEar.y - earHeight, earWidth/2, earHeight, -Math.PI/6, 0, Math.PI * 2);
      ctx.fill();
      
      // Right ear
      ctx.beginPath();
      ctx.ellipse(rightEar.x + earWidth/2, rightEar.y - earHeight, earWidth/2, earHeight, Math.PI/6, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner ears
      ctx.fillStyle = "pink";
      ctx.beginPath();
      ctx.ellipse(leftEar.x - earWidth/2, leftEar.y - earHeight, earWidth/4, earHeight * 0.7, -Math.PI/6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.ellipse(rightEar.x + earWidth/2, rightEar.y - earHeight, earWidth/4, earHeight * 0.7, Math.PI/6, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawCatEars = (ctx, leftEar, rightEar, faceWidth) => {
      const earWidth = faceWidth * 0.25;
      const earHeight = earWidth * 1.5;
      
      // Left ear
      ctx.fillStyle = "gray";
      ctx.beginPath();
      ctx.moveTo(leftEar.x, leftEar.y - earHeight);
      ctx.lineTo(leftEar.x - earWidth/2, leftEar.y);
      ctx.lineTo(leftEar.x + earWidth/2, leftEar.y);
      ctx.closePath();
      ctx.fill();
      
      // Right ear
      ctx.beginPath();
      ctx.moveTo(rightEar.x, rightEar.y - earHeight);
      ctx.lineTo(rightEar.x - earWidth/2, rightEar.y);
      ctx.lineTo(rightEar.x + earWidth/2, rightEar.y);
      ctx.closePath();
      ctx.fill();
      
      // Inner ears
      ctx.fillStyle = "pink";
      ctx.beginPath();
      ctx.moveTo(leftEar.x, leftEar.y - earHeight * 0.7);
      ctx.lineTo(leftEar.x - earWidth/4, leftEar.y - earHeight * 0.3);
      ctx.lineTo(leftEar.x + earWidth/4, leftEar.y - earHeight * 0.3);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(rightEar.x, rightEar.y - earHeight * 0.7);
      ctx.lineTo(rightEar.x - earWidth/4, rightEar.y - earHeight * 0.3);
      ctx.lineTo(rightEar.x + earWidth/4, rightEar.y - earHeight * 0.3);
      ctx.closePath();
      ctx.fill();
    };

    // Additional filter functions would go here...
    const drawFlowerCrown = (ctx, forehead, faceWidth) => {
      const crownWidth = faceWidth * 1.5;
      const flowerSize = crownWidth / 8;
      
      ctx.fillStyle = "green";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(forehead.x - crownWidth/2, forehead.y - 20);
      ctx.lineTo(forehead.x + crownWidth/2, forehead.y - 20);
      ctx.stroke();
      
      // Draw flowers
      const flowerColors = ["pink", "yellow", "white", "purple"];
      for (let i = 0; i < 5; i++) {
        const x = forehead.x - crownWidth/2 + i * (crownWidth/4);
        const color = flowerColors[i % flowerColors.length];
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, forehead.y - 20, flowerSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Flower center
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(x, forehead.y - 20, flowerSize/3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawPartyHat = (ctx, forehead, faceWidth) => {
      const hatWidth = faceWidth * 0.8;
      const hatHeight = hatWidth * 1.2;
      
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.moveTo(forehead.x - hatWidth/2, forehead.y);
      ctx.lineTo(forehead.x + hatWidth/2, forehead.y);
      ctx.lineTo(forehead.x, forehead.y - hatHeight);
      ctx.closePath();
      ctx.fill();
      
      // Pom pom
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(forehead.x, forehead.y - hatHeight, hatWidth/6, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawHeartEyes = (ctx, leftEye, rightEye, eyeDistance) => {
      const heartSize = eyeDistance * 0.2;
      
      // Left heart
      drawHeart(ctx, leftEye.x, leftEye.y, heartSize, "red");
      
      // Right heart
      drawHeart(ctx, rightEye.x, rightEye.y, heartSize, "red");
    };

    const drawHeart = (ctx, x, y, size, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      const topCurveHeight = size * 0.3;
      ctx.moveTo(x, y + topCurveHeight);
      // Left top curve
      ctx.bezierCurveTo(
        x, y, 
        x - size/2, y, 
        x - size/2, y + topCurveHeight
      );
      // Left bottom curve
      ctx.bezierCurveTo(
        x - size/2, y + (size + topCurveHeight)/2, 
        x, y + (size + topCurveHeight)/2, 
        x, y + size
      );
      // Right bottom curve
      ctx.bezierCurveTo(
        x, y + (size + topCurveHeight)/2, 
        x + size/2, y + (size + topCurveHeight)/2, 
        x + size/2, y + topCurveHeight
      );
      // Right top curve
      ctx.bezierCurveTo(
        x + size/2, y, 
        x, y, 
        x, y + topCurveHeight
      );
      ctx.closePath();
      ctx.fill();
    };

    const drawClownNose = (ctx, noseTip, faceWidth) => {
      const noseSize = faceWidth * 0.15;
      
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(noseTip.x, noseTip.y, noseSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(noseTip.x - noseSize/3, noseTip.y - noseSize/3, noseSize/4, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawAlien = (ctx, forehead, faceWidth) => {
      const headWidth = faceWidth * 1.2;
      const headHeight = headWidth * 1.5;
      
      // Head
      ctx.fillStyle = "green";
      ctx.beginPath();
      ctx.ellipse(forehead.x, forehead.y, headWidth/2, headHeight/2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      const eyeSize = headWidth * 0.15;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(forehead.x - headWidth/4, forehead.y - headHeight/6, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(forehead.x + headWidth/4, forehead.y - headHeight/6, eyeSize, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawVikingHelmet = (ctx, forehead, faceWidth) => {
      const helmetWidth = faceWidth * 1.5;
      const helmetHeight = helmetWidth * 0.6;
      
      // Helmet base
      ctx.fillStyle = "silver";
      ctx.beginPath();
      ctx.ellipse(forehead.x, forehead.y, helmetWidth/2, helmetHeight/2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Horns
      ctx.fillStyle = "gold";
      ctx.beginPath();
      ctx.ellipse(forehead.x - helmetWidth/2, forehead.y - helmetHeight/2, helmetWidth/6, helmetHeight, -Math.PI/4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(forehead.x + helmetWidth/2, forehead.y - helmetHeight/2, helmetWidth/6, helmetHeight, Math.PI/4, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPirate = (ctx, leftEye, rightEye, eyeDistance) => {
      // Eye patch
      const patchSize = eyeDistance * 0.4;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(leftEye.x, leftEye.y, patchSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Patch strap
      ctx.strokeStyle = "black";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(leftEye.x - patchSize, leftEye.y);
      ctx.lineTo(leftEye.x - patchSize * 1.5, leftEye.y - patchSize);
      ctx.stroke();
      
      // Pirate hat
      const hatWidth = eyeDistance * 2;
      const hatHeight = hatWidth * 0.4;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.ellipse((leftEye.x + rightEye.x)/2, leftEye.y - hatHeight, hatWidth/2, hatHeight/2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Skull and crossbones (simplified)
      ctx.fillStyle = "white";
      ctx.font = "bold 20px Arial";
      ctx.fillText("☠", (leftEye.x + rightEye.x)/2 - 10, leftEye.y - hatHeight + 5);
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [selectedFilter]);

  return (
    <div className="face-filter-container">
      {/* Header */}
      <div className="filter-header text-center mb-4">
        <h2 className="filter-title">Face Filters</h2>
        <p className="filter-subtitle">Choose a filter and see it on your face!</p>
      </div>

      {/* Filter Selection */}
      <div className="filter-selection mb-4">
        <div className="filter-scroll-container">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className={`filter-option ${selectedFilter === filter.id ? 'active' : ''}`}
              onClick={() => setSelectedFilter(filter.id)}
            >
              <div className="filter-emoji">{filter.emoji}</div>
              <div className="filter-name">{filter.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Camera View */}
      <div className="camera-container mx-auto">
        <Webcam
          ref={webcamRef}
          audio={false}
          width={640}
          height={480}
          className="webcam-feed"
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
          className="filter-canvas"
        />
      </div>
    </div>
  );
}