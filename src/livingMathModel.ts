import { evaluateLinear, graphPlot, graphX, graphY } from './functionGraphModel';

const fullTurn = Math.PI * 2;

// Compute the line, probe and projections from the same coefficients in every frame.
// No path morphing: the geometry always consists of one mathematical straight line.
export function getLivingMathFrame(elapsedMs: number) {
  const time = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const phase = time / 32000 * fullTurn;
  const a = 1.15 + 0.5 * Math.sin(phase);
  const b = 0.6 + 1.1 * Math.sin(phase + 0.4);
  const x = 3.6 * Math.sin(time / 24000 * fullTurn - 0.6);
  const y = evaluateLinear(a, b, x);
  const px = graphX(x), py = graphY(y);
  const entrance = Math.min(1, time / 2200);
  const pointEntrance = Math.min(1, Math.max(0, (time - 1800) / 900));
  return {
    a, b, x, y, px, py,
    line: `M ${graphX(graphPlot.xMin)} ${graphY(evaluateLinear(a, b, graphPlot.xMin))} L ${graphX(graphPlot.xMax)} ${graphY(evaluateLinear(a, b, graphPlot.xMax))}`,
    guides: `M ${px} ${graphY(0)} V ${py} H ${graphX(0)}`,
    drawProgress: 1 - Math.pow(1 - entrance, 3),
    pointOpacity: pointEntrance,
    guideOpacity: pointEntrance * (0.22 + 0.14 * Math.sin(time / 12000 * fullTurn) ** 2),
  };
}
