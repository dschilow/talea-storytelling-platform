import React, { useState } from 'react';
import { ListPlus, Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { Chapter } from '../../types/story';

interface StoryAudioActionsProps {
  storyId: string;
  storyTitle: string;
  chapters: Chapter[];
  coverImageUrl?: string;
  className?: string;
}

export const StoryAudioActions: React.FC<StoryAudioActionsProps> = ({
  storyId,
  storyTitle,
  chapters,
  coverImageUrl,
  className = '',
}) => {
  const { startStoryConversion, playlist } = useAudioPlayer();
  const { resolvedTheme } = useTheme();
  const [isAdding, setIsAdding] = useState(false);

  const isDark = resolvedTheme === 'dark';
  const alreadyInPlaylist = playlist.some((item) => item.parentStoryId === storyId);

  const handlePlay = () => {
    if (alreadyInPlaylist || !chapters.length) return;
    setIsAdding(true);
    startStoryConversion(storyId, storyTitle, chapters, coverImageUrl, true);
    setTimeout(() => setIsAdding(false), 500);
  };

  const handleAddToQueue = () => {
    if (alreadyInPlaylist || !chapters.length) return;
    setIsAdding(true);
    startStoryConversion(storyId, storyTitle, chapters, coverImageUrl, false);
    setTimeout(() => setIsAdding(false), 500);
  };

  const btnBase = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition-all`;
  const btnStyle: React.CSSProperties = {
    borderColor: isDark ? '#34455d' : '#decfbf',
    background: isDark ? 'rgba(33,42,58,0.7)' : 'rgba(255,255,255,0.7)',
    color: isDark ? '#d9e5f8' : '#2a3b52',
    backdropFilter: 'blur(8px)',
  };

  if (alreadyInPlaylist) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold"
          style={{
            borderColor: isDark ? '#2a5a3a' : '#a8d5b8',
            background: isDark ? 'rgba(42,90,58,0.2)' : 'rgba(168,213,184,0.2)',
            color: isDark ? '#7dd3a0' : '#2d7a4a',
          }}
        >
          <Play size={14} />
          In der Warteschlange
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={handlePlay}
        disabled={isAdding}
        className={btnBase}
        style={{
          ...btnStyle,
          background: isDark
            ? 'linear-gradient(135deg, rgba(134,167,219,0.25), rgba(176,132,199,0.25))'
            : 'linear-gradient(135deg, rgba(213,189,175,0.4), rgba(177,131,196,0.3))',
        }}
      >
        {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        Geschichte anhoeren
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleAddToQueue}
        disabled={isAdding}
        className={btnBase}
        style={btnStyle}
      >
        <ListPlus size={14} />
        Zur Warteschlange
      </motion.button>
    </div>
  );
};
