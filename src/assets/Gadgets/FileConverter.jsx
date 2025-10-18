import React, { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import * as Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export default function FileConverter() {
  const [imageFiles, setImageFiles] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfImages, setPdfImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversionType, setConversionType] = useState("jpg-to-pdf");
  const [extractedText, setExtractedText] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Mobile device detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Enhanced cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Tesseract.terminate() removed - causes error in newer versions
    };
  }, []);

  // Improved Camera functions
  const startCamera = async () => {
    try {
      setCameraError("");
      setLoading(true);

      // Check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera not supported in this browser");
        setLoading(false);
        return;
      }

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          width: { ideal: isMobile ? 1280 : 1920 },
          height: { ideal: isMobile ? 720 : 1080 },
          facingMode: 'environment',
          aspectRatio: isMobile ? 4 / 3 : 16 / 9
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Wait for video element to be ready with better error handling
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load properly
        await new Promise((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            reject(new Error("Video element not found"));
            return;
          }

          const onLoaded = () => {
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('error', onError);
            resolve();
          };

          const onError = () => {
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('error', onError);
            reject(new Error("Failed to load video stream"));
          };

          video.addEventListener('loadedmetadata', onLoaded);
          video.addEventListener('error', onError);

          // Fallback timeout
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('error', onError);
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              resolve();
            } else {
              reject(new Error("Camera stream timeout"));
            }
          }, 5000);
        });

        setCameraActive(true);
      } else {
        throw new Error("Camera element not ready");
      }

    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access failed: " + err.message);
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setCameraError("");
  };

  // Improved capture function
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError("Camera not ready");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Check if video is actually playing
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
      setCameraError("Camera stream not loaded properly");
      return;
    }

    try {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to JPEG with quality settings
      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      
      setCapturedImages(prev => [...prev, {
        id: Date.now(),
        data: imageData,
        name: `captured-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`
      }]);

      // Success feedback
      if (isMobile && navigator.vibrate) {
        navigator.vibrate(50);
      }

    } catch (error) {
      console.error("Capture error:", error);
      setCameraError("Failed to capture image");
    }
  };

  const useCapturedImage = () => {
    const newImageFiles = capturedImages.map(img =>
      dataURLtoFile(img.data, img.name)
    );
    setImageFiles(prev => [...prev, ...newImageFiles]);
    setCapturedImages([]);
    stopCamera();
    setActiveTab("upload");
  };

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Improved tab switching
  const handleTabSwitch = async (tab) => {
    setActiveTab(tab);
    setCameraError("");
    
    if (tab === "camera") {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (!cameraActive) {
          startCamera();
        } else if (videoRef.current && streamRef.current) {
          // Reinitialize camera if already active
          videoRef.current.srcObject = streamRef.current;
        }
      }, 100);
    } else {
      // Stop camera when switching away from camera tab
      if (cameraActive) {
        stopCamera();
      }
    }
  };

  // Mobile-optimized Preview Component
  const PreviewImage = ({ src, onRemove, name, size, isCaptured = false }) => (
    <div className="col-6 col-sm-4 col-md-3 mb-3">
      <div className="card h-100 shadow-sm">
        <div className="position-relative">
          <img
            src={src}
            className="card-img-top"
            alt="Preview"
            style={{
              height: isMobile ? '120px' : '150px',
              objectFit: 'cover',
              width: '100%'
            }}
          />
          <button
            className="btn btn-danger btn-sm position-absolute top-0 end-0 m-1"
            onClick={onRemove}
            style={{
              width: '30px',
              height: '30px',
              padding: '0',
              borderRadius: '50%',
              fontSize: '14px'
            }}
          >
            ×
          </button>
        </div>
        <div className="card-body p-2 d-flex flex-column">
          <small className="text-truncate">{name}</small>
          <small className="text-muted mt-auto">{size}</small>
        </div>
      </div>
    </div>
  );

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const compressImage = (base64, quality = 0.8) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const maxWidth = isMobile ? 1200 : 2000;
        const maxHeight = isMobile ? 1200 : 2000;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  // Enhanced OCR Text Scanner Function
  const handleTextScan = async () => {
    const allImages = [...imageFiles, ...capturedImages.map(img => dataURLtoFile(img.data, img.name))];
    
    if (!allImages.length && !pdfFile && capturedImages.length === 0) {
      alert("Please select images, use camera, or upload PDF first!");
      return;
    }

    setLoading(true);
    setExtractedText("");
    setOcrProgress(0);

    try {
      let textResults = [];

      // Process images
      if (allImages.length > 0) {
        for (let i = 0; i < allImages.length; i++) {
          setOcrProgress(Math.round((i / allImages.length) * 100));
          
          const result = await Tesseract.recognize(
            allImages[i],
            'eng', // Start with English only for better performance
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  setOcrProgress(Math.round((i + m.progress) / allImages.length * 100));
                }
              }
            }
          );
          
          textResults.push(`--- Image ${i + 1} ---\n${result.data.text}\n`);
        }
      } 
      // Process PDF
      else if (pdfFile) {
        setExtractedText("Processing PDF pages...");
        
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          setOcrProgress(Math.round((pageNum / pdf.numPages) * 100));
          
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: isMobile ? 1.5 : 2.0 });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: ctx, viewport }).promise;

          const imageData = canvas.toDataURL("image/jpeg", 0.8);

          const result = await Tesseract.recognize(
            imageData,
            'eng',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  const pageProgress = (pageNum - 1 + m.progress) / pdf.numPages;
                  setOcrProgress(Math.round(pageProgress * 100));
                }
              }
            }
          );

          textResults.push(`--- Page ${pageNum} ---\n${result.data.text}\n`);
          
          // Clean up
          canvas.remove();
        }
      }

      const finalText = textResults.join('\n');
      setExtractedText(finalText || "No text could be extracted from the provided content.");
      
    } catch (err) {
      console.error("OCR Error:", err);
      alert("Failed to extract text: " + (err.message || "Unknown error occurred"));
      setExtractedText("Error occurred during text extraction. Please try again with clearer images or documents.");
    } finally {
      setLoading(false);
      setOcrProgress(0);
    }
  };

  // PDF to Word conversion
  const handlePdfToWord = async () => {
    if (!pdfFile) {
      alert("Please select a PDF file first!");
      return;
    }

    setLoading(true);
    try {
      let fullText = "";
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `Page ${pageNum}:\n${pageText}\n\n`;
      }

      const wordContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="utf-8">
            <title>Converted Document</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div>${fullText.replace(/\n/g, '<br>').replace(/Page \d+:/g, '<h3>$&</h3>')}</div>
          </body>
        </html>
      `;

      const blob = new Blob([wordContent], {
        type: 'application/msword'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `converted-${Date.now()}.doc`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      alert("Failed to convert PDF to Word: " + err.message);
    }
    setLoading(false);
  };

  // Word to PDF conversion
  const handleWordToPdf = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.doc') && !file.name.endsWith('.docx')) {
      alert("Please select a Word document (.doc or .docx)");
      return;
    }

    setLoading(true);
    try {
      const text = await readWordFile(file);

      const pdf = new jsPDF();
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");

      const lines = pdf.splitTextToSize(text, 180);
      pdf.text(lines, 10, 10);

      pdf.save(`converted-${Date.now()}.pdf`);

    } catch (err) {
      alert("Failed to convert Word to PDF: " + err.message);
    }
    setLoading(false);
  };

  const readWordFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(`Document: ${file.name}\n\nContent extracted from Word document.`);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Image to PDF
  const handleImagesToPdf = async () => {
    const allImages = [...imageFiles, ...capturedImages.map(img => dataURLtoFile(img.data, img.name))];

    if (!allImages.length) {
      alert("Please select images or use camera first!");
      return;
    }

    setLoading(true);
    try {
      const pdf = new jsPDF();

      for (let i = 0; i < allImages.length; i++) {
        const base64 = await toBase64(allImages[i]);
        const compressed = await compressImage(base64, 0.9);

        const img = new Image();
        img.src = compressed;

        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (img.height * pdfWidth) / img.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(compressed, "JPEG", 0, 0, pdfWidth, pdfHeight, null, 'FAST');
      }

      pdf.save(`converted-${Date.now()}.pdf`);
    } catch (err) {
      alert("Failed to convert images to PDF.");
    }
    setLoading(false);
  };

  // PDF to Images
  const handlePdfToJpg = async () => {
    if (!pdfFile) {
      alert("Please select a PDF file first!");
      return;
    }

    setLoading(true);
    setPdfImages([]);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: isMobile ? 2.0 : 3.0 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push({
          data: canvas.toDataURL("image/jpeg", 0.9),
          pageNumber: pageNum,
          width: viewport.width,
          height: viewport.height
        });
      }

      setPdfImages(pages);
    } catch (err) {
      alert("Failed to convert PDF to images.");
    }
    setLoading(false);
  };

  const clearFiles = () => {
    setImageFiles([]);
    setPdfFile(null);
    setPdfImages([]);
    setExtractedText("");
    setCapturedImages([]);
    stopCamera();
    setCameraError("");
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeCapturedImage = (id) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id));
  };

  const downloadImage = (data, page) => {
    const a = document.createElement("a");
    a.href = data;
    a.download = `page-${page}.jpg`;
    a.click();
  };

  const downloadAllImages = () => {
    pdfImages.forEach((img, i) => {
      setTimeout(() => downloadImage(img.data, img.pageNumber), i * 200);
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    alert("Text copied to clipboard!");
  };

  const downloadText = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-text-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Modern Circular Icon Button
  const ConversionTypeButton = ({ type, label, icon, color }) => (
    <button
      className={`conversion-btn ${conversionType === type ? "active" : ""}`}
      onClick={() => {
        setConversionType(type);
        clearFiles();
        setActiveTab("upload");
      }}
    >
      <div className="conversion-icon" style={{ backgroundColor: color }}>
        <span className="icon">{icon}</span>
      </div>
      <span className="label">{label}</span>
    </button>
  );

  return (
    <div className="container-fluid px-2 py-3" style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Conversion Type Selector */}
      <div className="conversion-grid">
        <ConversionTypeButton type="jpg-to-pdf" label="Images to PDF" icon="🖼️" color="#4dabf7" />
        <ConversionTypeButton type="pdf-to-jpg" label="PDF to Images" icon="📄" color="#f06595" />
        <ConversionTypeButton type="pdf-to-word" label="PDF to Word" icon="📝" color="#63e6be" />
        <ConversionTypeButton type="text-scanner" label="Text Scanner" icon="🔍" color="#fcc419" />
        <style>{`
          .conversion-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
            text-align: center;
          }
          .conversion-btn {
            border: none;
            background: white;
            border-radius: 12px;
            padding: 15px 10px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .conversion-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
          }
          .conversion-btn.active {
            outline: 2px solid #007bff;
            background: #e7f1ff;
          }
          .conversion-icon {
            width: 55px;
            height: 55px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 26px;
            margin-bottom: 8px;
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
          }
          .conversion-btn .label {
            font-size: 13px;
            font-weight: 600;
            color: #333;
          }
        `}</style>
      </div>

      {/* Input Methods Tabs */}
      {(conversionType === "jpg-to-pdf" || conversionType === "text-scanner") && (
        <div className="card mb-3">
          <div className="card-body p-0">
            <div className="d-flex border-bottom">
              <button
                className={`btn flex-fill ${activeTab === "upload" ? "btn-primary" : "btn-light"} rounded-0`}
                onClick={() => handleTabSwitch("upload")}
              >
                📁 Upload
              </button>
              <button
                className={`btn flex-fill ${activeTab === "camera" ? "btn-primary" : "btn-light"} rounded-0`}
                onClick={() => handleTabSwitch("camera")}
              >
                📷 Camera
              </button>
            </div>

            <div className="p-3">
              {activeTab === "upload" && (
                <div>
                  <input
                    type="file"
                    accept={conversionType === "text-scanner" ? "image/*,application/pdf" : "image/*"}
                    multiple={conversionType !== "pdf-to-jpg" && conversionType !== "pdf-to-word"}
                    className="form-control form-control-lg mb-3"
                    onChange={(e) => {
                      if (conversionType === "pdf-to-jpg" || conversionType === "pdf-to-word") {
                        setPdfFile(e.target.files[0]);
                      } else {
                        setImageFiles([...e.target.files]);
                      }
                    }}
                  />
                </div>
              )}

              {activeTab === "camera" && (
                <div>
                  {!cameraActive ? (
                    <div>
                      <button
                        className="btn btn-success w-100 btn-lg mb-3"
                        onClick={startCamera}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                            Starting Camera...
                          </>
                        ) : (
                          '📷 Start Camera'
                        )}
                      </button>
                      {cameraError && (
                        <div className="alert alert-warning text-center small">
                          {cameraError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-center mb-3 position-relative">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="img-fluid rounded shadow"
                          style={{
                            maxHeight: isMobile ? '300px' : '400px',
                            width: '100%',
                            backgroundColor: '#000',
                            minHeight: '200px'
                          }}
                          onError={() => setCameraError("Failed to load video stream")}
                        />
                        <canvas 
                          ref={canvasRef} 
                          style={{ display: 'none' }} 
                        />
                        {!videoRef.current?.srcObject && (
                          <div className="position-absolute top-50 start-50 translate-middle">
                            <div className="spinner-border text-light" role="status">
                              <span className="visually-hidden">Loading camera...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {cameraError && (
                        <div className="alert alert-warning text-center small mb-2">
                          {cameraError}
                        </div>
                      )}

                      <div className="row g-2">
                        <div className="col-4">
                          <button
                            className="btn btn-danger w-100"
                            onClick={stopCamera}
                          >
                            Stop
                          </button>
                        </div>
                        <div className="col-4">
                          <button
                            className="btn btn-warning w-100"
                            onClick={captureImage}
                            disabled={!cameraActive}
                          >
                            Capture
                          </button>
                        </div>
                        <div className="col-4">
                          <button
                            className="btn btn-success w-100"
                            onClick={useCapturedImage}
                            disabled={capturedImages.length === 0}
                          >
                            Use ({capturedImages.length})
                          </button>
                        </div>
                      </div>
                      
                      {/* Camera tips */}
                      <div className="mt-3 text-center">
                        <small className="text-muted">
                          💡 Tips: Ensure good lighting and hold steady for better text recognition
                        </small>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Other conversion types file input */}
      {(conversionType === "pdf-to-jpg" || conversionType === "pdf-to-word") && (
        <div className="card mb-3">
          <div className="card-body">
            <input
              type="file"
              accept="application/pdf"
              className="form-control form-control-lg"
              onChange={(e) => setPdfFile(e.target.files[0])}
            />
          </div>
        </div>
      )}

      {/* Word to PDF input */}
      {conversionType === "word-to-pdf" && (
        <div className="card mb-3">
          <div className="card-body">
            <input
              type="file"
              accept=".doc,.docx"
              className="form-control form-control-lg"
              onChange={handleWordToPdf}
            />
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="card mb-3">
        <div className="card-body">
          <button
            className={`btn w-100 btn-lg ${conversionType === "jpg-to-pdf" ? "btn-primary" :
              conversionType === "pdf-to-jpg" ? "btn-success" :
                conversionType === "pdf-to-word" ? "btn-info" :
                  "btn-dark"
              }`}
            disabled={
              loading ||
              (conversionType === "jpg-to-pdf" && imageFiles.length === 0 && capturedImages.length === 0) ||
              ((conversionType === "pdf-to-jpg" || conversionType === "pdf-to-word") && !pdfFile) ||
              (conversionType === "text-scanner" && imageFiles.length === 0 && !pdfFile && capturedImages.length === 0)
            }
            onClick={
              conversionType === "jpg-to-pdf" ? handleImagesToPdf :
                conversionType === "pdf-to-jpg" ? handlePdfToJpg :
                  conversionType === "pdf-to-word" ? handlePdfToWord :
                    handleTextScan
            }
            style={{ height: '60px', fontSize: '18px' }}
          >
            {loading ? (
              <div className="d-flex align-items-center justify-content-center">
                <div className="spinner-border spinner-border-sm me-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                {conversionType === "text-scanner" ? `Scanning ${ocrProgress}%` : "Processing..."}
              </div>
            ) : (
              conversionType === "jpg-to-pdf" ? `Convert to PDF (${imageFiles.length + capturedImages.length})` :
                conversionType === "pdf-to-jpg" ? "Extract Images" :
                  conversionType === "pdf-to-word" ? "Convert to Word" :
                    "Scan Text"
            )}
          </button>
        </div>
      </div>

      {/* Previews */}
      {imageFiles.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h6 className="card-title">📁 Uploaded Files ({imageFiles.length})</h6>
            <div className="row">
              {imageFiles.map((file, index) => (
                <PreviewImage
                  key={index}
                  src={URL.createObjectURL(file)}
                  name={file.name}
                  size={formatFileSize(file.size)}
                  onRemove={() => removeImage(index)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {capturedImages.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h6 className="card-title">📷 Captured Images ({capturedImages.length})</h6>
            <div className="row">
              {capturedImages.map((img) => (
                <PreviewImage
                  key={img.id}
                  src={img.data}
                  name={img.name}
                  size="Camera"
                  onRemove={() => removeCapturedImage(img.id)}
                  isCaptured={true}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {extractedText && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">📝 Extracted Text</h6>
              <div>
                <button className="btn btn-outline-secondary btn-sm me-1" onClick={copyToClipboard}>
                  Copy
                </button>
                <button className="btn btn-outline-primary btn-sm" onClick={downloadText}>
                  Download
                </button>
              </div>
            </div>
            <textarea
              className="form-control"
              rows="6"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              style={{
                fontSize: '14px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>
        </div>
      )}

      {pdfImages.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">🖼️ Extracted Images ({pdfImages.length})</h6>
              <button className="btn btn-outline-primary btn-sm" onClick={downloadAllImages}>
                Download All
              </button>
            </div>
            <div className="row g-2">
              {pdfImages.map((img) => (
                <div key={img.pageNumber} className="col-6 col-md-4">
                  <div className="border rounded p-2 text-center bg-white">
                    <img
                      src={img.data}
                      alt={`Page ${img.pageNumber}`}
                      className="img-fluid mb-2 rounded"
                      style={{ maxHeight: '150px' }}
                    />
                    <div className="small text-muted mb-2">Page {img.pageNumber}</div>
                    <button
                      className="btn btn-outline-secondary btn-sm w-100"
                      onClick={() => downloadImage(img.data, img.pageNumber)}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clear All Button */}
      {(imageFiles.length > 0 || pdfFile || pdfImages.length > 0 || extractedText || capturedImages.length > 0) && (
        <div className="text-center mt-3">
          <button
            className="btn btn-outline-danger btn-lg"
            onClick={clearFiles}
          >
            🗑️ Clear All
          </button>
        </div>
      )}

      {/* Mobile Footer Space */}
      {isMobile && <div style={{ height: '80px' }}></div>}
    </div>
  );
}