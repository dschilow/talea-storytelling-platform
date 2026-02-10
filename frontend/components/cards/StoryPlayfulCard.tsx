"use client";

import React from 'react';
import { Calendar, Clock, Users, Book, Star } from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  PlayfulCard,
  PlayfulCardHeader,
  PlayfulCardTitle,
  PlayfulCardDescription,
  PlayfulButton,
  usePlayfulCard,
} from '../ui/playful-card';
import type { Story } from '../../types/story';

interface StoryPlayfulCardProps {
  story: Story;
  onRead?: (story: Story) => void;
  onEdit?: (story: Story) => void;
}

export const StoryPlayfulCard: React.FC<StoryPlayfulCardProps> = ({
  story,
  onRead,
  onEdit,
}) => {
  const { expandedCardId } = usePlayfulCard();
  const isExpanded = expandedCardId === `story-${story.id}`;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getAgeGroupColor = (ageGroup: string) => {
    switch (ageGroup) {
      case '3-5': return 'green';
      case '6-8': return 'blue';
      case '9-12': return 'purple';
      case '13+': return 'orange';
      default: return 'yellow';
    }
  };

  const getAgeGroupEmoji = (ageGroup: string) => {
    switch (ageGroup) {
      case '3-5': return '🧸';
      case '6-8': return '🎒';
      case '9-12': return '📚';
      case '13+': return '🌟';
      default: return '📖';
    }
  };

  const getGenreEmoji = (genre: string) => {
    const genreEmojis: { [key: string]: string } = {
      'Abenteuer': '🗺️',
      'Märchen': '🏰',
      'Fantasy': '🦄',
      'Krimi': '🔍',
      'Comedy': '😂',
      'Drama': '🎭',
      'Thriller': '😱',
      'Romance': '💕',
      'Horror': '👻',
      'Science Fiction': '🚀',
    };
    return genreEmojis[genre] || '📚';
  };

  const handleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRead?.(story);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(story);
  };

  return (
    <PlayfulCard
      cardId={`story-${story.id}`}
      color={getAgeGroupColor(story.config.ageGroup) as any}
      size="medium"
    >
      <PlayfulCardHeader>
        <div className="text-center">
          {/* Story Cover - Kinderfreundlich */}
          <div className="relative mb-3">
            <img
              src={story.coverImageUrl || '/placeholder-story.jpg'}
              alt={story.title}
              className={`w-full rounded-xl object-cover shadow-md transition-all duration-300 ${
                isExpanded ? 'h-24' : 'h-16'
              }`}
            />
            
            {/* Overlay mit Genre-Emoji */}
            <div className="absolute top-2 left-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                <span className="text-lg">{getGenreEmoji(story.config.genre)}</span>
              </div>
            </div>

            {/* Reading Time Bubble */}
            <div className="absolute top-2 right-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-md">
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                  ⏰ {story.estimatedReadingTime || 5} Min
                </div>
              </div>
            </div>
          </div>

          <PlayfulCardTitle 
            emoji={getGenreEmoji(story.config.genre)}
            className={isExpanded ? 'text-xl' : 'text-lg'}
          >
            {story.title}
          </PlayfulCardTitle>

          {/* Age Group Badge */}
          <div className="mb-2">
            <Badge 
              variant="outline" 
              className="bg-white/90 border-2 border-current text-current font-semibold shadow-sm"
            >
              {getAgeGroupEmoji(story.config.ageGroup)} {story.config.ageGroup} Jahre
            </Badge>
          </div>

          {!isExpanded && (
            <PlayfulCardDescription className="line-clamp-2">
              {story.summary}
            </PlayfulCardDescription>
          )}
        </div>
      </PlayfulCardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4">
          {/* Story Summary */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              📖 Story
            </h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              {story.summary}
            </p>
          </div>

          {/* Story Details - Kinderfreundlich mit Emojis */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              ✨ Details
            </h4>
            
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-stone-50 border-2 border-stone-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Book className="w-4 h-4 text-stone-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-stone-800">{getGenreEmoji(story.config.genre)} Genre:</span>
                    <span className="ml-2 text-stone-700 text-sm">{story.config.genre}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-amber-800">🎨 Stil:</span>
                    <span className="ml-2 text-amber-700 text-sm">{story.config.style}</span>
                  </div>
                </div>
              </div>

              {story.config.moral && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-green-500 mt-0.5" />
                    <div>
                      <span className="font-medium text-green-800">💭 Moral:</span>
                      <p className="text-green-700 text-sm mt-1">{story.config.moral}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Characters - Spielerisch dargestellt */}
          {story.config.avatars && story.config.avatars.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                👥 Charaktere ({story.config.avatars.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {story.config.avatars.slice(0, 4).map((avatar, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-full px-3 py-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      {avatar.imageUrl && (
                        <img
                          src={avatar.imageUrl}
                          alt={avatar.name}
                          className="w-6 h-6 rounded-full object-cover border-2 border-white"
                        />
                      )}
                      <span className="text-sm font-medium text-yellow-800">
                        {avatar.name}
                      </span>
                    </div>
                  </div>
                ))}
                {story.config.avatars.length > 4 && (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-full px-3 py-2 shadow-sm">
                    <span className="text-sm font-medium text-gray-800">
                      +{story.config.avatars.length - 4} weitere
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <PlayfulButton
              color={getAgeGroupColor(story.config.ageGroup) as any}
              emoji="📚"
              onClick={handleRead}
              className="w-full justify-center"
            >
              Geschichte lesen
            </PlayfulButton>
            
            <PlayfulButton
              color="orange"
              emoji="✏️"
              onClick={handleEdit}
              className="w-full justify-center"
              size="small"
            >
              Bearbeiten
            </PlayfulButton>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t-2 border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center text-gray-500">
                <Calendar className="w-3 h-3 mr-1" />
                📅 {formatDate(story.createdAt)}
              </div>
              
              <Badge 
                variant="outline" 
                className={`text-xs font-medium ${
                  story.status === 'complete' 
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : story.status === 'generating'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                    : 'bg-red-50 text-red-700 border-red-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  story.status === 'complete' ? 'bg-green-500' : 
                  story.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} />
                {story.status === 'complete' ? '✅ Fertig' : 
                 story.status === 'generating' ? '⏳ Wird erstellt...' : '❌ Fehler'}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </PlayfulCard>
  );
};
