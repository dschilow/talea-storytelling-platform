import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, User, BookOpen } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import backend from '~backend/client';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

interface Story {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
}

const HomeScreen: React.FC = () => {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mock user ID for demo purposes
  const userId = 'demo-user-123';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load avatars and stories in parallel
      const [avatarsResponse, storiesResponse] = await Promise.all([
        backend.avatar.list({ userId }),
        backend.story.list({ userId })
      ]);

      setAvatars(avatarsResponse.avatars);
      setStories(storiesResponse.stories);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const navigateToAvatarCreation = () => {
    window.location.href = '/avatar';
  };

  const navigateToStoryCreation = () => {
    window.location.href = '/story';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Lade deine Welt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <FadeInView delay={0}>
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white p-8 rounded-b-3xl mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Willkommen bei Talea! 🌟</h1>
              <p className="text-purple-100 text-lg">
                Erschaffe magische Geschichten mit deinen Avataren
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </FadeInView>

      <div className="px-6 space-y-6">
        {/* Quick Actions */}
        <FadeInView delay={100}>
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Schnellaktionen</h2>
            <div className="grid grid-cols-2 gap-4">
              <Card variant="elevated" className="text-center">
                <button 
                  onClick={navigateToAvatarCreation}
                  className="w-full p-4"
                >
                  <User className="w-8 h-8 mx-auto mb-3 text-purple-600" />
                  <h3 className="font-semibold text-gray-800 mb-1">Avatar erstellen</h3>
                  <p className="text-sm text-gray-600">
                    Erschaffe einen neuen Charakter
                  </p>
                </button>
              </Card>

              <Card variant="elevated" className="text-center">
                <button 
                  onClick={navigateToStoryCreation}
                  className="w-full p-4"
                >
                  <BookOpen className="w-8 h-8 mx-auto mb-3 text-purple-600" />
                  <h3 className="font-semibold text-gray-800 mb-1">Geschichte schreiben</h3>
                  <p className="text-sm text-gray-600">
                    Starte ein neues Abenteuer
                  </p>
                </button>
              </Card>
            </div>
          </div>
        </FadeInView>

        {/* Avatars Section */}
        <FadeInView delay={200}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Meine Avatare</h2>
              <span className="text-gray-500">({avatars.length})</span>
            </div>
            
            {avatars.length === 0 ? (
              <Card variant="outlined" className="text-center py-8">
                <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Avatare</h3>
                <p className="text-gray-600 mb-4">
                  Erstelle deinen ersten Avatar, um loszulegen!
                </p>
                <Button
                  title="Avatar erstellen"
                  onPress={navigateToAvatarCreation}
                  size="sm"
                />
              </Card>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {avatars.map((avatar, index) => (
                  <FadeInView key={avatar.id} delay={300 + index * 50}>
                    <Card variant="elevated" className="min-w-[120px] text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">
                          {avatar.creationType === 'ai-generated' ? '🤖' : '📷'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm mb-1 truncate">
                        {avatar.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {avatar.creationType === 'ai-generated' ? 'KI-generiert' : 'Foto-basiert'}
                      </p>
                    </Card>
                  </FadeInView>
                ))}
              </div>
            )}
          </div>
        </FadeInView>

        {/* Stories Section */}
        <FadeInView delay={300}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Meine Geschichten</h2>
              <span className="text-gray-500">({stories.length})</span>
            </div>
            
            {stories.length === 0 ? (
              <Card variant="outlined" className="text-center py-8">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Geschichten</h3>
                <p className="text-gray-600 mb-4">
                  Erschaffe deine erste magische Geschichte!
                </p>
                <Button
                  title="Geschichte erstellen"
                  onPress={navigateToStoryCreation}
                  size="sm"
                />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {stories.map((story, index) => (
                  <FadeInView key={story.id} delay={400 + index * 50}>
                    <Card variant="elevated">
                      <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center mb-3 relative">
                        <span className="text-2xl">📖</span>
                        {story.status === 'generating' && (
                          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                            Wird erstellt...
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm mb-1 line-clamp-2">
                        {story.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-3">
                        {story.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(story.createdAt).toLocaleDateString('de-DE')}
                      </p>
                    </Card>
                  </FadeInView>
                ))}
              </div>
            )}
          </div>
        </FadeInView>
      </div>
    </div>
  );
};

export default HomeScreen;
