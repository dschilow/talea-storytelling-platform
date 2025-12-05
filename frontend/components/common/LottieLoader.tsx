import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { motion } from 'framer-motion';

interface LottieLoaderProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
}

/**
 * Lottie-basierter Ladeindikator
 * 
 * @param message - Optionale Nachricht unter der Animation
 * @param size - Größe der Animation in Pixeln (Standard: 150)
 * @param fullScreen - Wenn true, wird der Loader als Vollbild-Overlay angezeigt
 */
const LottieLoader: React.FC<LottieLoaderProps> = ({ 
  message, 
  size = 150,
  fullScreen = false 
}) => {
  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}
    >
      <div style={{ width: size, height: size }}>
        <DotLottieReact
          src="/loading-animation.lottie"
          loop
          autoplay
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
      
      {message && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '1.1rem',
            fontWeight: 500,
            textAlign: 'center',
            maxWidth: '280px',
            margin: 0,
          }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10, 10, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 9999,
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight: '200px',
      }}
    >
      {content}
    </div>
  );
};

export default LottieLoader;
