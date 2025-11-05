// Step 1: Avatar Selection
// User selects which avatars to include in the story

import React, { useState, useEffect } from 'react';
import { User, Plus, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  age: number;
  gender: string;
}

interface Props {
  state: {
    selectedAvatars: string[];
  };
  updateState: (updates: any) => void;
}

export default function Step1AvatarSelection({ state, updateState }: Props) {
  const { getToken } = useAuth();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/avatar', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvatars(data.avatars || []);
      }
    } catch (err) {
      console.error('[Step1] Error loading avatars:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvatar = (avatarId: string) => {
    const newSelection = state.selectedAvatars.includes(avatarId)
      ? state.selectedAvatars.filter(id => id !== avatarId)
      : [...state.selectedAvatars, avatarId];
    
    updateState({ selectedAvatars: newSelection });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600">Lade Avatare...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🧸 Wer spielt in der Geschichte mit?
        </h2>
        <p className="text-gray-600">
          Wähle 1-4 Avatare aus, die Teil der Geschichte werden sollen.
        </p>
      </div>

      {/* Avatar Grid */}
      {avatars.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">Du hast noch keine Avatare erstellt.</p>
          <button 
            onClick={() => window.location.href = '/avatars/create'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
          >
            <Plus size={20} />
            Ersten Avatar erstellen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {avatars.map((avatar) => {
            const isSelected = state.selectedAvatars.includes(avatar.id);
            
            return (
              <button
                key={avatar.id}
                onClick={() => toggleAvatar(avatar.id)}
                className={`
                  relative p-4 rounded-xl border-2 transition-all transform
                  ${isSelected 
                    ? 'border-purple-600 bg-purple-50 ring-4 ring-purple-200 scale-105' 
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:scale-102'}
                `}
              >
                {/* Selection Badge */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                    ✓
                  </div>
                )}
                
                {/* Avatar Image */}
                <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-200 to-pink-200 mb-3 flex items-center justify-center overflow-hidden">
                  {avatar.imageUrl ? (
                    <img 
                      src={avatar.imageUrl} 
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={40} className="text-purple-400" />
                  )}
                </div>
                
                {/* Avatar Info */}
                <div className="text-left">
                  <p className="font-semibold text-gray-800 truncate">{avatar.name}</p>
                  <p className="text-sm text-gray-500">{avatar.age} Jahre, {avatar.gender === 'male' ? '👦' : avatar.gender === 'female' ? '👧' : '🧒'}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selection Summary */}
      {state.selectedAvatars.length > 0 && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-green-800">
              ✓ {state.selectedAvatars.length} Avatar{state.selectedAvatars.length > 1 ? 'e' : ''} ausgewählt
            </p>
            <p className="text-sm text-green-600">
              {state.selectedAvatars.length === 1 && 'Perfekt für eine fokussierte Geschichte!'}
              {state.selectedAvatars.length === 2 && 'Ideal für eine Geschichte mit Freundschaft!'}
              {state.selectedAvatars.length === 3 && 'Spannende Gruppe für Abenteuer!'}
              {state.selectedAvatars.length >= 4 && 'Große Gruppe - viele Charaktere!'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
