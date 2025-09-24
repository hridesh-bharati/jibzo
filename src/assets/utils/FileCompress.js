// src/assets/utils/FileCompress.js
import Compressor from "compressorjs";

export const getCroppedImage = (file, croppedAreaPixels) => {

  return new Promise((resolve, reject) => {
    console.log('Starting image crop...', { 
      fileSize: file.size, 
      fileType: file.type,
      cropArea: croppedAreaPixels 
    });
    
    // Validate inputs
    if (!file || !croppedAreaPixels) {
      reject(new Error("Missing file or crop area"));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        console.log('Original image loaded, dimensions:', img.width, 'x', img.height);
        
        // Validate crop area against image dimensions
        if (croppedAreaPixels.x + croppedAreaPixels.width > img.width ||
            croppedAreaPixels.y + croppedAreaPixels.height > img.height) {
          reject(new Error("Crop area exceeds image dimensions"));
          return;
        }

        if (croppedAreaPixels.width <= 0 || croppedAreaPixels.height <= 0) {
          reject(new Error("Invalid crop area dimensions"));
          return;
        }

        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          // Set canvas dimensions to cropped area
          canvas.width = croppedAreaPixels.width;
          canvas.height = croppedAreaPixels.height;
          
          // Ensure high quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          console.log('Drawing cropped image on canvas...');
          
          ctx.drawImage(
            img,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            canvas.width,
            canvas.height
          );
          
          console.log('Image drawn on canvas, converting to blob...');
          
          // Convert canvas to blob with quality settings
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Canvas is empty - failed to create blob"));
              return;
            }
            
            console.log('Blob created successfully, size:', blob.size);
            
            // Compress the image with better settings
            new Compressor(blob, {
              quality: 0.8,
              maxWidth: 1920,
              maxHeight: 1080,
              success: (compressedBlob) => {
                console.log('Compression successful, final size:', compressedBlob.size);
                resolve(compressedBlob);
              },
              error: (err) => {
                console.warn('Compression failed, using original blob:', err);
                resolve(blob); // Fallback to original blob
              },
            });
          }, "image/jpeg", 0.8); // 80% quality
          
        } catch (drawError) {
          console.error('Error drawing image:', drawError);
          reject(new Error("Failed to draw image on canvas: " + drawError.message));
        }
      };
      
      img.onerror = () => {
        console.error('Failed to load image');
        reject(new Error("Failed to load image for cropping"));
      };
      
      img.src = event.target.result;
    };
    
    reader.onerror = () => {
      console.error('Failed to read file');
      reject(new Error("Failed to read file data"));
    };
    
    reader.onabort = () => {
      console.error('File reading aborted');
      reject(new Error("File reading was aborted"));
    };
    
    reader.readAsDataURL(file);
  });
};