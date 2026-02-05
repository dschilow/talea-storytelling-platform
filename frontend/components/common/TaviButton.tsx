import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TaviChat from './TaviChat';

const TaviButton: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {/* Floating Tavi button — always visible */}
      <motion.div
        initial={{ opacity: 0, scale: 0, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="fixed bottom-[120px] right-5 z-[1001]"
      >
        {/* Float animation wrapper */}
        <motion.div
          animate={{ y: isChatOpen ? 0 : [0, -8, 0] }}
          transition={isChatOpen ? { duration: 0.2 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="relative">
            {/* Pulse ring — only when chat is closed */}
            <AnimatePresence>
              {!isChatOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -inset-1.5 rounded-full border-2 border-[#A989F2]/50"
                />
              )}
            </AnimatePresence>

            {/* Outer glow */}
            <div className={`absolute -inset-3 rounded-full blur-xl transition-colors duration-300 ${isChatOpen ? 'bg-[#A989F2]/25' : 'bg-[#A989F2]/15'}`} />

            {/* Button */}
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              animate={isChatOpen ? { rotate: 0 } : {}}
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`relative w-[68px] h-[68px] rounded-full bg-cover bg-center border-[3px] shadow-xl transition-all duration-300 cursor-pointer ${
                isChatOpen
                  ? 'border-[#A989F2]/70 shadow-purple-500/40 ring-4 ring-[#A989F2]/20'
                  : 'border-[#A989F2]/40 shadow-purple-500/25 hover:shadow-purple-500/40 hover:border-[#A989F2]/60'
              }`}
              style={{ backgroundImage: 'url(/tavi.png)' }}
            >
              {/* Notification sparkle — only when chat is closed */}
              <AnimatePresence>
                {!isChatOpen && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B9D] to-[#FF9B5C] border-2 border-white dark:border-slate-900 flex items-center justify-center"
                  >
                    <span className="text-white text-[9px] font-bold">✦</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active indicator when chat is open */}
              <AnimatePresence>
                {isChatOpen && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      <TaviChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};

export default TaviButton;
