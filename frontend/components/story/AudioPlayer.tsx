import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Loader, Pause } from 'lucide-react';
import { useBackend } from '../../hooks/useBackend';

interface AudioPlayerProps {
    text: string;
    className?: string;
    autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, className = '', autoPlay = false }) => {
    const backend = useBackend();
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Reset state when text changes
        stop();
        setAudioSrc(null);
        if (autoPlay) {
            // Give a small delay to allow UI to settle?
            // handlePlay(); // Auto-play might be annoying if navigating quickly, maybe explicit action is better.
        }

        return () => {
            stop();
        }
    }, [text]);

    const handlePlay = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation clicks if nested

        if (isPlaying) {
            pause();
            return;
        }

        if (audioSrc) {
            play();
            return;
        }

        if (!text) return;

        try {
            setIsLoading(true);
            // Calls the TTS service
            // @ts-ignore - ignoring potential type mismatch if client not fully updated in IDE context
            const response = await backend.tts.generateSpeech({ text });

            if (response && response.audioData) {
                const src = response.audioData;
                setAudioSrc(src);

                const audio = new Audio(src);
                audioRef.current = audio;

                audio.onended = () => setIsPlaying(false);
                audio.onpause = () => setIsPlaying(false);
                audio.onplay = () => setIsPlaying(true);

                await audio.play();
            }
        } catch (error) {
            console.error("Failed to play audio:", error);
            // Optional: Show toast error?
        } finally {
            setIsLoading(false);
        }
    };

    const play = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Play error:", e));
        }
    };

    const pause = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    };

    const stop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
    };

    return (
        <button
            onClick={handlePlay}
            disabled={isLoading || !text}
            className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center ${className}`}
            title={isPlaying ? "Pause" : "Vorlesen"}
        >
            {isLoading ? (
                <Loader className="w-6 h-6 animate-spin text-blue-500" />
            ) : isPlaying ? (
                <Pause className="w-6 h-6 text-blue-500" />
            ) : (
                <Volume2 className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            )}
        </button>
    );
};
