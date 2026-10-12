import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { createServer, loadConfigFromFile } from 'vite';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { normalizeOrigin, parseAllowedOrigins } from '../src/config/origins.js';
import { loadServerEnvironment, serverEnvPath } from '../src/config/environment.js';
import { MockAIService } from '../src/services/mock-ai.service.js';

const payload = () => ({ message: '5 + 5?', clientMessageId: randomUUID(), history: [], images: [], mode: 'tutor' });
async function fixture() {
  const config = loadConfig({ ALLOWED_ORIGINS: ' http://LOCALHOST:8443/, http://127.0.0.1:8443,http://192.168.0.109:8443 ', AI_RATE_LIMIT_PER_MINUTE: '100' });
  const observed: Array<{ origin?: string; host?: string; referer?: string; forwardedHost?: string; forwardedProto?: string }> = [];
  const app = createApp(config, { provider: new MockAIService(false, 0), authenticate: async req => {
    observed.push({ origin: req.headers.origin, host: req.headers.host, referer: req.headers.referer, forwardedHost: String(req.headers['x-forwarded-host'] ?? ''), forwardedProto: String(req.headers['x-forwarded-proto'] ?? '') });
    return { userId: 'origin-test' };
  } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  return { observed, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}

test('allowlist normalization trims/deduplicates and canonicalizes host, scheme, default port and config slash', () => {
  assert.deepEqual(parseAllowedOrigins(' http://LOCALHOST:8443/,http://localhost:8443,HTTPS://Example.COM:443/ '), ['http://localhost:8443', 'https://example.com']);
  assert.equal(normalizeOrigin('HTTP://LOCALHOST:8443'), 'http://localhost:8443');
  for (const value of ['', '*', 'null', 'file://localhost', 'http://user:pass@localhost', 'https://example.com/path', 'https://example.com?key=not-real', 'https://example.com#part', 'http://localhost:8443,']) assert.throws(() => parseAllowedOrigins(value), /ALLOWED_ORIGINS/);
  for (const value of ['null', 'http://localhost:8443/', 'http://localhost:8443/path', 'http://localhost:8443?x=y', 'http://localhost:8443#x', 'http://localhost:8443\\path', 'http://user@localhost:8443']) assert.equal(normalizeOrigin(value), null);
});

test('localhost, loopback, configured LAN and absent Origin reach validation; unconfigured LAN/protocol/port/invalid Origin are blocked first', async () => {
  const f = await fixture();
  try {
    for (const origin of [undefined, 'http://localhost:8443', 'http://127.0.0.1:8443', 'http://LOCALHOST:8443', 'http://192.168.0.109:8443']) {
      const response = await fetch(`${f.base}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: '{}' });
      const body = await response.json(); assert.equal(response.status, 422); assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.equal(response.headers.get('x-request-id'), body.error.requestId);
    }
    for (const origin of ['https://evil.example', 'http://192.168.0.110:8443', 'https://localhost:8443', 'http://localhost:8444', 'null', '', 'not-an-origin', 'http://localhost:8443/']) {
      const response = await fetch(`${f.base}/api/ai/chat`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Referer: 'http://localhost:8443/', 'X-Forwarded-Host': 'localhost:8443', 'X-Forwarded-Proto': 'http' }, body: '{' });
      const body = await response.json(); assert.equal(response.status, 403); assert.equal(body.error.code, 'ORIGIN_NOT_ALLOWED');
      assert.equal(response.headers.get('access-control-allow-origin'), null); assert.equal(response.headers.get('x-request-id'), body.error.requestId);
    }
  } finally { await f.close(); }
});

test('valid Origin reaches AI chat even when Host/Referer/forwarded headers differ; none of these grant permission', async () => {
  const f = await fixture();
  try {
    const response = await fetch(`${f.base}/api/ai/chat`, { method: 'POST', headers: { Origin: 'http://localhost:8443', 'Content-Type': 'application/json', Referer: 'https://other.example/', 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-Proto': 'https' }, body: JSON.stringify(payload()) });
    assert.equal(response.status, 200); assert.equal((await response.json()).metadata.provider, 'mock');
    assert.equal(f.observed[0].origin, 'http://localhost:8443'); assert.equal(f.observed[0].forwardedHost, 'evil.example');
  } finally { await f.close(); }
});

test('CORS preflight echoes only allowed Origin; unsupported method/headers and blocked Origin cannot proceed', async () => {
  const f = await fixture();
  try {
    const headers = { Origin: 'http://localhost:8443', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type,Authorization' };
    const valid = await fetch(`${f.base}/api/ai/chat`, { method: 'OPTIONS', headers }); assert.equal(valid.status, 204); assert.equal(valid.headers.get('access-control-allow-origin'), headers.Origin);
    assert.equal(valid.headers.get('access-control-allow-credentials'), 'true'); assert.equal(valid.headers.get('vary'), 'Origin');
    for (const altered of [{ Origin: 'https://evil.example' }, { 'Access-Control-Request-Method': 'DELETE' }, { 'Access-Control-Request-Headers': 'X-Unknown' }]) {
      const response = await fetch(`${f.base}/api/ai/chat`, { method: 'OPTIONS', headers: { ...headers, ...altered } }); assert.equal(response.status, altered.Origin ? 403 : 400);
    }
  } finally { await f.close(); }
});

test('server environment resolves from entry URL rather than cwd, before config; inherited values stay authoritative and file changes need reload', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'math-mentor-origin-'));
  try {
    await mkdir(path.join(temp, 'server', 'src'), { recursive: true }); await mkdir(path.join(temp, 'server', 'dist', 'server', 'src'), { recursive: true });
    const envFile = path.join(temp, 'server', '.env');
    await writeFile(envFile, 'AI_MODE=mock\nALLOWED_ORIGINS=http://LOCALHOST:8443/,http://127.0.0.1:8443\n');
    const source = pathToFileURL(path.join(temp, 'server', 'src', 'index.ts')).href;
    const compiled = pathToFileURL(path.join(temp, 'server', 'dist', 'server', 'src', 'index.js')).href;
    assert.equal(serverEnvPath(source), envFile); assert.equal(serverEnvPath(compiled), envFile);
    const target: NodeJS.ProcessEnv = {}; assert.equal(loadServerEnvironment(source, target).originSource, 'server/.env');
    const initial = loadConfig(target); assert.deepEqual(initial.allowedOrigins, ['http://localhost:8443', 'http://127.0.0.1:8443']);
    await writeFile(envFile, 'AI_MODE=mock\nALLOWED_ORIGINS=http://localhost:8443,http://127.0.0.1:8443,http://192.168.0.109:8443\n');
    assert.equal(initial.allowedOrigins.length, 2);
    const fresh: NodeJS.ProcessEnv = {}; loadServerEnvironment(compiled, fresh); assert.equal(loadConfig(fresh).allowedOrigins.length, 3);
    const inherited = { ALLOWED_ORIGINS: 'https://deployment.example' }; assert.equal(loadServerEnvironment(source, inherited).originSource, 'process environment');
    assert.deepEqual(loadConfig(inherited).allowedOrigins, ['https://deployment.example']);
  } finally {
    const resolved = path.resolve(temp);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('math-mentor-origin-')) throw new Error('Unsafe temporary cleanup target');
    await rm(resolved, { recursive: true, force: true });
  }
});

test('real Vite proxy config preserves Origin, frontend Host and path; blocked Origin stays blocked through proxy', async () => {
  const root = path.resolve('..'); const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.join(root, 'vite.config.ts'));
  const rule = loaded?.config.server?.proxy?.['/api/ai']; assert.equal(typeof rule, 'object');
  if (!rule || typeof rule === 'string') throw new Error('Expected configured AI proxy');
  assert.equal(rule.target, 'http://127.0.0.1:3001'); assert.equal(rule.changeOrigin, false); assert.equal(rule.rewrite, undefined);
  const f = await fixture(); const vite = await createServer({ configFile: false, root, cacheDir: path.join(root, '.cache', 'origin-proxy-cache'), server: { cors: loaded!.config.server?.cors, host: '127.0.0.1', port: 0, strictPort: false, proxy: { '/api/ai': { ...rule, target: f.base } } } });
  try {
    await vite.listen(); const port = (vite.httpServer!.address() as AddressInfo).port; const base = `http://127.0.0.1:${port}`;
    const allowed = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { Origin: 'http://localhost:8443', 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
    assert.equal(allowed.status, 200); assert.equal(f.observed[0].origin, 'http://localhost:8443'); assert.equal(f.observed[0].host, `127.0.0.1:${port}`);
    const denied = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
    assert.equal(denied.status, 403); assert.equal((await denied.json()).error.code, 'ORIGIN_NOT_ALLOWED');
    for (const origin of ['http://localhost:8443', 'http://127.0.0.1:8443', 'http://192.168.0.109:8443', 'https://evil.example']) {
      const response = await fetch(`${base}/api/ai/chat`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
      assert.equal(response.status, origin === 'https://evil.example' ? 403 : 204);
      assert.ok(response.headers.get('x-request-id'), 'preflight reached Express rather than stopping at Vite CORS');
      assert.equal(response.headers.get('access-control-allow-origin'), origin === 'https://evil.example' ? null : origin);
    }
    await f.close();
    const offline = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { Origin: 'http://localhost:8443', 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
    assert.ok([500, 502, 503].includes(offline.status));
  } finally { await vite.close(); await f.close(); }
});
