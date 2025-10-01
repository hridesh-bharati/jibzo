import React, { useState } from "react";

export default function ImageResizer() {
  const [files, setFiles] = useState([]);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);

  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          const resizedFile = new File([blob], file.name, { type: file.type });
          resolve(resizedFile);
        }, file.type);
      };
    });
  };

  const handleResize = async () => {
    if (!files.length) return alert("Select images first!");
    const resized = await Promise.all(files.map((file) => resizeImage(file)));
    resized.forEach((file) => {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="container my-4">
      <div className="card">
        <div className="card-body">
          <h4 className="text-center mb-4 text-danger fw-bolder">Image Resizer</h4>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles([...e.target.files])}
            className="form-control mb-3"
          />

          <div className="mb-3">
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(+e.target.value)}
              placeholder="Width"
              className="form-control mb-2"
            />
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(+e.target.value)}
              placeholder="Height"
              className="form-control"
            />
          </div>

          <button className="btn btn-primary w-100" onClick={handleResize}>
            Resize & Download
          </button>
        </div>
      </div>
    </div>
  );
}