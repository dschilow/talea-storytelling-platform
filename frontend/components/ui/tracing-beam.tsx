"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useTransform,
  useScroll,
  useSpring,
} from "framer-motion";
import { cn } from "../../lib/utils";

export const TracingBeam = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      if (contentRef.current) {
        const height = contentRef.current.offsetHeight;
        setSvgHeight(height);
      }
    };

    // Initial height calculation
    updateHeight();

    // Update height when window resizes or content changes
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateHeight, 100);
    });
    
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateHeight);

    // Multiple delays to ensure images are loaded
    const timeouts = [
      setTimeout(updateHeight, 100),
      setTimeout(updateHeight, 500),
      setTimeout(updateHeight, 1000),
      setTimeout(updateHeight, 2000),
    ];

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
      timeouts.forEach(clearTimeout);
    };
  }, [children]);

  const y1 = useSpring(
    useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]),
    {
      stiffness: 500,
      damping: 90,
    }
  );
  const y2 = useSpring(
    useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]),
    {
      stiffness: 500,
      damping: 90,
    }
  );

  return (
    <motion.div
      ref={ref}
      className={cn("relative w-full max-w-4xl mx-auto h-full", className)}
    >
      {/* TracingBeam visual indicator removed - keeping component for layout */}
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
};

