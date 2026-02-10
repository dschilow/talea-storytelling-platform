import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { TRAIT_CATEGORIES, TraitValue, buildDynamicCategories, getTraitLabel, getTraitIcon, getSubcategoryIcon, convertBackendTraitsToFrontend, normalizeTraitValues } from '../../constants/traits';
import { groupTraitsHierarchically, formatKnowledgeDisplay, getCategoryEmoji, type TraitDisplayData } from '../../utils/personalityDisplay';

interface HierarchicalTraitDisplayProps {
  traits: TraitValue[];
  memories?: Array<{
    personalityChanges: Array<{
      trait: string;
      change: number;
      description?: string;
    }>;
    storyTitle: string;
    createdAt: string;
  }>;
  language?: 'de' | 'en' | 'ru';
  onReduceTrait?: (trait: string, amount: number, reason?: string) => void;
}

export const HierarchicalTraitDisplay: React.FC<HierarchicalTraitDisplayProps> = ({
  traits,
  memories = [],
  language = 'de',
  onReduceTrait
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Normalize traits to handle backend format (knowledge.history -> traitId: knowledge, subcategory: history)
  const normalizedTraits = normalizeTraitValues(traits);

  const getTraitValue = (traitId: string, subcategory?: string): number => {
    const matchingTraits = normalizedTraits.filter(t => t.traitId === traitId);
    if (subcategory) {
      const specificTrait = matchingTraits.find(t => t.subcategory === subcategory);
      return specificTrait?.value || 0;
    }
    // For main categories, get the main category value (not subcategories)
    const mainCategoryTrait = matchingTraits.find(t => !t.subcategory);
    return mainCategoryTrait?.value || 0;
  };

  const hasRecentProgress = (traitId: string, subcategory?: string): boolean => {
    // Check if there are recent changes in memories
    const traitIdentifier = subcategory ? `${traitId}.${subcategory}` : traitId;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return memories.some(memory => {
      const memoryDate = new Date(memory.createdAt);
      return memoryDate > weekAgo &&
             memory.personalityChanges.some(change => change.trait === traitIdentifier);
    });
  };

  const getRecentReasons = (traitId: string, subcategory?: string): string[] => {
    // Get reasons from memories instead of trait history
    const traitIdentifier = subcategory ? `${traitId}.${subcategory}` : traitId;
    const currentValue = getTraitValue(traitId, subcategory);

    // Only show descriptions if the trait has points > 0
    if (currentValue <= 0) {
      return [];
    }

    const reasons: string[] = [];

    // Go through memories and collect descriptions for this trait
    memories.forEach(memory => {
      memory.personalityChanges.forEach(change => {
        if (change.trait === traitIdentifier && change.description) {
          const shortTitle = memory.storyTitle.length > 30
            ? memory.storyTitle.substring(0, 30) + '...'
            : memory.storyTitle;
          reasons.push(`${change.description} (${shortTitle})`);
        }
      });
    });

    // Return most recent 3 reasons
    return reasons.slice(-3);
  };

  const getProgressColor = (value: number): string => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-stone-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getProgressTextColor = (value: number): string => {
    if (value >= 80) return 'text-green-700';
    if (value >= 60) return 'text-stone-700';
    if (value >= 40) return 'text-yellow-700';
    return 'text-gray-700';
  };

  const renderSubcategory = (subcategory: any, mainCategoryId: string) => {
    const value = getTraitValue(mainCategoryId, subcategory.id);
    const isRecent = hasRecentProgress(mainCategoryId, subcategory.id);
    const reasons = getRecentReasons(mainCategoryId, subcategory.id);

    // Don't render subcategories with 0 points - they should be removed entirely
    if (value === 0) {
      return null;
    }

    return (
      <div key={subcategory.id} className="ml-6 py-3 border-l-2 pl-4 border-stone-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{subcategory.icon}</span>
            <span className="font-medium text-gray-700">
              {subcategory.labels[language]}
            </span>
            {isRecent && <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">✨ Neu</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getProgressColor(value)}`}
                style={{ width: `${Math.min(value, 100)}%` }}
              />
            </div>
            <span className={`text-sm font-semibold min-w-[2rem] ${getProgressTextColor(value)}`}>
              {value}
            </span>
            {onReduceTrait && value > 0 && (
              <button
                onClick={() => {
                  const traitIdentifier = `${mainCategoryId}.${subcategory.id}`;
                  const amount = Math.min(5, value); // Reduce by 5 or remaining value
                  onReduceTrait(traitIdentifier, amount, `Manuelle Reduzierung von ${subcategory.labels[language]}`);
                }}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                title={`${subcategory.labels[language]} reduzieren (-5)`}
              >
                ❌
              </button>
            )}
          </div>
        </div>

        {reasons.length > 0 && (
          <div className="text-xs text-gray-600 mt-2">
            <div className="flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 text-stone-500" />
              <div>
                {reasons.map((reason, idx) => (
                  <div key={idx} className="mb-1">• {reason}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMainCategory = (category: any) => {
    const hasSubcategories = category.subcategories && category.subcategories.length > 0;
    const isExpanded = expandedCategories[category.id];

    const categoryValue = getTraitValue(category.id);
    const hasRecentProgressInCategory = hasSubcategories
      ? category.subcategories.some((sub: any) => hasRecentProgress(category.id, sub.id))
      : hasRecentProgress(category.id);

    const mainCategoryReasons = getRecentReasons(category.id);

    return (
      <div key={category.id} className="mb-4">
        <div
          className={`p-4 rounded-lg border-2 transition-all ${
            hasSubcategories
              ? 'cursor-pointer hover:border-amber-300 bg-gradient-to-r from-amber-50 to-stone-50'
              : 'bg-gray-50'
          }`}
          onClick={hasSubcategories ? () => toggleCategory(category.id) : undefined}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasSubcategories && (
                isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
              <span className="text-xl">{category.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {category.labels[language]}
                </h3>
                {hasSubcategories && (
                  <p className="text-sm text-gray-600">
                    {category.subcategories.filter((sub: any) => getTraitValue(category.id, sub.id) > 0).length} Unterbereiche
                  </p>
                )}
              </div>
              {hasRecentProgressInCategory && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  ✨ Fortschritt
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${getProgressColor(categoryValue)}`}
                  style={{ width: `${Math.min(categoryValue, 100)}%` }}
                />
              </div>
              <span className={`text-lg font-bold min-w-[2.5rem] ${getProgressTextColor(categoryValue)}`}>
                {categoryValue}
              </span>
              {onReduceTrait && categoryValue > 0 && (
                <button
                  onClick={() => {
                    const amount = Math.min(5, categoryValue); // Reduce by 5 or remaining value
                    onReduceTrait(category.id, amount, `Manuelle Reduzierung von ${category.labels[language]}`);
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                  title={`${category.labels[language]} reduzieren (-5)`}
                >
                  ❌
                </button>
              )}
            </div>
          </div>

          {/* Main category reasons (when no subcategories or collapsed) */}
          {(!hasSubcategories || !isExpanded) && mainCategoryReasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-stone-500" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Erhalten für:</p>
                  {mainCategoryReasons.map((reason, idx) => (
                    <div key={idx} className="text-xs text-gray-600 mb-1">• {reason}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subcategories */}
        {hasSubcategories && isExpanded && (
          <div className="mt-2 bg-white rounded-lg border border-gray-200 p-3">
            {category.subcategories
              .map((sub: any) => renderSubcategory(sub, category.id))
              .filter((rendered: any) => rendered !== null)}

            {/* Main category reasons when expanded */}
            {mainCategoryReasons.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-stone-500" />
                  <div className="text-sm text-gray-700">
                    <p className="font-medium mb-1">Allgemein erhalten für:</p>
                    {mainCategoryReasons.map((reason, idx) => (
                      <div key={idx} className="text-xs text-gray-600 mb-1">• {reason}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Build dynamic categories with AI-generated subcategories (use normalized traits)
  const dynamicCategories = buildDynamicCategories(normalizedTraits);

  console.log('🏗️ HierarchicalTraitDisplay - normalized traits:', normalizedTraits);
  console.log('🏗️ HierarchicalTraitDisplay - dynamic categories:', dynamicCategories);
  console.log('🏗️ HierarchicalTraitDisplay - memories for descriptions:', memories);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          🧠 Persönlichkeitsentwicklung
        </h3>
        <p className="text-sm text-gray-600">
          Eigenschaften entwickeln sich durch Geschichten, Dokus und Quizzes
        </p>
      </div>

      {dynamicCategories.map(renderMainCategory)}

      <div className="mt-6 p-4 bg-stone-50 rounded-lg">
        <h4 className="font-semibold text-stone-800 mb-2">💡 Hinweis</h4>
        <p className="text-sm text-stone-700">
          Die KI erstellt automatisch Unterbereiche basierend auf den Inhalten der Geschichten und Dokus.
          Beschreibungen zeigen, wofür die Punkte erhalten wurden.
        </p>
      </div>
    </div>
  );
};
