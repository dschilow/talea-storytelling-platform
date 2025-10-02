"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface CardManagerContextType {
  expandedCardId: string | null
  expandCard: (cardId: string) => void
  collapseCard: (cardId: string) => void
  isCardExpanded: (cardId: string) => boolean
}

const CardManagerContext = createContext<CardManagerContextType | undefined>(undefined)

export const useCardManager = () => {
  const context = useContext(CardManagerContext)
  if (!context) {
    throw new Error('useCardManager must be used within a CardManagerProvider')
  }
  return context
}

interface CardManagerProviderProps {
  children: ReactNode
}

export const CardManagerProvider: React.FC<CardManagerProviderProps> = ({ children }) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  const expandCard = (cardId: string) => {
    setExpandedCardId(cardId)
  }

  const collapseCard = (cardId: string) => {
    if (expandedCardId === cardId) {
      setExpandedCardId(null)
    }
  }

  const isCardExpanded = (cardId: string) => {
    return expandedCardId === cardId
  }

  const contextValue: CardManagerContextType = {
    expandedCardId,
    expandCard,
    collapseCard,
    isCardExpanded,
  }

  return (
    <CardManagerContext.Provider value={contextValue}>
      {children}
    </CardManagerContext.Provider>
  )
}