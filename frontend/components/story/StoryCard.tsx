import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PastelButton } from "@/components/ui/PastelButton";
import { Play, BookOpen } from "lucide-react";

interface StoryCardProps {
    title: string;
    coverImage?: string;
    genre?: string;
    progress?: number;
    onClick?: () => void;
}

export function StoryCard({
    title,
    coverImage,
    genre = "Fantasy",
    progress,
    onClick
}: StoryCardProps) {
    return (
        <GlassCard
            variant="interactive"
            className="relative w-[280px] h-[380px] p-0 overflow-hidden group flex flex-col shrink-0"
            onClick={onClick}
        >
            {/* Cover Image Background */}
            <div className="absolute inset-0 bg-muted/50">
                {coverImage ? (
                    <img
                        src={coverImage}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <BookOpen className="w-16 h-16 text-primary/40" />
                    </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
            </div>

            {/* Content */}
            <div className="relative z-10 mt-auto p-5 flex flex-col gap-3 text-white">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/20 backdrop-blur-md w-fit">
                    {genre}
                </span>

                <h3 className="text-xl font-bold leading-tight group-hover:text-primary-foreground transition-colors">
                    {title}
                </h3>

                {/* Progress Bar if started */}
                {progress !== undefined && (
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-secondary transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {/* Play Button (appears on hover) */}
                <div className="h-0 group-hover:h-12 overflow-hidden transition-all duration-300 opacity-0 group-hover:opacity-100">
                    <PastelButton size="sm" className="w-full bg-white/90 text-primary hover:bg-white">
                        <Play className="w-4 h-4 mr-2 fill-current" />
                        Weiterlesen
                    </PastelButton>
                </div>
            </div>
        </GlassCard>
    );
}
