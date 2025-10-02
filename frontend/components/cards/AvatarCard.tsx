"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Edit3, Play, User, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Avatar } from '../../types/avatar';

interface AvatarCardProps {
  avatar: Avatar;
  onUse: (avatar: Avatar) => void;
  onDelete?: (avatar: Avatar) => void;
}

export const AvatarCard: React.FC<AvatarCardProps> = ({ avatar, onUse, onDelete }) => {
  const navigate = useNavigate();

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/avatar/${avatar.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/avatar/edit/${avatar.id}`);
  };

  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUse(avatar);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`Möchtest du "${avatar.name}" wirklich löschen?`)) {
      onDelete(avatar);
    }
  };

  return (
    <motion.div
      className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-xl"
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Image Section */}
      <div 
        onClick={handleViewDetails}
        className="relative overflow-hidden cursor-pointer"
      >
        {avatar.imageUrl ? (
          <motion.img
            src={avatar.imageUrl}
            alt={avatar.name}
            className="w-full h-56 object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
            <User className="w-16 h-16 text-white/80" />
          </div>
        )}
        
        {/* Status indicator */}
        <div className="absolute top-3 left-3">
          <div 
            className={`w-3 h-3 rounded-full ${
              avatar.status === 'complete' ? 'bg-green-500' : 
              avatar.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`}
          />
        </div>

        {/* Personality/Memory count */}
        {(avatar.personality?.traits?.length || avatar.memories?.length) && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-gray-700">
            {avatar.memories?.length || 0} Erinnerungen
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium text-gray-800">
            Details anzeigen
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 
              onClick={handleViewDetails}
              className="font-bold text-lg text-gray-800 dark:text-white truncate group-hover:text-purple-600 transition-colors cursor-pointer"
            >
              {avatar.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {avatar.description || 'Keine Beschreibung'}
            </p>
          </div>
        </div>

        {/* Personality traits preview */}
        {avatar.personality?.traits && avatar.personality.traits.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Persönlichkeit:</div>
            <div className="flex flex-wrap gap-1">
              {avatar.personality.traits.slice(0, 3).map((trait) => (
                <span
                  key={trait.trait}
                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  {trait.trait}: {trait.value}%
                </span>
              ))}
              {avatar.personality.traits.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{avatar.personality.traits.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleUse}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            Verwenden
          </button>
          <button
            onClick={handleEdit}
            className="flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="flex items-center justify-center px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
