import React from 'react';
import { motion } from 'framer-motion';
import { Beaker, ListChecks, Clock } from 'lucide-react';
import type { DokuSection } from '../../types/doku';

interface ActivityComponentProps {
  section: DokuSection;
}

export const ActivityComponent: React.FC<ActivityComponentProps> = ({ section }) => {
  const activities = section.interactive?.activities;

  if (!activities || !activities.enabled || !activities.items || activities.items.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-green-50 to-teal-100 dark:from-green-900/30 dark:to-teal-900/30">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6">
            <div className="inline-block p-3 bg-white/50 dark:bg-gray-800/50 rounded-full shadow-md mb-4">
                <Beaker className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Aktivitäten & Experimente</h2>
            <p className="text-gray-600 dark:text-gray-300">Zeit, aktiv zu werden!</p>
        </div>

        <div className="space-y-6">
          {activities.items.map((item, index) => (
            <motion.div
              key={index}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 + 0.2 }}
            >
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">{item.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">{item.description}</p>
              
              <div className="flex flex-wrap gap-4 text-sm">
                {item.materials && item.materials.length > 0 && (
                    <div className="flex items-center text-gray-700 dark:text-gray-200">
                        <ListChecks className="w-5 h-5 text-blue-500 mr-2" />
                        <strong>Material:</strong>
                        <span className="ml-1.5">{item.materials.join(', ')}</span>
                    </div>
                )}
                {item.durationMinutes && (
                    <div className="flex items-center text-gray-700 dark:text-gray-200">
                        <Clock className="w-5 h-5 text-purple-500 mr-2" />
                        <strong>Dauer:</strong>
                        <span className="ml-1.5">{item.durationMinutes} Minuten</span>
                    </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
