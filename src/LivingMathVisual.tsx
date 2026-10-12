import { useEffect, useId, useRef } from 'react';
import { graphPlot, graphX, graphY } from './functionGraphModel';
import { getLivingMathFrame } from './livingMathModel';

export default function LivingMathVisual() {
  const root = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');
  const initial = getLivingMathFrame(0);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const trace = element.querySelector<SVGPathElement>('.living-math-trace')!;
    const glow = element.querySelector<SVGPathElement>('.living-math-line-glow')!;
    const guides = element.querySelector<SVGPathElement>('.living-math-guides')!;
    const point = element.querySelector<SVGGElement>('.living-math-point')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width:767px)');
    let frame = 0, elapsed = 0;
    let previousTime: number | null = null, lastPaint = -Infinity;
    // Start only after visibility is known; the fallback is an immediately running visual.
    let visible = typeof IntersectionObserver === 'undefined';
    const running = () => visible && !document.hidden && !reduced.matches;
    const paint = (time: number, staticFrame = false) => {
      const geometry = getLivingMathFrame(time);
      trace.setAttribute('d', geometry.line);
      glow.setAttribute('d', geometry.line);
      trace.style.strokeDashoffset = String(staticFrame ? 0 : 1 - geometry.drawProgress);
      glow.style.opacity = String(staticFrame ? 0.1 : geometry.drawProgress * 0.1);
      guides.setAttribute('d', geometry.guides);
      guides.style.opacity = String(staticFrame ? 0.3 : geometry.guideOpacity);
      point.setAttribute('transform', `translate(${geometry.px} ${geometry.py})`);
      point.style.opacity = String(staticFrame ? 1 : geometry.pointOpacity);
    };
    const tick = (timestamp: number) => {
      frame = 0;
      if (!running()) return;
      if (previousTime !== null) elapsed += Math.max(0, Math.min(64, timestamp - previousTime));
      previousTime = timestamp;
      // One small SVG, no React updates or layout reads; cap mobile writes at 30 fps.
      if (!mobile.matches || timestamp - lastPaint >= 1000 / 30) {
        paint(elapsed); lastPaint = timestamp;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!running()) {
        cancelAnimationFrame(frame); frame = 0; previousTime = null; lastPaint = -Infinity;
        element.dataset.livingAnimation = reduced.matches ? 'static' : 'paused';
        if (reduced.matches) paint(elapsed, true);
        return;
      }
      element.dataset.livingAnimation = 'running';
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false; sync();
    }, { threshold: 0.01 });
    observer?.observe(element);
    reduced.addEventListener('change', sync);
    mobile.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      reduced.removeEventListener('change', sync);
      mobile.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return <div ref={root} className="living-math-visual" aria-hidden="true" inert style={{ pointerEvents: 'none' }} data-living-animation="paused">
    <svg viewBox={`0 0 ${graphPlot.width} ${graphPlot.height}`} focusable="false">
      <defs>
        <linearGradient id={`${id}-living-line`} x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#818cf8"/><stop offset="0.55" stopColor="#6366f1"/><stop offset="1" stopColor="#38bdf8"/>
        </linearGradient>
        <radialGradient id={`${id}-living-light`}>
          <stop stopColor="#818cf8" stopOpacity="0.13"/><stop offset="1" stopColor="#38bdf8" stopOpacity="0"/>
        </radialGradient>
        <clipPath id={`${id}-living-clip`}>
          <rect x={graphPlot.left} y={graphPlot.top} width={graphPlot.right - graphPlot.left} height={graphPlot.bottom - graphPlot.top}/>
        </clipPath>
      </defs>
      <ellipse cx="218" cy="102" rx="150" ry="108" fill={`url(#${id}-living-light)`}/>
      <g className="living-math-grid">
        {[-4,-3,-2,-1,0,1,2,3,4].map(x => <line key={`x-${x}`} x1={graphX(x)} x2={graphX(x)} y1={graphPlot.top} y2={graphPlot.bottom}/>)}
        {[-8,-6,-4,-2,0,2,4,6,8].map(y => <line key={`y-${y}`} x1={graphPlot.left} x2={graphPlot.right} y1={graphY(y)} y2={graphY(y)}/>)}
      </g>
      <g className="living-math-axes">
        <path d={`M ${graphPlot.left} ${graphY(0)} H ${graphPlot.right} M ${graphX(0)} ${graphPlot.bottom} V ${graphPlot.top}`}/>
        <path d={`m ${graphPlot.right - 5} ${graphY(0) - 3} 5 3 -5 3 M ${graphX(0) - 3} ${graphPlot.top + 5} l 3 -5 3 5`}/>
      </g>
      <g className="living-math-axis-labels">
        <text x={graphX(0) - 12} y={graphY(0) + 15}>O</text>
        <text x={graphPlot.right - 5} y={graphY(0) + 16}>x</text>
        <text x={graphX(0) + 8} y={graphPlot.top + 8}>y</text>
      </g>
      <g clipPath={`url(#${id}-living-clip)`}>
        <path className="living-math-guides" d={initial.guides}/>
        <path className="living-math-line-glow" d={initial.line} stroke={`url(#${id}-living-line)`}/>
        <path className="living-math-trace" d={initial.line} pathLength={1} stroke={`url(#${id}-living-line)`}/>
        <g className="living-math-point" transform={`translate(${initial.px} ${initial.py})`}>
          <circle className="living-math-halo" r="12"/><circle className="living-math-halo-inner" r="7"/>
          <circle className="living-math-dot" r="3.4"/>
        </g>
      </g>
      <g className="living-math-symbols">
        <text className="living-math-symbol" x="48" y="42">f(x)</text>
        <text className="living-math-symbol living-math-symbol-second" x="302" y="175">∑</text>
      </g>
      <text className="living-math-equation" x="34" y="216">y = ax + b</text>
    </svg>
  </div>;
}
