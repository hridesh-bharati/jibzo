// src\assets\Gadgets\AiModel\FaceSticker.jsx
import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import "./FaceSticker.css";

export default function FaceSticker() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [selectedFilter, setSelectedFilter] = useState("sunglasses");
  const [isLoading, setIsLoading] = useState(true);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const lastLandmarksRef = useRef(null);
  const filterElementsRef = useRef({});

  const filters = [
    { id: "sunglasses", name: "Sunglasses", emoji: "😎", premium: false },
    { id: "nerd", name: "Nerd", emoji: "🤓", premium: false },
    { id: "crown", name: "Royal", emoji: "👑", premium: true },
    { id: "dog", name: "Puppy", emoji: "🐶", premium: false },
    { id: "cat", name: "Kitty", emoji: "🐱", premium: false },
    { id: "flower", name: "Flower", emoji: "🌸", premium: false },
    { id: "party", name: "Party", emoji: "🎉", premium: false },
    { id: "heart", name: "Lovely", emoji: "😍", premium: false },
    { id: "clown", name: "Clown", emoji: "🤡", premium: false },
    { id: "alien", name: "Alien", emoji: "👽", premium: true },
    { id: "viking", name: "Viking", emoji: "⚔️", premium: true },
    { id: "pirate", name: "Pirate", emoji: "🏴‍☠️", premium: true },
    { id: "butterfly", name: "Butterfly", emoji: "🦋", premium: true },
    { id: "rainbow", name: "Rainbow", emoji: "🌈", premium: true },
    { id: "golden", name: "Golden", emoji: "⭐", premium: true },
  ];

  useEffect(() => {
    const initializeFaceMesh = async () => {
      if (!webcamRef.current || !canvasRef.current) return;

      try {
        setIsLoading(true);

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
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
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

        await cameraRef.current.start();
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing camera:", error);
        setIsLoading(false);
      }
    };

    const onResults = (results) => {
      if (!canvasRef.current || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        lastLandmarksRef.current = null;
        drawNoFaceDetected();
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const landmarks = results.multiFaceLandmarks[0];
      
      // High-quality smoothing for professional feel
      if (lastLandmarksRef.current) {
        for (let i = 0; i < landmarks.length; i++) {
          landmarks[i].x = landmarks[i].x * 0.2 + lastLandmarksRef.current[i].x * 0.8;
          landmarks[i].y = landmarks[i].y * 0.2 + lastLandmarksRef.current[i].y * 0.8;
        }
      }
      lastLandmarksRef.current = landmarks;

      // Clear canvas with fade effect for smooth transitions
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw webcam feed
      if (results.image) {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      }

      // Apply professional filter with animations
      applyProfessionalFilter(ctx, landmarks, canvas.width, canvas.height);
    };

    const drawNoFaceDetected = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw webcam feed
      if (webcamRef.current?.video) {
        ctx.drawImage(webcamRef.current.video, 0, 0, canvas.width, canvas.height);
      }
      
      // Add semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add message
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Looking for face...', canvas.width/2, canvas.height/2);
      ctx.font = '16px Arial';
      ctx.fillText('Make sure your face is clearly visible', canvas.width/2, canvas.height/2 + 40);
    };

    const applyProfessionalFilter = (ctx, landmarks, width, height) => {
      // Calculate key face points with high precision
      const noseTip = { x: landmarks[1].x * width, y: landmarks[1].y * height };
      const forehead = { x: landmarks[10].x * width, y: landmarks[10].y * height };
      const leftEye = { x: landmarks[33].x * width, y: landmarks[33].y * height };
      const rightEye = { x: landmarks[263].x * width, y: landmarks[263].y * height };
      const leftEar = { x: landmarks[234].x * width, y: landmarks[234].y * height };
      const rightEar = { x: landmarks[454].x * width, y: landmarks[454].y * height };
      const mouthLeft = { x: landmarks[61].x * width, y: landmarks[61].y * height };
      const mouthRight = { x: landmarks[291].x * width, y: landmarks[291].y * height };
      const leftEyebrow = { x: landmarks[70].x * width, y: landmarks[70].y * height };
      const rightEyebrow = { x: landmarks[300].x * width, y: landmarks[300].y * height };
      
      // Calculate face dimensions for perfect scaling
      const faceWidth = Math.abs(leftEye.x - rightEye.x) * 2.5;
      const eyeDistance = Math.abs(leftEye.x - rightEye.x);
      const faceHeight = Math.abs(forehead.y - noseTip.y) * 3;

      ctx.save();
      
      // Add timestamp for animations
      const now = Date.now();
      
      switch(selectedFilter) {
        case "sunglasses":
          drawProfessionalSunglasses(ctx, leftEye, rightEye, eyeDistance, now);
          break;
        case "nerd":
          drawProfessionalNerd(ctx, leftEye, rightEye, eyeDistance, now);
          break;
        case "crown":
          drawProfessionalCrown(ctx, forehead, faceWidth, now);
          break;
        case "dog":
          drawProfessionalDogEars(ctx, leftEar, rightEar, faceWidth, now);
          break;
        case "cat":
          drawProfessionalCatEars(ctx, leftEar, rightEar, faceWidth, now);
          break;
        case "flower":
          drawProfessionalFlowerCrown(ctx, forehead, faceWidth, now);
          break;
        case "party":
          drawProfessionalParty(ctx, forehead, faceWidth, now);
          break;
        case "heart":
          drawProfessionalHearts(ctx, leftEye, rightEye, eyeDistance, now);
          break;
        case "clown":
          drawProfessionalClown(ctx, noseTip, faceWidth, now);
          break;
        case "alien":
          drawProfessionalAlien(ctx, forehead, faceWidth, now);
          break;
        case "viking":
          drawProfessionalViking(ctx, forehead, faceWidth, now);
          break;
        case "pirate":
          drawProfessionalPirate(ctx, leftEye, rightEye, eyeDistance, now);
          break;
        case "butterfly":
          drawProfessionalButterfly(ctx, forehead, faceWidth, now);
          break;
        case "rainbow":
          drawProfessionalRainbow(ctx, forehead, faceWidth, now);
          break;
        case "golden":
          drawProfessionalGolden(ctx, forehead, faceWidth, now);
          break;
        default:
          drawProfessionalSunglasses(ctx, leftEye, rightEye, eyeDistance, now);
      }
      
      ctx.restore();
    };

    // Professional filter drawing functions with animations
    const drawProfessionalSunglasses = (ctx, leftEye, rightEye, eyeDistance, time) => {
      const frameWidth = eyeDistance * 1.3;
      const frameHeight = frameHeight * 0.4;
      const bridgeWidth = eyeDistance * 0.25;
      
      // Animated lens effect
      const lensShade = 100 + Math.sin(time * 0.005) * 50;
      
      // Gradient lenses
      const leftLensGradient = ctx.createRadialGradient(
        leftEye.x, leftEye.y, 0,
        leftEye.x, leftEye.y, frameWidth/2
      );
      leftLensGradient.addColorStop(0, `rgba(0, 0, ${lensShade}, 0.9)`);
      leftLensGradient.addColorStop(1, `rgba(0, 0, ${lensShade/2}, 0.7)`);
      
      const rightLensGradient = ctx.createRadialGradient(
        rightEye.x, rightEye.y, 0,
        rightEye.x, rightEye.y, frameWidth/2
      );
      rightLensGradient.addColorStop(0, `rgba(0, 0, ${lensShade}, 0.9)`);
      rightLensGradient.addColorStop(1, `rgba(0, 0, ${lensShade/2}, 0.7)`);
      
      // Draw lenses with reflection
      ctx.fillStyle = leftLensGradient;
      ctx.fillRect(leftEye.x - frameWidth/2, leftEye.y - frameHeight/2, frameWidth, frameHeight);
      ctx.fillStyle = rightLensGradient;
      ctx.fillRect(rightEye.x - frameWidth/2, rightEye.y - frameHeight/2, frameWidth, frameHeight);
      
      // Metallic frame
      const frameGradient = ctx.createLinearGradient(0, leftEye.y - frameHeight/2, 0, leftEye.y + frameHeight/2);
      frameGradient.addColorStop(0, '#888');
      frameGradient.addColorStop(0.5, '#fff');
      frameGradient.addColorStop(1, '#666');
      
      ctx.strokeStyle = frameGradient;
      ctx.lineWidth = 4;
      ctx.strokeRect(leftEye.x - frameWidth/2, leftEye.y - frameHeight/2, frameWidth, frameHeight);
      ctx.strokeRect(rightEye.x - frameWidth/2, rightEye.y - frameHeight/2, frameWidth, frameHeight);
      
      // Bridge with 3D effect
      ctx.fillStyle = frameGradient;
      ctx.fillRect((leftEye.x + rightEye.x)/2 - bridgeWidth/2, leftEye.y - frameHeight/4, bridgeWidth, frameHeight/2);
      
      // Reflective highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(leftEye.x - frameWidth/3, leftEye.y - frameHeight/3, frameWidth/4, frameHeight/6);
      ctx.fillRect(rightEye.x - frameWidth/3, rightEye.y - frameHeight/3, frameWidth/4, frameHeight/6);
    };

    const drawProfessionalNerd = (ctx, leftEye, rightEye, eyeDistance, time) => {
      const frameWidth = eyeDistance * 0.9;
      const frameHeight = frameWidth * 0.7;
      
      // Thick black frames
      ctx.fillStyle = 'black';
      ctx.fillRect(leftEye.x - frameWidth/2 - 3, leftEye.y - frameHeight/2 - 3, frameWidth + 6, frameHeight + 6);
      ctx.fillRect(rightEye.x - frameWidth/2 - 3, rightEye.y - frameHeight/2 - 3, frameWidth + 6, frameHeight + 6);
      
      // White frames
      ctx.fillStyle = 'white';
      ctx.fillRect(leftEye.x - frameWidth/2, leftEye.y - frameHeight/2, frameWidth, frameHeight);
      ctx.fillRect(rightEye.x - frameWidth/2, rightEye.y - frameHeight/2, frameWidth, frameHeight);
      
      // Glass effect with animated sparkle
      ctx.fillStyle = 'rgba(200, 230, 255, 0.3)';
      ctx.fillRect(leftEye.x - frameWidth/2, leftEye.y - frameHeight/2, frameWidth, frameHeight);
      ctx.fillRect(rightEye.x - frameWidth/2, rightEye.y - frameHeight/2, frameWidth, frameHeight);
      
      // Bridge with tape
      ctx.strokeStyle = 'silver';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(leftEye.x + frameWidth/2, leftEye.y);
      ctx.lineTo(rightEye.x - frameWidth/2, rightEye.y);
      ctx.stroke();
      
      // Animated tape reflection
      const sparkleX = (leftEye.x + rightEye.x)/2;
      const sparkleY = leftEye.y - 5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(time * 0.01) * 0.3})`;
      ctx.fillRect(sparkleX - 3, sparkleY - 2, 6, 4);
    };

    const drawProfessionalCrown = (ctx, forehead, faceWidth, time) => {
      const crownWidth = faceWidth * 1.6;
      const crownHeight = crownWidth * 0.5;
      
      // Animated golden glow
      const glowIntensity = 0.7 + Math.sin(time * 0.005) * 0.3;
      
      // Crown base with gradient
      const crownGradient = ctx.createLinearGradient(
        forehead.x - crownWidth/2, forehead.y - crownHeight/2,
        forehead.x - crownWidth/2, forehead.y + crownHeight/2
      );
      crownGradient.addColorStop(0, '#FFD700');
      crownGradient.addColorStop(0.5, '#FFEC8B');
      crownGradient.addColorStop(1, '#DAA520');
      
      ctx.fillStyle = crownGradient;
      ctx.fillRect(forehead.x - crownWidth/2, forehead.y - crownHeight/2, crownWidth, crownHeight);
      
      // Crown points with jewels
      const pointCount = 7;
      const pointWidth = crownWidth / pointCount;
      
      for (let i = 0; i < pointCount; i++) {
        const x = forehead.x - crownWidth/2 + i * pointWidth + pointWidth/2;
        const pointHeight = crownHeight * (i % 2 === 0 ? 1.2 : 0.8);
        
        // Crown point
        ctx.fillStyle = crownGradient;
        ctx.beginPath();
        ctx.moveTo(x, forehead.y - crownHeight/2);
        ctx.lineTo(x - pointWidth/2, forehead.y - crownHeight/2 - pointHeight);
        ctx.lineTo(x + pointWidth/2, forehead.y - crownHeight/2 - pointHeight);
        ctx.closePath();
        ctx.fill();
        
        // Animated jewel
        const jewelColors = ['#FF0000', '#0000FF', '#00FF00', '#FF00FF'];
        const jewelColor = jewelColors[i % jewelColors.length];
        ctx.fillStyle = jewelColor;
        ctx.beginPath();
        ctx.arc(x, forehead.y - crownHeight/2 - pointHeight + 8, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Jewel sparkle
        ctx.fillStyle = `rgba(255, 255, 255, ${glowIntensity})`;
        ctx.beginPath();
        ctx.arc(x - 1, forehead.y - crownHeight/2 - pointHeight + 6, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawProfessionalDogEars = (ctx, leftEar, rightEar, faceWidth, time) => {
      const earWidth = faceWidth * 0.35;
      const earHeight = earWidth * 1.4;
      
      // Floppy ear animation
      const earWiggle = Math.sin(time * 0.008) * 0.1;
      
      // Left ear with fur texture
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.ellipse(
        leftEar.x - earWidth/2, 
        leftEar.y - earHeight + earWiggle * 20, 
        earWidth/2, 
        earHeight, 
        -Math.PI/6 + earWiggle, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
      
      // Right ear
      ctx.beginPath();
      ctx.ellipse(
        rightEar.x + earWidth/2, 
        rightEar.y - earHeight - earWiggle * 20, 
        earWidth/2, 
        earHeight, 
        Math.PI/6 - earWiggle, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
      
      // Inner ears with animation
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath();
      ctx.ellipse(
        leftEar.x - earWidth/2, 
        leftEar.y - earHeight + earWiggle * 20, 
        earWidth/4, 
        earHeight * 0.7, 
        -Math.PI/6 + earWiggle, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
      
      ctx.beginPath();
      ctx.ellipse(
        rightEar.x + earWidth/2, 
        rightEar.y - earHeight - earWiggle * 20, 
        earWidth/4, 
        earHeight * 0.7, 
        Math.PI/6 - earWiggle, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
    };

    // Additional professional filter functions...
    const drawProfessionalCatEars = (ctx, leftEar, rightEar, faceWidth, time) => {
      const earWidth = faceWidth * 0.3;
      const earHeight = earWidth * 1.6;
      
      // Ear twitch animation
      const twitch = Math.sin(time * 0.01) * 0.05;
      
      // Left ear
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.moveTo(leftEar.x, leftEar.y - earHeight + twitch * 10);
      ctx.lineTo(leftEar.x - earWidth/2, leftEar.y);
      ctx.lineTo(leftEar.x + earWidth/2, leftEar.y);
      ctx.closePath();
      ctx.fill();
      
      // Right ear
      ctx.beginPath();
      ctx.moveTo(rightEar.x, rightEar.y - earHeight - twitch * 10);
      ctx.lineTo(rightEar.x - earWidth/2, rightEar.y);
      ctx.lineTo(rightEar.x + earWidth/2, rightEar.y);
      ctx.closePath();
      ctx.fill();
      
      // Inner ears with pink gradient
      const innerGradient = ctx.createLinearGradient(0, 0, 0, earHeight);
      innerGradient.addColorStop(0, '#FF69B4');
      innerGradient.addColorStop(1, '#FFB6C1');
      
      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.moveTo(leftEar.x, leftEar.y - earHeight * 0.7 + twitch * 10);
      ctx.lineTo(leftEar.x - earWidth/4, leftEar.y - earHeight * 0.3);
      ctx.lineTo(leftEar.x + earWidth/4, leftEar.y - earHeight * 0.3);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(rightEar.x, rightEar.y - earHeight * 0.7 - twitch * 10);
      ctx.lineTo(rightEar.x - earWidth/4, rightEar.y - earHeight * 0.3);
      ctx.lineTo(rightEar.x + earWidth/4, rightEar.y - earHeight * 0.3);
      ctx.closePath();
      ctx.fill();
    };

    const drawProfessionalFlowerCrown = (ctx, forehead, faceWidth, time) => {
      const crownWidth = faceWidth * 1.8;
      const flowerSize = crownWidth / 10;
      
      // Animated floating effect
      const floatOffset = Math.sin(time * 0.006) * 3;
      
      // Vine
      ctx.strokeStyle = '#228B22';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(forehead.x - crownWidth/2, forehead.y - 25 + floatOffset);
      ctx.lineTo(forehead.x + crownWidth/2, forehead.y - 25 + floatOffset);
      ctx.stroke();
      
      // Animated flowers
      const flowerColors = ['#FF69B4', '#FFD700', '#87CEEB', '#98FB98', '#DDA0DD'];
      for (let i = 0; i < 6; i++) {
        const x = forehead.x - crownWidth/2 + i * (crownWidth/5);
        const y = forehead.y - 25 + floatOffset + (i % 2 === 0 ? -5 : 5);
        const color = flowerColors[i % flowerColors.length];
        const pulse = 0.8 + Math.sin(time * 0.01 + i) * 0.2;
        
        drawAnimatedFlower(ctx, x, y, flowerSize * pulse, color, time);
      }
    };

    const drawAnimatedFlower = (ctx, x, y, size, color, time) => {
      const rotation = time * 0.002;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      
      // Petals
      ctx.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(size * 0.8, 0, size, size/2, Math.PI/5 * i, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(Math.PI * 2/5);
      }
      
      // Center
      ctx.fillStyle = 'yellow';
      ctx.beginPath();
      ctx.arc(0, 0, size/3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    };

    // More filter implementations would continue here...

    initializeFaceMesh();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, [selectedFilter]);

  return (
    <div className="instagram-face-filters">
      {/* Camera View */}
      <div className="camera-section">
        <div className="camera-container">
          {isLoading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Initializing camera...</p>
            </div>
          )}
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
          
          {/* Camera Controls */}
          <div className="camera-controls">
            <button className="control-btn capture-btn">
              <div className="capture-circle"></div>
            </button>
            <button className="control-btn gallery-btn">🖼️</button>
          </div>
        </div>
      </div>

      {/* Filter Carousel */}
      <div className="filter-carousel-section">
        <div className="carousel-header">
          <h3>Choose Filter</h3>
          <span className="filters-count">{filters.length} filters</span>
        </div>
        <div className="filter-carousel">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className={`filter-item ${selectedFilter === filter.id ? 'active' : ''} ${
                filter.premium ? 'premium' : ''
              }`}
              onClick={() => setSelectedFilter(filter.id)}
            >
              <div className="filter-emoji">{filter.emoji}</div>
              <div className="filter-name">{filter.name}</div>
              {filter.premium && <div className="premium-badge">⭐</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bottom-nav">
        <button className="nav-item active">🎭</button>
        <button className="nav-item">🔍</button>
        <button className="nav-item">❤️</button>
        <button className="nav-item">👤</button>
      </div>
    </div>
  );
}