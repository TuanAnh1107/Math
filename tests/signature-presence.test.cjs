require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { getTutorOrbState, idleTutorActivity, orbDescriptions } = require('../src/tutorPresence.ts');
const { settlePointer, motionTokens } = require('../src/motionTokens.ts');
const AIOrb = require('../src/AIOrb.tsx').default;
const { loadComponent } = require('./component-harness.cjs');

test('Orb states follow composer focus, actual file reads, API requests, errors and received responses', () => {
  assert.equal(getTutorOrbState(idleTutorActivity, false), 'idle');
  assert.equal(getTutorOrbState({ ...idleTutorActivity, focused: true }, false), 'focused');
  assert.equal(getTutorOrbState({ ...idleTutorActivity, readingImages: true }, true), 'processing');
  assert.equal(getTutorOrbState(idleTutorActivity, true), 'responding');
  assert.equal(getTutorOrbState(idleTutorActivity, false, true), 'processing');
  assert.equal(getTutorOrbState({ ...idleTutorActivity, focused: true }, true, true), 'processing');
  assert.equal(getTutorOrbState({ focused: true, readingImages: true, hasError: true }, true), 'error');
  assert.equal(getTutorOrbState({ ...idleTutorActivity, hasError: true }, true, true), 'error');
  assert.match(orbDescriptions.processing, /yêu cầu/);
  assert.match(orbDescriptions.responding, /phản hồi/);
  assert.equal(/demo|gemini|trên thiết bị/i.test(orbDescriptions.responding), false, 'response description works for both API providers');
});

test('SVG Orb has unique gradients, accessible state descriptions, and static message variants', () => {
  const markup = renderToStaticMarkup(React.createElement('div', null,
    React.createElement(AIOrb, { state: 'processing' }),
    React.createElement(AIOrb, { size: 'compact', animated: false, decorative: true })));
  assert.match(markup, /aria-label="Math Mentor · [^"]+yêu cầu/);
  assert.match(markup, /data-animated="false"/);
  const ids = [...markup.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('Orb marks a response as shown from its native response animation, without a fake request timer', () => {
  const harness = loadComponent('../src/AIOrb.tsx');
  let completed = 0;
  const element = harness.render({ state: 'responding', onResponseShown: () => { completed++; } });
  assert.equal(element.props['data-state'], 'responding');
  element.props.onAnimationEnd({ animationName: 'orb-breathe' });
  assert.equal(completed, 0);
  element.props.onAnimationEnd({ animationName: 'orb-answer-pulse' });
  assert.equal(completed, 1);
  harness.dispose();
});

test('pointer damping converges without overshoot and is independent of frame rate', () => {
  let position = .5;
  for (let i = 0; i < 40; i++) {
    const next = settlePointer(position, 1, 16);
    assert.ok(next >= position && next <= 1);
    position = next;
  }
  assert.ok(1 - position < motionTokens.spring.settleThreshold);
  const twoFrames = settlePointer(settlePointer(.5, 1, 16), 1, 16);
  assert.ok(Math.abs(twoFrames - settlePointer(.5, 1, 32)) < 1e-12);
});
