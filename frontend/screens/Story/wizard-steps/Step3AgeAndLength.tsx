// Step 3: Age Group & Story Length
// Simple choices for target age and story duration

import React from 'react';
import { Baby, Users, GraduationCap, UserCheck, Clock } from 'lucide-react';

type AgeGroup = '3-5' | '6-8' | '9-12' | '13+' | null;
type Length = 'short' | 'medium' | 'long' | null;

interface Props {
  state: {
    ageGroup: AgeGroup;
    length: Length;
  };
  updateState: (updates: any) => void;
}

const AGE_GROUPS = [
  {
    id: '3-5',
    title: '3-5 Jahre',
    icon: Baby,
    description: 'Einfache Worte, kurze Sätze, viele Bilder',
    color: 'pink'
  },
  {
    id: '6-8',
    title: '6-8 Jahre',
    icon: Users,
    description: 'Spannende Abenteuer, leicht zu folgen',
    color: 'blue'
  },
  {
    id: '9-12',
    title: '9-12 Jahre',
    icon: GraduationCap,
    description: 'Komplexere Handlung, mehr Details',
    color: 'purple'
  },
  {
    id: '13+',
    title: '13+ Jahre',
    icon: UserCheck,
    description: 'Tiefgründige Themen, anspruchsvoll',
    color: 'indigo'
  }
];

const LENGTHS = [
  {
    id: 'short',
    title: '⚡ Kurz',
    duration: '5-10 Min',
    chapters: '3-4 Kapitel',
    color: 'green'
  },
  {
    id: 'medium',
    title: '📖 Mittel',
    duration: '10-15 Min',
    chapters: '5-6 Kapitel',
    color: 'yellow'
  },
  {
    id: 'long',
    title: '📚 Lang',
    duration: '15-25 Min',
    chapters: '7-9 Kapitel',
    color: 'orange'
  }
];

export default function Step3AgeAndLength({ state, updateState }: Props) {
  const handleSelectAge = (ageGroup: AgeGroup) => {
    updateState({ ageGroup });
  };

  const handleSelectLength = (length: Length) => {
    updateState({ length });
  };

  return (
    <div className="space-y-8">
      {/* Title & Description */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎯 Für welches Alter & wie lang?
        </h2>
        <p className="text-gray-600">
          Passe die Geschichte an das Alter und die verfügbare Zeit an.
        </p>
      </div>

      {/* Age Group Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Users size={20} />
          Altersgruppe
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGE_GROUPS.map((group) => {
            const isSelected = state.ageGroup === group.id;
            const Icon = group.icon;
            
            return (
              <button
                key={group.id}
                onClick={() => handleSelectAge(group.id as AgeGroup)}
                className={`
                  relative p-4 rounded-xl border-2 transition-all transform
                  ${isSelected 
                    ? `border-${group.color}-600 bg-${group.color}-50 ring-4 ring-${group.color}-200 scale-105` 
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:scale-102'}
                `}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                )}
                
                <div className="flex flex-col items-center text-center">
                  <Icon size={32} className={`mb-2 ${isSelected ? `text-${group.color}-600` : 'text-gray-400'}`} />
                  <p className="font-bold text-sm text-gray-800 mb-1">{group.title}</p>
                  <p className="text-xs text-gray-600">{group.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Length Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Clock size={20} />
          Geschichtenlänge
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {LENGTHS.map((length) => {
            const isSelected = state.length === length.id;
            
            return (
              <button
                key={length.id}
                onClick={() => handleSelectLength(length.id as Length)}
                className={`
                  relative p-5 rounded-xl border-2 transition-all transform
                  ${isSelected 
                    ? `border-${length.color}-600 bg-${length.color}-50 ring-4 ring-${length.color}-200 scale-105` 
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:scale-102'}
                `}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                )}
                
                <div className="text-center">
                  <p className="text-2xl mb-2">{length.title}</p>
                  <p className="font-semibold text-gray-800 mb-1">{length.duration}</p>
                  <p className="text-xs text-gray-600">{length.chapters}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection Summary */}
      {state.ageGroup && state.length && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4">
          <p className="font-semibold text-green-800 mb-1">
            ✓ Einstellungen gewählt
          </p>
          <p className="text-sm text-green-600">
            Geschichte für {state.ageGroup} Jahre, {
              state.length === 'short' ? 'kurz (5-10 Min)' :
              state.length === 'medium' ? 'mittel (10-15 Min)' :
              'lang (15-25 Min)'
            }
          </p>
        </div>
      )}
    </div>
  );
}
