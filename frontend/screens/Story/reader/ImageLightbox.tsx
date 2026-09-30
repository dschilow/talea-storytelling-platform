import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  src: string | null;
  alt: string;
  onClose: () => void;
}

/** Full-screen view of an illustration. Closes on backdrop tap, X or Escape. */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!src) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [src, onClose]);

  // Portalled to <body>: inside the reader's stacking context the app's floating
  // bottom nav (z-70) would still sit on top of the enlarged picture.
  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          className="rd-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
        >
          <button ref={closeRef} type="button" className="rd-lightbox-close" onClick={onClose} aria-label="Bild schließen">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <motion.img
            src={src}
            alt={alt}
            className="rd-lightbox-img"
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.2, 0.65, 0.3, 0.9] }}
            onClick={(event) => event.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
