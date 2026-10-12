require('./load-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const MathMarkdown = require('../src/ai/MathMarkdown.tsx').default;

const render = text => renderToStaticMarkup(React.createElement(MathMarkdown, { text }));

test('AI Markdown renders inline math, display aligned formulas and numbered solution steps', () => {
  const html = render('**Bước giải**\n\n1. Viết $\\frac{1}{2}$ và $\\sqrt{x}$.\n2. Kiểm tra kết quả.\n\n$$\n\\begin{aligned}x+2 &= 5\\\\ x &= 3\\end{aligned}\n$$');
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/);
  assert.match(html, /<ol>/);
  assert.match(html, /<strong>Bước giải<\/strong>/);
  assert.match(html, /mfrac/);
});

test('AI Markdown ignores raw HTML, blocks unsafe links and never fetches AI remote images', () => {
  const html = render('<script>alert(1)</script>\n<img src="https://tracker.example/pixel">\n\n![đề](https://tracker.example/image.png)\n\n[unsafe](javascript:alert%281%29) [safe](https://example.com/math)\n\n$\\href{javascript:alert(1)}{x}$');
  assert.equal(/<script|<img|href="javascript:|src="https:\/\/tracker/.test(html), false);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /href="https:\/\/example.com\/math"/);
  assert.match(html, /Ảnh: đề/);
});

test('AI Markdown bounds macro expansion, font sizing and total response length', () => {
  const html = render('$\\def\\foo{\\foo}\\foo$\n\n$\\rule{999em}{999em}$\n\n' + 'a'.repeat(24000) + 'OUTSIDE_LIMIT');
  assert.equal(html.includes('OUTSIDE_LIMIT'), false);
  assert.equal(/(?:height|width|vertical-align):999em/.test(html), false);
  assert.match(html, /katex/);
});
