import { useEffect, useId, useRef } from 'react';
import { orbDescriptions, type OrbState } from './tutorPresence';

export default function AIOrb({ state = 'idle', size = 'presence', animated = true, decorative = false, onResponseShown }: {
  state?: OrbState; size?: 'presence' | 'teaser' | 'compact'; animated?: boolean; decorative?: boolean;
  onResponseShown?: () => void;
}) {
  const id = useId().replace(/:/g, '');
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !animated) return;
    let visible = true;
    const sync = () => { element.dataset.orbPaused = String(document.hidden || !visible); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true; sync();
    }, { rootMargin: '40px' });
    observer?.observe(element); sync();
    document.addEventListener('visibilitychange', sync);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [animated]);
  return <span ref={root} className={`ai-orb ai-orb-${size}`} data-state={state} data-animated={animated} role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `Math Mentor · ${orbDescriptions[state]}`} onAnimationEnd={event => { if (event.animationName === 'orb-answer-pulse') onResponseShown?.(); }}>
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <defs><linearGradient id={`${id}-ribbon`} x1="16" y1="16" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#c4b5fd"/><stop offset=".45" stopColor="#818cf8"/><stop offset="1" stopColor="#38bdf8"/></linearGradient><radialGradient id={`${id}-core`}><stop stopColor="#e0e7ff"/><stop offset=".42" stopColor="#a5b4fc"/><stop offset="1" stopColor="#6366f1" stopOpacity=".2"/></radialGradient></defs>
      <circle className="orb-field" cx="48" cy="48" r="37" stroke={`url(#${id}-ribbon)`} strokeWidth=".6"/>
      <g className="orb-orbit orb-orbit-outer" stroke={`url(#${id}-ribbon)`}><ellipse cx="48" cy="48" rx="39" ry="21" transform="rotate(-35 48 48)" strokeWidth="1.2"/><ellipse cx="48" cy="48" rx="39" ry="21" transform="rotate(35 48 48)" strokeWidth=".8" strokeOpacity=".5"/><circle cx="80" cy="29" r="2" fill="#a5b4fc" stroke="none"/></g>
      <g className="orb-orbit orb-orbit-inner" stroke={`url(#${id}-ribbon)`}><path d="M19 48C19 16 77 16 77 48S19 80 19 48Z" strokeWidth="1.4"/><path d="M48 19C80 19 80 77 48 77S16 19 48 19Z" strokeWidth=".7" strokeOpacity=".7"/><circle cx="48" cy="20" r="1.5" fill="#38bdf8" stroke="none"/></g>
      <g className="orb-core"><circle cx="48" cy="48" r="19" fill={`url(#${id}-core)`}/><path d="m48 36 3.5 8.5L60 48l-8.5 3.5L48 60l-3.5-8.5L36 48l8.5-3.5Z" fill="#eef2ff" fillOpacity=".9"/><circle cx="48" cy="48" r="3.5" fill="#6366f1"/></g>
      <g className="orb-error-mark" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round"><path d="M48 35v16"/><circle cx="48" cy="59" r="1"/></g>
    </svg>
  </span>;
}
