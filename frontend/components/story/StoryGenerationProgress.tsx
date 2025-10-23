import React from 'react';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTrigger,
  StepperTitle,
  StepperDescription,
} from '@/components/ui/stepper';
import { Check, Loader2, Users, Brain, FileText, CheckCircle, Image, Sparkles } from 'lucide-react';

export type StoryGenerationStep = 
  | 'profiles' 
  | 'memories' 
  | 'text' 
  | 'validation' 
  | 'images' 
  | 'complete';

interface StoryGenerationProgressProps {
  currentStep: StoryGenerationStep;
  className?: string;
}

const STEP_CONFIG = {
  profiles: {
    step: 1,
    icon: Users,
    title: 'Avatar-Profile laden',
    description: 'Lade visuelle Profile und Eigenschaften',
    estimatedTime: '2-3 Sek',
  },
  memories: {
    step: 2,
    icon: Brain,
    title: 'Erinnerungen abrufen',
    description: 'Sammle Erlebnisse und Persönlichkeitsentwicklung',
    estimatedTime: '2-3 Sek',
  },
  text: {
    step: 3,
    icon: FileText,
    title: 'Story-Text generieren',
    description: 'KI schreibt die Geschichte mit allen Kapiteln',
    estimatedTime: '25-30 Sek',
  },
  validation: {
    step: 4,
    icon: CheckCircle,
    title: 'Story validieren',
    description: 'Prüfe Struktur und Konsistenz',
    estimatedTime: '2-3 Sek',
  },
  images: {
    step: 5,
    icon: Image,
    title: 'Bilder generieren',
    description: 'Erstelle Cover und Kapitelbilder',
    estimatedTime: '40-50 Sek',
  },
  complete: {
    step: 6,
    icon: Sparkles,
    title: 'Fertigstellen',
    description: 'Speichere Story und aktualisiere Avatare',
    estimatedTime: '2-3 Sek',
  },
};

const STEP_ORDER: StoryGenerationStep[] = ['profiles', 'memories', 'text', 'validation', 'images', 'complete'];

export function StoryGenerationProgress({ currentStep, className }: StoryGenerationProgressProps) {
  const currentStepNumber = STEP_CONFIG[currentStep].step;
  const totalSteps = STEP_ORDER.length;

  return (
    <div className={className}>
      <Stepper
        value={currentStepNumber}
        orientation="vertical"
        className="w-full"
        indicators={{
          completed: <Check className="size-4" />,
          loading: <Loader2 className="size-4 animate-spin" />,
        }}
      >
        <StepperNav className="w-full">
          {STEP_ORDER.map((stepKey, index) => {
            const config = STEP_CONFIG[stepKey];
            const Icon = config.icon;
            const isLast = index === totalSteps - 1;
            const isLoading = config.step === currentStepNumber;
            const isCompleted = config.step < currentStepNumber;

            return (
              <StepperItem 
                key={stepKey} 
                step={config.step} 
                loading={isLoading}
                completed={isCompleted}
                className="w-full"
              >
                <StepperTrigger className="w-full justify-start p-4 rounded-lg hover:bg-accent/50 transition-colors">
                  <StepperIndicator className="data-[state=completed]:bg-green-500 data-[state=completed]:text-white data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-gray-200 data-[state=inactive]:text-gray-500 size-8">
                    {!isLoading && !isCompleted && <Icon className="size-4" />}
                  </StepperIndicator>
                  
                  <div className="flex-1 text-left ml-3">
                    <StepperTitle className="text-base font-semibold">
                      {config.title}
                    </StepperTitle>
                    <StepperDescription className="text-sm mt-1">
                      {config.description}
                    </StepperDescription>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {isLoading && (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          <span>Läuft gerade...</span>
                        </>
                      )}
                      {!isLoading && !isCompleted && (
                        <span>~{config.estimatedTime}</span>
                      )}
                      {isCompleted && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ✓ Abgeschlossen
                        </span>
                      )}
                    </div>
                  </div>
                </StepperTrigger>
                
                {!isLast && (
                  <StepperSeparator className="ml-8 group-data-[state=completed]/step:bg-green-500" />
                )}
              </StepperItem>
            );
          })}
        </StepperNav>
      </Stepper>

      {/* Geschätzte Gesamtzeit */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-blue-900 dark:text-blue-100">
            Geschätzte Gesamtdauer: 75-90 Sekunden
          </span>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
          Die längste Phase ist die Bildgenerierung. Bitte hab etwas Geduld! 🎨
        </p>
      </div>
    </div>
  );
}

