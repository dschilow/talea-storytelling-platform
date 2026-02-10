"use client"

import React from 'react'
import { BookOpen, Calendar, Brain, Activity, Edit, Globe, Lock, Users, Zap, Target } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  AnimatedCard,
  AnimatedCardHeader,
  AnimatedCardContent,
  AnimatedCardFooter,
  useAnimatedCard,
} from '../ui/animated-card'
import type { Doku } from '../../types/doku'
import { motion } from 'framer-motion'

interface DokuAnimatedCardProps {
  doku: Doku
  onRead?: (doku: Doku) => void
  onEdit?: (doku: Doku) => void
}

export const DokuAnimatedCard: React.FC<DokuAnimatedCardProps> = ({ 
  doku, 
  onRead, 
  onEdit 
}) => {
  const { isCardExpanded } = useAnimatedCard()
  const isExpanded = isCardExpanded(`doku-${doku.id}`)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getTopicBadgeClass = (topic: string) => {
    const colorMap: { [key: string]: string } = {
      'Wissenschaft': 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-900/20 dark:text-stone-300',
      'Technologie': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300',
      'Geschichte': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300',
      'Kunst': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300',
      'Sport': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300',
      'Natur': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300',
    }
    
    return colorMap[topic] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300'
  }

  const getDepthIcon = (depth?: string) => {
    switch (depth) {
      case 'basic': return <Brain className="w-4 h-4" />
      case 'standard': return <BookOpen className="w-4 h-4" />
      case 'deep': return <Activity className="w-4 h-4" />
      default: return <BookOpen className="w-4 h-4" />
    }
  }

  const getDepthLabel = (depth?: string) => {
    switch (depth) {
      case 'basic': return 'Einfach'
      case 'standard': return 'Standard'
      case 'deep': return 'Vertieft'
      default: return 'Standard'
    }
  }

  const getDepthColor = (depth?: string) => {
    switch (depth) {
      case 'basic': return 'text-green-600'
      case 'standard': return 'text-stone-600'
      case 'deep': return 'text-amber-600'
      default: return 'text-stone-600'
    }
  }

  const handleRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRead?.(doku)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(doku)
  }

  return (
    <AnimatedCard
      cardId={`doku-${doku.id}`}
      collapsedSize={{ width: 300, height: 240 }}
      expandedSize={{ width: 520, height: 680 }}
      className="group"
      onExpand={() => console.log(`Expanding doku: ${doku.title}`)}
      onCollapse={() => console.log(`Collapsing doku: ${doku.title}`)}
    >
      <AnimatedCardHeader className="relative p-0">
        {/* Cover Image with enhanced styling */}
        <motion.div 
          className="relative overflow-hidden"
          whileHover={{ scale: isExpanded ? 1 : 1.02 }}
          transition={{ duration: 0.3 }}
        >
          <img
            src={doku.coverImageUrl || '/placeholder-doku.jpg'}
            alt={doku.title}
            className={`w-full object-cover transition-all duration-500 ${
              isExpanded ? 'h-48' : 'h-32'
            }`}
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          
          {/* Topic Badge */}
          <motion.div 
            className="absolute top-3 left-3"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring" }}
          >
            <Badge
              variant="outline"
              className={`${getTopicBadgeClass(doku.topic)} shadow-lg backdrop-blur-sm font-medium`}
            >
              {doku.topic}
            </Badge>
          </motion.div>

          {/* Visibility Badge */}
          <motion.div 
            className="absolute top-3 right-3"
            initial={{ scale: 0, rotate: 10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring" }}
          >
            <Badge variant="outline" className="bg-black/60 text-white border-transparent shadow-lg backdrop-blur-sm">
              {doku.isPublic ? (
                <Globe className="w-3 h-3 mr-1" />
              ) : (
                <Lock className="w-3 h-3 mr-1" />
              )}
              {doku.isPublic ? 'Öffentlich' : 'Privat'}
            </Badge>
          </motion.div>

          {/* Depth Badge - Enhanced */}
          <motion.div 
            className="absolute bottom-3 right-3"
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: isExpanded ? 1 : 0.9, y: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <Badge variant="outline" className="bg-black/60 text-white border-transparent shadow-lg backdrop-blur-sm">
              <div className={getDepthColor()}>
                {getDepthIcon()}
              </div>
              <span className="ml-1">{getDepthLabel()}</span>
            </Badge>
          </motion.div>
          
          {/* Title overlay on image */}
          <div className="absolute bottom-4 left-4 right-16">
            <motion.h3 
              className={`font-bold text-white drop-shadow-lg transition-all duration-300 line-clamp-2 ${
                isExpanded ? 'text-xl' : 'text-lg'
              }`}
              layout
            >
              {doku.title}
            </motion.h3>
          </div>
        </motion.div>
      </AnimatedCardHeader>

      {/* Summary - Always visible but styled differently */}
      <div className="px-6 py-4">
        <motion.p 
          className={`text-sm text-gray-600 dark:text-gray-400 leading-relaxed transition-all duration-300 ${
            isExpanded ? 'line-clamp-none' : 'line-clamp-2'
          }`}
          layout
        >
          {doku.summary}
        </motion.p>
      </div>

      {/* Expanded Content */}
      <AnimatedCardContent showOnlyWhenExpanded className="pt-0">
        <div className="space-y-5">
          {/* Doku Details with beautiful styling */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, staggerChildren: 0.05 }}
          >
            <motion.div 
              className="flex items-center p-3 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <BookOpen className="w-4 h-4 mr-2 text-teal-600" />
              <span className="text-sm font-medium text-teal-800 dark:text-teal-200">Thema:</span>
              <span className="ml-1 text-sm text-gray-700 dark:text-gray-300">{doku.topic}</span>
            </motion.div>
            
            {doku.content?.sections && (
              <motion.div 
                className="flex items-center p-3 rounded-xl bg-gradient-to-r from-stone-50 to-stone-50 dark:from-stone-900/20 dark:to-stone-900/20"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Activity className="w-4 h-4 mr-2 text-stone-600" />
                <span className="text-sm font-medium text-stone-800 dark:text-stone-200">Kapitel:</span>
                <span className="ml-1 text-sm text-gray-700 dark:text-gray-300">{doku.content.sections.length}</span>
              </motion.div>
            )}

            <motion.div 
              className="flex items-center p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {doku.isPublic ? (
                <>
                  <Globe className="w-4 h-4 mr-2 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Öffentlich sichtbar</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Privat</span>
                </>
              )}
            </motion.div>
          </motion.div>

          {/* Interactive Elements with enhanced design */}
          {doku.content?.sections && doku.content.sections.some(s => s.interactive) && (
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="font-medium text-sm text-gray-800 dark:text-gray-100 flex items-center">
                <Users className="w-4 h-4 mr-2 text-amber-500" />
                Interaktive Inhalte:
              </h4>
              <div className="flex flex-wrap gap-2">
                {doku.content.sections
                  .filter(s => s.interactive)
                  .map((section, index) => (
                    <div key={index} className="flex flex-wrap gap-2">
                      {section.interactive?.quiz?.enabled && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 + index * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                        >
                          <Badge variant="outline" className="bg-stone-50 dark:bg-stone-900/20 text-stone-700 dark:text-stone-300 border-stone-200 shadow-sm">
                            <Brain className="w-3 h-3 mr-1" />
                            Quiz
                          </Badge>
                        </motion.div>
                      )}
                      {section.interactive?.activities?.enabled && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.35 + index * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                        >
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 shadow-sm">
                            <Target className="w-3 h-3 mr-1" />
                            Aktivitäten
                          </Badge>
                        </motion.div>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Metadata with enhanced styling */}
          {doku.metadata && (
            <motion.div 
              className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="grid grid-cols-2 gap-4 text-xs">
                {doku.metadata.tokensUsed && (
                  <div className="flex items-center">
                    <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                    <span className="text-gray-600 dark:text-gray-400">Tokens:</span>
                    <span className="ml-1 font-semibold text-gray-800 dark:text-gray-200">
                      {doku.metadata.tokensUsed.total.toLocaleString()}
                    </span>
                  </div>
                )}
                {doku.metadata.processingTime && (
                  <div className="flex items-center">
                    <Activity className="w-3 h-3 mr-1 text-stone-500" />
                    <span className="text-gray-600 dark:text-gray-400">Zeit:</span>
                    <span className="ml-1 font-semibold text-gray-800 dark:text-gray-200">
                      {Math.round(doku.metadata.processingTime / 1000)}s
                    </span>
                  </div>
                )}
                {doku.metadata.imagesGenerated && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 mr-1 bg-amber-500 rounded-sm" />
                    <span className="text-gray-600 dark:text-gray-400">Bilder:</span>
                    <span className="ml-1 font-semibold text-gray-800 dark:text-gray-200">
                      {doku.metadata.imagesGenerated}
                    </span>
                  </div>
                )}
                {doku.metadata.totalCost && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 mr-1 bg-green-500 rounded-full" />
                    <span className="text-gray-600 dark:text-gray-400">Kosten:</span>
                    <span className="ml-1 font-semibold text-gray-800 dark:text-gray-200">
                      ${doku.metadata.totalCost.total.toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div 
            className="space-y-3 pt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              onClick={handleRead}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Doku lesen
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full border-2 border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all duration-300"
              onClick={handleEdit}
            >
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
          </motion.div>
        </div>
      </AnimatedCardContent>

      {/* Footer */}
      <AnimatedCardFooter className={isExpanded ? 'mt-6' : 'mt-auto'}>
        <motion.div 
          className="flex items-center justify-between w-full text-sm"
          layout
        >
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <Calendar className="w-3 h-3 mr-1" />
            <span>Erstellt: {formatDate(doku.createdAt)}</span>
          </div>
          
          <Badge 
            variant="outline"
            className={`shadow-sm ${
              doku.status === 'complete' 
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
                : doku.status === 'generating'
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
            }`}
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              doku.status === 'complete' ? 'bg-green-500' : 
              doku.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            {doku.status === 'complete' ? 'Fertig' : 
             doku.status === 'generating' ? 'Wird erstellt...' : 'Fehler'}
          </Badge>
        </motion.div>
      </AnimatedCardFooter>
    </AnimatedCard>
  )
}
