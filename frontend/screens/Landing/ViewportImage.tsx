import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

// Native lazy loading can fetch images several thousand pixels offscreen on
// slow connections. Keep decorative chapter images out of the initial load.
export default function ViewportImage({ src, srcSet, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px' });
    observer.observe(image);
    return () => observer.disconnect();
  }, []);
  return <img {...props} ref={imageRef} src={visible ? src : undefined} srcSet={visible ? srcSet : undefined} loading="lazy" decoding="async" />;
}
