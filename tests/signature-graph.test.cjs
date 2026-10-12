require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { evaluateLinear, getGraphGeometry, graphPlot, graphX, graphY, initialGraph, unprojectGraphX, visibleGraphDomain } = require('../src/functionGraphModel.ts');
const FunctionGraph = require('../src/FunctionGraph.tsx').default;

test('linear parameters and coordinate projection are mathematically consistent', () => {
  for (let a = -3; a <= 3; a += .25) {
    for (let b = -5; b <= 5; b += .5) {
      for (const x of [-5, -2, 0, 1.2345, 5]) {
        const geometry = getGraphGeometry({ a, b, x });
        assert.equal(geometry.y, evaluateLinear(a, b, geometry.x));
        assert.ok(geometry.py >= graphPlot.top - 1e-8 && geometry.py <= graphPlot.bottom + 1e-8);
        assert.ok(geometry.px >= graphPlot.left && geometry.px <= graphPlot.right);
        assert.ok(Math.abs(unprojectGraphX(graphX(geometry.x)) - geometry.x) < 1e-9);
        assert.equal(graphY(geometry.y), geometry.py);
      }
    }
  }
});

test('horizontal/negative lines clip correctly; non-finite or invisible functions are excluded', () => {
  assert.deepEqual(visibleGraphDomain(0, 1), [-5, 5]);
  assert.equal(visibleGraphDomain(0, 11), null);
  assert.equal(visibleGraphDomain(NaN, 0), null);
  assert.deepEqual(visibleGraphDomain(-3, 5), [-5/3, 5]);
  const boundary = getGraphGeometry({ a: 3, b: 5, x: 5 });
  assert.equal(boundary.x, 1.66);
  assert.equal(boundary.coordinate, '(1.66; 9.98)');
});

test('graph renders two labeled native sliders, keyboard/touch guidance and true initial coordinates', () => {
  const markup = renderToStaticMarkup(React.createElement(FunctionGraph, { session: { ...initialGraph } }));
  assert.equal((markup.match(/type="range"/g) || []).length, 2);
  assert.match(markup, /min="-3" max="3" step="0.25"/);
  assert.match(markup, /min="-5" max="5" step="0.5"/);
  assert.match(markup, /tabindex="0"/);
  assert.match(markup, /Home/);
  assert.match(markup, /x = 1 · y = 2.5/);
  assert.match(markup, /y = 1.5x \+ 1/);
});
