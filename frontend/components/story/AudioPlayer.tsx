import React, { useState, useRef, useEffect } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { useBackend } from '../../hooks/useBackend';

interface AudioPlayerProps {
    text: string;
    className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, className = '' }) => {
    const backend = useBackend();
    const [isLoading, setIsLoading] = useState(false);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Reset when text changes
    useEffect(() => {
        setAudioSrc(null);
        setError(null);
    }, [text]);

    const loadAudio = async () => {
        if (audioSrc) return; // Already loaded
        if (!text) return;

        try {
            setIsLoading(true);
            setError(null);

            // @ts-ignore
            const response = await backend.tts.generateSpeech({ text });

            if (response && response.audioData) {
                // Create a Blob from the base64 data to avoid huge strings in memory/DOM
                const fetchRes = await fetch(response.audioData);
                const blob = await fetchRes.blob();
                const objectUrl = URL.createObjectURL(blob);
                setAudioSrc(objectUrl);
            } else {
                throw new Error("Keine Audiodaten empfangen");
            }
        } catch (err) {
            console.error("Failed to load audio:", err);
            setError("Fehler beim Laden");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {!audioSrc && !isLoading && !error && (
                <button
                    onClick={loadAudio}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                >
                    <span className="text-lg">🔊</span> Vorlesen
                </button>
            )}

            {isLoading && (
                <div className="flex items-center gap-2 text-blue-400 px-3 py-1">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Generiere Audio...</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-red-400 px-3 py-1" title={error}>
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs">Fehler</span>
                </div>
            )}

            {audioSrc && (
                <audio
                    ref={audioRef}
                    controls
                    autoPlay
                    src={audioSrc}
                    className="h-10 w-full max-w-[300px] outline-none rounded-full shadow-md"
                    title="Audio Player"
                >
                    Ihr Browser unterstützt dieses Audio-Element nicht.
                </audio>
            )}
        </div>
    );
};
