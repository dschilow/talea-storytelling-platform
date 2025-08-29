import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import Card from '../../components/common/Card';
import FadeInView from '../../components/animated/FadeInView';
import AIGeneratedTab from './AIGeneratedTab';
import PhotoUploadTab from './PhotoUploadTab';

type TabType = 'ai-generated' | 'photo-upload';

const AvatarCreationScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('ai-generated');

  const tabs = [
    { key: 'ai-generated', title: 'KI-Generiert', icon: '🤖' },
    { key: 'photo-upload', title: 'Foto hochladen', icon: '📷' }
  ];

  const goBack = () => {
    window.location.href = '/';
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai-generated':
        return <AIGeneratedTab />;
      case 'photo-upload':
        return <PhotoUploadTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <FadeInView delay={0}>
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center mb-4">
            <button
              onClick={goBack}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-3"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <h1 className="text-2xl font-bold text-gray-800">Avatar erstellen</h1>
              <p className="text-gray-600">
                Erschaffe deinen einzigartigen Charakter
              </p>
            </div>
          </div>
        </div>
      </FadeInView>

      <div className="px-6 py-6">
        {/* Tab Bar */}
        <FadeInView delay={100}>
          <Card variant="elevated" padding="sm" className="mb-6">
            <div className="flex bg-gray-100 rounded-lg p-1 relative">
              {/* Tab Indicator */}
              <div 
                className={`absolute top-1 bottom-1 bg-white rounded-md shadow-sm transition-transform duration-300 ease-out`}
                style={{
                  width: '50%',
                  transform: `translateX(${activeTab === 'ai-generated' ? '0%' : '100%'})`
                }}
              />
              
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabType)}
                  className={`flex-1 flex items-center justify-center py-3 px-4 rounded-md transition-colors relative z-10 ${
                    activeTab === tab.key 
                      ? 'text-purple-600 font-semibold' 
                      : 'text-gray-600'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  <span>{tab.title}</span>
                </button>
              ))}
            </div>
          </Card>
        </FadeInView>

        {/* Tab Content */}
        <div>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default AvatarCreationScreen;
