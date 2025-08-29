import React, { useEffect, useState } from 'react';

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  from?: 'bottom' | 'top' | 'left' | 'right' | 'scale';
  style?: React.CSSProperties;
}

const FadeInView: React.FC<FadeInViewProps> = ({
  children,
  delay = 0,
  className = '',
  from = 'bottom',
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getTransform = () => {
    if (!isVisible) {
      switch (from) {
        case 'bottom':
          return 'translateY(20px)';
        case 'top':
          return 'translateY(-20px)';
        case 'left':
          return 'translateX(-20px)';
        case 'right':
          return 'translateX(20px)';
        case 'scale':
          return 'scale(0.96)';
        default:
          return 'translateY(20px)';
      }
    }
    return 'translateY(0px) translateX(0px) scale(1.0)';
  };

  const animationStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: getTransform(),
    transition: 'all 0.3s cubic-bezier(0.2, 0.0, 0.0, 1.0)',
    ...style,
  };

  return (
    <div style={animationStyle} className={className}>
      {children}
    </div>
  );
};

export default FadeInView;
