import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles, WandSparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";

import { useBackend } from "../../hooks/useBackend";
import { useOptionalChildProfiles } from "../../contexts/ChildProfilesContext";
import { StoryGenerationProgress, StoryGenerationStep } from "../../components/story/StoryGenerationProgress";
import LevelUpModal from "../../components/gamification/LevelUpModal";
import type { InventoryItem } from "../../types/avatar";
import { useTheme } from "../../contexts/ThemeContext";
import { useStoryAgentFlow, ActiveAgentStack } from "../../agents";
import Step1AvatarSelection from "./wizard-steps/Step1AvatarSelection";
import Step2CategorySelection from "./wizard-steps/Step2CategorySelection";
import Step3AgeAndLength from "./wizard-steps/Step3AgeAndLength";
import Step4StoryFeeling from "./wizard-steps/Step4StoryFeeling";
import Step5SpecialWishes from "./wizard-steps/Step5SpecialWishes";
import Step6Summary from "./wizard-steps/Step6Summary";
import { generateStoryWithModelFallback } from "./storyGenerateWithModelFallback";
import {
  TaleaActionButton,
  TaleaMetricPill,
  TaleaPageBackground,
  TaleaProgressSteps,
  TaleaSurface,
  taleaChipClass,
  taleaDisplayFont,
  taleaPageShellClass,
} from "@/components/talea/TaleaPastelPrimitives";

interface WizardState {
  selectedAvatars: string[];
  mainCategory: "fairy-tales" | "adventure" | "magic" | "animals" | "scifi" | "modern" | null;
  subCategory: string | null;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+" | null;
  length: "short" | "medium" | "long" | null;
  feelings: ("funny" | "warm" | "exciting" | "crazy" | "meaningful")[];
  rhymes: boolean;
  moral: boolean;
  avatarIsHero: boolean;
  famousCharacters: boolean;
  happyEnd: boolean;
  surpriseEnd: boolean;
  customWish: string;
  aiModel:
    | "claude-sonnet-4-6"
    | "gpt-5.4"
    | "gpt-5.4-mini"
    | "gemini-3-flash-preview"
    | "gemini-3-pro-preview"
    | "gemini-3.1-pro-preview";
}

function getStoryGenerationErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message?.trim() || "";
  if (!message) {
    return fallback;
  }

  if (message.includes("length limit exceeded")) {
    return "Die Geschichte ist zu lang. Bitte waehle eine kuerzere Laenge.";
  }
  if (message.includes("timeout")) {
    return "Die Generierung hat zu lange gedauert. Bitte erneut versuchen.";
  }
  if (message.includes("Abo-Limit erreicht")) {
    return "Abo-Limit erreicht. Bitte im Profil dein Abo upgraden.";
  }
  if (message.includes("invalid token") || message.includes("unauthenticated")) {
    return "Deine Sitzung ist abgelaufen. Bitte Seite neu laden und erneut anmelden.";
  }
  if (message.includes("Story generation failed")) {
    return `Story-Generierung fehlgeschlagen:\n${message}`;
  }
  return `${fallback}\n\n${message}`;
}

export default function ModernStoryWizard() {
  const navigate = useNavigate();
  const backend = useBackend();
  const { userId } = useAuth();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { onPhaseChange, onStoryReady } = useStoryAgentFlow();

  const steps = [
    t("wizard.steps.avatars"),
    t("wizard.steps.category"),
    t("wizard.steps.ageLength"),
    t("wizard.steps.feeling"),
    t("wizard.steps.wishes"),
    t("wizard.steps.summary"),
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<StoryGenerationStep>("profiles");
  const [userLanguage, setUserLanguage] = useState<string>("de");
  const [lootArtifact, setLootArtifact] = useState<InventoryItem | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);
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
    customWish: "",
    aiModel: "gemini-3-flash-preview",
  });

  // Sync agent flow with generation phases
  useEffect(() => {
    if (generating) {
      onPhaseChange(generationStep);
    }
  }, [generationStep, generating, onPhaseChange]);

  useEffect(() => {
    if (i18n.language) {
      setUserLanguage(i18n.language);
    }
  }, [i18n.language]);

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleGenerate = async () => {
    if (!userId) {
      alert(t("story.wizard.alerts.loginRequired"));
      return;
    }

    try {
      setGenerating(true);

      setGenerationStep("profiles");
      await new Promise((resolve) => setTimeout(resolve, 1200));

      setGenerationStep("memories");
      await new Promise((resolve) => setTimeout(resolve, 1200));

      setGenerationStep("text");

      const storyConfig = mapWizardStateToAPI(state, userLanguage);
      const story = await generateStoryWithModelFallback(backend.story.generate, {
        userId,
        config: storyConfig,
        profileId: activeProfileId || undefined,
      });

      setGenerationStep("validation");
      await new Promise((resolve) => setTimeout(resolve, 900));

      setGenerationStep("images");
      await new Promise((resolve) => setTimeout(resolve, 1200));

      setGenerationStep("complete");
      await new Promise((resolve) => setTimeout(resolve, 800));

      const storyData = story as any;
      const newArtifact = storyData.newArtifact || storyData.metadata?.newArtifact;

      if (newArtifact) {
        const lootItem: InventoryItem = {
          id: crypto.randomUUID(),
          name: newArtifact.name,
          type: newArtifact.type || "TOOL",
          level: 1,
          sourceStoryId: story.id,
          description: newArtifact.description,
          visualPrompt: newArtifact.visualDescriptorKeywords?.join(", ") || "",
          tags: newArtifact.visualDescriptorKeywords || [],
          acquiredAt: new Date().toISOString(),
          imageUrl: newArtifact.imageUrl,
          storyEffect: newArtifact.storyEffect,
        };

        setLootArtifact(lootItem);
        setPendingStoryId(story.id);
        setShowLootModal(true);
      } else {
        navigate(`/story-reader/${story.id}`);
      }
    } catch (error) {
      console.error("[ModernWizard] Error generating story:", error);
      const fallback = t("story.wizard.alerts.error");
      alert(getStoryGenerationErrorMessage(error, fallback));
    } finally {
      setGenerating(false);
      setGenerationStep("profiles");
      onStoryReady();
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return state.selectedAvatars.length > 0;
      case 1:
        return state.mainCategory !== null;
      case 2:
        return state.ageGroup !== null && state.length !== null;
      case 3:
        return state.feelings.length > 0;
      case 4:
      case 5:
        return true;
      default:
        return false;
    }
  };

  const categoryLabel = state.mainCategory
    ? t(`wizard.categories.${state.mainCategory.replace("-", "_")}.title`)
    : "Noch offen";
  const ageLabel = state.ageGroup ? t(`wizard.ageGroups.${state.ageGroup}.title`) : "Noch offen";
  const lengthLabel = state.length ? t(`wizard.lengths.${state.length}.title`) : "Noch offen";
  const feelingLabel =
    state.feelings.length > 0
      ? state.feelings.map((item) => t(`wizard.feelings.${item}.title`)).join(", ")
      : "Noch offen";

  const overviewItems = [
    { id: "avatars", label: "Helden", value: state.selectedAvatars.length > 0 ? `${state.selectedAvatars.length} ausgewaehlt` : "Noch offen" },
    { id: "category", label: "Welt", value: categoryLabel },
    { id: "age", label: "Alter", value: ageLabel },
    { id: "mood", label: "Stimmung", value: feelingLabel },
  ];

  const stepDescriptions = [
    "Waehle die Avatare, die in dieser Geschichte auftreten.",
    "Bestimme die Welt, in der sich die Geschichte entfaltet.",
    "Lege Alter, Laenge und Modell der Geschichte fest.",
    "Definiere den emotionalen Ton fuer die Erzaehlung.",
    "Fuege kleine Extras und eigene Ideen hinzu.",
    "Pruefe alles vor dem Start und stoesse die Generierung an.",
  ];

  const generationPhaseLabel = {
    profiles: "Profile",
    memories: "Erinnerungen",
    text: "Text",
    validation: "Pruefung",
    images: "Bilder",
    complete: "Finalisierung",
  } satisfies Record<StoryGenerationStep, string>;

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

  const handleLootModalClose = () => {
    setShowLootModal(false);
    setLootArtifact(null);
    if (pendingStoryId) {
      navigate(`/story-reader/${pendingStoryId}`);
      setPendingStoryId(null);
    }
  };

  if (generating) {
    return (
      <div className="relative min-h-screen pb-24 pt-4">
        <TaleaPageBackground isDark={isDark} />
        <div className={`${taleaPageShellClass} space-y-5`}>
          <TaleaSurface className="p-5 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
              <div>
                <span className={`${taleaChipClass} border-white/75 bg-white/75 text-[var(--primary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--primary)]`}>
                  Story Atelier
                </span>
                <h1
                  className="mt-4 text-4xl font-semibold text-slate-900 dark:text-white md:text-[3.6rem]"
                  style={{ fontFamily: taleaDisplayFont }}
                >
                  {t("wizard.loading.title")}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                  {t("wizard.loading.subtitle")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <TaleaMetricPill label="Phase" value={generationPhaseLabel[generationStep]} />
                <TaleaMetricPill label="Story-Skizze" value={lengthLabel} />
              </div>
            </div>
          </TaleaSurface>

          <TaleaSurface className="p-5 md:p-6">
            <StoryGenerationProgress currentStep={generationStep} />
          </TaleaSurface>

          {/* Contextual agent banners — appear only during active generation */}
          <ActiveAgentStack className="mt-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-24 pt-4">
      <TaleaPageBackground isDark={isDark} />
      <div className={`${taleaPageShellClass} space-y-5`}>
        <TaleaSurface className="p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-end">
            <div>
              <span className={`${taleaChipClass} border-white/75 bg-white/75 text-[var(--primary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--primary)]`}>
                Story Atelier
              </span>
              <h1
                className="mt-4 text-4xl font-semibold text-slate-900 dark:text-white md:text-[3.8rem]"
                style={{ fontFamily: taleaDisplayFont }}
              >
                {t("story.wizard.title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                Eine ruhige Werkbank fuer hochwertige Kinderstories: sanfte Pastellflaechen, klare Entscheidungen und leichte Motion statt Standard-Wizard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TaleaMetricPill label="Fortschritt" value={`${activeStep + 1} / ${steps.length}`} />
              <TaleaMetricPill label="Story-Fokus" value={state.mainCategory ? categoryLabel : "Noch offen"} />
            </div>
          </div>
        </TaleaSurface>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <TaleaSurface className="self-start p-4 md:p-5 lg:sticky lg:top-5">
            <TaleaProgressSteps
              steps={steps.map((label, index) => ({ id: String(index), label }))}
              activeIndex={activeStep}
            />

            <div className="mt-5 space-y-3">
              {steps.map((label, index) => {
                const done = index < activeStep;
                const active = index === activeStep;

                return (
                  <div
                    key={label}
                    className={`rounded-[22px] border px-4 py-3 transition ${
                      active
                        ? "border-white/80 bg-white/82 shadow-[0_16px_34px_-24px_rgba(164,136,115,0.45)] dark:border-white/10 dark:bg-white/8"
                        : "border-white/60 bg-white/44 dark:border-white/10 dark:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          done
                            ? "bg-[var(--primary)] text-white"
                            : active
                              ? "border-2 border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                              : "border border-[var(--talea-border-light)] bg-white/60 text-[var(--talea-text-muted)] dark:bg-[var(--talea-surface-inset)] dark:text-[var(--talea-text-muted)]"
                        }`}
                      >
                        {done ? <CheckCircle size={16} /> : index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {stepDescriptions[index]}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-3">
              {overviewItems.map((item) => (
                <TaleaMetricPill key={item.id} label={item.label} value={item.value} />
              ))}
              <TaleaMetricPill label="Laenge" value={lengthLabel} />
            </div>
          </TaleaSurface>

          <TaleaSurface className="p-4 md:p-6">
            <div className="mb-6 flex flex-col gap-4 border-b border-white/70 pb-5 dark:border-white/10 md:flex-row md:items-end md:justify-between">
              <div>
                <span className={`${taleaChipClass} border-white/70 bg-white/72 text-[var(--primary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--primary)]`}>
                  Schritt {activeStep + 1}
                </span>
                <h2
                  className="mt-3 text-[2rem] font-semibold text-slate-900 dark:text-white md:text-[2.6rem]"
                  style={{ fontFamily: taleaDisplayFont }}
                >
                  {steps[activeStep]}
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                  {stepDescriptions[activeStep]}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <WandSparkles className="h-4 w-4 text-[var(--primary)]" />
                {t("story.wizard.stepCounter", { current: activeStep + 1, total: steps.length })}
              </div>
            </div>

            <div className="min-h-[440px]">{renderStep()}</div>

            <div className="mt-8 flex flex-col gap-3 border-t border-white/70 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <TaleaActionButton
                variant="secondary"
                onClick={handleBack}
                disabled={activeStep === 0}
                icon={<ArrowLeft className="h-4 w-4" />}
                className="justify-center sm:justify-start"
              >
                {t("wizard.buttons.back")}
              </TaleaActionButton>

              {activeStep < steps.length - 1 ? (
                <TaleaActionButton
                  onClick={handleNext}
                  disabled={!canProceed()}
                  icon={<ArrowRight className="h-4 w-4" />}
                  className="justify-center sm:justify-start"
                >
                  {t("wizard.buttons.next")}
                </TaleaActionButton>
              ) : (
                <TaleaActionButton
                  onClick={handleGenerate}
                  icon={<Sparkles className="h-4 w-4" />}
                  className="justify-center sm:justify-start"
                >
                  {t("wizard.buttons.generate")}
                </TaleaActionButton>
              )}
            </div>
          </TaleaSurface>
        </div>
      </div>

      <LevelUpModal
        isOpen={showLootModal}
        onClose={handleLootModalClose}
        item={lootArtifact || undefined}
        type="new_item"
      />
    </div>
  );
}

function mapWizardStateToAPI(state: WizardState, userLanguage: string) {
  const ageGroupMap: Record<string, string> = {
    "3-5": "3-5",
    "6-8": "6-8",
    "9-12": "9-12",
    "13+": "13+",
  };

  const lengthMap: Record<string, string> = {
    short: "short",
    medium: "medium",
    long: "long",
  };

  const genreMap: Record<string, string> = {
    "fairy-tales": "fairy_tales",
    adventure: "adventure",
    magic: "magic",
    animals: "animals",
    scifi: "scifi",
    modern: "modern",
  };

  let tone: "warm" | "witty" | "epic" | "soothing" | "mischievous" | "wonder" = "warm";
  if (state.feelings.includes("funny")) tone = "witty";
  else if (state.feelings.includes("exciting")) tone = "epic";
  else if (state.feelings.includes("warm")) tone = "warm";
  else if (state.feelings.includes("crazy")) tone = "mischievous";
  else if (state.feelings.includes("meaningful")) tone = "soothing";
  else if (state.mainCategory === "magic") tone = "wonder";

  const rawGenre = state.mainCategory ? genreMap[state.mainCategory] : null;
  const genre = rawGenre || "adventure";

  return {
    avatarIds: state.selectedAvatars,
    ageGroup: (state.ageGroup ? ageGroupMap[state.ageGroup] : "6-8") as "3-5" | "6-8" | "9-12" | "13+",
    genre,
    length: (state.length ? lengthMap[state.length] : "medium") as "short" | "medium" | "long",
    complexity: "medium" as "simple" | "medium" | "complex",
    setting: state.mainCategory === "fairy-tales" ? "fantasy" : "varied",
    suspenseLevel: state.feelings.includes("exciting") ? 2 : 1,
    humorLevel: state.feelings.includes("funny") ? 2 : 1,
    tone,
    pacing: (state.feelings.includes("exciting") ? "fast" : "balanced") as "fast" | "balanced" | "slow",
    allowRhymes: state.rhymes,
    hasTwist: state.surpriseEnd,
    customPrompt: state.customWish || undefined,
    language: userLanguage as "de" | "en" | "fr" | "es" | "it" | "nl" | "ru",
    aiModel: state.aiModel || "gemini-3-flash-preview",
    preferences: {
      useFairyTaleTemplate: state.mainCategory === "fairy-tales" || state.mainCategory === "magic",
    },
  } as any;
}
