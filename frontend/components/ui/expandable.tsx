"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { useCardManager } from './card-manager'

// Context für Expandable State
interface ExpandableContextType {
  isExpanded: boolean
  onToggle: () => void
  expandDirection: 'horizontal' | 'vertical' | 'both'
  expandBehavior: 'replace' | 'push'
  onExpandStart?: () => void
  onExpandEnd?: () => void
}

const ExpandableContext = createContext<ExpandableContextType | undefined>(undefined)

export const useExpandable = () => {
  const context = useContext(ExpandableContext)
  if (!context) {
    throw new Error('useExpandable must be used within an Expandable component')
  }
  return context
}

// Main Expandable Component
interface ExpandableProps {
  children: ({ isExpanded }: { isExpanded: boolean }) => ReactNode | ReactNode
  expanded?: boolean
  onToggle?: () => void
  expandDirection?: 'horizontal' | 'vertical' | 'both'
  expandBehavior?: 'replace' | 'push'
  initialDelay?: number
  onExpandStart?: () => void
  onExpandEnd?: () => void
  cardId?: string
}

export const Expandable: React.FC<ExpandableProps> = ({
  children,
  expanded,
  onToggle,
  expandDirection = 'both',
  expandBehavior = 'replace',
  initialDelay = 0,
  onExpandStart,
  onExpandEnd,
  cardId,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const cardManager = cardId ? useCardManager() : null
  
  const isExpanded = expanded !== undefined ? expanded : 
    cardId ? cardManager?.isCardExpanded(cardId) ?? false : internalExpanded
  
  const handleToggle = () => {
    if (onExpandStart && !isExpanded) {
      onExpandStart()
    }
    if (onExpandEnd && isExpanded) {
      onExpandEnd()
    }
    
    if (onToggle) {
      onToggle()
    } else if (cardId && cardManager) {
      if (isExpanded) {
        cardManager.collapseCard(cardId)
      } else {
        cardManager.expandCard(cardId)
      }
    } else {
      setInternalExpanded(!internalExpanded)
    }
  }

  const contextValue: ExpandableContextType = {
    isExpanded,
    onToggle: handleToggle,
    expandDirection,
    expandBehavior,
    onExpandStart,
    onExpandEnd,
  }

  return (
    <ExpandableContext.Provider value={contextValue}>
      {typeof children === 'function' ? children({ isExpanded }) : children}
    </ExpandableContext.Provider>
  )
}

// ExpandableCard Component
interface ExpandableCardProps {
  children: ReactNode
  className?: string
  collapsedSize: { width: number; height: number }
  expandedSize: { width: number; height: number }
  hoverToExpand?: boolean
  expandDelay?: number
  collapseDelay?: number
  layoutId?: string
  centerOnExpand?: boolean
}

export const ExpandableCard: React.FC<ExpandableCardProps> = ({
  children,
  className = '',
  collapsedSize,
  expandedSize,
  hoverToExpand = false,
  expandDelay = 300,
  collapseDelay = 200,
  layoutId,
  centerOnExpand = true,
}) => {
  const { isExpanded, onToggle } = useExpandable()
  
  if (isExpanded) {
    return (
      <>
        {/* Placeholder to maintain grid space */}
        <div
          style={{
            width: collapsedSize.width,
            height: collapsedSize.height,
            visibility: 'hidden'
          }}
        />
        
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm"
          style={{ zIndex: 9998 }}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        />
        
        {/* Expanded card in portal-like fixed positioning */}
        <motion.div
          layoutId={layoutId}
          className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer ${className}`}
          initial={{
            width: collapsedSize.width,
            height: collapsedSize.height,
          }}
          animate={{
            width: expandedSize.width,
            height: expandedSize.height,
          }}
          exit={{
            width: collapsedSize.width,
            height: collapsedSize.height,
          }}
          transition={{
            duration: expandDelay / 1000,
            ease: 'easeInOut',
          }}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            transformOrigin: 'center',
          }}
        >
          {children}
        </motion.div>
      </>
    )
  }
  
  return (
    <motion.div
      layoutId={layoutId}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer ${className}`}
      style={{
        width: collapsedSize.width,
        height: collapsedSize.height,
        transformOrigin: 'center',
      }}
    >
      {children}
    </motion.div>
  )
}

// ExpandableTrigger Component
interface ExpandableTriggerProps {
  children: ReactNode
}

export const ExpandableTrigger: React.FC<ExpandableTriggerProps> = ({ children }) => {
  const { onToggle, isExpanded } = useExpandable()
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle()
  }
  
  return (
    <div onClick={handleClick} className="h-full w-full">
      {children}
    </div>
  )
}

// ExpandableCardHeader Component
interface ExpandableCardHeaderProps {
  children: ReactNode
  className?: string
}

export const ExpandableCardHeader: React.FC<ExpandableCardHeaderProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  )
}

// ExpandableCardContent Component
interface ExpandableCardContentProps {
  children: ReactNode
  className?: string
}

export const ExpandableCardContent: React.FC<ExpandableCardContentProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`px-4 flex-1 ${className}`}>
      {children}
    </div>
  )
}

// ExpandableCardFooter Component
interface ExpandableCardFooterProps {
  children: ReactNode
  className?: string
}

export const ExpandableCardFooter: React.FC<ExpandableCardFooterProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`p-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  )
}

// ExpandableContent Component
interface ExpandableContentProps {
  children: ReactNode
  preset?: 'fade' | 'blur-sm' | 'blur-md' | 'slide-up' | 'slide-down'
  stagger?: boolean
  staggerChildren?: number
  keepMounted?: boolean
  animateIn?: {
    initial: any
    animate: any
    transition?: any
  }
}

export const ExpandableContent: React.FC<ExpandableContentProps> = ({
  children,
  preset = 'fade',
  stagger = false,
  staggerChildren = 0.1,
  keepMounted = true,
  animateIn,
}) => {
  const { isExpanded } = useExpandable()

  const getPresetAnimation = () => {
    switch (preset) {
      case 'blur-sm':
        return {
          initial: { opacity: 0, filter: 'blur(4px)' },
          animate: { opacity: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, filter: 'blur(4px)' },
        }
      case 'blur-md':
        return {
          initial: { opacity: 0, filter: 'blur(8px)' },
          animate: { opacity: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, filter: 'blur(8px)' },
        }
      case 'slide-up':
        return {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 20 },
        }
      case 'slide-down':
        return {
          initial: { opacity: 0, y: -20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 },
        }
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        }
    }
  }

  const animation = animateIn || getPresetAnimation()

  if (!keepMounted && !isExpanded) {
    return null
  }

  return (
    <AnimatePresence mode="wait">
      {isExpanded && (
        <motion.div
          initial={animation.initial}
          animate={animation.animate}
          exit={animation.exit}
          transition={{
            duration: 0.3,
            ease: 'easeInOut',
            staggerChildren: stagger ? staggerChildren : 0,
            ...animation.transition,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}