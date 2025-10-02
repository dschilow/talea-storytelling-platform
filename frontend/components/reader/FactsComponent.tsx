import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Star } from 'lucide-react';
import type { DokuSection } from '../../types/doku';

interface FactsComponentProps {
  section: DokuSection;
}

export const FactsComponent: React.FC<FactsComponentProps> = ({ section }) => {
  const facts = section.keyFacts;

  if (!facts || facts.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6">
            <div className="inline-block p-3 bg-white/50 dark:bg-gray-800/50 rounded-full shadow-md mb-4">
                <Star className="w-10 h-10 text-yellow-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Wichtige Fakten</h2>
            <p className="text-gray-600 dark:text-gray-300">Die Kernaussagen zusammengefasst</p>
        </div>

        <div className="space-y-4">
          {facts.map((fact, index) => (
            <motion.div
              key={index}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex items-start"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + 0.2, type: 'spring', stiffness: 200, damping: 20 }}
            >
              <CheckCircle className="w-6 h-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
              <p className="text-lg text-gray-700 dark:text-gray-200">{fact}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
