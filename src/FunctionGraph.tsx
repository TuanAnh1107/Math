import { useEffect, useId, useRef } from 'react';
import { clamp, formatGraphNumber, getGraphGeometry, graphPlot, graphX, graphY, initialGraph, unprojectGraphX, type GraphSession } from './functionGraphModel';

export default function FunctionGraph({ session }: { session: GraphSession }) {
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<{ schedule: (announce?: boolean) => void; probe: (clientX: number) => void } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const aInput = useRef<HTMLInputElement>(null);
  const bInput = useRef<HTMLInputElement>(null);
  const id = useId().replace(/:/g, '');
  const initial = getGraphGeometry(session)!;
  useEffect(() => {
    const element = root.current, svg = svgRef.current;
    if (!element || !svg) return;
    const line = element.querySelector<SVGPathElement>('.function-line')!;
    const guides = element.querySelector<SVGPathElement>('.function-guides')!;
    const point = element.querySelector<SVGGElement>('.function-point')!;
    const tooltip = element.querySelector<SVGGElement>('.function-tooltip')!;
    const coordinate = element.querySelector<SVGTextElement>('.function-tooltip text')!;
    const equation = element.querySelector<HTMLElement>('.function-equation')!;
    const readout = element.querySelector<HTMLElement>('.function-readout output')!;
    const announcement = element.querySelector<HTMLElement>('.function-announcement')!;
    const outputs = { a: element.querySelector<HTMLOutputElement>('[data-parameter=a]')!, b: element.querySelector<HTMLOutputElement>('[data-parameter=b]')! };
    let frame = 0, announce = false, pendingClientX: number | null = null;
    let bounds: DOMRect | null = null;
    const invalidateBounds = () => { bounds = null; };
    const paint = () => {
      frame = 0;
      if (pendingClientX !== null) {
        // Read once after enter/resize/scroll, before any writes. No layout read per pointermove.
        bounds ??= svg.getBoundingClientRect();
        if (bounds.width > 0) session.x = unprojectGraphX((pendingClientX - bounds.left) / bounds.width * graphPlot.width);
        pendingClientX = null;
      }
      const geometry = getGraphGeometry(session);
      if (!geometry) return;
      session.x = geometry.x;
      line.setAttribute('d', geometry.line);
      guides.setAttribute('d', geometry.guides);
      point.setAttribute('transform', `translate(${geometry.px} ${geometry.py})`);
      tooltip.setAttribute('transform', `translate(${geometry.tooltipX} ${geometry.tooltipY})`);
      coordinate.textContent = geometry.coordinate;
      equation.textContent = geometry.equation;
      readout.textContent = `x = ${formatGraphNumber(geometry.x)} · y = ${formatGraphNumber(geometry.y)}`;
      outputs.a.textContent = formatGraphNumber(session.a);
      outputs.b.textContent = formatGraphNumber(session.b);
      if (announce) announcement.textContent = `${geometry.equation}. Điểm ${geometry.coordinate}.`;
      announce = false;
    };
    const schedule = (shouldAnnounce = false) => {
      announce ||= shouldAnnounce;
      if (!frame && !document.hidden) frame = requestAnimationFrame(paint);
    };
    controller.current = { schedule, probe: clientX => { pendingClientX = clientX; schedule(); } };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else schedule();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidateBounds);
    observer?.observe(svg);
    window.addEventListener('scroll', invalidateBounds, { passive: true, capture: true });
    window.addEventListener('resize', invalidateBounds, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    paint();
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); controller.current = null;
      window.removeEventListener('scroll', invalidateBounds, true);
      window.removeEventListener('resize', invalidateBounds);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [session]);
  const change = (name: 'a' | 'b', value: string) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    session[name] = clamp(number, name === 'a' ? -3 : -5, name === 'a' ? 3 : 5);
    controller.current?.schedule(true);
  };
  return <div ref={root} className="function-graph">
    <div className="function-heading"><span>PHÒNG THÍ NGHIỆM HÀM SỐ</span><span className="function-live-dot" aria-hidden="true"/></div>
    <strong className="function-equation">{initial.equation}</strong>
    <svg ref={svgRef} viewBox={`0 0 ${graphPlot.width} ${graphPlot.height}`} role="img" tabIndex={0} aria-labelledby={`${id}-title ${id}-description`} onPointerMove={event => controller.current?.probe(event.clientX)} onPointerDown={event => {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      controller.current?.probe(event.clientX);
    }} onKeyDown={event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      session.x = event.key === 'Home' ? -5 : event.key === 'End' ? 5 : session.x + (event.key === 'ArrowRight' ? 0.25 : -0.25);
      controller.current?.schedule(true);
    }}>
      <title id={`${id}-title`}>Đồ thị tương tác y = ax + b</title><desc id={`${id}-description`}>Di chuyển chuột hoặc chạm để xem tọa độ. Dùng mũi tên trái phải, Home và End khi đồ thị có focus. Các thanh trượt thay đổi hệ số a và b.</desc>
      <defs><linearGradient id={`${id}-line`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#38bdf8"/></linearGradient><clipPath id={`${id}-clip`}><rect x={graphPlot.left} y={graphPlot.top} width={graphPlot.right - graphPlot.left} height={graphPlot.bottom - graphPlot.top}/></clipPath></defs>
      <g className="function-grid">{[-4,-2,0,2,4].map(x => <line key={`x-${x}`} x1={graphX(x)} x2={graphX(x)} y1={graphPlot.top} y2={graphPlot.bottom}/>)}{[-8,-4,0,4,8].map(y => <line key={`y-${y}`} x1={graphPlot.left} x2={graphPlot.right} y1={graphY(y)} y2={graphY(y)}/>)}</g>
      <g className="function-axes"><path d={`M ${graphPlot.left} ${graphY(0)} H ${graphPlot.right} M ${graphX(0)} ${graphPlot.bottom} V ${graphPlot.top}`}/><path d={`m ${graphPlot.right-5} ${graphY(0)-3} 5 3 -5 3 M ${graphX(0)-3} ${graphPlot.top+5} l 3 -5 3 5`}/></g>
      <g className="function-ticks">{[-4,-2,2,4].map(x => <text key={x} x={graphX(x)} y={graphPlot.bottom+16} textAnchor="middle">{x}</text>)}{[-8,-4,4,8].map(y => <text key={y} x={graphPlot.left-9} y={graphY(y)+3} textAnchor="end">{y}</text>)}<text x={graphX(0)-12} y={graphY(0)+13}>O</text><text x={graphPlot.right-5} y={graphY(0)+15}>x</text><text x={graphX(0)+8} y={graphPlot.top+6}>y</text></g>
      <g clipPath={`url(#${id}-clip)`}><path className="function-guides" d={initial.guides}/><path className="function-line" d={initial.line} pathLength={1} stroke={`url(#${id}-line)`}/><g className="function-point" transform={`translate(${initial.px} ${initial.py})`}><circle className="function-point-halo" r="12"/><circle r="4.5"/></g></g>
      <g className="function-tooltip" transform={`translate(${initial.tooltipX} ${initial.tooltipY})`}><rect width="102" height="27" rx="7"/><text x="51" y="18" textAnchor="middle">{initial.coordinate}</text></g>
    </svg>
    <div className="function-readout"><span>P(x, y)</span><output>{`x = ${formatGraphNumber(initial.x)} · y = ${formatGraphNumber(initial.y)}`}</output></div>
    <div className="function-parameters">
      <label htmlFor={`${id}-a`}><span>Độ dốc <b>a</b><output data-parameter="a">{formatGraphNumber(session.a)}</output></span><input ref={aInput} id={`${id}-a`} type="range" min={-3} max={3} step={0.25} defaultValue={session.a} onInput={event => change('a', event.currentTarget.value)}/></label>
      <label htmlFor={`${id}-b`}><span>Tung độ gốc <b>b</b><output data-parameter="b">{formatGraphNumber(session.b)}</output></span><input ref={bInput} id={`${id}-b`} type="range" min={-5} max={5} step={0.5} defaultValue={session.b} onInput={event => change('b', event.currentTarget.value)}/></label>
    </div>
    <div className="function-footer"><span>Kéo để khám phá · ← → để dịch điểm</span><button type="button" onClick={() => {
      Object.assign(session, initialGraph);
      if (aInput.current) aInput.current.value = String(session.a);
      if (bInput.current) bInput.current.value = String(session.b);
      controller.current?.schedule(true);
    }}>Đặt lại</button></div>
    <span className="signature-sr-only function-announcement" aria-live="polite" aria-atomic="true"/>
  </div>;
}
