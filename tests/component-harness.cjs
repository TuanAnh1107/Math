require('./load-ts.cjs');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

// A small hook harness checks event/state wiring without claiming browser/E2E coverage.
function loadComponent(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const cells = [];
  let cursor = 0;
  const hooks = {
    ...React,
    useState: initial => {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], value => {
        cells[index] = typeof value === 'function' ? value(cells[index]) : value;
      }];
    },
  };
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === 'react') return hooks;
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith('.css')) return {};
    return originalRequire(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
  return { render: props => { cursor = 0; return loaded.exports.default(props); }, cells };
}

function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
}

module.exports = { loadComponent, nodes };
