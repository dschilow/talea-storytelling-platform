/** Vector atmosphere: soft lit clouds, a connecting star trail, and the finale. */
export function SkyClouds({ id }: { id: string }) {
  return (
    <svg className="sky-clouds" viewBox="0 0 1600 500" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`${id}-cloud`} x1="800" y1="100" x2="800" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#82708f" stopOpacity=".5" />
          <stop offset=".42" stopColor="#334c73" stopOpacity=".75" />
          <stop offset="1" stopColor="#0b182c" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9db8d6" stopOpacity=".05" />
          <stop offset=".8" stopColor="#f6b995" stopOpacity=".25" />
          <stop offset="1" stopColor="#edc4c4" stopOpacity=".1" />
        </linearGradient>
        <filter id={`${id}-cloud-soft`} x="-10%" y="-25%" width="120%" height="150%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id={`${id}-cloud-mist`} x="-10%" y="-25%" width="120%" height="150%"><feGaussianBlur stdDeviation="17" /></filter>
      </defs>
      <g className="cloud-bank cloud-bank--far" fill={`url(#${id}-cloud)`} filter={`url(#${id}-cloud-mist)`}>
        <path d="M-150 420C-150 352-85 320-22 331C-21 254 83 207 150 266C186 178 307 185 345 264C410 227 492 263 487 327C566 280 654 318 660 396C768 329 851 347 880 402C968 346 1050 355 1084 407C1110 323 1200 310 1254 351C1250 272 1355 242 1410 292C1480 205 1590 228 1607 329C1685 289 1770 334 1770 420V520H-150Z" />
      </g>
      <g className="cloud-bank cloud-bank--near" fill={`url(#${id}-cloud)`} stroke={`url(#${id}-rim)`} strokeWidth="2" filter={`url(#${id}-cloud-soft)`}>
        <path d="M-100 440C-80 357 18 348 65 392C83 310 189 302 229 377C269 330 355 358 355 412C423 378 493 403 510 465C580 416 638 432 668 469C787 440 897 435 955 465C1005 411 1092 399 1135 450C1152 364 1248 348 1299 398C1335 302 1450 306 1490 380C1553 326 1650 364 1650 446V540H-100Z" />
      </g>
    </svg>
  );
}

export function StarTrail({ animated }: { animated: boolean }) {
  return (
    <svg className="star-trail" viewBox="0 0 1600 800" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="journey-trail-light" x1="0" y1="700" x2="1600" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe2a6" stopOpacity="0" />
          <stop offset=".4" stopColor="#ffe2a6" stopOpacity=".65" />
          <stop offset="1" stopColor="#f5b490" stopOpacity=".1" />
        </linearGradient>
        <path id="journey-flight-route" d="M-100 710C220 430 385 840 665 655S965 415 1280 570S1485 540 1700 375" />
      </defs>
      <use href="#journey-flight-route" stroke="url(#journey-trail-light)" strokeWidth="12" opacity=".05" />
      <use href="#journey-flight-route" stroke="url(#journey-trail-light)" strokeWidth="3" opacity=".16" />
      <use href="#journey-flight-route" stroke="url(#journey-trail-light)" strokeWidth="1" strokeDasharray="3 8" />
      <g>
        {animated && <animateMotion dur="16s" repeatCount="indefinite"><mpath href="#journey-flight-route" /></animateMotion>}
        <circle r="15" fill="#ffd997" opacity=".06" />
        <circle r="7" fill="#ffd997" opacity=".2" />
        <path d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z" fill="#fff2ca" />
      </g>
    </svg>
  );
}

export function SoundWave() {
  return (
    <svg className="sound-wave" viewBox="0 0 240 46" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => {
        const height = 5 + Math.sin(i * 0.8) ** 2 * 28 + Math.cos(i * 0.35) ** 2 * 10;
        return <rect key={i} className="sound-wave-bar" x={i * 6} y={(46 - height) / 2} width="2" height={height} rx="1" style={{ animationDelay: `${i * -0.12}s` }} />;
      })}
    </svg>
  );
}

export function NovaRays() {
  return (
    <svg className="nova-rays" viewBox="-500 -500 1000 1000" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nova-ray-light" x1="0" y1="-25" x2="0" y2="-450" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff7de" stopOpacity=".8" />
          <stop offset=".45" stopColor="#ffcb97" stopOpacity=".4" />
          <stop offset="1" stopColor="#f2a3a5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 32 }, (_, i) => (
        <path key={i} d={`M-2-25 0-${i % 3 === 0 ? 490 : 340} 2-25Z`} fill="url(#nova-ray-light)" transform={`rotate(${i * 11.25})`} />
      ))}
    </svg>
  );
}
