// Modern Story Wizard - Kindgerecht & Smart
// 6 Schritte statt 20+ Parameter
// Version 2.0 - November 2025

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Import Steps
import Step1AvatarSelection from './wizard-steps/Step1AvatarSelection';
import Step2CategorySelection from './wizard-steps/Step2CategorySelection';
import Step3AgeAndLength from './wizard-steps/Step3AgeAndLength';
import Step4StoryFeeling from './wizard-steps/Step4StoryFeeling';
import Step5SpecialWishes from './wizard-steps/Step5SpecialWishes';
import Step6Summary from './wizard-steps/Step6Summary';

interface WizardState {
  // Step 1: Avatar Selection
  selectedAvatars: string[]; // Avatar IDs
  
  // Step 2: Category
  mainCategory: 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;
  subCategory: string | null;
  
  // Step 3: Age & Length
  ageGroup: '3-5' | '6-8' | '9-12' | '13+' | null;
  length: 'short' | 'medium' | 'long' | null;
  
  // Step 4: Feeling
  feelings: ('funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful')[];
  
  // Step 5: Special Wishes
  rhymes: boolean;
  moral: boolean;
  avatarIsHero: boolean;
  famousCharacters: boolean;
  happyEnd: boolean;
  surpriseEnd: boolean;
  customWish: string;
}

const STEPS = [
  'Wer spielt mit?',
  'Was für eine Geschichte?',
  'Wie alt & wie lang?',
  'Welches Gefühl?',
  'Besondere Wünsche',
  'Zusammenfassung'
];

export default function ModernStoryWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    selectedAvatars: [],
    mainCategory: null,
    subCategory: null,
    ageGroup: null,
    length: null,
    feelings: [],
    rhymes: false,
    moral: false,
    avatarIsHero: true,
    famousCharacters: false,
    happyEnd: true,
    surpriseEnd: false,
    customWish: ''
  });

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const handleGenerate = async () => {
    // Map wizard state to API request
    const request = mapWizardStateToAPI(state);
    
    // Navigate to generation screen
    navigate('/stories/generating', { state: { request } });
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return state.selectedAvatars.length > 0;
      case 1: return state.mainCategory !== null;
      case 2: return state.ageGroup !== null && state.length !== null;
      case 3: return state.feelings.length > 0;
      case 4: return true; // Optional step
      case 5: return true; // Summary
      default: return false;
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <Step1AvatarSelection state={state} updateState={updateState} />;
      case 1:
        return <Step2CategorySelection state={state} updateState={updateState} />;
      case 2:
        return <Step3AgeAndLength state={state} updateState={updateState} />;
      case 3:
        return <Step4StoryFeeling state={state} updateState={updateState} />;
      case 4:
        return <Step5SpecialWishes state={state} updateState={updateState} />;
      case 5:
        return <Step6Summary state={state} onGenerate={handleGenerate} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">
            ✨ Neue Geschichte erstellen
          </h1>
          <p className="text-gray-600">Schritt {activeStep + 1} von {STEPS.length}</p>
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  ${index < activeStep ? 'bg-green-500 text-white' : ''}
                  ${index === activeStep ? 'bg-purple-600 text-white ring-4 ring-purple-200' : ''}
                  ${index > activeStep ? 'bg-gray-200 text-gray-500' : ''}
                `}>
                  {index < activeStep ? <CheckCircle size={20} /> : index + 1}
                </div>
                <span className={`text-xs mt-2 text-center ${index === activeStep ? 'font-bold text-purple-600' : 'text-gray-500'}`}>
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-1 flex-1 mx-2 rounded ${index < activeStep ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] mb-8">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            disabled={activeStep === 0}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
              ${activeStep === 0 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:scale-95'}
            `}
          >
            <ArrowLeft size={20} />
            Zurück
          </button>
          
          {activeStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                ${!canProceed()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-lg'}
              `}
            >
              Weiter
              <ArrowRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              className="
                flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-xl
                bg-gradient-to-r from-green-500 to-emerald-600 text-white
                hover:from-green-600 hover:to-emerald-700 active:scale-95
                shadow-2xl transform transition-all duration-200
              "
            >
              <Sparkles size={24} />
              GESCHICHTE ERSTELLEN!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper: Map wizard state to API request format
function mapWizardStateToAPI(state: WizardState) {
  // Convert wizard-friendly format to existing API format
  const ageGroupMap: Record<string, string> = {
    '3-5': '3-5',
    '6-8': '6-8',
    '9-12': '9-12',
    '13+': '13+'
  };

  const lengthMap: Record<string, string> = {
    'short': 'short',
    'medium': 'medium',
    'long': 'long'
  };

  const genreMap: Record<string, string> = {
    'fairy-tales': 'fantasy',
    'adventure': 'adventure',
    'magic': 'fantasy',
    'animals': 'animals',
    'scifi': 'scifi',
    'modern': 'realistic'
  };

  return {
    avatarIds: state.selectedAvatars,
    ageGroup: state.ageGroup ? ageGroupMap[state.ageGroup] : '6-8',
    genre: state.mainCategory ? genreMap[state.mainCategory] : 'adventure',
    length: state.length ? lengthMap[state.length] : 'medium',
    complexity: 'medium',
    setting: state.mainCategory === 'fairy-tales' ? 'fantasy' : 'varied',
    suspenseLevel: state.feelings.includes('exciting') ? 2 : 1,
    humorLevel: state.feelings.includes('funny') ? 2 : 1,
    tone: state.feelings.includes('warm') ? 'warm' : 'balanced',
    pacing: state.feelings.includes('exciting') ? 'fast' : 'balanced',
    allowRhymes: state.rhymes,
    hasTwist: state.surpriseEnd,
    customPrompt: state.customWish || undefined,
    preferences: {
      useFairyTaleTemplate: state.mainCategory === 'fairy-tales'
    }
  };
}
