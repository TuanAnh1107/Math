require('./load-ts.cjs');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

// A small hook harness checks event/state wiring without claiming browser/E2E coverage.
function loadComponent(relativePath, mocks = {}, options = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const cells = [];
  const refs = [], memos = [], effects = [], pendingEffects = [];
  let cursor = 0, refCursor = 0, memoCursor = 0, effectCursor = 0;
  const unchanged = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const memo = (factory, dependencies) => {
    const index = memoCursor++;
    if (!memos[index] || !unchanged(memos[index].dependencies, dependencies)) memos[index] = { value: factory(), dependencies };
    return memos[index].value;
  };
  const hooks = {
    ...React,
    useEffect: (effect, dependencies) => {
      const index = effectCursor++;
      if (!options.effects || effects[index] && unchanged(effects[index].dependencies, dependencies)) return;
      const previous = effects[index];
      effects[index] = { dependencies, cleanup: previous?.cleanup };
      pendingEffects.push(() => { previous?.cleanup?.(); effects[index].cleanup = effect(); });
    },
    useRef: initial => {
      const index = refCursor++;
      refs[index] ??= { current: initial ?? null };
      return refs[index];
    },
    useCallback: (callback, dependencies) => memo(() => callback, dependencies),
    useMemo: memo,
    useId: () => 'hook-harness-id',
    useState: initial => {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], value => {
        cells[index] = typeof value === 'function' ? value(cells[index]) : value;
      }];
    },
  };
  const cache = new Map();
  const load = target => {
    if (cache.has(target)) return cache.get(target);
    const loaded = new Module(target, module);
    cache.set(target, loaded);
    loaded.filename = target;
    loaded.paths = Module._nodeModulePaths(path.dirname(target));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = name => {
      if (name === 'react') return hooks;
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.endsWith('.css')) return {};
      if (name.startsWith('.')) {
        const resolved = Module._resolveFilename(name, loaded);
        if (/\.tsx?$/.test(resolved)) return load(resolved).exports;
      }
      return originalRequire(name);
    };
    loaded._compile(ts.transpileModule(fs.readFileSync(target, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: target,
    }).outputText, target);
    return loaded;
  };
  const loaded = load(filename);
  return {
    render: (...args) => { cursor = refCursor = memoCursor = effectCursor = 0; return loaded.exports.default(...args); },
    cells, refs,
    flushEffects: () => { while (pendingEffects.length) pendingEffects.shift()(); },
    dispose: () => { pendingEffects.length = 0; effects.forEach(effect => effect?.cleanup?.()); },
  };
}

function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
}

module.exports = { loadComponent, nodes };
