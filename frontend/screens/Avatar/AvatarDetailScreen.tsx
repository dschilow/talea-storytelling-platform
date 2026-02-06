import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, Heart, Brain, Sparkles, Shield, Users, Zap, Calendar, BookOpen, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { useAvatarMemory } from '../../hooks/useAvatarMemory';
import { Avatar, PersonalityTrait, AvatarMemory } from '../../types/avatar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { HierarchicalTraitDisplay } from '../../components/common/HierarchicalTraitDisplay';
import { PersonalityRadarChart } from '../../components/avatar/PersonalityRadarChart';
import TreasureRoom from '../../components/gamification/TreasureRoom';
import { PackageOpen } from 'lucide-react';
import { convertBackendTraitsToFrontend } from '../../constants/traits';
import { colors } from '../../utils/constants/colors';

const MemoryTimeline: React.FC<{
  memories: AvatarMemory[];
  onDeleteMemory: (memoryId: string) => void;
}> = ({ memories, onDeleteMemory }) => {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return '#10B981';
      case 'negative': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getImpactEmoji = (impact: string, contentType?: string) => {
    if (contentType === 'doku') return '📚';
    if (contentType === 'quiz') return '🧩';
    switch (impact) {
      case 'positive': return '✨';
      case 'negative': return '💔';
      default: return '💭';
    }
  };

  const getContentLabel = (contentType?: string) => {
    switch (contentType) {
      case 'doku': return 'Doku';
      case 'quiz': return 'Quiz';
      default: return 'Geschichte';
    }
  };

  // Trait display names for diary
  const traitDisplayNames: Record<string, string> = {
    courage: 'Mut', creativity: 'Kreativität', vocabulary: 'Wortschatz',
    curiosity: 'Neugier', teamwork: 'Teamgeist', empathy: 'Empathie',
    persistence: 'Ausdauer', logic: 'Logik', knowledge: 'Wissen',
    'knowledge.biology': 'Biologie', 'knowledge.history': 'Geschichte',
    'knowledge.physics': 'Physik', 'knowledge.geography': 'Geografie',
    'knowledge.astronomy': 'Astronomie', 'knowledge.mathematics': 'Mathematik',
    'knowledge.chemistry': 'Chemie',
  };

  const sortedMemories = [...memories].sort((a, b) =>
    new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime()
  );

  // Group memories by date for diary feel
  const groupedByDate: Record<string, typeof sortedMemories> = {};
  sortedMemories.forEach(m => {
    const dateStr = new Date(m.createdAt || m.timestamp || 0).toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
    groupedByDate[dateStr].push(m);
  });

  return (
    <div className="space-y-6">
      {/* Diary Header */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border border-amber-200">
          <span className="text-lg">📔</span>
          <span className="text-sm font-semibold text-amber-800">Tagebuch</span>
          <span className="text-xs text-amber-600">({memories.length} Einträge)</span>
        </div>
      </div>

      {Object.entries(groupedByDate).map(([dateStr, dayMemories]) => (
        <div key={dateStr}>
          {/* Date Separator (diary style) */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-amber-200" />
            <span className="text-xs font-medium text-amber-700 px-3 py-1 bg-amber-50 rounded-full border border-amber-200 italic">
              📅 {dateStr}
            </span>
            <div className="flex-1 h-px bg-amber-200" />
          </div>

          <div className="space-y-3">
            {dayMemories.map((memory, index) => (
              <FadeInView key={memory.id} delay={index * 80}>
                {/* Diary Entry Card */}
                <div className="relative bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                  {/* Decorative left border */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                    style={{ backgroundColor: getImpactColor(memory.emotionalImpact) }}
                  />

                  <div className="p-4 pl-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getImpactEmoji(memory.emotionalImpact, (memory as any).contentType)}</span>
                        <div>
                          <h4 className="font-semibold text-gray-800 text-sm leading-tight">
                            {memory.storyTitle}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                              {getContentLabel((memory as any).contentType)}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(memory.createdAt || memory.timestamp || 0).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteMemory(memory.id)}
                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                        title="Erinnerung löschen"
                      >
                        <span className="text-sm">🗑️</span>
                      </button>
                    </div>

                    {/* Diary text — the experience in a "handwritten" style */}
                    <div className="mt-2 pl-1 text-gray-700 text-sm leading-relaxed italic">
                      „{memory.experience}"
                    </div>

                    {/* Personality Changes as mini badges */}
                    {memory.personalityChanges && memory.personalityChanges.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {memory.personalityChanges.map((change, idx) => {
                          const displayName = traitDisplayNames[change.trait] || change.trait;
                          const isPositive = change.change > 0;
                          return (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor: isPositive ? '#10B98115' : '#EF444415',
                                color: isPositive ? '#059669' : '#DC2626',
                                border: `1px solid ${isPositive ? '#10B98130' : '#EF444430'}`,
                              }}
                            >
                              {isPositive ? '↑' : '↓'} {displayName} {isPositive ? '+' : ''}{change.change}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </FadeInView>
            ))}
          </div>
        </div>
      ))}

      {memories.length === 0 && (
        <FadeInView delay={0}>
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-200">
              <span className="text-3xl">📔</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Einträge</h3>
            <p className="text-gray-500 max-w-xs mx-auto text-sm">
              Sobald dein Avatar Geschichten erlebt oder Dokus liest, erscheinen hier seine Tagebuch-Einträge.
            </p>
          </div>
        </FadeInView>
      )}
    </div>
  );
};

// Convert old German trait names to new hierarchical trait IDs
const convertGermanTraitToId = (germanName: string): string => {
  const mapping: Record<string, string> = {
    'Mut': 'courage',
    'Kreativität': 'creativity',
    'Empathie': 'empathy',
    'Intelligenz': 'knowledge', // Map to main knowledge category
    'Sozialität': 'teamwork',
    'Energie': 'persistence'
  };
  return mapping[germanName] || germanName.toLowerCase();
};

// Convert old personality trait format to new TraitValue format
const convertTraitsToHierarchicalFormat = (oldTraits: PersonalityTrait[]): Array<{
  traitId: string;
  value: number;
  subcategory?: string;
  reason?: string;
  history?: Array<{
    timestamp: string;
    oldValue: number;
    newValue: number;
    reason: string;
    storyId?: string;
    subcategory?: string;
  }>;
}> => {
  return oldTraits.map(oldTrait => ({
    traitId: convertGermanTraitToId(oldTrait.trait),
    value: oldTrait.value,
    history: oldTrait.history?.map(h => ({
      timestamp: h.timestamp,
      oldValue: h.oldValue,
      newValue: h.newValue,
      reason: h.reason,
      storyId: h.storyId
    }))
  }));
};

const AvatarDetailScreen: React.FC = () => {
  const { avatarId } = useParams<{ avatarId: string }>();
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const backend = useBackend();
  const { getMemories } = useAvatarMemory();

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [memories, setMemories] = useState<AvatarMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'personality' | 'memories' | 'inventory'>('personality');

  // Default personality traits
  const defaultTraits: PersonalityTrait[] = [
    { trait: 'Mut', value: 50, history: [] },
    { trait: 'Kreativität', value: 50, history: [] },
    { trait: 'Empathie', value: 50, history: [] },
    { trait: 'Intelligenz', value: 50, history: [] },
    { trait: 'Sozialität', value: 50, history: [] },
    { trait: 'Energie', value: 50, history: [] },
  ];

  const [personalityTraits, setPersonalityTraits] = useState<PersonalityTrait[]>(defaultTraits);
  const [rawPersonalityTraits, setRawPersonalityTraits] = useState<any>(null);

  useEffect(() => {
    const loadAvatar = async () => {
      if (!avatarId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Try to load avatar from backend API first
        try {
          console.log('Loading avatar from backend API:', avatarId);
          const avatarData = await backend.avatar.get({ id: avatarId });
          console.log('Backend avatar data:', avatarData);

          if (avatarData && avatarData.id) {
            setAvatar(avatarData as Avatar);

            // Store raw backend personality traits for hierarchical display
            if (avatarData.personalityTraits) {
              console.log('Using backend personality traits:', avatarData.personalityTraits);
              setRawPersonalityTraits(avatarData.personalityTraits);

              // Also convert to old format for backwards compatibility (if still needed)
              const backendTraits = Object.entries(avatarData.personalityTraits).map(([trait, value]: [string, any]) => ({
                trait: trait.charAt(0).toUpperCase() + trait.slice(1), // Capitalize first letter
                value: value === null ? 0 : (typeof value === 'object' ? value.value || 0 : Number(value) || 0),
                history: [] // New avatars have no history yet
              }));
              setPersonalityTraits(backendTraits);
            }
          } else {
            throw new Error('Avatar not found in backend');
          }
        } catch (backendError) {
          console.log('Backend failed, trying localStorage fallback:', backendError);

          // Fallback to localStorage
          const avatarKey = `avatar_${avatarId}`;
          const avatarData = JSON.parse(localStorage.getItem(avatarKey) || '{}');

          if (avatarData.id) {
            // Use real avatar data from localStorage
            setAvatar(avatarData);
          } else {
            // Create a fallback avatar if none exists
            const fallbackAvatar = {
              id: avatarId,
              userId: 'local-user',
              name: 'Mein Avatar',
              description: 'Ein lokaler Avatar',
              imageUrl: undefined,
              creationType: 'ai-generated' as const,
              status: 'complete' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            setAvatar(fallbackAvatar);
            // Save fallback for future use
            localStorage.setItem(avatarKey, JSON.stringify(fallbackAvatar));
          }
        }

        // Use backend personality data only (no localStorage)
        console.log('Using only backend personality data - no localStorage lookup');
      } catch (error) {
        console.error('Error in loadAvatar:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAvatar();
  }, [avatarId]);

  // Listen for real-time personality updates from backend
  useEffect(() => {
    const handlePersonalityUpdate = (event: CustomEvent) => {
      const { avatarId: updatedAvatarId, updatedTraits } = event.detail;

      if (updatedAvatarId === avatarId && updatedTraits) {
        console.log('📲 Real-time backend personality update received:', updatedTraits);

        // Convert backend traits to display format
        const displayTraits = Object.entries(updatedTraits).map(([trait, value]) => ({
          trait: trait.charAt(0).toUpperCase() + trait.slice(1),
          value: Number(value) || 50,
          history: []
        }));

        setPersonalityTraits(displayTraits);
      }
    };

    window.addEventListener('personalityUpdated', handlePersonalityUpdate as EventListener);

    return () => {
      window.removeEventListener('personalityUpdated', handlePersonalityUpdate as EventListener);
    };
  }, [avatarId]);

  useEffect(() => {
    let mounted = true;

    const loadMemories = async () => {
      if (!avatarId) return;

      try {
        setMemoryLoading(true);
        console.log('Loading memories for avatar:', avatarId);
        const avatarMemories = await getMemories(avatarId);
        console.log('Loaded memories:', avatarMemories);
        if (mounted) {
          setMemories(avatarMemories);
          console.log('Set memories state:', avatarMemories.length, 'memories');
        }
      } catch (error) {
        console.error('Error loading memories:', error);
      } finally {
        if (mounted) {
          setMemoryLoading(false);
        }
      }
    };

    loadMemories();

    return () => {
      mounted = false;
    };
  }, [avatarId]);

  // Listen for localStorage changes to update personality and memories in real time
  useEffect(() => {
    // Guard against undefined avatarId
    if (!avatarId) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (!avatarId) return;

      if (e.key === `avatar_personality_${avatarId}`) {
        console.log('Personality data changed for avatar:', avatarId);
        const personalityData = JSON.parse(e.newValue || '{}');
        if (personalityData.traits) {
          setPersonalityTraits(personalityData.traits);
          console.log('Updated personality traits from storage event:', personalityData.traits);
        }
      }

      if (e.key === `avatar_memories_${avatarId}`) {
        console.log('Memory data changed for avatar:', avatarId);
        // Reload memories - with guard
        if (avatarId) {
          getMemories(avatarId).then(memories => {
            setMemories(memories);
            console.log('Updated memories from storage event:', memories);
          });
        }
      }
    };

    // Listen for storage events (changes from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom personality update events (same-tab updates)
    const handlePersonalityUpdate = (e: CustomEvent) => {
      if (e.detail.avatarId === avatarId) {
        console.log('🔄 Received personalityUpdated event:', e.detail);
        setPersonalityTraits(e.detail.data.traits);
      }
    };
    window.addEventListener('personalityUpdated', handlePersonalityUpdate as EventListener);

    // Also check for changes every 2 seconds (backup mechanism)
    const interval = setInterval(() => {
      // Guard against avatarId becoming undefined
      if (!avatarId) return;

      const personalityKey = `avatar_personality_${avatarId}`;
      const currentData = JSON.parse(localStorage.getItem(personalityKey) || '{}');

      if (currentData.lastUpdated) {
        const lastUpdate = new Date(currentData.lastUpdated).getTime();
        const now = Date.now();

        // If updated within last 5 seconds, reload
        if (now - lastUpdate < 5000 && currentData.traits) {
          console.log('Detected recent personality update, refreshing...');
          setPersonalityTraits(currentData.traits);

          // Also reload memories - with guard
          if (avatarId) {
            getMemories(avatarId).then(memories => {
              setMemories(memories);
            });
          }
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('personalityUpdated', handlePersonalityUpdate as EventListener);
      clearInterval(interval);
    };
  }, [avatarId, getMemories]);

  const handleEdit = () => {
    navigate(`/avatar/edit/${avatarId}`);
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!avatarId || !isSignedIn) {
      console.error('Cannot delete memory: missing avatarId or not signed in');
      return;
    }

    try {
      console.log(`🗑️ Deleting memory ${memoryId} for avatar ${avatarId}`);

      const response = await backend.avatar.deleteMemory({ avatarId, memoryId });

      if (response.success) {
        console.log('✅ Memory deleted successfully, recalculated traits:', response.recalculatedTraits);

        // Remove the memory from local state
        setMemories(prevMemories => prevMemories.filter(m => m.id !== memoryId));

        // Update personality traits with recalculated values
        if (response.recalculatedTraits) {
          setRawPersonalityTraits(response.recalculatedTraits);

          // Also update old format for backwards compatibility
          const backendTraits = Object.entries(response.recalculatedTraits).map(([trait, value]: [string, any]) => ({
            trait: trait.charAt(0).toUpperCase() + trait.slice(1),
            value: value === null ? 0 : (typeof value === 'object' ? value.value || 0 : Number(value) || 0),
            history: []
          }));
          setPersonalityTraits(backendTraits);
        }

        // Show success notification
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            type: 'success',
            message: '🗑️ Erinnerung gelöscht und Persönlichkeit neu berechnet',
            duration: 3000
          }
        }));
      } else {
        throw new Error('Failed to delete memory');
      }
    } catch (error) {
      console.error('Error deleting memory:', error);

      // Show error notification
      window.dispatchEvent(new CustomEvent('showToast', {
        detail: {
          type: 'error',
          message: '❌ Fehler beim Löschen der Erinnerung',
          duration: 3000
        }
      }));
    }
  };

  const handleReduceTrait = async (trait: string, amount: number, reason?: string) => {
    if (!avatarId || !isSignedIn) {
      console.error('Cannot reduce trait: missing avatarId or not signed in');
      return;
    }

    try {
      console.log(`🔻 Reducing trait ${trait} by ${amount} for avatar ${avatarId}`);

      const response = await backend.avatar.reducePersonalityTrait({
        avatarId,
        trait,
        amount,
        reason
      });

      if (response.success) {
        console.log('✅ Trait reduced successfully:', response.reduction);

        // Update personality traits with new values
        if (response.updatedTraits) {
          setRawPersonalityTraits(response.updatedTraits);

          // Also update old format for backwards compatibility
          const backendTraits = Object.entries(response.updatedTraits).map(([trait, value]: [string, any]) => ({
            trait: trait.charAt(0).toUpperCase() + trait.slice(1),
            value: value === null ? 0 : (typeof value === 'object' ? value.value || 0 : Number(value) || 0),
            history: []
          }));
          setPersonalityTraits(backendTraits);
        }

        // Show success notification
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            type: 'success',
            message: `🔻 ${response.reduction.trait}: ${response.reduction.oldValue} → ${response.reduction.newValue} (-${response.reduction.amountReduced})`,
            duration: 3000
          }
        }));
      } else {
        throw new Error('Failed to reduce trait');
      }
    } catch (error) {
      console.error('Error reducing trait:', error);

      // Show error notification
      window.dispatchEvent(new CustomEvent('showToast', {
        detail: {
          type: 'error',
          message: '❌ Fehler beim Reduzieren der Eigenschaft',
          duration: 3000
        }
      }));
    }
  };

  const handleResetDokuHistory = async () => {
    if (!avatarId || !isSignedIn) {
      console.error('Cannot reset doku history: missing avatarId or not signed in');
      return;
    }

    try {
      console.log(`🗑️ Resetting doku history for avatar ${avatarId}`);

      const response = await backend.avatar.resetDokuHistory({ avatarId, dokuId: undefined });

      if (response.success) {
        console.log('✅ Doku history reset successfully:', response.message);

        // Show success notification
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            type: 'success',
            message: `📚 ${response.message}`,
            duration: 3000
          }
        }));
      } else {
        throw new Error('Failed to reset doku history');
      }
    } catch (error) {
      console.error('Error resetting doku history:', error);

      // Show error notification
      window.dispatchEvent(new CustomEvent('showToast', {
        detail: {
          type: 'error',
          message: '❌ Fehler beim Zurücksetzen der Doku-Historie',
          duration: 3000
        }
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  if (!avatar) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Avatar nicht gefunden</h2>
            <Button title="Zurück" onPress={() => navigate('/avatar')} />
          </div>
        </div>
      </div>
    );
  }


  const displayMemories = memories;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <FadeInView delay={0}>
        <div className="bg-white border-b border-gray-200">
          <div className="flex items-center p-4">
            <button
              onClick={() => navigate('/avatar')}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-3"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">{avatar.name}</h1>
              <p className="text-gray-600 text-sm">{avatar.description || 'Avatar Details'}</p>
            </div>
            <Button
              title="Bearbeiten"
              onPress={handleEdit}
              variant="outline"
              size="sm"
            />
          </div>
        </div>
      </FadeInView>

      <div className="px-6 py-6">
        {/* Avatar Image */}
        <FadeInView delay={100}>
          <Card variant="glass" className="mb-6 text-center">
            <div className="py-8">
              {avatar.imageUrl ? (
                <img
                  src={avatar.imageUrl}
                  alt={avatar.name}
                  className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                  {avatar.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{avatar.name}</h2>
              <p className="text-gray-600">{avatar.description}</p>
            </div>
          </Card>
        </FadeInView>

        {/* Tab Navigation */}
        <FadeInView delay={200}>
          <div className="flex bg-white rounded-xl p-1 mb-6 border border-gray-100 shadow-sm">
            <button
              onClick={() => setActiveTab('personality')}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg transition-all ${activeTab === 'personality'
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Brain className="w-5 h-5 mr-2" />
              Persönlichkeit
            </button>
            <button
              onClick={() => setActiveTab('memories')}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg transition-all ${activeTab === 'memories'
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Tagebuch ({displayMemories.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg transition-all ${activeTab === 'inventory'
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <PackageOpen className="w-5 h-5 mr-2" />
              Schatzkammer
            </button>
          </div>
        </FadeInView>

        {/* Tab Content */}
        <div>
          {activeTab === 'personality' && (
            <FadeInView delay={300}>
              <Card variant="elevated" className="mb-6">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <TrendingUp className="w-6 h-6 mr-2 text-purple-500" />
                    Persönlichkeitsentwicklung
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Die Persönlichkeit deines Avatars entwickelt sich durch seine Erfahrungen in den Geschichten.
                  </p>

                  {/* Radar Chart Overview */}
                  {rawPersonalityTraits && (
                    <div className="mb-8 p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50 rounded-2xl border border-purple-100">
                      <h4 className="text-center text-sm font-semibold text-purple-700 mb-2 tracking-wide uppercase">
                        ✨ Fähigkeiten-Übersicht
                      </h4>
                      <PersonalityRadarChart
                        traits={rawPersonalityTraits}
                        size={320}
                        showMasteryBadges={true}
                        showLegend={true}
                        animate={true}
                      />
                    </div>
                  )}

                  {/* Debug buttons for resetting */}
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700 mb-3">
                      <strong>Debug-Funktionen:</strong>
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={async () => {
                          try {
                            const { getBackendUrl } = await import('../../config');
                            const target = getBackendUrl();
                            const token = await getToken();

                            const response = await fetch(`${target}/avatar/reset-personality-traits`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                              },
                              credentials: 'include'
                            });

                            if (response.ok) {
                              const result = await response.json();
                              alert(`✅ ${result.message}`);

                              if (avatarId) {
                                const avatarData = await backend.avatar.get({ id: avatarId });
                                if (avatarData && avatarData.id) {
                                  setAvatar(avatarData as any);
                                  if (avatarData.personalityTraits) {
                                    setRawPersonalityTraits(avatarData.personalityTraits);
                                    console.log('🔄 Updated personality traits after reset:', avatarData.personalityTraits);
                                  }
                                }
                              }
                            } else {
                              const error = await response.text();
                              alert(`❌ Error: ${error}`);
                            }
                          } catch (error) {
                            console.error('Reset error:', error);
                            alert(`❌ Network error: ${error}`);
                          }
                        }}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                      >
                        🔄 Persönlichkeit auf 0
                      </button>
                      <button
                        onClick={handleResetDokuHistory}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        📚 Doku-Historie zurücksetzen
                      </button>
                    </div>
                    <p className="text-xs text-yellow-600 mt-2">
                      Doku-Historie zurücksetzen ermöglicht das erneute Lesen von Dokus für Persönlichkeitsentwicklung.
                    </p>
                  </div>
                  <HierarchicalTraitDisplay
                    traits={rawPersonalityTraits ? (() => {
                      console.log('🔍 Raw personality traits from backend:', rawPersonalityTraits);
                      const converted = convertBackendTraitsToFrontend(rawPersonalityTraits);
                      console.log('🔄 Converted traits for display:', converted);
                      return converted;
                    })() : []}
                    memories={memories.map(m => ({
                      personalityChanges: m.personalityChanges,
                      storyTitle: m.storyTitle,
                      createdAt: m.createdAt || m.timestamp || ''
                    }))}
                    onReduceTrait={handleReduceTrait}
                  />
                </div>
              </Card>
            </FadeInView>
          )}

          {activeTab === 'memories' && (
            <FadeInView delay={300}>
              <Card variant="elevated" className="mb-6">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <BookOpen className="w-6 h-6 mr-2 text-amber-500" />
                    Tagebuch
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Alle Erlebnisse und Entdeckungen deines Avatars — wie in einem persönlichen Tagebuch.
                  </p>
                  {memoryLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Lade Tagebuch...</p>
                    </div>
                  ) : (
                    <MemoryTimeline
                      memories={displayMemories}
                      onDeleteMemory={handleDeleteMemory}
                    />
                  )}
                </div>
              </Card>
            </FadeInView>
          )}

          {activeTab === 'inventory' && (
            <FadeInView delay={300}>
              <Card variant="elevated" className="mb-6">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <PackageOpen className="w-6 h-6 mr-2 text-purple-500" />
                    Schatzkammer
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Sammle magische Gegenstände und Wissen aus deinen Abenteuern.
                  </p>
                  <TreasureRoom items={avatar.inventory || []} />
                </div>
              </Card>
            </FadeInView>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarDetailScreen;