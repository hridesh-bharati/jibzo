import React, { useState } from "react";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import "bootstrap/dist/css/bootstrap.min.css";

// ✅ from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export default function FileConverter() {
  const [imageFiles, setImageFiles] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfImages, setPdfImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversionType, setConversionType] = useState("jpg-to-pdf");

  // Optimized toBase64 function
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  // Optimized image compression
  const compressImage = (base64, quality = 0.7) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set reasonable dimensions
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 1000;

        let { width, height } = img;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  /** Convert Images -> PDF */
  const handleImagesToPdf = async () => {
    if (!imageFiles.length) {
      alert("Please select images first!");
      return;
    }

    setLoading(true);
    try {
      const pdf = new jsPDF();

      for (let i = 0; i < imageFiles.length; i++) {
        const originalBase64 = await toBase64(imageFiles[i]);
        const compressedBase64 = await compressImage(originalBase64, 0.7);

        const img = new Image();
        img.src = compressedBase64;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (img.height * pdfWidth) / img.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(compressedBase64, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`converted-${Date.now()}.pdf`);

    } catch (err) {
      console.error("PDF Conversion Error:", err);
      alert("Failed to convert images to PDF.");
    }
    setLoading(false);
  };

  /** Convert PDF -> JPG */
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
        const viewport = page.getViewport({ scale: 1.2 }); // Lower scale for smaller files

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const imgData = canvas.toDataURL("image/jpeg", 0.8); // 80% quality

        pages.push({
          data: imgData,
          pageNumber: pageNum,
        });
      }

      setPdfImages(pages);
    } catch (err) {
      console.error("PDF to JPG Error:", err);
      alert("Failed to convert PDF to images.");
    }
    setLoading(false);
  };

  const clearFiles = () => {
    setImageFiles([]);
    setPdfFile(null);
    setPdfImages([]);
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

  return (
    <div className="container my-4">
      <h2 className="text-center mb-4 text-primary fw-bold">
        <i className="bi bi-file-earmark-arrow-down me-2"></i>
        File Converter
      </h2>

      {/* Conversion Type */}
      <div className="btn-group w-100 mb-4">
        <button
          className={`btn ${conversionType === "jpg-to-pdf" ? "btn-primary" : "btn-outline-primary"
            }`}
          onClick={() => {
            setConversionType("jpg-to-pdf");
            clearFiles();
          }}
        >
          Images → PDF
        </button>
        <button
          className={`btn ${conversionType === "pdf-to-jpg" ? "btn-success" : "btn-outline-success"
            }`}
          onClick={() => {
            setConversionType("pdf-to-jpg");
            clearFiles();
          }}
        >
          PDF → Images
        </button>
      </div>

      {/* Images -> PDF */}
      {conversionType === "jpg-to-pdf" && (
        <div className="card mb-4">
          <div className="card-body">
            <input
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="form-control mb-3"
              onChange={(e) => setImageFiles([...e.target.files])}
            />
            <button
              className="btn btn-primary w-100"
              disabled={!imageFiles.length || loading}
              onClick={handleImagesToPdf}
            >
              {loading ? "Converting..." : `Convert to PDF (${imageFiles.length})`}
            </button>
          </div>
        </div>
      )}

      {/* PDF -> Images */}
      {conversionType === "pdf-to-jpg" && (
        <div className="card mb-4">
          <div className="card-body">
            <input
              type="file"
              accept="application/pdf"
              className="form-control mb-3"
              onChange={(e) => setPdfFile(e.target.files[0])}
            />
            <button
              className="btn btn-success w-100"
              disabled={!pdfFile || loading}
              onClick={handlePdfToJpg}
            >
              {loading ? "Extracting..." : "Extract Images"}
            </button>
          </div>
        </div>
      )}

      {/* Show Extracted Images */}
      {pdfImages.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-3">
              <h5>Extracted Images ({pdfImages.length})</h5>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={downloadAllImages}
              >
                Download All
              </button>
            </div>
            <div className="row g-3">
              {pdfImages.map((img) => (
                <div key={img.pageNumber} className="col-md-4">
                  <div className="border rounded p-2 text-center">
                    <img
                      src={img.data}
                      alt={`Page ${img.pageNumber}`}
                      className="img-fluid mb-2"
                      style={{ maxHeight: "150px", objectFit: "contain" }}
                    />
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => downloadImage(img.data, img.pageNumber)}
                    >
                      Download Page {img.pageNumber}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(imageFiles.length || pdfFile || pdfImages.length) > 0 && (
        <div className="text-center">
          <button className="btn btn-outline-secondary" onClick={clearFiles}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}