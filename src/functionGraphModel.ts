export type GraphSession = { a: number; b: number; x: number };
export const initialGraph: GraphSession = { a: 1.5, b: 1, x: 1 };
export const graphPlot = { width: 360, height: 224, left: 34, right: 344, top: 14, bottom: 190, xMin: -5, xMax: 5, yMin: -10, yMax: 10 };
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const evaluateLinear = (a: number, b: number, x: number) => a * x + b;
export function formatGraphNumber(value: number) { return String(Number(value.toFixed(4))); }
export function graphX(x: number) { return graphPlot.left + (x - graphPlot.xMin) / (graphPlot.xMax - graphPlot.xMin) * (graphPlot.right - graphPlot.left); }
export function graphY(y: number) { return graphPlot.bottom - (y - graphPlot.yMin) / (graphPlot.yMax - graphPlot.yMin) * (graphPlot.bottom - graphPlot.top); }
export function unprojectGraphX(pixelX: number) { return graphPlot.xMin + (pixelX - graphPlot.left) / (graphPlot.right - graphPlot.left) * (graphPlot.xMax - graphPlot.xMin); }
export function visibleGraphDomain(a: number, b: number): [number, number] | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === 0) return b >= graphPlot.yMin && b <= graphPlot.yMax ? [graphPlot.xMin, graphPlot.xMax] : null;
  const intersections = [(graphPlot.yMin - b) / a, (graphPlot.yMax - b) / a].sort((left, right) => left - right);
  const min = Math.max(graphPlot.xMin, intersections[0]);
  const max = Math.min(graphPlot.xMax, intersections[1]);
  return min <= max ? [min, max] : null;
}
export function getGraphGeometry(session: GraphSession) {
  const domain = visibleGraphDomain(session.a, session.b);
  if (!domain) return null;
  // Round the probe first; the displayed y is computed from this exact displayed x.
  const x = clamp(Number(session.x.toFixed(2)), Math.ceil(domain[0] * 100) / 100, Math.floor(domain[1] * 100) / 100);
  const y = evaluateLinear(session.a, session.b, x);
  const px = graphX(x), py = graphY(y);
  return {
    x, y, px, py,
    line: `M ${graphX(domain[0])} ${graphY(evaluateLinear(session.a, session.b, domain[0]))} L ${graphX(domain[1])} ${graphY(evaluateLinear(session.a, session.b, domain[1]))}`,
    guides: `M ${px} ${graphY(0)} V ${py} H ${graphX(0)}`,
    tooltipX: clamp(px - 51, graphPlot.left, graphPlot.right - 102),
    tooltipY: py < 50 ? py + 14 : py - 38,
    coordinate: `(${formatGraphNumber(x)}; ${formatGraphNumber(y)})`,
    equation: `y = ${formatGraphNumber(session.a)}x ${session.b < 0 ? '−' : '+'} ${formatGraphNumber(Math.abs(session.b))}`,
  };
}
