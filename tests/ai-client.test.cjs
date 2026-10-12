require('./load-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { sendAiMessage, getAiStatus, trimAiHistory, AiClientError } = require('../src/ai/aiClient.ts');
const { AI_LIMITS, TUTOR_MODES } = require('../shared/ai.ts');
const id = '9d3f783b-5ed0-420d-af7c-f49690d0f21c';
const body = { message: 'x + 2 = 5', clientMessageId: id, images: [], history: [], mode: 'hint' };
const response = { answer: 'Em hãy trừ 2 ở hai vế.', conversationId: id, mode: 'hint', metadata: { provider: 'mock', model: null, imageCount: 0, requestId: id } };
function mockFetch(t, fetcher) { const old = global.fetch; global.fetch = fetcher; t.after(() => { global.fetch = old; }); }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('AI client calls the local API with exact payload and same-origin credentials, without model or secret headers', async t => {
  let calls = 0;
  mockFetch(t, async (url, options) => {
    calls++;
    assert.equal(url, '/api/ai/chat');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(options.body), body);
    assert.equal(Object.keys(options.headers).some(key => /authorization|api.?key/i.test(key)), false);
    return json(response);
  });
  assert.deepEqual(await sendAiMessage(body), response);
  assert.equal(calls, 1);
});

test('AI client reads validated provider status and rejects malformed success responses', async t => {
  mockFetch(t, async url => {
    assert.equal(url, '/api/ai/status');
    return json({ provider: 'mock', configured: true, limits: AI_LIMITS, modes: TUTOR_MODES, timeoutMs: 30000 });
  });
  assert.equal((await getAiStatus()).provider, 'mock');
  global.fetch = async () => json({ ...response, answer: '' });
  await assert.rejects(sendAiMessage(body), error => error.code === 'INVALID_RESPONSE');
  global.fetch = async () => json({ ...response, metadata: { ...response.metadata, provider: 'invented' } });
  await assert.rejects(sendAiMessage(body), error => error.code === 'INVALID_RESPONSE');
  global.fetch = async () => json({ ...response, metadata: { ...response.metadata, provider: ['mock'] } });
  await assert.rejects(sendAiMessage(body), error => error.code === 'INVALID_RESPONSE');
});

test('AI errors use safe local messages; caller retry stays explicit and preserves request ID', async t => {
  let calls = 0;
  mockFetch(t, async (_url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).clientMessageId, id);
    return calls === 1 ? json({ error: { code: 'RATE_LIMITED', message: 'sensitive-provider-detail', retryable: true } }, 429) : json(response);
  });
  await assert.rejects(sendAiMessage(body), error => error instanceof AiClientError && error.code === 'RATE_LIMITED' && error.retryable && !error.message.includes('sensitive'));
  assert.equal(calls, 1, 'the client does not perform hidden retries');
  assert.deepEqual(await sendAiMessage(body), response);
  global.fetch = async () => json({ error: { code: 'CONFIGURATION_ERROR', message: 'private-key-value', retryable: false } }, 503);
  await assert.rejects(sendAiMessage(body), error => error.code === 'CONFIGURATION_ERROR' && !error.retryable && !error.message.includes('private-key-value'));
});

test('AI client distinguishes timeout, caller abort and network failure', async t => {
  mockFetch(t, (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Abort', 'AbortError')), { once: true });
  }));
  await assert.rejects(sendAiMessage(body, { timeoutMs: 5 }), error => error.code === 'TIMEOUT' && error.retryable);
  const controller = new AbortController();
  const pending = sendAiMessage(body, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.code === 'ABORTED' && !error.retryable);
  await assert.rejects(sendAiMessage(body, { signal: controller.signal }), error => error.code === 'ABORTED');
  global.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(sendAiMessage(body), error => error.code === 'NETWORK_ERROR' && error.retryable);
});

test('AI client bounds incoming response bytes before rendering', async t => {
  mockFetch(t, async () => new Response('{}'.repeat(300000), { status: 200 }));
  await assert.rejects(sendAiMessage(body), error => error.code === 'INVALID_RESPONSE');
});

test('proxy offline HTML/empty 5xx is distinct from sanitized Gemini and Origin errors', async t => {
  mockFetch(t, async () => new Response('', { status: 500 }));
  await assert.rejects(sendAiMessage(body), error => error.code === 'BACKEND_UNAVAILABLE' && error.retryable && error.status === 500);
  global.fetch = async () => new Response('<html>private proxy details</html>', { status: 502 });
  await assert.rejects(sendAiMessage(body), error => error.code === 'BACKEND_UNAVAILABLE' && !error.message.includes('private'));
  global.fetch = async () => json({ error: { code: 'AI_UNAVAILABLE', retryable: true } }, 503);
  await assert.rejects(sendAiMessage(body), error => error.code === 'AI_UNAVAILABLE');
  global.fetch = async () => json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'secret must not be displayed', retryable: false } }, 403);
  await assert.rejects(sendAiMessage(body), error => error.code === 'ORIGIN_NOT_ALLOWED' && !error.retryable && !error.message.includes('secret'));
});

test('history trimming preserves canonical complete pairs, order and dual size limits', () => {
  const history = Array.from({ length: 24 }, (_, index) => ({ role: index % 2 ? 'model' : 'user', text: `${index}` }));
  const trimmed = trimAiHistory(history);
  assert.equal(trimmed.length, 20);
  assert.equal(trimmed[0].text, '4');
  assert.equal(trimmed.at(-1).text, '23');
  assert.equal(history.length, 24);
  const long = Array.from({ length: 6 }, (_, index) => ({ role: index % 2 ? 'model' : 'user', text: `${index}${'x'.repeat(4999)}` }));
  const bounded = trimAiHistory(long);
  assert.equal(bounded.length, 4);
  assert.equal(bounded[0].text, long[2].text, 'messages remain exact so backend canonical comparison works');
  assert.equal(bounded.reduce((sum, entry) => sum + entry.text.length, 0) <= AI_LIMITS.maxHistoryChars, true);
});
