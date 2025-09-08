import React, { useState } from 'react';
import { Download, Sparkles, Wand2, Eye, User } from 'lucide-react';
import { useUser } from '@clerk/nextjs'; // ✅ Clerk Hook hinzufügen

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import TraitSlider from '../../components/avatar/TraitSlider';
import backend from '~backend/client';

import type { PhysicalTraits, PersonalityTraits, AvatarVisualProfile } from '~backend/avatar/create';

const AIGeneratedTab: React.FC = () => {
  // ✅ Echte User-ID aus Clerk holen
  const { user, isLoaded } = useUser();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [visualProfile, setVisualProfile] = useState<AvatarVisualProfile | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Physical Traits State
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

  // Personality Traits State
  const [personalityTraits, setPersonalityTraits] = useState<PersonalityTraits>({
    courage: 7,
    intelligence: 6,
    creativity: 8,
    empathy: 9,
    strength: 5,
    humor: 7,
    adventure: 8,
    patience: 4,
    curiosity: 9,
    leadership: 6,
  });

  // ✅ Prüfung ob User geladen ist
  if (!isLoaded) {
    return (
      <FadeInView>
        <Card variant="elevated" className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Lade Benutzer-Informationen...</p>
        </Card>
      </FadeInView>
    );
  }

  // ✅ Prüfung ob User eingeloggt ist
  if (!user) {
    return (
      <FadeInView>
        <Card variant="elevated" className="text-center py-8">
          <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Anmeldung erforderlich</h3>
          <p className="text-gray-600">
            Du musst angemeldet sein, um einen Avatar zu erstellen.
          </p>
        </Card>
      </FadeInView>
    );
  }

  const updatePhysicalTrait = (trait: keyof PhysicalTraits, value: any) => {
    setPhysicalTraits(prev => ({ ...prev, [trait]: value }));
  };

  const updatePersonalityTrait = (trait: keyof PersonalityTraits, value: number) => {
    setPersonalityTraits(prev => ({ ...prev, [trait]: value }));
  };

  const downloadImage = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = (name || 'avatar') + '.webp';
    a.click();
  };

  const generateAvatarImage = async () => {
    try {
      setGeneratingImage(true);
      setVisualProfile(null);
      console.log('🎨 Starting avatar image generation...');
      console.log('📋 Physical traits:', physicalTraits);
      console.log('🧠 Personality traits:', personalityTraits);
      console.log('📝 Description:', description);

      const result = await backend.ai.generateAvatarImage({
        physicalTraits,
        personalityTraits,
        description,
        style: 'disney',
      });

      console.log('✅ Avatar image generated successfully');
      setGeneratedImageUrl(result.imageUrl);
      setDebugInfo(result.debugInfo);

      // Immediately analyze the generated image to obtain a canonical visual profile
      console.log("🔬 Analyzing generated image to create visual profile...");
      try {
        const analysis = await backend.ai.analyzeAvatarImage({
          imageUrl: result.imageUrl,
          hints: {
            name: name || undefined,
            physicalTraits,
            personalityTraits,
          }
        });
        setVisualProfile(analysis.visualProfile);
        console.log('✅ Visual profile extracted:', analysis.visualProfile);
      } catch (analysisErr) {
        console.error('❌ Error analyzing avatar image:', analysisErr);
        setVisualProfile(null);
      }
    } catch (error) {
      console.error('❌ Error generating avatar image:', error);
      alert('Fehler beim Generieren des Avatar-Bildes. Bitte versuche es erneut.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleCreateAvatar = async () => {
    if (!name.trim()) {
      alert('Bitte gib deinem Avatar einen Namen.');
      return;
    }

    try {
      setLoading(true);

      // ✅ Echte User-ID verwenden anstatt Demo-ID
      console.log('👤 Creating avatar for user:', user.id);
      
      const avatar = await backend.avatar.create({
        userId: user.id, // ✅ FIXED: Echte User-ID aus Clerk
        name: name.trim(),
        description: description.trim() || undefined,
        physicalTraits,
        personalityTraits,
        imageUrl: generatedImageUrl || undefined,
        visualProfile: visualProfile || undefined,
        creationType: 'ai-generated',
      });

      console.log('✅ Avatar created successfully:', avatar.id);
      alert(`Avatar "${avatar.name}" wurde erfolgreich erstellt! 🎉`);
      
      // Reset form
      setName('');
      setDescription('');
      setGeneratedImageUrl(null);
      setVisualProfile(null);
      setDebugInfo(null);
      
    } catch (error) {
      console.error('❌ Error creating avatar:', error);
      
      // ✅ Bessere Fehlerbehandlung
      let errorMessage = 'Avatar konnte nicht erstellt werden. ';
      
      if (error instanceof Error) {
        if (error.message.includes('unauthorized')) {
          errorMessage += 'Du bist nicht angemeldet.';
        } else if (error.message.includes('database')) {
          errorMessage += 'Database-Fehler. Bitte versuche es später erneut.';
        } else if (error.message.includes('validation')) {
          errorMessage += 'Ungültige Daten. Prüfe deine Eingaben.';
        } else {
          errorMessage += 'Bitte versuche es erneut.';
        }
      } else {
        errorMessage += 'Unbekannter Fehler. Bitte versuche es erneut.';
      }
      
      alert(errorMessage);
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
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beschreibe deinen Avatar (optional)..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
              />
            </div>
          </div>
        </Card>
      </FadeInView>

      {/* Physical Traits */}
      <FadeInView delay={200}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Physische Eigenschaften</h2>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <TraitSlider
                  label="Alter"
                  value={physicalTraits.age}
                  onChange={(value) => updatePhysicalTrait('age', value)}
                  min={5}
                  max={15}
                  step={1}
                  unit="Jahre"
                />
              </div>
              
              <div>
                <TraitSlider
                  label="Größe"
                  value={physicalTraits.height}
                  onChange={(value) => updatePhysicalTrait('height', value)}
                  min={100}
                  max={180}
                  step={5}
                  unit="cm"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Geschlecht</label>
                <select
                  value={physicalTraits.gender}
                  onChange={(e) => updatePhysicalTrait('gender', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="male">Männlich</option>
                  <option value="female">Weiblich</option>
                  <option value="non-binary">Divers</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Haarfarbe</label>
                <input
                  type="color"
                  value={physicalTraits.hairColor}
                  onChange={(e) => updatePhysicalTrait('hairColor', e.target.value)}
                  className="w-full h-12 border border-gray-200 rounded-xl cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Augenfarbe</label>
                <input
                  type="color"
                  value={physicalTraits.eyeColor}
                  onChange={(e) => updatePhysicalTrait('eyeColor', e.target.value)}
                  className="w-full h-12 border border-gray-200 rounded-xl cursor-pointer"
                />
              </div>
            </div>
          </div>
        </Card>
      </FadeInView>

      {/* Personality Traits */}
      <FadeInView delay={300}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Persönlichkeit</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(personalityTraits).map(([trait, value]) => (
              <TraitSlider
                key={trait}
                label={trait.charAt(0).toUpperCase() + trait.slice(1)}
                value={value}
                onChange={(newValue) => updatePersonalityTrait(trait as keyof PersonalityTraits, newValue)}
                min={1}
                max={10}
                step={1}
              />
            ))}
          </div>
        </Card>
      </FadeInView>

      {/* Image Generation */}
      <FadeInView delay={400}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Avatar-Bild generieren</h2>
          
          <div className="space-y-4">
            <Button
              onClick={generateAvatarImage}
              disabled={generatingImage}
              variant="primary"
              size="large"
              className="w-full"
            >
              {generatingImage ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Generiere Avatar-Bild...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Wand2 className="w-5 h-5 mr-2" />
                  Avatar-Bild generieren
                </div>
              )}
            </Button>

            {generatedImageUrl && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={generatedImageUrl}
                    alt="Generated Avatar"
                    className="w-full h-64 object-cover"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={downloadImage}
                    variant="secondary"
                    size="medium"
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Herunterladen
                  </Button>
                  
                  <Button
                    onClick={generateAvatarImage}
                    variant="secondary"
                    size="medium"
                    className="flex-1"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Neu generieren
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </FadeInView>

      {/* Create Avatar Button */}
      <FadeInView delay={500}>
        <Card variant="elevated">
          <Button
            onClick={handleCreateAvatar}
            disabled={loading || !name.trim()}
            variant="primary"
            size="large"
            className="w-full"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Erstelle Avatar...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <User className="w-5 h-5 mr-2" />
                Avatar erstellen
              </div>
            )}
          </Button>
        </Card>
      </FadeInView>

      {/* Debug Info */}
      {debugInfo && process.env.NODE_ENV === 'development' && (
        <FadeInView delay={600}>
          <Card variant="outlined">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Debug-Informationen</h3>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </Card>
        </FadeInView>
      )}
    </div>
  );
};

export default AIGeneratedTab;