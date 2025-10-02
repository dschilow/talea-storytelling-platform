"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { X } from 'lucide-react'

// Context for card expansion state
interface AnimatedCardContextType {
  expandedCardId: string | null
  expandCard: (cardId: string) => void
  collapseCard: () => void
  isCardExpanded: (cardId: string) => boolean
}

const AnimatedCardContext = createContext<AnimatedCardContextType | undefined>(undefined)

export const useAnimatedCard = () => {
  const context = useContext(AnimatedCardContext)
  if (!context) {
    throw new Error('useAnimatedCard must be used within an AnimatedCardProvider')
  }
  return context
}

interface AnimatedCardProviderProps {
  children: ReactNode
}

export const AnimatedCardProvider: React.FC<AnimatedCardProviderProps> = ({ children }) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  const expandCard = (cardId: string) => {
    setExpandedCardId(cardId)
  }

  const collapseCard = () => {
    setExpandedCardId(null)
  }

  const isCardExpanded = (cardId: string) => {
    return expandedCardId === cardId
  }

  const contextValue: AnimatedCardContextType = {
    expandedCardId,
    expandCard,
    collapseCard,
    isCardExpanded,
  }

  return (
    <AnimatedCardContext.Provider value={contextValue}>
      {children}
    </AnimatedCardContext.Provider>
  )
}

// Main AnimatedCard component
interface AnimatedCardProps {
  children: ReactNode
  cardId: string
  className?: string
  collapsedSize: { width: number; height: number }
  expandedSize: { width: number; height: number }
  onExpand?: () => void
  onCollapse?: () => void
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  cardId,
  className = '',
  collapsedSize,
  expandedSize,
  onExpand,
  onCollapse,
}) => {
  const { expandedCardId, expandCard, collapseCard, isCardExpanded } = useAnimatedCard()
  const isExpanded = isCardExpanded(cardId)
  
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-300, 300], [30, -30])
  const rotateY = useTransform(mouseX, [-300, 300], [-30, 30])
  
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isExpanded) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    mouseX.set(event.clientX - centerX)
    mouseY.set(event.clientY - centerY)
  }
  
  const handleMouseLeave = () => {
    if (isExpanded) return
    mouseX.set(0)
    mouseY.set(0)
  }
  
  const handleClick = () => {
    if (isExpanded) {
      collapseCard()
      onCollapse?.()
    } else {
      expandCard(cardId)
      onExpand?.()
    }
  }

  if (isExpanded) {
    return (
      <>
        {/* Placeholder to maintain grid space */}
        <div
          style={{
            width: collapsedSize.width,
            height: collapsedSize.height,
            visibility: 'hidden',
          }}
        />
        
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
          onClick={handleClick}
        />
        
        {/* Expanded card */}
        <motion.div
          layoutId={`card-${cardId}`}
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[9999] ${className}`}
          initial={false}
          animate={{
            width: expandedSize.width,
            height: expandedSize.height,
            scale: 1,
          }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 300,
            duration: 0.4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={handleClick}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          
          {children}
        </motion.div>
      </>
    )
  }

  return (
    <motion.div
      layoutId={`card-${cardId}`}
      className={`bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden cursor-pointer transition-shadow duration-300 ${className}`}
      style={{
        width: collapsedSize.width,
        height: collapsedSize.height,
        rotateX: isExpanded ? 0 : rotateX,
        rotateY: isExpanded ? 0 : rotateY,
        transformStyle: "preserve-3d",
      }}
      whileHover={{
        scale: 1.02,
        y: -5,
      }}
      whileTap={{ scale: 0.98 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      transition={{
        type: "spring",
        damping: 20,
        stiffness: 300,
      }}
    >
      {children}
    </motion.div>
  )
}

// Card content components
interface AnimatedCardHeaderProps {
  children: ReactNode
  className?: string
}

export const AnimatedCardHeader: React.FC<AnimatedCardHeaderProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}

interface AnimatedCardContentProps {
  children: ReactNode
  className?: string
  showOnlyWhenExpanded?: boolean
}

export const AnimatedCardContent: React.FC<AnimatedCardContentProps> = ({ 
  children, 
  className = '',
  showOnlyWhenExpanded = false
}) => {
  const { expandedCardId } = useAnimatedCard()
  const isExpanded = expandedCardId !== null
  
  if (showOnlyWhenExpanded && !isExpanded) {
    return null
  }
  
  return (
    <motion.div 
      className={`px-6 pb-6 ${className}`}
      initial={showOnlyWhenExpanded ? { opacity: 0, y: 20 } : false}
      animate={showOnlyWhenExpanded && isExpanded ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.2, duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedCardFooterProps {
  children: ReactNode
  className?: string
}

export const AnimatedCardFooter: React.FC<AnimatedCardFooterProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`px-6 pb-6 border-t border-gray-100 dark:border-gray-800 pt-4 mt-auto ${className}`}>
      {children}
    </div>
  )
}