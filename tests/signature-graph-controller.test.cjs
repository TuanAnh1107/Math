const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadComponent, nodes } = require('./component-harness.cjs');
const { getGraphGeometry, initialGraph, unprojectGraphX } = require('../src/functionGraphModel.ts');

test('graph pointer bursts coalesce to one frame, update all coordinates together, and clean up', () => {
  const names = ['window','document','requestAnimationFrame','cancelAnimationFrame'];
  const previous = Object.fromEntries(names.map(name => [name, global[name]]));
  const frames = new Map(), listeners = new Map(); let counter = 0, boundsReads = 0;
  global.requestAnimationFrame = callback => { frames.set(++counter, callback); return counter; };
  global.cancelAnimationFrame = id => frames.delete(id);
  global.document = { hidden: false, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  global.window = { addEventListener() {}, removeEventListener() {} };
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { attributes: {}, textContent: '', setAttribute(name, value) { this.attributes[name] = value; } });
    return elements.get(selector);
  };
  const svg = { getBoundingClientRect: () => { boundsReads++; return { left: 0, width: 360 }; } };
  const session = { ...initialGraph };
  const harness = loadComponent('../src/FunctionGraph.tsx', {}, { effects: true });
  const flush = () => { const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback(16)); };
  try {
    let tree = harness.render({ session });
    harness.refs[0].current = { querySelector: element }; harness.refs[2].current = svg;
    harness.flushEffects();
    const surface = nodes(tree).find(node => node.type === 'svg');
    for (let index = 0; index < 30; index++) surface.props.onPointerMove({ clientX: 200 + index });
    assert.equal(frames.size, 1); assert.equal(harness.cells.length, 0);
    flush();
    assert.equal(boundsReads, 1);
    const expected = getGraphGeometry({ ...initialGraph, x: unprojectGraphX(229) });
    assert.equal(element('.function-line').attributes.d, expected.line);
    assert.equal(element('.function-tooltip text').textContent, expected.coordinate);
    assert.equal(element('.function-point').attributes.transform, `translate(${expected.px} ${expected.py})`);
    assert.equal(element('.function-equation').textContent, expected.equation);
    const slider = nodes(tree).find(node => node.type === 'input' && node.props.min === -3);
    slider.props.onInput({ currentTarget: { value: '-2' } }); flush();
    assert.equal(session.a, -2);
    assert.equal(element('.function-line').attributes.d, getGraphGeometry(session).line);
    surface.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} }); flush();
    assert.equal(element('.function-announcement').textContent.includes(getGraphGeometry(session).coordinate), true);
    global.document.hidden = true; listeners.get('visibilitychange')();
    surface.props.onPointerMove({ clientX: 100 }); assert.equal(frames.size, 0);
    global.document.hidden = false; listeners.get('visibilitychange')(); assert.equal(frames.size, 1);
    harness.dispose(); assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
  } finally { Object.assign(global, previous); }
});
