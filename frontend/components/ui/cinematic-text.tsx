import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CinematicTextProps {
    text: string;
    className?: string;
    paragraphClassName?: string;
    paragraphStyle?: React.CSSProperties;
    delay?: number;
    enableDropCap?: boolean;
}

export const CinematicText: React.FC<CinematicTextProps> = ({
    text,
    className,
    paragraphClassName,
    paragraphStyle,
    delay = 0,
    enableDropCap = false,
}) => {
    const paragraphs = String(text || '')
        .replace(/\r\n?/g, '\n')
        .trim()
        .split(/\n{2,}/)
        .map((paragraph) =>
            paragraph
                .replace(/\n+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
        )
        .filter((paragraph) => paragraph.length > 0);

    return (
        <div className={cn("space-y-8", className)}>
            {paragraphs.map((paragraph, index) => (
                <Paragraph
                    key={index}
                    text={paragraph}
                    index={index}
                    baseDelay={delay}
                    paragraphClassName={paragraphClassName}
                    paragraphStyle={paragraphStyle}
                    isFirst={enableDropCap && index === 0}
                />
            ))}
        </div>
    );
};

const Paragraph: React.FC<{
    text: string;
    index: number;
    baseDelay: number;
    paragraphClassName?: string;
    paragraphStyle?: React.CSSProperties;
    isFirst?: boolean;
}> = ({ text, index, baseDelay, paragraphClassName, paragraphStyle, isFirst }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, {
        once: true,
        margin: "0px 0px -60px 0px"
    });

    return (
        <motion.p
            ref={ref}
            initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
            animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
            transition={{
                duration: 0.7,
                ease: [0.2, 0.65, 0.3, 0.9],
                delay: baseDelay + (index * 0.08)
            }}
            className={cn(
                "leading-relaxed text-lg md:text-xl lg:text-2xl text-gray-300 font-['Merriweather'] tracking-wide drop-shadow-sm",
                isFirst && 'first-paragraph-drop-cap',
                paragraphClassName
            )}
            style={paragraphStyle}
        >
            {text}
        </motion.p>
    );
};
