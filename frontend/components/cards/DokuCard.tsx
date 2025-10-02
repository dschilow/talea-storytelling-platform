"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { Doku } from '../../types/doku';

interface DokuCardProps {
  doku: Doku;
  onRead: (doku: Doku) => void;
}

export const DokuCard: React.FC<DokuCardProps> = ({ doku, onRead }) => {
  const handleClick = () => {
    console.log('DokuCard clicked:', doku.title, doku.id);
    onRead(doku);
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer group bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-lg"
    >
      <div className="relative overflow-hidden rounded-t-md">
        <motion.img
          src={doku.coverImageUrl || '/placeholder-doku.jpg'}
          alt={doku.title}
          className="w-full h-56 object-cover"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
        <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-md">
          <Heart className="w-4 h-4 text-red-500" />
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-md text-gray-800 dark:text-white truncate group-hover:text-teal-600 transition-colors">
          {doku.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{doku.topic}</p>
      </div>
    </div>
  );
};
