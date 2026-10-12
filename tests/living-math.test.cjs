require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadComponent, nodes } = require('./component-harness.cjs');
const { graphPlot } = require('../src/functionGraphModel.ts');
const { getLivingMathFrame } = require('../src/livingMathModel.ts');
const LivingMathVisual = require('../src/LivingMathVisual.tsx').default;

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const mathX = pixel => graphPlot.xMin + (pixel - graphPlot.left) / (graphPlot.right - graphPlot.left) * (graphPlot.xMax - graphPlot.xMin);
const mathY = pixel => graphPlot.yMin + (graphPlot.bottom - pixel) / (graphPlot.bottom - graphPlot.top) * (graphPlot.yMax - graphPlot.yMin);

test('automatic geometry stays a straight mathematical line and the probe stays on it through a full cycle', () => {
  for (let time = 0; time <= 96000; time += 173) {
    const frame = getLivingMathFrame(time);
    assert.match(frame.line, /^M [-\d.e]+ [-\d.e]+ L [-\d.e]+ [-\d.e]+$/);
    const [x1, y1, x2, y2] = frame.line.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
    for (const fraction of [0, .25, .5, .75, 1]) {
      const x = mathX(x1 + (x2 - x1) * fraction);
      const y = mathY(y1 + (y2 - y1) * fraction);
      near(y, frame.a * x + frame.b);
    }
    near(mathX(frame.px), frame.x);
    near(mathY(frame.py), frame.y);
    near(frame.y, frame.a * frame.x + frame.b);
    assert.ok(frame.px >= graphPlot.left && frame.px <= graphPlot.right);
    assert.ok(frame.py >= graphPlot.top && frame.py <= graphPlot.bottom);
    const next = getLivingMathFrame(time + 1);
    assert.ok(Math.abs(next.px - frame.px) < .04 && Math.abs(next.py - frame.py) < .04);
  }
  const first = getLivingMathFrame(0), repeat = getLivingMathFrame(96000);
  near(first.px, repeat.px); near(first.py, repeat.py);
  assert.equal(getLivingMathFrame(0).drawProgress, 0);
  assert.equal(getLivingMathFrame(2200).drawProgress, 1);
});

test('visual is decorative only, Dashboard keeps its Continue CTA and no graph controls', () => {
  const markup = renderToStaticMarkup(React.createElement(LivingMathVisual));
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /inert=""/);
  assert.match(markup, /pointer-events:none/);
  assert.match(markup, /focusable="false"/);
  assert.doesNotMatch(markup, /<(?:button|input|textarea|select|a)\b|tabindex=|tooltip|type="range"/);
  const visual = loadComponent('../src/LivingMathVisual.tsx');
  assert.equal(nodes(visual.render()).some(node => Object.keys(node.props || {}).some(key => /^on[A-Z]/.test(key))), false);
  const previousWindow = global.window;
  global.window = {};
  try {
    const app = loadComponent('../src/App.tsx', { './Theme': { useTheme: () => ({ dark: false }), default: () => null } });
    const hero = nodes(app.render()).find(node => node.props?.className === 'continue-card signature-hero');
    const children = nodes(hero);
    assert.equal(children.filter(node => node.type?.name === 'LivingMathVisual').length, 1);
    assert.equal(children.some(node => node.type?.name === 'FunctionGraph' || node.type === 'input'), false);
    assert.equal(children.some(node => node.type?.name === 'Button' && typeof node.props.onClick === 'function'), true);
  } finally { global.window = previousWindow; }
});

test('animation waits for appearance, throttles mobile, freezes for motion preference and cleans up', () => {
  const names = ['window', 'document', 'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = Object.fromEntries(names.map(name => [name, global[name]]));
  const frames = new Map(), documentListeners = new Map();
  let nextId = 0, intersect, disconnected = false, writes = 0;
  const query = matches => ({ matches, listeners: new Set(), addEventListener(name, callback) { this.listeners.add(callback); }, removeEventListener(name, callback) { this.listeners.delete(callback); } });
  const reduced = query(false), mobile = query(true);
  global.window = { matchMedia: name => name.includes('reduced-motion') ? reduced : mobile };
  global.document = { hidden: false, addEventListener: (name, callback) => documentListeners.set(name, callback), removeEventListener: name => documentListeners.delete(name) };
  global.requestAnimationFrame = callback => { frames.set(++nextId, callback); return nextId; };
  global.cancelAnimationFrame = id => frames.delete(id);
  global.IntersectionObserver = class { constructor(callback) { intersect = callback; } observe() {} disconnect() { disconnected = true; } };
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { style: {}, attributes: {}, setAttribute(name, value) { if (selector === '.living-math-trace') writes++; this.attributes[name] = value; } });
    return elements.get(selector);
  };
  const root = { dataset: {}, querySelector: element, getBoundingClientRect() { throw new Error('Animation must not read layout'); } };
  const harness = loadComponent('../src/LivingMathVisual.tsx', {}, { effects: true });
  const advance = timestamp => { const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback(timestamp)); };
  try {
    harness.render(); harness.refs[0].current = root; harness.flushEffects();
    assert.equal(frames.size, 0);
    intersect([{ isIntersecting: true }]); assert.equal(frames.size, 1);
    for (let index = 0; index <= 180; index++) advance(index * 1000 / 60);
    assert.ok(writes <= 92 && writes >= 60, `mobile writes: ${writes}`);
    assert.equal(harness.cells.length, 0);
    const trace = element('.living-math-trace');
    assert.equal(trace.style.strokeDashoffset, '0');
    global.document.hidden = true; documentListeners.get('visibilitychange')();
    assert.equal(frames.size, 0);
    global.document.hidden = false; documentListeners.get('visibilitychange')();
    advance(20000);
    const resumedLine = trace.attributes.d;
    assert.equal(resumedLine, getLivingMathFrame(3000).line, 'hidden time must not advance beyond the 3000 ms active phase');
    reduced.matches = true; reduced.listeners.forEach(callback => callback());
    assert.equal(frames.size, 0); assert.equal(root.dataset.livingAnimation, 'static');
    assert.equal(element('.living-math-point').style.opacity, '1');
    assert.equal(trace.attributes.d, resumedLine, 'reduced motion keeps the current mathematical shape');
    reduced.matches = false; reduced.listeners.forEach(callback => callback());
    assert.equal(frames.size, 1);
    intersect([{ isIntersecting: false }]); assert.equal(frames.size, 0);
    intersect([{ isIntersecting: true }]); assert.equal(frames.size, 1);
    harness.dispose();
    assert.equal(frames.size, 0); assert.equal(disconnected, true);
    assert.equal(reduced.listeners.size + mobile.listeners.size + documentListeners.size, 0);
  } finally { Object.assign(global, previous); }
});
