"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Trash2 } from 'lucide-react';
import type { Story } from '../../types/story';

interface StoryCardProps {
  story: Story;
  onRead: (story: Story) => void;
  onDelete?: (storyId: string, storyTitle: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, onRead, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(story.id, story.title);
    }
  };

  return (
    <div
      onClick={() => onRead(story)}
      className="cursor-pointer group bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-lg"
    >
      <div className="relative overflow-hidden rounded-t-md">
        <motion.img
          src={story.coverImageUrl || '/placeholder-story.jpg'}
          alt={story.title}
          className="w-full h-56 object-cover"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
        <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-md">
          <Heart className="w-4 h-4 text-red-500" />
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="absolute top-3 left-3 bg-red-500/80 backdrop-blur-sm rounded-full p-1.5 shadow-md hover:bg-red-600 transition-colors"
            title="Geschichte löschen"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-md text-gray-800 dark:text-white truncate group-hover:text-blue-600 transition-colors">
          {story.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">By Talea</p>
      </div>
    </div>
  );
};
