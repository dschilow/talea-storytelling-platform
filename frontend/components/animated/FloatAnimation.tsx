import React, { CSSProperties } from 'react';

interface FloatAnimationProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
}

const FloatAnimation: React.FC<FloatAnimationProps> = ({
  children,
  delay = 0,
  duration = 3,
  distance = 10,
}) => {
  const containerStyle: CSSProperties = {
    animation: `float ${duration}s ease-in-out ${delay}s infinite`,
  };

  return (
    <>
      <div style={containerStyle}>
        {children}
      </div>
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-${distance}px);
          }
        }
      `}</style>
    </>
  );
};

export default FloatAnimation;
