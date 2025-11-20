import React, { useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Typewriter } from './typewriter-text';

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
                />
            ))}
        </div>
    );
};

const Paragraph: React.FC<{ text: string; index: number }> = ({ text, index }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, {
        once: true,
        margin: "0px 0px -100px 0px"
    });
    const [isCompleted, setIsCompleted] = useState(false);

    return (
        <div ref={ref} className="relative">
            {/* Invisible text to reserve layout space and prevent jumping */}
            <p className="leading-relaxed text-lg md:text-xl lg:text-2xl text-transparent font-serif tracking-wide select-none pointer-events-none" aria-hidden="true">
                {text}
            </p>

            {/* Absolute positioned Typewriter overlay */}
            <div className="absolute inset-0 top-0 left-0">
                {isInView && (
                    <p className="leading-relaxed text-lg md:text-xl lg:text-2xl text-gray-100 font-serif tracking-wide drop-shadow-md">
                        <Typewriter
                            text={text}
                            speed={15} // Fast typing speed for reading
                            cursor={isCompleted ? "" : "|"}
                            loop={false}
                            onComplete={() => setIsCompleted(true)}
                        />
                    </p>
                )}
            </div>
        </div>
    );
};

