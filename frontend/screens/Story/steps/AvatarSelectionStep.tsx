import React, { useState, useEffect } from 'react';
import { User, Check } from 'lucide-react';

import Card from '../../../components/common/Card';
import FadeInView from '../../../components/animated/FadeInView';
import backend from '~backend/client';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

interface AvatarSelectionStepProps {
  selectedAvatarIds: string[];
  onSelectionChange: (avatarIds: string[]) => void;
}

const AvatarSelectionStep: React.FC<AvatarSelectionStepProps> = ({
  selectedAvatarIds,
  onSelectionChange,
}) => {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      const response = await backend.avatar.list({ userId: 'demo-user-123' });
      setAvatars(response.avatars);
    } catch (error) {
      console.error('Error loading avatars:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvatarSelection = (avatarId: string) => {
    const isSelected = selectedAvatarIds.includes(avatarId);
    
    if (isSelected) {
      onSelectionChange(selectedAvatarIds.filter(id => id !== avatarId));
    } else {
      if (selectedAvatarIds.length < 4) { // Limit to 4 avatars
        onSelectionChange([...selectedAvatarIds, avatarId]);
      }
    }
  };

  if (loading) {
    return (
      <FadeInView>
        <Card variant="elevated" className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Lade Avatare...</p>
        </Card>
      </FadeInView>
    );
  }

  if (avatars.length === 0) {
    return (
      <FadeInView>
        <Card variant="elevated" className="text-center py-8">
          <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Keine Avatare gefunden</h3>
          <p className="text-gray-600">
            Du musst zuerst einen Avatar erstellen, bevor du eine Geschichte schreiben kannst.
          </p>
        </Card>
      </FadeInView>
    );
  }

  return (
    <FadeInView>
      <Card variant="elevated">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Wähle deine Helden</h2>
        <p className="text-gray-600 text-center mb-4">
          Wähle bis zu 4 Avatare für deine Geschichte aus
        </p>
        
        <div className="text-center mb-6">
          <span className="text-purple-600 font-semibold">
            {selectedAvatarIds.length} von 4 ausgewählt
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {avatars.map((avatar, index) => {
            const isSelected = selectedAvatarIds.includes(avatar.id);
            
            return (
              <FadeInView key={avatar.id} delay={100 + index * 50}>
                <button
                  onClick={() => toggleAvatarSelection(avatar.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                      isSelected ? 'bg-purple-100' : 'bg-gray-100'
                    }`}>
                      <span className="text-2xl">
                        {avatar.creationType === 'ai-generated' ? '🤖' : '📷'}
                      </span>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className={`font-semibold text-center mb-1 ${
                    isSelected ? 'text-purple-700' : 'text-gray-800'
                  }`}>
                    {avatar.name}
                  </h3>
                  
                  <p className={`text-xs text-center ${
                    isSelected ? 'text-purple-600' : 'text-gray-500'
                  }`}>
                    {avatar.creationType === 'ai-generated' ? 'KI-generiert' : 'Foto-basiert'}
                  </p>
                </button>
              </FadeInView>
            );
          })}
        </div>
      </Card>
    </FadeInView>
  );
};

export default AvatarSelectionStep;
