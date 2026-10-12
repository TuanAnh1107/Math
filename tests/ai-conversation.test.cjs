const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadComponent, nodes } = require('./component-harness.cjs');

class ClientError extends Error {
  constructor(code, message, retryable = false) { super(message); Object.assign(this, { code, retryable }); }
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = (answer = 'A supported answer') => ({ answer, conversationId: '12345678-1234-1234-1234-123456789abc', mode: 'tutor', metadata: { provider: 'mock', model: null, imageCount: 0, requestId: 'mock-request' } });
function conversation(send, prepare = async () => []) {
  const calls = [];
  const harness = loadComponent('../src/ai/useAiConversation.ts', {
    './aiClient': { AiClientError: ClientError, getAiStatus: async () => ({ provider: 'mock', configured: true, timeoutMs: 120000 }),
      sendAiMessage: (request, options) => { calls.push({ request, options }); return send(request, options); } },
    './imagePreparation': { prepareAiImages: prepare },
  }, { effects: true });
  harness.render(); harness.flushEffects();
  return { ...harness, calls };
}

test('actual pending operation prevents double send; composer ACK only follows successful response', async () => {
  const wait = deferred(); const harness = conversation(() => wait.promise);
  const first = harness.render().send({ text: 'x + 1 = 3' }, 'tutor');
  assert.equal(await harness.render().send({ text: 'duplicate' }, 'tutor'), false);
  assert.equal(harness.render().busy, true);
  assert.equal(harness.render().acknowledgedEntry, null);
  await Promise.resolve(); assert.equal(harness.calls.length, 1);
  wait.resolve(response()); assert.equal(await first, true);
  assert.equal(harness.render().busy, false); assert.equal(harness.render().responding, true);
  assert.equal(harness.render().acknowledgedEntry.text, 'x + 1 = 3');
  harness.render().finishResponding(); assert.equal(harness.render().responding, false);
  harness.dispose();
});

test('failed request keeps draft snapshot and manual retry uses the exact same UUID and payload', async () => {
  let attempt = 0;
  const harness = conversation(async () => { if (++attempt === 1) throw new ClientError('AI_UNAVAILABLE', 'retry', true); return response(); });
  assert.equal(await harness.render().send({ text: '  original draft  ' }, 'hint'), false);
  assert.equal(harness.render().turns[0].entry.text, '  original draft  ');
  assert.equal(harness.render().acknowledgedEntry, null);
  assert.equal(harness.render().error.retryable, true);
  assert.equal(await harness.render().retry(), true);
  assert.equal(harness.calls[0].request, harness.calls[1].request);
  assert.equal(harness.calls[0].request.clientMessageId, harness.calls[1].request.clientMessageId);
  assert.equal(harness.render().turns.length, 1); assert.equal(harness.render().turns[0].state, 'completed');
  harness.dispose();
});

test('abort immediately exits busy state and late responses cannot acknowledge or overwrite the draft', async () => {
  const wait = deferred(); const harness = conversation(() => wait.promise);
  const operation = harness.render().send({ text: 'preserved' }, 'tutor');
  await Promise.resolve(); harness.render().abort();
  assert.equal(harness.calls[0].options.signal.aborted, true);
  assert.equal(harness.render().busy, false); assert.equal(harness.render().turns[0].state, 'aborted');
  wait.resolve(response('late')); assert.equal(await operation, false);
  assert.equal(harness.render().acknowledgedEntry, null); assert.equal(harness.render().turns[0].response, undefined);
  harness.dispose();
});

test('new conversation aborts pending work and fences late completion from the new context', async () => {
  const wait = deferred(); let call = 0;
  const harness = conversation(() => ++call === 1 ? wait.promise : Promise.resolve(response('new answer')));
  const previous = harness.render().send({ text: 'old' }, 'tutor');
  await Promise.resolve(); harness.render().newConversation();
  assert.deepEqual(harness.render().turns, []); assert.equal(harness.render().busy, false);
  assert.equal(await harness.render().send({ text: 'new' }, 'tutor'), true);
  wait.resolve(response('old answer')); assert.equal(await previous, false);
  assert.equal(harness.render().turns[0].entry.text, 'new');
  assert.deepEqual(harness.calls[1].request.history, []); assert.equal(harness.calls[1].request.conversationId, undefined);
  harness.dispose();
});

test('multi-turn context contains only completed ordered pairs and excludes failed drafts', async () => {
  let call = 0;
  const harness = conversation(async () => { if (++call === 2) throw new ClientError('AI_UNAVAILABLE', 'retry', true); return response(`answer${call}`); });
  await harness.render().send({ text: 'first' }, 'tutor');
  await harness.render().send({ text: 'failed' }, 'solve');
  await harness.render().send({ text: 'third' }, 'check_answer');
  assert.deepEqual(harness.calls[2].request.history, [{ role: 'user', text: 'first' }, { role: 'model', text: 'answer1' }]);
  assert.equal(harness.calls[2].request.conversationId, response().conversationId);
  assert.equal(harness.calls[2].request.mode, 'check_answer');
  harness.dispose();
});

test('context caps completed turns at ten, stays paired, and uses configured server timeout plus margin', async () => {
  const harness = conversation(async () => response());
  await Promise.resolve();
  for (let i = 0; i < 13; i++) await harness.render().send({ text: `question${i}` }, 'tutor', 'quick');
  assert.equal(harness.render().turns.length, 10);
  assert.equal(harness.calls[12].request.history.length, 20);
  assert.deepEqual(harness.calls[12].request.history[0], { role: 'user', text: 'question2' });
  assert.equal(harness.calls[12].options.timeoutMs, 125000);
  assert.equal(harness.render().acknowledgedEntry, null);
  harness.dispose();
});

test('image preparation failure is explicit; successful image turns retain optimized previews only', async () => {
  const original = { id: 'image1', name: 'question.png', src: 'data:image/png;base64,original' };
  let fail = true;
  const harness = conversation(async () => response(), async () => { if (fail) throw new ClientError('IMAGE_INVALID', 'invalid'); return [{ mimeType: 'image/webp', data: 'optimized' }]; });
  assert.equal(await harness.render().send({ text: '', images: [original] }, 'tutor'), false);
  assert.equal(harness.calls.length, 0); assert.equal(harness.render().turns[0].entry.images[0].src, original.src);
  fail = false; assert.equal(await harness.render().retry(), true);
  assert.equal(harness.render().turns[0].entry.images[0].src, 'data:image/webp;base64,optimized');
  assert.equal(harness.render().acknowledgedEntry.images[0].src, original.src);
  harness.dispose();
});

test('empty and overlong text never reach the API; unmount aborts any pending request', async () => {
  const wait = deferred(); const harness = conversation(() => wait.promise);
  assert.equal(await harness.render().send({ text: '   ' }, 'tutor'), false);
  assert.equal(await harness.render().send({ text: 'x'.repeat(6001) }, 'tutor'), false);
  assert.equal(harness.calls.length, 0);
  const operation = harness.render().send({ text: 'pending' }, 'tutor');
  await Promise.resolve(); harness.dispose();
  assert.equal(harness.calls[0].options.signal.aborted, true);
  wait.resolve(response()); assert.equal(await operation, false);
});

test('composer clears text and attachments only after success, keeps both on failure, and blocks double submit', async () => {
  const wait = deferred(); let draft = 'my draft'; let count = 0;
  const harness = loadComponent('../src/ImageComposer.tsx');
  const image = { id: 'a', name: 'q.png', src: 'data:image/png;base64,a', status: 'ready' };
  const props = () => ({ message: draft, setMessage: value => { draft = value; }, onSend: () => { count++; return wait.promise; } });
  harness.render(props()); harness.refs[0].current = [image]; harness.cells[0] = [image];
  const form = () => nodes(harness.render(props())).find(node => node.type === 'form' && node.props.className === 'image-composer');
  const first = form().props.onSubmit({ preventDefault() {} });
  await form().props.onSubmit({ preventDefault() {} }); assert.equal(count, 1);
  wait.resolve(false); await first; assert.equal(draft, 'my draft'); assert.equal(harness.refs[0].current.length, 1);
  const accepted = { ...props(), onSend: async () => true };
  await nodes(harness.render(accepted)).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(draft, ''); assert.deepEqual(harness.refs[0].current, []);
});

test('successful retry ACK clears only its matching draft, preserving any later edits', () => {
  let draft = 'changed after failure'; const entry = { text: 'previous failed text', images: [] };
  const harness = loadComponent('../src/ImageComposer.tsx', {}, { effects: true });
  const props = acknowledgedEntry => ({ message: draft, setMessage: value => { draft = value; }, onSend: async () => true, acknowledgedEntry });
  harness.render(props(entry)); harness.flushEffects(); assert.equal(draft, 'changed after failure');
  draft = 'previous failed text'; harness.render(props({ ...entry })); harness.flushEffects(); assert.equal(draft, '');
  harness.dispose();
});
