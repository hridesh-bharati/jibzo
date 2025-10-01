import React, { useState } from "react";

export default function ImageCompressor() {
  const [files, setFiles] = useState([]);
  const [targetSize, setTargetSize] = useState(50);
  const [compressing, setCompressing] = useState(false);
  const [compressedFiles, setCompressedFiles] = useState([]);

  const compressImage = (file, targetSizeKB) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          let { width, height } = img;
          const maxDim = 1024;
          if (width > height && width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
          } else if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const compress = (quality) =>
            new Promise((res) => {
              canvas.toBlob(
                (blob) => {
                  const sizeKB = blob.size / 1024;
                  if (Math.abs(sizeKB - targetSizeKB) <= 5 || quality <= 0.1) {
                    res({ blob, sizeKB, fileName: file.name });
                  } else if (sizeKB > targetSizeKB) {
                    res(compress(quality * 0.7));
                  } else {
                    res(compress(Math.min(quality * 1.1, 1)));
                  }
                },
                "image/jpeg",
                quality
              );
            });

          compress(0.8).then(resolve);
        };
      };
    });

  const handleCompress = async () => {
    if (!files.length) return;
    setCompressing(true);
    setCompressedFiles([]);
    
    try {
      const results = await Promise.all(files.map((f) => compressImage(f, targetSize)));
      setCompressedFiles(results);
    } catch (err) {
      alert("Error compressing images");
    } finally {
      setCompressing(false);
    }
  };

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compressed_${file.fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFiles = () => {
    setFiles([]);
    setCompressedFiles([]);
  };

  return (
    <div className="container my-4">
      <div className="card">
        <div className="card-body">
          <h3 className="card-title mb-4 text-danger fw-bolder">Image Compressor</h3>

          <div className="mb-3">
            <label className="form-label fw-bold">Target Size:</label>
            <select
              className="form-select"
              value={targetSize}
              onChange={(e) => setTargetSize(Number(e.target.value))}
            >
              {[5, 20, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}KB
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              multiple
              className="form-control"
              onChange={(e) => {
                setFiles([...e.target.files]);
                setCompressedFiles([]);
              }}
            />
            <small className="text-muted">{files.length} files selected</small>

            {files.length > 0 && (
              <div className="mt-3">
                <button
                  className="btn btn-primary me-2"
                  onClick={handleCompress}
                  disabled={compressing}
                >
                  {compressing ? "Compressing..." : `Compress to ${targetSize}KB`}
                </button>
                <button className="btn btn-outline-secondary" onClick={clearFiles}>
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="row">
            {files.length > 0 && (
              <div className="col-6">
                <h5>Original Files</h5>
                <div className="d-flex flex-wrap gap-3">
                  {files.map((file, idx) => (
                    <div key={idx} className="text-center">
                      <img
                        src={URL.createObjectURL(file)}
                        alt=""
                        className="img-thumbnail"
                        style={{ width: "100px", height: "100px", objectFit: "cover" }}
                      />
                      <div className="small mt-1">{(file.size / 1024).toFixed(1)}KB</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {compressedFiles.length > 0 && (
              <div className="col-6">
                <h5>Compressed Files</h5>
                <div className="d-flex flex-wrap gap-3">
                  {compressedFiles.map((file, idx) => (
                    <div key={idx} className="text-center">
                      <img
                        src={URL.createObjectURL(file.blob)}
                        alt=""
                        className="img-thumbnail"
                        style={{ width: "100px", height: "100px", objectFit: "cover" }}
                      />
                      <div className="small mt-1">{file.sizeKB.toFixed(1)}KB</div>
                      <button
                        className="btn btn-success btn-sm mt-1"
                        onClick={() => downloadFile(file)}
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}