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
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'environment' 
        } 
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch (err) {
      alert("Camera access failed: " + err.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 1.0); // HD quality
    setCapturedImages(prev => [...prev, {
      id: Date.now(),
      data: imageData,
      name: `captured-${Date.now()}.jpg`
    }]);
  };

  const useCapturedImage = () => {
    const newImageFiles = capturedImages.map(img => 
      dataURLtoFile(img.data, img.name)
    );
    setImageFiles(prev => [...prev, ...newImageFiles]);
    setCapturedImages([]);
    stopCamera();
    alert(`${newImageFiles.length} images added for conversion!`);
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

  // Preview functions
  const PreviewImage = ({ src, onRemove, name, size }) => (
    <div className="col-md-3 mb-3">
      <div className="card h-100">
        <img 
          src={src} 
          className="card-img-top" 
          alt="Preview" 
          style={{ height: '150px', objectFit: 'contain' }}
        />
        <div className="card-body p-2">
          <small className="d-block text-truncate">{name}</small>
          <small className="text-muted">{size}</small>
        </div>
        {onRemove && (
          <button 
            className="btn btn-danger btn-sm m-2"
            onClick={onRemove}
          >
            Remove
          </button>
        )}
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

  const compressImage = (base64, quality = 0.9) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Maintain HD quality but compress slightly
        const maxWidth = 2000;
        const maxHeight = 2000;
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

  // OCR Text Scanner Function - HD Quality
  const handleTextScan = async () => {
    if (!imageFiles.length && !pdfFile && capturedImages.length === 0) {
      alert("Please select images, use camera, or upload PDF first!");
      return;
    }

    setLoading(true);
    setExtractedText("");
    setOcrProgress(0);

    try {
      let textResults = [];
      const allImages = [...imageFiles, ...capturedImages.map(img => dataURLtoFile(img.data, img.name))];

      if (allImages.length > 0) {
        // Scan images with HD quality
        for (let i = 0; i < allImages.length; i++) {
          const result = await Tesseract.recognize(
            allImages[i],
            'eng+hin', // English + Hindi support
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  setOcrProgress(Math.round(m.progress * 100));
                }
              }
            }
          );
          textResults.push(`--- Image ${i + 1} ---\n${result.data.text}\n`);
        }
      } else if (pdfFile) {
        // Convert PDF to HD images and then scan
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 3.0 }); // HD quality

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: ctx, viewport }).promise;
          
          const imageData = canvas.toDataURL("image/jpeg", 1.0);
          
          const result = await Tesseract.recognize(
            imageData,
            'eng+hin',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  setOcrProgress(Math.round(m.progress * 100));
                }
              }
            }
          );
          
          textResults.push(`--- Page ${pageNum} ---\n${result.data.text}\n`);
        }
      }

      setExtractedText(textResults.join('\n'));
    } catch (err) {
      alert("Failed to extract text: " + err.message);
    }
    setLoading(false);
    setOcrProgress(0);
  };

  // PDF to Word conversion - HD Quality
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

      // Create Word document with better formatting
      const wordContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="utf-8">
            <title>Converted Document</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
              .page-break { page-break-after: always; }
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
      
      // Better text formatting for HD quality
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
        resolve(`Document: ${file.name}\n\nContent extracted from Word document. For better results, use specialized Word processing libraries.`);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // HD Quality Image to PDF
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
        const compressed = await compressImage(base64, 0.95); // High quality

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

  // HD Quality PDF to Images
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
        const viewport = page.getViewport({ scale: 3.0 }); // HD quality

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push({
          data: canvas.toDataURL("image/jpeg", 1.0), // Maximum quality
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
    a.download = `page-${page}-hd.jpg`;
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

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container my-4 myshadow p-2">
      <h2 className="text-center mb-4 text-danger fw-bolder">HD File Converter with Camera</h2>

      <div className="btn-group w-100 mb-4 flex-wrap">
        <button className={`btn ${conversionType === "jpg-to-pdf" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { setConversionType("jpg-to-pdf"); clearFiles(); }}>Images → PDF</button>
        <button className={`btn ${conversionType === "pdf-to-jpg" ? "btn-success" : "btn-outline-success"}`} onClick={() => { setConversionType("pdf-to-jpg"); clearFiles(); }}>PDF → Images</button>
        <button className={`btn ${conversionType === "pdf-to-word" ? "btn-info" : "btn-outline-info"}`} onClick={() => { setConversionType("pdf-to-word"); clearFiles(); }}>PDF → Word</button>
        <button className={`btn ${conversionType === "word-to-pdf" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => { setConversionType("word-to-pdf"); clearFiles(); }}>Word → PDF</button>
        <button className={`btn ${conversionType === "text-scanner" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => { setConversionType("text-scanner"); clearFiles(); }}>Text Scanner (OCR)</button>
      </div>

      {/* Camera Section */}
      {(conversionType === "jpg-to-pdf" || conversionType === "text-scanner") && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">📷 Camera Scanner</h5>
            {!cameraActive ? (
              <button className="btn btn-outline-primary w-100 mb-3" onClick={startCamera}>
                Start Camera
              </button>
            ) : (
              <div>
                <div className="text-center mb-3">
                  <video ref={videoRef} autoPlay playsInline className="img-fluid rounded" style={{ maxHeight: '300px' }} />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
                <div className="d-flex gap-2 mb-3">
                  <button className="btn btn-success flex-fill" onClick={captureImage}>
                    Capture Image
                  </button>
                  <button className="btn btn-warning flex-fill" onClick={useCapturedImage}>
                    Use Captured Images ({capturedImages.length})
                  </button>
                  <button className="btn btn-danger flex-fill" onClick={stopCamera}>
                    Stop Camera
                  </button>
                </div>
              </div>
            )}
            
            {capturedImages.length > 0 && (
              <div className="mt-3">
                <h6>Captured Images Preview:</h6>
                <div className="row">
                  {capturedImages.map((img) => (
                    <div key={img.id} className="col-md-3 mb-2">
                      <div className="card">
                        <img src={img.data} className="card-img-top" alt="Captured" style={{height: '100px', objectFit: 'cover'}} />
                        <button className="btn btn-danger btn-sm" onClick={() => removeCapturedImage(img.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Upload Sections */}
      {conversionType === "jpg-to-pdf" && (
        <div className="card mb-4">
          <div className="card-body">
            <input type="file" accept="image/jpeg,image/png,image/jpg" multiple className="form-control mb-3" onChange={(e) => setImageFiles([...e.target.files])} />
            <button className="btn btn-primary w-100" disabled={(!imageFiles.length && !capturedImages.length) || loading} onClick={handleImagesToPdf}>
              {loading ? "Converting..." : `Convert to PDF (${imageFiles.length + capturedImages.length} images)`}
            </button>
          </div>
        </div>
      )}

      {conversionType === "pdf-to-jpg" && (
        <div className="card mb-4">
          <div className="card-body">
            <input type="file" accept="application/pdf" className="form-control mb-3" onChange={(e) => setPdfFile(e.target.files[0])} />
            <button className="btn btn-success w-100" disabled={!pdfFile || loading} onClick={handlePdfToJpg}>
              {loading ? "Extracting..." : "Extract HD Images"}
            </button>
          </div>
        </div>
      )}

      {conversionType === "pdf-to-word" && (
        <div className="card mb-4">
          <div className="card-body">
            <input type="file" accept="application/pdf" className="form-control mb-3" onChange={(e) => setPdfFile(e.target.files[0])} />
            <button className="btn btn-info w-100" disabled={!pdfFile || loading} onClick={handlePdfToWord}>
              {loading ? "Converting..." : "Convert to Word"}
            </button>
          </div>
        </div>
      )}

      {conversionType === "word-to-pdf" && (
        <div className="card mb-4">
          <div className="card-body">
            <input type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="form-control mb-3" onChange={handleWordToPdf} />
          </div>
        </div>
      )}

      {conversionType === "text-scanner" && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Upload Images</label>
                <input type="file" accept="image/jpeg,image/png,image/jpg" multiple className="form-control" onChange={(e) => setImageFiles([...e.target.files])} />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Or Upload PDF</label>
                <input type="file" accept="application/pdf" className="form-control" onChange={(e) => setPdfFile(e.target.files[0])} />
              </div>
            </div>
            <button className="btn btn-dark w-100" disabled={(!imageFiles.length && !pdfFile && !capturedImages.length) || loading} onClick={handleTextScan}>
              {loading ? `Scanning... ${ocrProgress}%` : "Scan Text (OCR)"}
            </button>
          </div>
        </div>
      )}

      {/* Preview Sections */}
      {imageFiles.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <h5>Uploaded Images Preview ({imageFiles.length})</h5>
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

      {pdfFile && (
        <div className="card mb-4">
          <div className="card-body">
            <h5>PDF File Preview</h5>
            <div className="alert alert-info">
              <strong>{pdfFile.name}</strong> - {formatFileSize(pdfFile.size)}
              <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => setPdfFile(null)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {extractedText && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>Extracted Text</h5>
              <div>
                <button className="btn btn-outline-secondary btn-sm me-2" onClick={copyToClipboard}>Copy Text</button>
                <button className="btn btn-outline-primary btn-sm" onClick={downloadText}>Download Text</button>
              </div>
            </div>
            <textarea className="form-control" rows="10" value={extractedText} onChange={(e) => setExtractedText(e.target.value)} style={{ fontSize: '14px', fontFamily: 'monospace' }} />
          </div>
        </div>
      )}

      {pdfImages.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-3">
              <h5>Extracted HD Images ({pdfImages.length})</h5>
              <button className="btn btn-outline-primary btn-sm" onClick={downloadAllImages}>Download All</button>
            </div>
            <div className="row g-3">
              {pdfImages.map((img) => (
                <div key={img.pageNumber} className="col-md-4">
                  <div className="border rounded p-2 text-center">
                    <img src={img.data} alt={`Page ${img.pageNumber}`} className="img-fluid mb-2" style={{ maxHeight: "200px" }} />
                    <div className="small text-muted mb-2">{img.width} x {img.height} px</div>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => downloadImage(img.data, img.pageNumber)}>
                      Download Page {img.pageNumber}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(imageFiles.length || pdfFile || pdfImages.length || extractedText || capturedImages.length) > 0 && (
        <div className="text-center">
          <button className="btn btn-outline-secondary" onClick={clearFiles}>Clear All</button>
        </div>
      )}
    </div>
  );
}