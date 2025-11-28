import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import './WorldMap.css';

interface WorldMapProps {
    progress: number; // 0 to 1 (scrollytelling progress)
}

// Define the "camera" path points
// Each point corresponds to a progress value and a transform state (x, y, scale)
const PATH_POINTS = [
    { at: 0.0, x: 0, y: 0, scale: 1 },       // Start: Full map view
    { at: 0.2, x: 30, y: -20, scale: 2.5 },  // Story Forest
    { at: 0.4, x: -20, y: -40, scale: 2.5 }, // Avatar Workshop
    { at: 0.6, x: 0, y: 30, scale: 2.5 },    // Knowledge Mountains
    { at: 0.8, x: 40, y: 40, scale: 2.5 },   // Memory Tree
    { at: 1.0, x: 0, y: 0, scale: 1 },       // End: Zoom out
];

const WorldMap: React.FC<WorldMapProps> = ({ progress }) => {
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        // Find current segment
        // We need to interpolate between points based on progress
        // This is a simple linear interpolation between keyframes

        // 1. Find the two points we are between
        let startPoint = PATH_POINTS[0];
        let endPoint = PATH_POINTS[PATH_POINTS.length - 1];

        for (let i = 0; i < PATH_POINTS.length - 1; i++) {
            if (progress >= PATH_POINTS[i].at && progress <= PATH_POINTS[i + 1].at) {
                startPoint = PATH_POINTS[i];
                endPoint = PATH_POINTS[i + 1];
                break;
            }
        }

        // 2. Calculate local progress (0 to 1) within this segment
        const segmentDuration = endPoint.at - startPoint.at;
        const localProgress = (progress - startPoint.at) / segmentDuration;

        // 3. Interpolate values
        const x = gsap.utils.interpolate(startPoint.x, endPoint.x, localProgress);
        const y = gsap.utils.interpolate(startPoint.y, endPoint.y, localProgress);
        const scale = gsap.utils.interpolate(startPoint.scale, endPoint.scale, localProgress);

        // 4. Apply transform
        // We use % for x/y to be responsive
        gsap.to(mapRef.current, {
            transform: `translate(${x}%, ${y}%) scale(${scale})`,
            duration: 0.5,
            overwrite: true,
            ease: 'power1.out' // Smooth camera movement
        });

    }, [progress]);

    return (
        <div className="world-map-container">
            <div ref={mapRef} className="world-map">
                {/* Placeholder Map Art */}
                <div className="map-region forest">🌲 Story Forest</div>
                <div className="map-region workshop">🎭 Avatar Workshop</div>
                <div className="map-region mountains">🏔️ Knowledge Mountains</div>
                <div className="map-region memory">🌳 Memory Tree</div>
                <div className="map-region garden">💝 Values Garden</div>
                <div className="map-region castle">🏰 Parents Lounge</div>

                {/* Background Pattern */}
                <div className="map-bg"></div>
            </div>
        </div>
    );
};

export default WorldMap;
