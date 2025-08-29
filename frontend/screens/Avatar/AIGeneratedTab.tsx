import React, { useState } from 'react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import backend from '~backend/client';

interface PhysicalTraits {
  age: number;
  height: number;
  gender: 'male' | 'female' | 'non-binary';
  skinTone: string;
  hairColor: string;
  hairType: string;
  eyeColor: string;
  bodyType: number;
}

interface PersonalityTraits {
  courage: number;
  intelligence: number;
  creativity: number;
  empathy: number;
  strength: number;
  humor: number;
  adventure: number;
  patience: number;
  curiosity: number;
  leadership: number;
}

const AIGeneratedTab: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [physicalTraits, setPhysicalTraits] = useState<PhysicalTraits>({
    age: 8,
    height: 130,
    gender: 'male',
    skinTone: '#F4C2A1',
    hairColor: '#8B4513',
    hairType: 'curly',
    eyeColor: '#4A90E2',
    bodyType: 5,
  });

  const [personalityTraits, setPersonalityTraits] = useState<PersonalityTraits>({
    courage: 7,
    intelligence: 6,
    creativity: 8,
    empathy: 7,
    strength: 5,
    humor: 8,
    adventure: 9,
    patience: 4,
    curiosity: 9,
    leadership: 6,
  });

  const genderOptions = [
    { key: 'male', label: 'Männlich', icon: '👦' },
    { key: 'female', label: 'Weiblich', icon: '👧' },
    { key: 'non-binary', label: 'Divers', icon: '🧒' },
  ];

  const hairTypes = [
    { key: 'straight', label: 'Glatt', icon: '💇‍♀️' },
    { key: 'wavy', label: 'Wellig', icon: '🌊' },
    { key: 'curly', label: 'Lockig', icon: '🌀' },
    { key: 'coily', label: 'Kraus', icon: '🔄' },
  ];

  const personalityLabels = {
    courage: { label: 'Mut', icon: '🦁', color: 'bg-red-500' },
    intelligence: { label: 'Intelligenz', icon: '🧠', color: 'bg-purple-500' },
    creativity: { label: 'Kreativität', icon: '🎨', color: 'bg-orange-500' },
    empathy: { label: 'Empathie', icon: '❤️', color: 'bg-green-500' },
    strength: { label: 'Stärke', icon: '💪', color: 'bg-gray-600' },
    humor: { label: 'Humor', icon: '😄', color: 'bg-yellow-500' },
    adventure: { label: 'Abenteuer', icon: '🗺️', color: 'bg-blue-600' },
    patience: { label: 'Geduld', icon: '🧘', color: 'bg-green-600' },
    curiosity: { label: 'Neugier', icon: '🔍', color: 'bg-orange-600' },
    leadership: { label: 'Führung', icon: '👑', color: 'bg-yellow-600' },
  };

  const updatePhysicalTrait = <K extends keyof PhysicalTraits>(
    key: K, 
    value: PhysicalTraits[K]
  ) => {
    setPhysicalTraits(prev => ({ ...prev, [key]: value }));
  };

  const updatePersonalityTrait = <K extends keyof PersonalityTraits>(
    key: K, 
    value: PersonalityTraits[K]
  ) => {
    setPersonalityTraits(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateAvatar = async () => {
    if (!name.trim()) {
      alert('Bitte gib deinem Avatar einen Namen.');
      return;
    }

    try {
      setLoading(true);
      
      const avatar = await backend.avatar.create({
        userId: 'demo-user-123', // Mock user ID
        name: name.trim(),
        description: description.trim() || undefined,
        physicalTraits,
        personalityTraits,
        creationType: 'ai-generated',
      });

      alert(`Avatar "${avatar.name}" wurde erfolgreich erstellt!`);
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Error creating avatar:', error);
      alert('Avatar konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <FadeInView delay={100}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Grundinformationen</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wie soll dein Avatar heißen?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Beschreibung (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Erzähle etwas über deinen Avatar..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </Card>
      </FadeInView>

      {/* Physical Traits */}
      <FadeInView delay={200}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Körperliche Eigenschaften</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Alter: {physicalTraits.age} Jahre
              </label>
              <input
                type="range"
                min="3"
                max="16"
                step="1"
                value={physicalTraits.age}
                onChange={(e) => updatePhysicalTrait('age', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Größe: {physicalTraits.height} cm
              </label>
              <input
                type="range"
                min="80"
                max="180"
                step="5"
                value={physicalTraits.height}
                onChange={(e) => updatePhysicalTrait('height', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Geschlecht</label>
              <div className="flex gap-3">
                {genderOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => updatePhysicalTrait('gender', option.key as any)}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                      physicalTraits.gender === option.key
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-300 hover:border-purple-300'
                    }`}
                  >
                    <span className="mr-2">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Haartyp</label>
              <div className="grid grid-cols-2 gap-3">
                {hairTypes.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => updatePhysicalTrait('hairType', option.key)}
                    className={`py-3 px-4 rounded-lg border-2 transition-colors ${
                      physicalTraits.hairType === option.key
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-300 hover:border-purple-300'
                    }`}
                  >
                    <span className="mr-2">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </FadeInView>

      {/* Personality Traits */}
      <FadeInView delay={300}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Persönlichkeitseigenschaften</h2>
          <p className="text-gray-600 mb-6">
            Bestimme die Charakterzüge deines Avatars (1-10)
          </p>
          
          <div className="space-y-4">
            {Object.entries(personalityTraits).map(([key, value], index) => {
              const trait = personalityLabels[key as keyof PersonalityTraits];
              return (
                <FadeInView key={key} delay={350 + index * 50}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="mr-2">{trait.icon}</span>
                        <span className="font-medium text-gray-700">{trait.label}</span>
                      </div>
                      <div className={`px-2 py-1 rounded text-white text-sm font-bold ${trait.color}`}>
                        {value}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={value}
                      onChange={(e) => updatePersonalityTrait(key as keyof PersonalityTraits, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </FadeInView>
              );
            })}
          </div>
        </Card>
      </FadeInView>

      {/* Preview */}
      <FadeInView delay={400}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Vorschau</h2>
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🤖</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {name || 'Dein Avatar'}
            </h3>
            <p className="text-gray-600 mb-4">
              {description || 'Keine Beschreibung verfügbar'}
            </p>
            
            <div className="text-left">
              <h4 className="font-semibold text-gray-700 mb-2">Stärkste Eigenschaften:</h4>
              {Object.entries(personalityTraits)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([key, value]) => {
                  const trait = personalityLabels[key as keyof PersonalityTraits];
                  return (
                    <p key={key} className="text-gray-600 text-sm">
                      {trait.icon} {trait.label}: {value}/10
                    </p>
                  );
                })}
            </div>
          </div>
        </Card>
      </FadeInView>
      
      <FadeInView delay={500}>
        <Button
          title="Avatar erstellen"
          onPress={handleCreateAvatar}
          loading={loading}
          size="lg"
          className="w-full"
        />
      </FadeInView>
    </div>
  );
};

export default AIGeneratedTab;
