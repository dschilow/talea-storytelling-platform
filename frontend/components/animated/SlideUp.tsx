import React, { CSSProperties, useState, useEffect } from 'react';
import { animations } from '../../utils/constants/spacing';

interface SlideUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: string;
  distance?: number;
}

const SlideUp: React.FC<SlideUpProps> = ({
  children,
  delay = 0,
  duration = animations.duration.slow,
  distance = 30,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const containerStyle: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${distance}px)`,
    transition: `all ${duration} ${animations.easing.smooth}`,
  };

  return <div style={containerStyle}>{children}</div>;
};

export default SlideUp;
