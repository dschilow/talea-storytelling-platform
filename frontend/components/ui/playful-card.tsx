"use client";

import React, { useState, useRef, createContext, useContext } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Context für Card State Management
interface PlayfulCardContextType {
  expandedCardId: string | null;
  expandCard: (cardId: string) => void;
  collapseCard: () => void;
}

const PlayfulCardContext = createContext<PlayfulCardContextType | undefined>(undefined);

export const usePlayfulCard = () => {
  const context = useContext(PlayfulCardContext);
  if (!context) {
    throw new Error('usePlayfulCard must be used within a PlayfulCardProvider');
  }
  return context;
};

interface PlayfulCardProviderProps {
  children: React.ReactNode;
}

export const PlayfulCardProvider: React.FC<PlayfulCardProviderProps> = ({ children }) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const expandCard = (cardId: string) => {
    setExpandedCardId(cardId);
  };

  const collapseCard = () => {
    setExpandedCardId(null);
  };

  return (
    <PlayfulCardContext.Provider value={{ expandedCardId, expandCard, collapseCard }}>
      {children}
    </PlayfulCardContext.Provider>
  );
};

// Hauptkomponente für kinderfreundliche Cards
interface PlayfulCardProps {
  cardId: string;
  children: React.ReactNode;
  className?: string;
  color?: 'blue' | 'pink' | 'green' | 'purple' | 'orange' | 'yellow';
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

export const PlayfulCard: React.FC<PlayfulCardProps> = ({
  cardId,
  children,
  className = '',
  color = 'blue',
  size = 'medium',
  onClick,
}) => {
  const { expandedCardId, expandCard, collapseCard } = usePlayfulCard();
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedCardId === cardId;

  // React Spring Animationen für Bounce-Effekte
  const bounceSpring = useSpring({
    transform: isHovered && !isExpanded 
      ? 'scale(1.05) rotate(-2deg)' 
      : 'scale(1) rotate(0deg)',
    boxShadow: isHovered && !isExpanded
      ? '0 20px 40px rgba(0,0,0,0.15)'
      : '0 8px 25px rgba(0,0,0,0.1)',
    config: {
      tension: 300,
      friction: 10,
      mass: 0.8,
    },
  });

  const wiggleSpring = useSpring({
    transform: isExpanded 
      ? 'translateY(0px)' 
      : isHovered 
        ? 'translateY(-8px)' 
        : 'translateY(0px)',
    config: config.wobbly,
  });

  // Farb-Themes für Kinder
  const colorThemes = {
    blue: {
      gradient: 'from-stone-400 via-stone-500 to-stone-600',
      accent: 'bg-stone-100',
      border: 'border-stone-300',
      shadow: 'shadow-stone-200/50',
    },
    pink: {
      gradient: 'from-orange-400 via-orange-500 to-orange-600',
      accent: 'bg-orange-100',
      border: 'border-orange-300',
      shadow: 'shadow-orange-200/50',
    },
    green: {
      gradient: 'from-green-400 via-green-500 to-green-600',
      accent: 'bg-green-100',
      border: 'border-green-300',
      shadow: 'shadow-green-200/50',
    },
    purple: {
      gradient: 'from-amber-400 via-amber-500 to-amber-600',
      accent: 'bg-amber-100',
      border: 'border-amber-300',
      shadow: 'shadow-amber-200/50',
    },
    orange: {
      gradient: 'from-orange-400 via-orange-500 to-orange-600',
      accent: 'bg-orange-100',
      border: 'border-orange-300',
      shadow: 'shadow-orange-200/50',
    },
    yellow: {
      gradient: 'from-yellow-400 via-yellow-500 to-yellow-600',
      accent: 'bg-yellow-100',
      border: 'border-yellow-300',
      shadow: 'shadow-yellow-200/50',
    },
  };

  const sizeClasses = {
    small: 'w-64 h-48',
    medium: 'w-72 h-56',
    large: 'w-80 h-64',
  };

  const theme = colorThemes[color];
  const sizeClass = sizeClasses[size];

  const handleClick = () => {
    if (isExpanded) {
      collapseCard();
    } else {
      expandCard(cardId);
      onClick?.();
    }
  };

  if (isExpanded) {
    return (
      <>
        {/* Backdrop */}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]"
            onClick={collapseCard}
          />
        </AnimatePresence>

        {/* Expanded Card */}
        <motion.div
          layoutId={`playful-card-${cardId}`}
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-3xl shadow-2xl border-4 ${theme.border} ${theme.shadow} overflow-hidden max-w-md w-[90vw] max-h-[80vh]`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{
            type: "spring",
            damping: 15,
            stiffness: 300,
            mass: 0.8,
          }}
        >
          {/* Gradient Header */}
          <div className={`h-20 bg-gradient-to-r ${theme.gradient} relative overflow-hidden`}>
            {/* Playful decorative elements */}
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/20 rounded-full"></div>
            <div className="absolute -top-2 -left-6 w-12 h-12 bg-white/15 rounded-full"></div>
            <div className="absolute top-8 right-8 w-8 h-8 bg-white/25 rounded-full"></div>
            
            {/* Close Button */}
            <button
              onClick={collapseCard}
              className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-5rem)]">
            {children}
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <animated.div
      ref={cardRef}
      style={bounceSpring}
      className={`cursor-pointer select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <animated.div
        style={wiggleSpring}
        className={`${sizeClass} bg-white rounded-2xl border-3 ${theme.border} ${theme.shadow} overflow-hidden transition-all duration-300`}
      >
        {/* Gradient Top Bar - Kinderfreundliches Design */}
        <motion.div 
          className={`h-6 bg-gradient-to-r ${theme.gradient} relative overflow-hidden`}
          layoutId={`playful-card-header-${cardId}`}
        >
          {/* Spielerische Dekorationselemente */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-white/30 rounded-full animate-pulse"></div>
          <div className="absolute top-1 left-2 w-2 h-2 bg-white/40 rounded-full"></div>
          <div className="absolute top-1 right-6 w-3 h-3 bg-white/25 rounded-full"></div>
        </motion.div>

        {/* Card Content */}
        <motion.div 
          className="p-4 h-[calc(100%-1.5rem)] relative"
          layoutId={`playful-card-content-${cardId}`}
        >
          {/* Subtle background pattern */}
          <div className={`absolute inset-0 ${theme.accent} opacity-30 rounded-bl-2xl rounded-br-2xl`}>
            <div className="absolute top-2 left-2 w-8 h-8 bg-white/40 rounded-full opacity-50"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 bg-white/30 rounded-full opacity-40"></div>
            <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white/20 rounded-full opacity-60"></div>
          </div>
          
          {/* Actual content */}
          <div className="relative z-10">
            {children}
          </div>
        </motion.div>
      </animated.div>
    </animated.div>
  );
};

// Header Komponente für Cards
interface PlayfulCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const PlayfulCardHeader: React.FC<PlayfulCardHeaderProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
};

// Title Komponente mit kinderfreundlicher Typografie
interface PlayfulCardTitleProps {
  children: React.ReactNode;
  className?: string;
  emoji?: string;
}

export const PlayfulCardTitle: React.FC<PlayfulCardTitleProps> = ({ 
  children, 
  className = '',
  emoji 
}) => {
  return (
    <h3 className={`text-lg font-bold text-gray-800 mb-2 flex items-center gap-2 ${className}`}>
      {emoji && <span className="text-xl">{emoji}</span>}
      {children}
    </h3>
  );
};

// Description Komponente
interface PlayfulCardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const PlayfulCardDescription: React.FC<PlayfulCardDescriptionProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <p className={`text-gray-600 text-sm leading-relaxed ${className}`}>
      {children}
    </p>
  );
};

// Button Komponente mit kinderfreundlichem Design
interface PlayfulButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  color?: 'blue' | 'pink' | 'green' | 'purple' | 'orange' | 'yellow';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  emoji?: string;
}

export const PlayfulButton: React.FC<PlayfulButtonProps> = ({
  children,
  onClick,
  color = 'blue',
  size = 'medium',
  className = '',
  emoji,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const buttonSpring = useSpring({
    transform: isPressed ? 'scale(0.95)' : 'scale(1)',
    config: { tension: 300, friction: 10 },
  });

  const colorClasses = {
    blue: 'bg-gradient-to-r from-stone-500 to-stone-600 hover:from-stone-600 hover:to-stone-700 shadow-stone-200',
    pink: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-200',
    green: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-200',
    purple: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-200',
    orange: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-200',
    yellow: 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-yellow-200',
  };

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
  };

  return (
    <animated.button
      style={buttonSpring}
      className={`${colorClasses[color]} ${sizeClasses[size]} text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 ${className}`}
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {emoji && <span>{emoji}</span>}
      {children}
    </animated.button>
  );
};
