import React, { useState } from 'react';
import { Upload, Camera, X } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { useBackend } from '../../hooks/useBackend';

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

const PhotoUploadTab: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [artStyle, setArtStyle] = useState<'disney' | 'anime' | 'realistic'>('disney');
  const [loading, setLoading] = useState(false);
  const backend = useBackend();
  
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

  const artStyles = [
    { key: 'disney', label: 'Disney-Stil', icon: '🏰', description: 'Märchenhaft und freundlich' },
    { key: 'anime', label: 'Anime-Stil', icon: '🎌', description: 'Japanischer Manga-Look' },
    { key: 'realistic', label: 'Realistisch', icon: '📸', description: 'Natürlich und detailliert' },
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

  const updatePersonalityTrait = <K extends keyof PersonalityTraits>(
    key: K, 
    value: PersonalityTraits[K]
  ) => {
    setPersonalityTraits(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const handleCreateAvatar = async () => {
    if (!name.trim()) {
      alert('Bitte gib deinem Avatar einen Namen.');
      return;
    }

    if (!selectedImage) {
      alert('Bitte wähle ein Foto aus.');
      return;
    }

    try {
      setLoading(true);
      
      // In a real implementation, you would upload the image first
      // and get back a URL to store with the avatar
      const avatar = await backend.avatar.create({
        name: name.trim(),
        description: description.trim() || undefined,
        physicalTraits: {
          characterType: "Foto-basierter Avatar",
          appearance: description.trim() || "Von Foto erstellt",
        },
        personalityTraits,
        imageUrl: selectedImage, // In production, this would be the uploaded image URL
        creationType: 'photo-upload',
      });

      alert(`Avatar "${avatar.name}" wurde erfolgreich erstellt!`);
      setName('');
      setDescription('');
      setSelectedImage(null);
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

      {/* Photo Upload */}
      <FadeInView delay={200}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Foto hochladen</h2>
          
          {!selectedImage ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Foto auswählen</h3>
              <p className="text-gray-600 mb-4">
                Lade ein Foto hoch oder nimm ein neues auf
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                Foto auswählen
              </label>
            </div>
          ) : (
            <div className="relative">
              <img
                src={selectedImage}
                alt="Uploaded avatar"
                className="w-48 h-48 object-cover rounded-lg mx-auto"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center mt-4">
                <label
                  htmlFor="photo-upload-change"
                  className="inline-flex items-center px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors"
                >
                  Anderes Foto wählen
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="photo-upload-change"
                />
              </div>
            </div>
          )}
        </Card>
      </FadeInView>

      {/* Art Style */}
      <FadeInView delay={300}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Kunststil</h2>
          <p className="text-gray-600 mb-6">
            Wähle den Stil für deinen Avatar
          </p>
          
          <div className="grid grid-cols-1 gap-4">
            {artStyles.map((style) => (
              <button
                key={style.key}
                onClick={() => setArtStyle(style.key as any)}
                className={`p-4 rounded-lg border-2 transition-colors text-left ${
                  artStyle === style.key
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{style.icon}</span>
                  <div>
                    <h3 className={`font-semibold ${
                      artStyle === style.key ? 'text-purple-700' : 'text-gray-800'
                    }`}>
                      {style.label}
                    </h3>
                    <p className={`text-sm ${
                      artStyle === style.key ? 'text-purple-600' : 'text-gray-600'
                    }`}>
                      {style.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </FadeInView>

      {/* Personality Traits */}
      <FadeInView delay={400}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Persönlichkeitseigenschaften</h2>
          <p className="text-gray-600 mb-6">
            Bestimme die Charakterzüge deines Avatars (1-10)
          </p>
          
          <div className="space-y-4">
            {Object.entries(personalityTraits).map(([key, value], index) => {
              const trait = personalityLabels[key as keyof PersonalityTraits];
              return (
                <FadeInView key={key} delay={450 + index * 50}>
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
      <FadeInView delay={500}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Vorschau</h2>
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
              {selectedImage ? (
                <img src={selectedImage} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">📷</span>
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">
              {name || 'Dein Avatar'}
            </h3>
            <p className="text-sm text-purple-600 font-medium mb-3">
              {artStyles.find(s => s.key === artStyle)?.label} Stil
            </p>
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
      
      <FadeInView delay={600}>
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

export default PhotoUploadTab;
