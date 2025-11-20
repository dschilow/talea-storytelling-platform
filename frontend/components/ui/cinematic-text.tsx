import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CinematicTextProps {
    text: string;
    className?: string;
    delay?: number;
}

export const CinematicText: React.FC<CinematicTextProps> = ({ text, className, delay = 0 }) => {
    // Split text into paragraphs
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');

    return (
        <div className={cn("space-y-8", className)}>
            {paragraphs.map((paragraph, index) => (
                <Paragraph
                    key={index}
                    text={paragraph}
                    index={index}
                    baseDelay={delay}
                />
            ))}
        </div>
    );
};

const Paragraph: React.FC<{ text: string; index: number; baseDelay: number }> = ({ text, index, baseDelay }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, {
        once: true,
        margin: "0px 0px -50px 0px" // Trigger slightly before bottom
    });

    return (
        <motion.p
            ref={ref}
            initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
            animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
            transition={{
                duration: 0.8,
                ease: [0.2, 0.65, 0.3, 0.9], // Elegant easing
                delay: baseDelay + (index * 0.1)
            }}
            className="leading-relaxed text-lg md:text-xl lg:text-2xl text-gray-300 font-['Merriweather'] tracking-wide drop-shadow-sm"
        >
            {text}
        </motion.p>
    );
};
