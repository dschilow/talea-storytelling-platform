import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useLoading } from '../../contexts/LoadingContext';
import { motion, AnimatePresence } from 'framer-motion';

const GlobalLoader: React.FC = () => {
  const { isLoading, loadingMessage } = useLoading();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(10, 10, 20, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{
              width: 200,
              height: 200,
            }}
          >
            <DotLottieReact
              src="/loading-animation.lottie"
              loop
              autoplay
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </motion.div>
          
          {loadingMessage && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              style={{
                marginTop: '1rem',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '1.1rem',
                fontWeight: 500,
                textAlign: 'center',
                maxWidth: '300px',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              {loadingMessage}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalLoader;
