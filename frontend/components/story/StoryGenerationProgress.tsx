import React from "react";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTrigger,
  StepperTitle,
  StepperDescription,
} from "@/components/ui/stepper";
import { Check, Loader2, Users, Brain, FileText, CheckCircle, Image, Sparkles } from "lucide-react";

export type StoryGenerationStep =
  | "profiles"
  | "memories"
  | "text"
  | "validation"
  | "images"
  | "complete";

interface StoryGenerationProgressProps {
  currentStep: StoryGenerationStep;
  className?: string;
}

const STEP_CONFIG = {
  profiles: {
    step: 1,
    icon: Users,
    title: "Avatar-Profile laden",
    description: "Lade visuelle Profile und Eigenschaften",
    estimatedTime: "2-3 Sek",
  },
  memories: {
    step: 2,
    icon: Brain,
    title: "Erinnerungen abrufen",
    description: "Sammle Erlebnisse und Persoenlichkeitsentwicklung",
    estimatedTime: "2-3 Sek",
  },
  text: {
    step: 3,
    icon: FileText,
    title: "Story-Text generieren",
    description: "Die KI schreibt die Geschichte mit allen Kapiteln",
    estimatedTime: "25-30 Sek",
  },
  validation: {
    step: 4,
    icon: CheckCircle,
    title: "Story validieren",
    description: "Struktur und Konsistenz werden geprueft",
    estimatedTime: "2-3 Sek",
  },
  images: {
    step: 5,
    icon: Image,
    title: "Bilder generieren",
    description: "Cover und Kapitelbilder werden erstellt",
    estimatedTime: "40-50 Sek",
  },
  complete: {
    step: 6,
    icon: Sparkles,
    title: "Fertigstellen",
    description: "Story speichern und Avatare aktualisieren",
    estimatedTime: "2-3 Sek",
  },
} as const;

const STEP_ORDER: StoryGenerationStep[] = ["profiles", "memories", "text", "validation", "images", "complete"];

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
                <StepperTrigger className="w-full justify-start rounded-[22px] border border-white/70 bg-white/72 p-4 text-left shadow-[0_18px_36px_-26px_rgba(150,122,99,0.42)] transition hover:-translate-y-0.5 hover:bg-white/82 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_44px_-28px_rgba(2,8,23,0.9)] dark:hover:bg-white/8">
                  <StepperIndicator className="size-9 data-[state=completed]:bg-[#7daf99] data-[state=completed]:text-white data-[state=active]:bg-[linear-gradient(135deg,#f2d8e4_0%,#dfeefc_100%)] data-[state=active]:text-[#425166] data-[state=inactive]:bg-white/90 data-[state=inactive]:text-slate-400 dark:data-[state=completed]:bg-[#7fa3c8] dark:data-[state=active]:bg-[linear-gradient(135deg,rgba(111,84,114,0.54)_0%,rgba(65,96,131,0.44)_100%)] dark:data-[state=active]:text-white dark:data-[state=inactive]:bg-white/8 dark:data-[state=inactive]:text-slate-500">
                    {!isLoading && !isCompleted ? <Icon className="size-4" /> : null}
                  </StepperIndicator>

                  <div className="ml-3 flex-1 text-left">
                    <StepperTitle className="text-base font-semibold text-slate-900 dark:text-white">
                      {config.title}
                    </StepperTitle>
                    <StepperDescription className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {config.description}
                    </StepperDescription>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {isLoading ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          <span>Laeuft gerade...</span>
                        </>
                      ) : null}
                      {!isLoading && !isCompleted ? <span>~{config.estimatedTime}</span> : null}
                      {isCompleted ? (
                        <span className="font-medium text-[#6f9c8b] dark:text-[#9dc6e4]">OK Abgeschlossen</span>
                      ) : null}
                    </div>
                  </div>
                </StepperTrigger>

                {!isLast ? (
                  <StepperSeparator className="ml-8 bg-white/60 group-data-[state=completed]/step:bg-[#7daf99] dark:bg-white/8 dark:group-data-[state=completed]/step:bg-[#7fa3c8]" />
                ) : null}
              </StepperItem>
            );
          })}
        </StepperNav>
      </Stepper>

      <div className="mt-6 rounded-[22px] border border-white/70 bg-white/74 p-4 shadow-[0_16px_34px_-26px_rgba(150,122,99,0.4)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_44px_-28px_rgba(2,8,23,0.88)]">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-[#b4879f] dark:text-[#9dc6e4]" />
          <span className="font-medium text-slate-900 dark:text-slate-100">
            Geschaetzte Gesamtdauer: 75-90 Sekunden
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Die laengste Phase ist die Bildgenerierung. Bitte hab etwas Geduld.
        </p>
      </div>
    </div>
  );
}
