import { useEffect, useRef } from 'react';

/** A small, visibility-aware layer of starlight shared by the opening and journey. */
export default function JourneyAtmosphere({ animated }: { animated: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let previousTime = 0;
    let visible = !document.hidden;
    let intersecting = true;
    const stars = Array.from({ length: 65 }, (_, i) => ({
      x: ((i * 73 + 17) % 101) / 101,
      y: ((i * 47 + 9) % 103) / 103,
      size: i % 6 === 0 ? 1.8 : 0.7,
      phase: i * 1.7,
    }));

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      stars.forEach((star, i) => {
        const drift = animated ? Math.sin(time * 0.00012 + star.phase) * 12 : 0;
        const alpha = animated ? 0.28 + (Math.sin(time * 0.0006 + star.phase) + 1) * 0.25 : 0.5;
        context.fillStyle = i % 3 === 0 ? `rgba(255, 209, 146, ${alpha})` : `rgba(195, 224, 255, ${alpha})`;
        context.beginPath();
        context.arc(star.x * width + drift, star.y * height - drift, star.size, 0, Math.PI * 2);
        context.fill();
      });
    };

    const tick = (time: number) => {
      if (!visible) return;
      if (time - previousTime > 32) {
        draw(time);
        previousTime = time;
      }
      frame = requestAnimationFrame(tick);
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (animated && visible) frame = requestAnimationFrame(tick);

    const handleVisibility = () => {
      visible = !document.hidden && intersecting;
      cancelAnimationFrame(frame);
      if (visible && animated) frame = requestAnimationFrame(tick);
    };
    const intersection = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      handleVisibility();
    });
    intersection.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [animated]);

  return <canvas ref={canvasRef} className="journey-atmosphere" aria-hidden="true" />;
}
