const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const motionCss = fs.readFileSync(path.resolve(__dirname, '../src/motion.css'), 'utf8');
const appSource = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');

test('motion styles exclude exam shell and respect reduced-motion preferences', () => {
  assert.match(motionCss, /\.app:not\(\.exam-shell\)/);
  assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(motionCss, /animation-duration: \.01ms !important/);
});

test('pointer tilt uses requestAnimationFrame and removes its event handlers on cleanup', () => {
  assert.match(appSource, /requestAnimationFrame\(update\)/);
  assert.match(appSource, /removeEventListener\('pointermove', move\)/);
  assert.match(appSource, /cancelAnimationFrame\(frame\)/);
  assert.match(motionCss, /rotateX\(var\(--tilt-x/);
});

test('scroll reveal waits for an IntersectionObserver signal and has a visible-content fallback', () => {
  assert.match(appSource, /new IntersectionObserver/);
  assert.match(appSource, /if \(initialized\) return;/);
  assert.match(appSource, /removeAttribute\('data-motion-reveal'\)/);
  assert.match(appSource, /window\.setTimeout\(\(\) => \{/);
});
