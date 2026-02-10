import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { useTheme } from '../../contexts/ThemeContext';
import TaviChat from './TaviChat';

type TaviButtonProps = {
  showLauncher?: boolean;
};

const TaviButton: React.FC<TaviButtonProps> = ({ showLauncher = true }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const openHandler = () => setIsChatOpen(true);
    const toggleHandler = () => setIsChatOpen((prev) => !prev);

    window.addEventListener('tavi:open', openHandler);
    window.addEventListener('tavi:toggle', toggleHandler);

    return () => {
      window.removeEventListener('tavi:open', openHandler);
      window.removeEventListener('tavi:toggle', toggleHandler);
    };
  }, []);

  return (
    <>
      {showLauncher && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="fixed bottom-6 right-6 z-[1001] hidden md:block"
        >
          <motion.div
            animate={{ y: isChatOpen ? 0 : [0, -4, 0] }}
            transition={isChatOpen ? { duration: 0.2 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative">
              <AnimatePresence>
                {!isChatOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.18, 0.45] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -inset-1.5 rounded-full border-2"
                    style={{ borderColor: isDark ? 'rgba(125,157,198,0.45)' : 'rgba(88,131,125,0.45)' }}
                  />
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsChatOpen((prev) => !prev)}
                className="relative h-[58px] w-[58px] rounded-full border-[2px] bg-cover bg-center shadow-xl transition-all"
                style={{
                  backgroundImage: 'url(/tavi.png)',
                  borderColor: isDark ? 'rgba(126,161,201,0.62)' : 'rgba(88,131,125,0.62)',
                  boxShadow: isDark
                    ? '0 12px 30px rgba(7,13,23,0.45)'
                    : '0 12px 26px rgba(55,68,88,0.25)',
                }}
                aria-label="Tavi Chat oeffnen"
              >
                {!isChatOpen && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-emerald-400 text-[9px] font-bold text-white">
                    +
                  </span>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <TaviChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};

export default TaviButton;
