import React from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AlertProps {
  variant?: 'success' | 'info' | 'warning' | 'destructive' | 'mono';
  icon?: 'success' | 'info' | 'warning' | 'destructive';
  children: React.ReactNode;
  onClose?: () => void;
}

interface AlertIconProps {
  children: React.ReactNode;
}

interface AlertTitleProps {
  children: React.ReactNode;
}

const Alert: React.FC<AlertProps> = ({ 
  variant = 'info', 
  icon, 
  children, 
  onClose 
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'destructive':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'mono':
        return 'bg-white border-gray-200 text-gray-800 shadow-lg';
      default:
        return 'bg-stone-50 border-stone-200 text-stone-800';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`relative flex items-start gap-3 p-4 rounded-lg border ${getVariantStyles()} max-w-sm`}
    >
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

const AlertIcon: React.FC<AlertIconProps> = ({ children }) => {
  return <div className="flex-shrink-0 w-5 h-5">{children}</div>;
};

const AlertTitle: React.FC<AlertTitleProps> = ({ children }) => {
  return <div className="font-medium text-sm">{children}</div>;
};

// Icon components
const AlertIcons = {
  Success: CheckCircle,
  Info: Info,
  Warning: AlertTriangle,
  Destructive: AlertCircle,
};

export { Alert, AlertIcon, AlertTitle, AlertIcons };
