import React, { CSSProperties, useState, useEffect } from 'react';
import { animations } from '../../utils/constants/spacing';

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: string;
}

const ScaleIn: React.FC<ScaleInProps> = ({
  children,
  delay = 0,
  duration = animations.duration.normal,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const containerStyle: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.95)',
    transition: `all ${duration} ${animations.easing.spring}`,
  };

  return <div style={containerStyle}>{children}</div>;
};

export default ScaleIn;
