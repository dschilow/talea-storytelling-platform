"use client"

import React from 'react'
import { User, Calendar, Palette, Sparkles, Edit, Heart, Users, Star } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  AnimatedCard,
  AnimatedCardHeader,
  AnimatedCardContent,
  AnimatedCardFooter,
  useAnimatedCard,
} from '../ui/animated-card'
import type { Avatar } from '../../types/avatar'
import { motion } from 'framer-motion'

interface AvatarAnimatedCardProps {
  avatar: Avatar
  onUse?: (avatar: Avatar) => void
  onEdit?: (avatar: Avatar) => void
}

export const AvatarAnimatedCard: React.FC<AvatarAnimatedCardProps> = ({ 
  avatar, 
  onUse, 
  onEdit 
}) => {
  const { isCardExpanded } = useAnimatedCard()
  const isExpanded = isCardExpanded(`avatar-${avatar.id}`)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getGenderEmoji = (gender?: string) => {
    switch (gender?.toLowerCase()) {
      case 'male':
      case 'männlich':
        return '👨'
      case 'female':
      case 'weiblich':
        return '👩'
      case 'other':
      case 'divers':
        return '👤'
      default:
        return '👤'
    }
  }

  const getGenderBadgeClass = (gender?: string) => {
    switch (gender?.toLowerCase()) {
      case 'male':
      case 'männlich':
        return 'bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-100 border-stone-200'
      case 'female':
      case 'weiblich':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 border-gray-200'
    }
  }

  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation()
    onUse?.(avatar)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(avatar)
  }

  return (
    <AnimatedCard
      cardId={`avatar-${avatar.id}`}
      collapsedSize={{ width: 300, height: 240 }}
      expandedSize={{ width: 480, height: 640 }}
      className="group"
      onExpand={() => console.log(`Expanding avatar: ${avatar.name}`)}
      onCollapse={() => console.log(`Collapsing avatar: ${avatar.name}`)}
    >
      <AnimatedCardHeader className="relative">
        {/* Gradient background overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50 dark:from-amber-900/20 dark:via-stone-900/20 dark:to-orange-900/20 opacity-60" />
        
        <div className="relative flex flex-col items-center">
          {/* Avatar Image with enhanced styling */}
          <motion.div 
            className="relative mb-4"
            whileHover={{ scale: isExpanded ? 1 : 1.05 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
          >
            <div className="relative">
              <img
                src={avatar.imageUrl || '/placeholder-avatar.jpg'}
                alt={avatar.name}
                className={`rounded-2xl object-cover border-4 border-white dark:border-gray-700 shadow-xl transition-all duration-500 ${
                  isExpanded ? 'w-32 h-32' : 'w-24 h-24'
                }`}
              />
              
              {/* Animated glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-stone-400 opacity-20 blur-xl scale-110 group-hover:opacity-30 transition-opacity duration-500" />
              
              {/* Gender Badge */}
              <motion.div 
                className="absolute -bottom-2 -right-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <Badge
                  variant="outline"
                  className={`${getGenderBadgeClass(avatar.config?.gender)} text-lg p-1.5 shadow-lg backdrop-blur-sm`}
                >
                  {getGenderEmoji(avatar.config?.gender)}
                </Badge>
              </motion.div>
            </div>
          </motion.div>

          {/* Name with enhanced typography */}
          <motion.h3 
            className={`font-bold text-gray-800 dark:text-white text-center transition-all duration-300 ${
              isExpanded ? 'text-2xl mb-3' : 'text-lg mb-2'
            }`}
            layout
          >
            {avatar.name}
          </motion.h3>

          {/* Age - Enhanced visibility */}
          {avatar.config?.age && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isExpanded ? 1 : 0.8, y: 0 }}
              className="mb-3"
            >
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-amber-200 dark:border-amber-700">
                <User className="w-3 h-3 mr-1" />
                {avatar.config.age} Jahre alt
              </Badge>
            </motion.div>
          )}
        </div>
      </AnimatedCardHeader>

      {/* Expanded Content */}
      <AnimatedCardContent showOnlyWhenExpanded>
        <div className="space-y-4">
          {/* Description */}
          {avatar.description && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {avatar.description}
              </p>
            </motion.div>
          )}

          {/* Avatar Details with beautiful icons */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, staggerChildren: 0.05 }}
          >
            {avatar.config?.personality && (
              <motion.div 
                className="flex items-start p-3 rounded-xl bg-gradient-to-r from-orange-50 to-rose-50 dark:from-orange-900/20 dark:to-rose-900/20"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Heart className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-orange-500" />
                <div className="text-sm">
                  <span className="font-medium text-orange-800 dark:text-orange-200">Persönlichkeit:</span>
                  <span className="ml-1 text-gray-700 dark:text-gray-300">{avatar.config.personality}</span>
                </div>
              </motion.div>
            )}
            
            {avatar.config?.appearance && (
              <motion.div 
                className="flex items-start p-3 rounded-xl bg-gradient-to-r from-stone-50 to-cyan-50 dark:from-stone-900/20 dark:to-cyan-900/20"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Palette className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-stone-500" />
                <div className="text-sm">
                  <span className="font-medium text-stone-800 dark:text-stone-200">Aussehen:</span>
                  <span className="ml-1 text-gray-700 dark:text-gray-300">{avatar.config.appearance}</span>
                </div>
              </motion.div>
            )}

            {avatar.config?.hobbies && (
              <motion.div 
                className="flex items-start p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Sparkles className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-500" />
                <div className="text-sm">
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">Hobbies:</span>
                  <span className="ml-1 text-gray-700 dark:text-gray-300">{avatar.config.hobbies}</span>
                </div>
              </motion.div>
            )}

            {avatar.config?.backstory && (
              <motion.div 
                className="flex items-start p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <User className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-green-500" />
                <div className="text-sm">
                  <span className="font-medium text-green-800 dark:text-green-200">Hintergrund:</span>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {avatar.config.backstory}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Properties Grid with enhanced design */}
          {(avatar.config?.gender || avatar.config?.ageGroup || avatar.config?.ethnicity) && (
            <motion.div 
              className="grid grid-cols-2 gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {avatar.config.gender && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Geschlecht</div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{avatar.config.gender}</div>
                </div>
              )}
              {avatar.config.ageGroup && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Altersgruppe</div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{avatar.config.ageGroup}</div>
                </div>
              )}
              {avatar.config.ethnicity && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-3 text-center col-span-2 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ethnizität</div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{avatar.config.ethnicity}</div>
                </div>
              )}
            </motion.div>
          )}

          {/* Action Buttons with enhanced styling */}
          <motion.div 
            className="space-y-3 pt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              onClick={handleUse}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Avatar verwenden
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full border-2 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-300"
              onClick={handleEdit}
            >
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
          </motion.div>
        </div>
      </AnimatedCardContent>

      {/* Footer - Always visible but styled differently when expanded */}
      <AnimatedCardFooter className={isExpanded ? 'mt-6' : 'mt-auto'}>
        <motion.div 
          className="flex items-center justify-between w-full text-sm"
          layout
        >
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <Calendar className="w-3 h-3 mr-1" />
            <span>Erstellt: {formatDate(avatar.createdAt)}</span>
          </div>
          
          <Badge 
            variant="outline"
            className={`shadow-sm ${
              avatar.status === 'complete' 
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
                : avatar.status === 'generating'
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
            }`}
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              avatar.status === 'complete' ? 'bg-green-500' : 
              avatar.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            {avatar.status === 'complete' ? 'Fertig' : 
             avatar.status === 'generating' ? 'Wird erstellt...' : 'Fehler'}
          </Badge>
        </motion.div>
      </AnimatedCardFooter>
    </AnimatedCard>
  )
}
