import React, { useEffect, useState } from 'react';

interface PageFlipProps {
  direction: 'next' | 'prev';
  pageKey: string | number;
  children: React.ReactNode;
  onAnimationEnd?: () => void;
}

const PageFlip: React.FC<PageFlipProps> = ({ direction, pageKey, children, onAnimationEnd }) => {
  const [prevContent, setPrevContent] = useState<React.ReactNode>(null);
  const [prevKey, setPrevKey] = useState<string | number | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    // Trigger animation when key changes
    if (prevKey !== null && prevKey !== pageKey) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setAnimating(false);
        setPrevContent(null);
        setPrevKey(pageKey);
        onAnimationEnd?.();
      }, 650);
      return () => clearTimeout(timer);
    } else {
      setPrevKey(pageKey);
    }
  }, [pageKey]);

  useEffect(() => {
    // Store previous content just before animating
    setPrevContent(children);
  }, [children]);

  return (
    <div style={{ position: 'relative', perspective: '1400px' }}>
      {/* Current page */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          transform: animating ? 'translateZ(0)' : 'translateZ(0)',
          animation: animating ? (direction === 'next' ? 'pageEnterRight 650ms ease both' : 'pageEnterLeft 650ms ease both') : undefined,
        }}
      >
        {children}
      </div>

      {/* Flipping overlay of previous page */}
      {animating && prevContent && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: direction === 'next' ? 'left center' : 'right center',
            animation: direction === 'next' ? 'pageFlipLeft 650ms ease both' : 'pageFlipRight 650ms ease both',
            zIndex: 2,
            background: 'transparent',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.45))',
              backdropFilter: 'blur(8px) saturate(140%)',
              WebkitBackdropFilter: 'blur(8px) saturate(140%)',
            }}
          >
            {prevContent}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pageFlipLeft {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(-180deg); }
        }
        @keyframes pageFlipRight {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(180deg); }
        }
        @keyframes pageEnterRight {
          0% { transform: translateX(24px) scale(0.98); opacity: 0; }
          100% { transform: translateX(0px) scale(1); opacity: 1; }
        }
        @keyframes pageEnterLeft {
          0% { transform: translateX(-24px) scale(0.98); opacity: 0; }
          100% { transform: translateX(0px) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PageFlip;
