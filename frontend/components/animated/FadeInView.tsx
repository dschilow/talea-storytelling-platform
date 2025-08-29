import React, { useEffect, useState } from 'react';

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  from?: 'bottom' | 'top' | 'left' | 'right' | 'scale';
}

const FadeInView: React.FC<FadeInViewProps> = ({
  children,
  delay = 0,
  className = '',
  from = 'bottom'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getTransformClasses = () => {
    if (!isVisible) {
      switch (from) {
        case 'bottom':
          return 'translate-y-8 opacity-0';
        case 'top':
          return '-translate-y-8 opacity-0';
        case 'left':
          return '-translate-x-8 opacity-0';
        case 'right':
          return 'translate-x-8 opacity-0';
        case 'scale':
          return 'scale-90 opacity-0';
        default:
          return 'translate-y-8 opacity-0';
      }
    }
    return 'translate-y-0 translate-x-0 scale-100 opacity-100';
  };

  return (
    <div
      className={`transition-all duration-300 ease-out ${getTransformClasses()} ${className}`}
    >
      {children}
    </div>
  );
};

export default FadeInView;
