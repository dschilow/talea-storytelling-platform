import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadCameraProps {
  onImageSelected: (imageDataUrl: string) => void;
  currentImage?: string;
  onClearImage?: () => void;
  darkMode?: boolean;
}

// Helper function to resize and compress image
const resizeAndCompressImage = (file: File | string, maxSize: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with 0.85 quality for good compression
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Handle both File objects and data URLs
    if (typeof file === 'string') {
      img.src = file;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    }
  });
};

export const ImageUploadCamera: React.FC<ImageUploadCameraProps> = ({
  onImageSelected,
  currentImage,
  onClearImage,
  darkMode = false,
}) => {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start camera stream
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });
      setStream(mediaStream);
      setShowCamera(true);

      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          // Explicitly play the video
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
    } catch (error) {
      console.error('Camera access denied:', error);
      alert('Kamera-Zugriff wurde verweigert. Bitte erlaube den Zugriff in deinen Browser-Einstellungen.');
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  // Capture photo from camera
  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Resize and compress before passing to parent
        try {
          const compressedDataUrl = await resizeAndCompressImage(dataUrl);
          onImageSelected(compressedDataUrl);
        } catch (error) {
          console.error('Error compressing camera image:', error);
          onImageSelected(dataUrl); // Fallback to original if compression fails
        }

        stopCamera();
      }
    }
  };

  // Handle file upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Bitte waehle eine Bilddatei aus.');
        return;
      }

      try {
        // Resize and compress the uploaded image
        const compressedDataUrl = await resizeAndCompressImage(file);
        onImageSelected(compressedDataUrl);
      } catch (error) {
        console.error('Error processing uploaded image:', error);
        alert('Fehler beim Verarbeiten des Bildes. Bitte versuche es erneut.');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className={`text-sm font-medium ${darkMode ? 'text-white/50' : 'text-gray-600'}`}>
          Optional: Foto hochladen oder aufnehmen
        </p>
      </div>

      {/* Upload/Camera Buttons */}
      {!currentImage && !showCamera && (
        <div className="flex gap-3">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
              darkMode
                ? 'bg-white/[0.08] text-[#A989F2] border border-white/10 hover:bg-white/[0.12]'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            <Upload className="w-5 h-5" />
            <span className="font-medium">Bild hochladen</span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startCamera}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
              darkMode
                ? 'bg-white/[0.08] text-[#FF6B9D] border border-white/10 hover:bg-white/[0.12]'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="font-medium">Foto aufnehmen</span>
          </motion.button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Camera View */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="space-y-3"
          >
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto max-h-96 object-cover mirror"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
            <div className="flex gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={capturePhoto}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-semibold"
                style={{ background: 'linear-gradient(135deg, #A989F2, #FF6B9D)' }}
              >
                <Camera className="w-5 h-5" />
                <span>Foto aufnehmen</span>
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={stopCamera}
                className={`px-4 py-3 rounded-xl transition-colors ${
                  darkMode
                    ? 'bg-white/10 text-white/70 hover:bg-white/15'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview uploaded/captured image */}
      <AnimatePresence>
        {currentImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative"
          >
            <div className={`relative rounded-2xl overflow-hidden border-4 ${
              darkMode ? 'border-white/10 bg-white/[0.04]' : 'border-amber-200 bg-white'
            }`}>
              <img
                src={currentImage}
                alt="Referenzbild"
                className="w-full h-auto max-h-64 object-contain"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClearImage}
                  className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
            <div className={`mt-2 flex items-center gap-2 text-xs rounded-lg p-2 ${
              darkMode
                ? 'text-white/40 bg-white/[0.04]'
                : 'text-gray-500 bg-amber-50'
            }`}>
              <ImageIcon className={`w-4 h-4 ${darkMode ? 'text-[#A989F2]' : 'text-amber-500'}`} />
              <div className="flex-1">
                <div>Dieses Foto wird als Referenz fuer die AI-Bildgenerierung verwendet</div>
                <div className={`font-medium mt-0.5 ${darkMode ? 'text-[#2DD4BF]' : 'text-amber-600'}`}>
                  Optimiert: max. 1024px, JPEG-Komprimierung
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImageUploadCamera;

