const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadComponent } = require('./component-harness.cjs');

test('navigation marker follows wrapped tabs, clears unmatched routes, and coalesces rapid changes', () => {
  const names = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver'];
  const previous = Object.fromEntries(names.map(name => [name, global[name]]));
  const frames = new Map(), listeners = new Map();
  let frameId = 0, disconnected = false;
  const makeElement = () => {
    const classes = new Set(), properties = new Map();
    return { classes, properties,
      classList: { add: (...values) => values.forEach(value => classes.add(value)), remove: (...values) => values.forEach(value => classes.delete(value)) },
      style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) },
    };
  };
  const nav = makeElement(), tabs = makeElement();
  let active = { offsetTop: 48, offsetHeight: 40 };
  let selected = { offsetLeft: 4, offsetTop: 0, offsetWidth: 110, offsetHeight: 36 };
  nav.querySelector = () => active;
  tabs.querySelector = () => selected;
  tabs.closest = () => null;
  const app = {
    querySelector: selector => selector === '.sidebar nav' ? nav : {},
    querySelectorAll: selector => selector === 'main .tabs' ? [tabs] : [],
  };
  global.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  global.cancelAnimationFrame = id => frames.delete(id);
  global.window = { addEventListener: (name, callback) => listeners.set(`window:${name}`, callback), removeEventListener: name => listeners.delete(`window:${name}`) };
  global.document = { hidden: false, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  global.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  const harness = loadComponent('../src/useNavigationMotion.ts', {}, { effects: true });
  const root = { current: app };
  const flush = () => { const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback()); };
  try {
    harness.render(root, 'tools:formulas', true); harness.flushEffects(); flush();
    assert.equal(nav.properties.get('--nav-y'), '48px');
    selected = { offsetLeft: 8, offsetTop: 42, offsetWidth: 152, offsetHeight: 44 };
    harness.render(root, 'tools:calculator', true); harness.flushEffects();
    harness.render(root, 'tools:compare', true); harness.flushEffects();
    assert.equal(frames.size, 1);
    flush();
    assert.equal(tabs.properties.get('--tab-x'), '8px');
    assert.equal(tabs.properties.get('--tab-y'), '42px');
    assert.equal(tabs.properties.get('--tab-width'), '152px');
    assert.equal(tabs.properties.get('--tab-height'), '44px');
    active = null;
    harness.render(root, 'install', true); harness.flushEffects(); flush();
    assert.equal(nav.classes.has('signature-navigation'), false);
    assert.equal(nav.properties.size, 0);
    global.document.hidden = true; listeners.get('visibilitychange')();
    harness.render(root, 'profile', true); harness.flushEffects();
    assert.equal(frames.size, 0);
    global.document.hidden = false; listeners.get('visibilitychange')();
    assert.equal(frames.size, 1);
    harness.render(root, 'exam', false); harness.flushEffects();
    assert.equal(frames.size, 0);
    assert.equal(tabs.classes.size, 0);
    assert.equal(tabs.properties.size, 0);
    assert.equal(disconnected, true);
    assert.equal(listeners.size, 0);
    harness.dispose();
  } finally { Object.assign(global, previous); }
});
