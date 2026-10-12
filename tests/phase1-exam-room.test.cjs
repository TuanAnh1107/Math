require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadComponent, nodes } = require('./component-harness.cjs');
const model = require('../src/examModel.ts');

function environment(run) {
  const previous = { window: global.window, document: global.document, now: Date.now };
  let now = 1_700_000_000_000;
  const intervals = new Set(), timeouts = new Set();
  const entries = new Map();
  const store = model.createExamStore(() => ({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }));
  global.window = {
    addEventListener() {}, removeEventListener() {}, scrollTo() {},
    setInterval: callback => { intervals.add(callback); return callback; }, clearInterval: callback => intervals.delete(callback),
    setTimeout: callback => { timeouts.add(callback); return callback; }, clearTimeout: callback => timeouts.delete(callback),
  };
  global.document = { hidden: false, activeElement: null, body: { style: {} }, addEventListener() {}, removeEventListener() {} };
  Date.now = () => now;
  const config = model.getDemoExamConfig(1, false);
  const delivered = [];
  const mount = () => {
    const harness = loadComponent('../src/ExamRoom.tsx', {
      './Theme': { useTheme: () => ({ dark: false }), default: () => null },
      './examModel': { ...model, examStore: store },
    }, { effects: true });
    const props = { config, onExit() {}, onSubmit: result => delivered.push(result) };
    const render = () => harness.render(props);
    render(); harness.flushEffects();
    return { ...harness, render };
  };
  try { run({ mount, config, store, delivered, intervals, timeouts, setNow: value => { now = value; } }); }
  finally { global.window = previous.window; global.document = previous.document; Date.now = previous.now; }
}

test('ExamRoom auto-submits once at deadline, disables answers, and reentry shows same closed attempt', () => environment(({ mount, config, store, delivered, intervals, setNow }) => {
  const room = mount();
  nodes(room.render()).find(node => node.type === 'button' && node.props.children?.[1]?.props?.children === '7').props.onClick();
  const attempt = store.read(config.id).attempt;
  setNow(attempt.expiresAt);
  [...intervals].forEach(callback => callback());
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].reason, 'expired');
  assert.equal(delivered[0].earnedPoints, 1);
  assert.ok(nodes(room.render()).filter(node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children[1]?.type === 'strong').every(node => node.props.disabled));
  [...intervals].forEach(callback => callback());
  assert.equal(delivered.length, 1);
  room.dispose();
  const reopened = mount();
  assert.equal(delivered[1].attemptId, attempt.attemptId);
  assert.equal(store.read(config.id).attempt.expiresAt, attempt.expiresAt);
  reopened.dispose();
}));

test('a captured answer handler rejects input exactly at expiry before the clock tick', () => environment(({ mount, config, store, delivered, setNow }) => {
  const room = mount();
  const button = nodes(room.render()).find(node => node.type === 'button' && node.props.children?.[1]?.props?.children === '7');
  const attempt = store.read(config.id).attempt;
  setNow(attempt.expiresAt);
  button.props.onClick();
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].answeredCount, 0);
  assert.deepEqual(store.read(config.id).attempt.answers, {});
  room.dispose();
}));

test('room remount keeps deadline; manual submit includes the last textarea edit immediately', () => environment(({ mount, config, store, delivered, setNow }) => {
  const first = mount();
  const attempt = store.read(config.id).attempt;
  first.dispose(); setNow(attempt.startedAt + 20_000);
  const room = mount();
  assert.equal(store.read(config.id).attempt.expiresAt, attempt.expiresAt);
  const pagination = nodes(room.render()).find(node => node.props?.className === 'exam-desktop-pagination');
  pagination.props.children[2].props.onClick();
  nodes(room.render()).find(node => node.type === 'textarea').props.onChange({ target: { value: 'x >= 2' } });
  setNow(attempt.startedAt + 65_000);
  const utilities = nodes(room.render()).find(node => node.props?.className === 'exam-utilities');
  utilities.props.children[3].props.onClick();
  const actions = nodes(room.render()).find(node => node.props?.className === 'exam-dialog-actions');
  actions.props.children[1].props.onClick();
  assert.equal(delivered[0].reason, 'manual');
  assert.equal(delivered[0].elapsedSeconds, 65);
  assert.equal(delivered[0].correctCount, 1);
  assert.equal(delivered[0].questionResults[1].answer, 'x >= 2');
  assert.equal(delivered[0].pendingCount, 2);
  room.dispose();
}));
