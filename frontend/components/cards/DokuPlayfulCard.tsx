"use client";

import React from 'react';
import { Calendar, BookOpen, Brain, Activity, Globe, Lock, Users, Zap, Target } from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  PlayfulCard,
  PlayfulCardHeader,
  PlayfulCardTitle,
  PlayfulCardDescription,
  PlayfulButton,
  usePlayfulCard,
} from '../ui/playful-card';
import type { Doku } from '../../types/doku';

interface DokuPlayfulCardProps {
  doku: Doku;
  onRead?: (doku: Doku) => void;
  onEdit?: (doku: Doku) => void;
}

export const DokuPlayfulCard: React.FC<DokuPlayfulCardProps> = ({
  doku,
  onRead,
  onEdit,
}) => {
  const { expandedCardId } = usePlayfulCard();
  const isExpanded = expandedCardId === `doku-${doku.id}`;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getTopicColor = (topic: string) => {
    const colorMap: { [key: string]: string } = {
      'Wissenschaft': 'blue',
      'Technologie': 'purple',
      'Geschichte': 'orange',
      'Kunst': 'pink',
      'Sport': 'green',
      'Natur': 'green',
    };
    return colorMap[topic] || 'blue';
  };

  const getTopicEmoji = (topic: string) => {
    const emojiMap: { [key: string]: string } = {
      'Wissenschaft': '🔬',
      'Technologie': '💻',
      'Geschichte': '🏛️',
      'Kunst': '🎨',
      'Sport': '⚽',
      'Natur': '🌱',
      'Mathematik': '🔢',
      'Musik': '🎵',
      'Geografie': '🌍',
    };
    return emojiMap[topic] || '📚';
  };

  const getDepthEmoji = (depth?: string) => {
    switch (depth) {
      case 'basic': return '🌱';
      case 'standard': return '🌿';
      case 'deep': return '🌳';
      default: return '🌿';
    }
  };

  const getDepthLabel = (depth?: string) => {
    switch (depth) {
      case 'basic': return 'Einfach';
      case 'standard': return 'Standard';
      case 'deep': return 'Vertieft';
      default: return 'Standard';
    }
  };

  const handleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRead?.(doku);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(doku);
  };

  return (
    <PlayfulCard
      cardId={`doku-${doku.id}`}
      color={getTopicColor(doku.topic) as any}
      size="medium"
    >
      <PlayfulCardHeader>
        <div className="text-center">
          {/* Doku Cover */}
          <div className="relative mb-3">
            <img
              src={doku.coverImageUrl || '/placeholder-doku.jpg'}
              alt={doku.title}
              className={`w-full rounded-xl object-cover shadow-md transition-all duration-300 ${
                isExpanded ? 'h-24' : 'h-16'
              }`}
            />
            
            {/* Topic Badge */}
            <div className="absolute top-2 left-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                <span className="text-lg">{getTopicEmoji(doku.topic)}</span>
              </div>
            </div>

            {/* Visibility Badge */}
            <div className="absolute top-2 right-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                {doku.isPublic ? (
                  <span className="text-sm">🌍</span>
                ) : (
                  <span className="text-sm">🔒</span>
                )}
              </div>
            </div>

            {/* Depth Indicator */}
            <div className="absolute bottom-2 right-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-md">
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                  {getDepthEmoji()} {getDepthLabel()}
                </div>
              </div>
            </div>
          </div>

          <PlayfulCardTitle 
            emoji={getTopicEmoji(doku.topic)}
            className={`${isExpanded ? 'text-xl' : 'text-lg'} line-clamp-2`}
          >
            {doku.title}
          </PlayfulCardTitle>

          {/* Topic Badge */}
          <div className="mb-2">
            <Badge 
              variant="outline" 
              className="bg-white/90 border-2 border-current text-current font-semibold shadow-sm"
            >
              {getTopicEmoji(doku.topic)} {doku.topic}
            </Badge>
          </div>

          {!isExpanded && (
            <PlayfulCardDescription className="line-clamp-2">
              {doku.summary}
            </PlayfulCardDescription>
          )}
        </div>
      </PlayfulCardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4">
          {/* Summary */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              📝 Zusammenfassung
            </h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              {doku.summary}
            </p>
          </div>

          {/* Doku Details */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              📊 Details
            </h4>
            
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-teal-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-teal-800">{getTopicEmoji(doku.topic)} Thema:</span>
                    <span className="ml-2 text-teal-700 text-sm">{doku.topic}</span>
                  </div>
                </div>
              </div>
              
              {doku.content?.sections && (
                <div className="bg-stone-50 border-2 border-stone-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Activity className="w-4 h-4 text-stone-500 mt-0.5" />
                    <div>
                      <span className="font-medium text-stone-800">📚 Kapitel:</span>
                      <span className="ml-2 text-stone-700 text-sm">{doku.content.sections.length}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  {doku.isPublic ? (
                    <Globe className="w-4 h-4 text-emerald-500 mt-0.5" />
                  ) : (
                    <Lock className="w-4 h-4 text-orange-500 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium text-emerald-800">
                      {doku.isPublic ? '🌍 Öffentlich' : '🔒 Privat'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Elements */}
          {doku.content?.sections && doku.content.sections.some(s => s.interactive) && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                🎮 Interaktive Inhalte
              </h4>
              <div className="flex flex-wrap gap-2">
                {doku.content.sections
                  .filter(s => s.interactive)
                  .map((section, index) => (
                    <div key={index} className="flex flex-wrap gap-2">
                      {section.interactive?.quiz?.enabled && (
                        <div className="bg-stone-50 border-2 border-stone-200 rounded-full px-3 py-2 shadow-sm">
                          <div className="flex items-center gap-1 text-sm font-medium text-stone-800">
                            🧠 Quiz
                          </div>
                        </div>
                      )}
                      {section.interactive?.activities?.enabled && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-full px-3 py-2 shadow-sm">
                          <div className="flex items-center gap-1 text-sm font-medium text-green-800">
                            🎯 Aktivitäten
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Metadata - Spielerisch präsentiert */}
          {doku.metadata && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                📈 Statistiken
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {doku.metadata.tokensUsed && (
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">⚡</div>
                    <div className="text-xs text-yellow-600 font-medium">Tokens</div>
                    <div className="text-sm font-semibold text-yellow-800">
                      {doku.metadata.tokensUsed.total.toLocaleString()}
                    </div>
                  </div>
                )}
                {doku.metadata.processingTime && (
                  <div className="bg-stone-50 border-2 border-stone-200 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">⏱️</div>
                    <div className="text-xs text-stone-600 font-medium">Zeit</div>
                    <div className="text-sm font-semibold text-stone-800">
                      {Math.round(doku.metadata.processingTime / 1000)}s
                    </div>
                  </div>
                )}
                {doku.metadata.imagesGenerated && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">🖼️</div>
                    <div className="text-xs text-amber-600 font-medium">Bilder</div>
                    <div className="text-sm font-semibold text-amber-800">
                      {doku.metadata.imagesGenerated}
                    </div>
                  </div>
                )}
                {doku.metadata.totalCost && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">💰</div>
                    <div className="text-xs text-green-600 font-medium">Kosten</div>
                    <div className="text-sm font-semibold text-green-800">
                      ${doku.metadata.totalCost.total.toFixed(3)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <PlayfulButton
              color={getTopicColor(doku.topic) as any}
              emoji="📖"
              onClick={handleRead}
              className="w-full justify-center"
            >
              Doku lesen
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
                📅 {formatDate(doku.createdAt)}
              </div>
              
              <Badge 
                variant="outline" 
                className={`text-xs font-medium ${
                  doku.status === 'complete' 
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : doku.status === 'generating'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                    : 'bg-red-50 text-red-700 border-red-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  doku.status === 'complete' ? 'bg-green-500' : 
                  doku.status === 'generating' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} />
                {doku.status === 'complete' ? '✅ Fertig' : 
                 doku.status === 'generating' ? '⏳ Wird erstellt...' : '❌ Fehler'}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </PlayfulCard>
  );
};
