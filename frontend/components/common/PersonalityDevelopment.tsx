import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Sparkles, Brain, Heart, Shield, Users, Zap } from 'lucide-react';
import { PersonalityTrait } from '../../types/avatar';

interface PersonalityChangeNotificationProps {
  changes: Array<{ trait: string; change: number }>;
  visible: boolean;
  onClose: () => void;
}

export const PersonalityChangeNotification: React.FC<PersonalityChangeNotificationProps> = ({
  changes,
  visible,
  onClose
}) => {
  const traitIcons: Record<string, React.ElementType> = {
    'Mut': Shield,
    'Kreativität': Sparkles,
    'Empathie': Heart,
    'Intelligenz': Brain,
    'Sozialität': Users,
    'Energie': Zap,
  };

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 min-w-80 max-w-md">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mr-3">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Persönlichkeitsentwicklung!</h3>
                <p className="text-sm text-gray-600">Dein Avatar hat sich verändert</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {changes.map((change, index) => {
                const Icon = traitIcons[change.trait] || Brain;
                const isPositive = change.change > 0;
                
                return (
                  <motion.div
                    key={`${change.trait}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <Icon className="w-5 h-5 mr-3 text-gray-600" />
                      <span className="font-medium text-gray-800">{change.trait}</span>
                    </div>
                    
                    <div className="flex items-center">
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                      )}
                      <span 
                        className={`font-bold ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? '+' : ''}{change.change}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Diese Änderungen spiegeln die Entscheidungen in der Geschichte wider
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface PersonalityProgressBarProps {
  trait: PersonalityTrait;
  showAnimation?: boolean;
}

export const PersonalityProgressBar: React.FC<PersonalityProgressBarProps> = ({
  trait,
  showAnimation = true
}) => {
  const traitIcons: Record<string, React.ElementType> = {
    'Mut': Shield,
    'Kreativität': Sparkles,
    'Empathie': Heart,
    'Intelligenz': Brain,
    'Sozialität': Users,
    'Energie': Zap,
  };

  const Icon = traitIcons[trait.trait] || Brain;
  
  const getTraitColor = (value: number) => {
    if (value >= 80) return { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-100' };
    if (value >= 60) return { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-100' };
    if (value >= 40) return { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-100' };
    return { bg: 'bg-gray-400', text: 'text-gray-600', light: 'bg-gray-100' };
  };

  const colors = getTraitColor(trait.value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-full ${colors.light}`}>
            <Icon className={`w-4 h-4 ${colors.text}`} />
          </div>
          <span className="font-medium text-gray-800">{trait.trait}</span>
        </div>
        <span className={`text-sm font-bold ${colors.text}`}>
          {trait.value}%
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <motion.div
          className={`h-2 rounded-full ${colors.bg}`}
          initial={{ width: showAnimation ? '0%' : `${trait.value}%` }}
          animate={{ width: `${trait.value}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      
      {trait.history.length > 0 && (
        <div className="text-xs text-gray-500 flex items-center mt-1">
          <TrendingUp className="w-3 h-3 mr-1" />
          Letzte Änderung: {trait.history[trait.history.length - 1].reason}
        </div>
      )}
    </div>
  );
};

interface PersonalityDevelopmentDashboardProps {
  traits: PersonalityTrait[];
  className?: string;
}

export const PersonalityDevelopmentDashboard: React.FC<PersonalityDevelopmentDashboardProps> = ({
  traits,
  className = ''
}) => {
  const [selectedTrait, setSelectedTrait] = useState<PersonalityTrait | null>(null);

  const totalGrowth = traits.reduce((total, trait) => {
    const growth = trait.history.reduce((sum, entry) => sum + (entry.newValue - entry.oldValue), 0);
    return total + growth;
  }, 0);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 mb-1">Gesamtentwicklung</h3>
            <p className="text-sm text-gray-600">Persönlichkeitswachstum durch Geschichten</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-600">+{totalGrowth}</div>
            <div className="text-xs text-gray-500">Punkte insgesamt</div>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-800 flex items-center">
          <Brain className="w-5 h-5 mr-2 text-purple-500" />
          Persönlichkeitsmerkmale
        </h4>
        
        {traits.map((trait, index) => (
          <motion.div
            key={trait.trait}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="cursor-pointer"
            onClick={() => setSelectedTrait(selectedTrait?.trait === trait.trait ? null : trait)}
          >
            <PersonalityProgressBar trait={trait} />
            
            {/* Trait history expansion */}
            <AnimatePresence>
              {selectedTrait?.trait === trait.trait && trait.history.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 bg-gray-50 rounded-lg"
                >
                  <h5 className="font-medium text-gray-700 mb-2">Entwicklungsgeschichte:</h5>
                  <div className="space-y-2">
                    {trait.history.slice(-3).map((entry, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">{entry.reason}</span>
                          <span className={`font-medium ${
                            entry.newValue > entry.oldValue ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {entry.oldValue} → {entry.newValue}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(entry.timestamp).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};