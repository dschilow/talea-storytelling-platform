"use client"

import React from 'react'
import { Book, Calendar, Clock, Users, Play, Edit, Star, Sparkles } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  AnimatedCard,
  AnimatedCardHeader,
  AnimatedCardContent,
  AnimatedCardFooter,
  useAnimatedCard,
} from '../ui/animated-card'
import type { Story } from '../../types/story'
import { motion } from 'framer-motion'

interface StoryAnimatedCardProps {
  story: Story
  onRead?: (story: Story) => void
  onEdit?: (story: Story) => void
}

export const StoryAnimatedCard: React.FC<StoryAnimatedCardProps> = ({ 
  story, 
  onRead, 
  onEdit 
}) => {
  const { isCardExpanded } = useAnimatedCard()
  const isExpanded = isCardExpanded(`story-${story.id}`)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getAgeGroupBadgeClass = (ageGroup: string) => {
    switch (ageGroup) {
      case '3-5': 
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
      case '6-8': 
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
      case '9-12': 
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700'
      case '13+': 
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700'
      default: 
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700'
    }
  }

  const handleRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRead?.(story)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(story)
  }

  return (
    <AnimatedCard
      cardId={`story-${story.id}`}
      collapsedSize={{ width: 300, height: 240 }}
      expandedSize={{ width: 500, height: 620 }}
      className="group"
      onExpand={() => console.log(`Expanding story: ${story.title}`)}
      onCollapse={() => console.log(`Collapsing story: ${story.title}`)}
    >
      <AnimatedCardHeader className="relative p-0">
        {/* Cover Image with enhanced styling */}
        <motion.div 
          className="relative overflow-hidden"
          whileHover={{ scale: isExpanded ? 1 : 1.02 }}
          transition={{ duration: 0.3 }}
        >
          <img
            src={story.coverImageUrl || '/placeholder-story.jpg'}
            alt={story.title}
            className={`w-full object-cover transition-all duration-500 ${
              isExpanded ? 'h-48' : 'h-32'
            }`}
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Age Group Badge */}
          <motion.div 
            className="absolute top-3 left-3"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring" }}
          >
            <Badge
              variant="outline"
              className={`${getAgeGroupBadgeClass(story.config.ageGroup)} shadow-lg backdrop-blur-sm font-medium`}
            >
              {story.config.ageGroup} Jahre
            </Badge>
          </motion.div>

          {/* Reading Time - Enhanced visibility */}
          <motion.div 
            className="absolute top-3 right-3"
            initial={{ scale: 0, rotate: 10 }}
            animate={{ scale: isExpanded ? 1 : 0.9, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <Badge variant="outline" className="bg-black/60 text-white border-transparent shadow-lg backdrop-blur-sm">
              <Clock className="w-3 h-3 mr-1" />
              {story.estimatedReadingTime || 5} Min
            </Badge>
          </motion.div>
          
          {/* Title overlay on image */}
          <div className="absolute bottom-4 left-4 right-4">
            <motion.h3 
              className={`font-bold text-white drop-shadow-lg transition-all duration-300 ${
                isExpanded ? 'text-2xl' : 'text-lg'
              }`}
              layout
            >
              {story.title}
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
          {story.summary}
        </motion.p>
      </div>

      {/* Expanded Content */}
      <AnimatedCardContent showOnlyWhenExpanded className="pt-0">
        <div className="space-y-4">
          {/* Story Details with beautiful styling */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, staggerChildren: 0.05 }}
          >
            <motion.div 
              className="flex items-center p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Book className="w-4 h-4 mr-2 text-blue-500" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Genre:</span>
              <span className="ml-1 text-sm text-gray-700 dark:text-gray-300">{story.config.genre}</span>
            </motion.div>
            
            <motion.div 
              className="flex items-center p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Star className="w-4 h-4 mr-2 text-purple-500" />
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">Stil:</span>
              <span className="ml-1 text-sm text-gray-700 dark:text-gray-300">{story.config.style}</span>
            </motion.div>

            {story.config.moral && (
              <motion.div 
                className="flex items-start p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Users className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-green-500" />
                <div className="text-sm">
                  <span className="font-medium text-green-800 dark:text-green-200">Moral:</span>
                  <span className="ml-1 text-gray-700 dark:text-gray-300">{story.config.moral}</span>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Characters Section */}
          {story.config.avatars && story.config.avatars.length > 0 && (
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="font-medium text-sm text-gray-800 dark:text-gray-100 flex items-center">
                <Users className="w-4 h-4 mr-2 text-purple-500" />
                Charaktere:
              </h4>
              <div className="flex flex-wrap gap-2">
                {story.config.avatars.slice(0, 6).map((avatar, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-full px-3 py-2 shadow-sm"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    {avatar.imageUrl && (
                      <img
                        src={avatar.imageUrl}
                        alt={avatar.name}
                        className="w-6 h-6 rounded-full mr-2 object-cover border-2 border-white dark:border-gray-600"
                      />
                    )}
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                      {avatar.name}
                    </span>
                  </motion.div>
                ))}
                {story.config.avatars.length > 6 && (
                  <div className="flex items-center bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full px-3 py-2 shadow-sm">
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      +{story.config.avatars.length - 6} weitere
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
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              onClick={handleRead}
            >
              <Play className="w-4 h-4 mr-2" />
              Geschichte lesen
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300"
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
            <span>Erstellt: {formatDate(story.createdAt)}</span>
          </div>
          
          <Badge 
            variant="outline"
            className={`shadow-sm ${
              story.status === 'complete' 
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
                : story.status === 'generating'
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
            }`}
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              story.status === 'complete' ? 'bg-green-500' : 
              story.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            {story.status === 'complete' ? 'Fertig' : 
             story.status === 'generating' ? 'Wird erstellt...' : 'Fehler'}
          </Badge>
        </motion.div>
      </AnimatedCardFooter>
    </AnimatedCard>
  )
}