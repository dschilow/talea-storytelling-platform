import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import FadeInView from '../../../components/animated/FadeInView';

interface LearningMode {
  enabled: boolean;
  subjects: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learningObjectives: string[];
  assessmentType: 'quiz' | 'interactive' | 'discussion';
}

interface LearningModeStepProps {
  learningMode?: LearningMode;
  onLearningModeChange: (learningMode?: LearningMode) => void;
}

const LearningModeStep: React.FC<LearningModeStepProps> = ({
  learningMode,
  onLearningModeChange,
}) => {
  const [newObjective, setNewObjective] = useState('');

  const subjects = [
    { key: 'math', label: 'Mathematik', icon: '🔢' },
    { key: 'science', label: 'Naturwissenschaften', icon: '🔬' },
    { key: 'language', label: 'Sprache', icon: '📝' },
    { key: 'history', label: 'Geschichte', icon: '🏛️' },
    { key: 'geography', label: 'Geografie', icon: '🌍' },
    { key: 'social', label: 'Soziales Lernen', icon: '👥' },
  ];

  const difficultyOptions = [
    { key: 'beginner', label: 'Anfänger', icon: '🌱', description: 'Grundlagen vermitteln' },
    { key: 'intermediate', label: 'Fortgeschritten', icon: '🌿', description: 'Wissen vertiefen' },
    { key: 'advanced', label: 'Experte', icon: '🌳', description: 'Komplexe Konzepte' },
  ];

  const assessmentOptions = [
    { key: 'quiz', label: 'Quiz', icon: '❓', description: 'Fragen am Ende' },
    { key: 'interactive', label: 'Interaktiv', icon: '🎮', description: 'Während der Geschichte' },
    { key: 'discussion', label: 'Diskussion', icon: '💬', description: 'Gesprächsanregungen' },
  ];

  const toggleLearningMode = () => {
    if (learningMode?.enabled) {
      onLearningModeChange(undefined);
    } else {
      onLearningModeChange({
        enabled: true,
        subjects: [],
        difficulty: 'beginner',
        learningObjectives: [],
        assessmentType: 'quiz',
      });
    }
  };

  const updateLearningMode = (updates: Partial<LearningMode>) => {
    if (learningMode) {
      onLearningModeChange({ ...learningMode, ...updates });
    }
  };

  const toggleSubject = (subjectKey: string) => {
    if (!learningMode) return;
    
    const subjects = learningMode.subjects.includes(subjectKey)
      ? learningMode.subjects.filter(s => s !== subjectKey)
      : [...learningMode.subjects, subjectKey];
    
    updateLearningMode({ subjects });
  };

  const addLearningObjective = () => {
    if (!learningMode || !newObjective.trim()) return;
    
    const objectives = [...learningMode.learningObjectives, newObjective.trim()];
    updateLearningMode({ learningObjectives: objectives });
    setNewObjective('');
  };

  const removeLearningObjective = (index: number) => {
    if (!learningMode) return;
    
    const objectives = learningMode.learningObjectives.filter((_, i) => i !== index);
    updateLearningMode({ learningObjectives: objectives });
  };

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <FadeInView delay={100}>
        <Card variant="elevated">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Lernmodus aktivieren</h2>
              <p className="text-gray-600">
                Integriere Bildungsinhalte in deine Geschichte
              </p>
            </div>
            <button
              onClick={toggleLearningMode}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                learningMode?.enabled ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  learningMode?.enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>
      </FadeInView>

      {learningMode?.enabled && (
        <>
          {/* Subjects */}
          <FadeInView delay={200}>
            <Card variant="elevated">
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Fächer auswählen</h2>
              <p className="text-gray-600 text-center mb-6">
                Welche Themen sollen behandelt werden?
              </p>
              
              <div className="grid grid-cols-3 gap-3">
                {subjects.map((subject, index) => (
                  <FadeInView key={subject.key} delay={250 + index * 50}>
                    <button
                      onClick={() => toggleSubject(subject.key)}
                      className={`p-3 rounded-lg border-2 transition-colors text-center ${
                        learningMode.subjects.includes(subject.key)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <span className="text-xl mb-2 block">{subject.icon}</span>
                      <h3 className={`font-medium text-sm ${
                        learningMode.subjects.includes(subject.key) ? 'text-purple-700' : 'text-gray-800'
                      }`}>
                        {subject.label}
                      </h3>
                    </button>
                  </FadeInView>
                ))}
              </div>
            </Card>
          </FadeInView>

          {/* Difficulty */}
          <FadeInView delay={300}>
            <Card variant="elevated">
              <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Schwierigkeitsgrad</h2>
              
              <div className="grid grid-cols-3 gap-3">
                {difficultyOptions.map((option, index) => (
                  <FadeInView key={option.key} delay={350 + index * 50}>
                    <button
                      onClick={() => updateLearningMode({ difficulty: option.key as any })}
                      className={`p-4 rounded-lg border-2 transition-colors text-center ${
                        learningMode.difficulty === option.key
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{option.icon}</span>
                      <h3 className={`font-semibold mb-1 ${
                        learningMode.difficulty === option.key ? 'text-purple-700' : 'text-gray-800'
                      }`}>
                        {option.label}
                      </h3>
                      <p className={`text-xs ${
                        learningMode.difficulty === option.key ? 'text-purple-600' : 'text-gray-600'
                      }`}>
                        {option.description}
                      </p>
                    </button>
                  </FadeInView>
                ))}
              </div>
            </Card>
          </FadeInView>

          {/* Learning Objectives */}
          <FadeInView delay={400}>
            <Card variant="elevated">
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Lernziele</h2>
              <p className="text-gray-600 text-center mb-6">
                Was soll gelernt werden? (optional)
              </p>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Neues Lernziel hinzufügen..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={addLearningObjective}
                  disabled={!newObjective.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {learningMode.learningObjectives.length > 0 && (
                <div className="space-y-2">
                  {learningMode.learningObjectives.map((objective, index) => (
                    <FadeInView key={index} delay={450 + index * 50}>
                      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                        <span className="flex-1 text-gray-700">{objective}</span>
                        <button
                          onClick={() => removeLearningObjective(index)}
                          className="p-1 text-red-500 hover:bg-red-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </FadeInView>
                  ))}
                </div>
              )}
            </Card>
          </FadeInView>

          {/* Assessment Type */}
          <FadeInView delay={500}>
            <Card variant="elevated">
              <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Bewertungsart</h2>
              
              <div className="grid grid-cols-3 gap-3">
                {assessmentOptions.map((option, index) => (
                  <FadeInView key={option.key} delay={550 + index * 50}>
                    <button
                      onClick={() => updateLearningMode({ assessmentType: option.key as any })}
                      className={`p-4 rounded-lg border-2 transition-colors text-center ${
                        learningMode.assessmentType === option.key
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{option.icon}</span>
                      <h3 className={`font-semibold mb-1 ${
                        learningMode.assessmentType === option.key ? 'text-purple-700' : 'text-gray-800'
                      }`}>
                        {option.label}
                      </h3>
                      <p className={`text-xs ${
                        learningMode.assessmentType === option.key ? 'text-purple-600' : 'text-gray-600'
                      }`}>
                        {option.description}
                      </p>
                    </button>
                  </FadeInView>
                ))}
              </div>
            </Card>
          </FadeInView>
        </>
      )}
    </div>
  );
};

export default LearningModeStep;
