require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadComponent } = require('./component-harness.cjs');
const createId = require('../src/ai/clientMessageId.ts').default;
const { AiClientError } = require('../src/ai/aiClient.ts');

test('client UUID uses the native secure generator when available', () => {
  assert.equal(createId({ randomUUID: () => '6e3fb101-46ba-4e47-bba4-1d7cb980faff' }), '6e3fb101-46ba-4e47-bba4-1d7cb980faff');
});
test('missing or throwing randomUUID falls back to secure RFC 4122 v4 bytes accepted by backend', () => {
  for (const randomUUID of [undefined, () => { throw new Error('unsupported'); }]) {
    const id = createId({ randomUUID, getRandomValues: bytes => { bytes.fill(255); return bytes; } });
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(id, 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  }
});
test('unavailable secure randomness gives an actionable safe error rather than an insecure ID', () => {
  for (const source of [{}, { getRandomValues: () => { throw new Error('SECRET must not appear'); } }]) {
    assert.throws(() => createId(source), error => error instanceof AiClientError && error.code === 'CLIENT_ID_UNAVAILABLE' && error.retryable && !error.message.includes('SECRET'));
  }
});
test('ID creation errors are caught before request; the draft has no ACK and a later send can recover', async () => {
  let fail = true; let calls = 0;
  const harness = loadComponent('../src/ai/useAiConversation.ts', {
    './clientMessageId': { __esModule: true, default: () => { if (fail) throw new AiClientError('CLIENT_ID_UNAVAILABLE', 'safe actionable error', true); return '6e3fb101-46ba-4e47-bba4-1d7cb980faff'; } },
    './imagePreparation': { prepareAiImages: async () => [] },
    './aiClient': { AiClientError, getAiStatus: async () => ({}), sendAiMessage: async () => { calls++; return { answer: 'answer', conversationId: '6e3fb101-46ba-4e47-bba4-1d7cb980faff', metadata: { provider: 'gemini' } }; } },
  });
  const entry = { text: 'keep this draft', images: [] };
  assert.equal(await harness.render().send(entry, 'tutor'), false);
  assert.equal(calls, 0); assert.equal(harness.render().error.code, 'CLIENT_ID_UNAVAILABLE');
  assert.equal(harness.render().acknowledgedEntry, null); assert.equal(entry.text, 'keep this draft');
  assert.equal(harness.render().busy, false);
  fail = false; assert.equal(await harness.render().retry(), true); assert.equal(calls, 1);
});
