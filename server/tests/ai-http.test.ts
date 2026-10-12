import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { createApp, type AppDependencies } from "../src/app.js";
import { loadConfig, type AIConfig } from "../src/config/env.js";
import { AI_LIMITS, historyUserText, trimAIHistory, type AIChatRequest, type AIChatResponse } from "../../shared/ai.js";
import { MockAIService } from "../src/services/mock-ai.service.js";
import type { AIProvider } from "../src/services/provider.js";

async function fixture(overrides: Partial<AIConfig> = {}, dependencies: AppDependencies = {}) {
  const config = { ...loadConfig({}), ...overrides };
  const app = createApp(config, { provider: new MockAIService(true, 0), ...dependencies });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); } };
}
function request(overrides: Partial<AIChatRequest> = {}): AIChatRequest {
  return { message: "Giải thích hàm số", clientMessageId: randomUUID(), history: [], images: [], mode: "tutor", ...overrides };
}
async function post(base: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json(), response };
}

test("local HTTP mock chat without key, health/status and bounded new sessions", async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(`${f.base}/health`)).status, 200);
    const status = await (await fetch(`${f.base}/api/ai/status`)).json();
    assert.equal(status.provider, "mock"); assert.equal(status.configured, true);
    assert.deepEqual(status.limits, AI_LIMITS);
    for (const mode of ["tutor", "hint", "solve", "check_answer", "explain_concept"] as const) {
      // Up to three independent sessions are deliberately allowed; reuse each successful context.
      const shared = request({ mode });
      const result = await post(f.base, shared);
      if (mode === "check_answer" || mode === "explain_concept") assert.equal(result.body.error?.code, "CONVERSATION_LIMIT");
      else { assert.equal(result.status, 200); assert.match(result.body.answer, /DEMO/); assert.equal(result.body.metadata.provider, "mock"); }
    }
  } finally { await f.close(); }
});

test("canonical context trims complete pairs and expires after 30 minutes", async () => {
  let now = 0;
  const f = await fixture({ rateLimitPerMinute: 100 }, { now: () => now });
  let conversationId: string | undefined; let history: AIChatRequest["history"] = [];
  try {
    for (let index = 0; index < 12; index++) {
      const outgoing = request({ conversationId, history });
      const result = await post(f.base, outgoing); assert.equal(result.status, 200);
      conversationId = result.body.conversationId;
      history = trimAIHistory([...history, { role: "user", text: outgoing.message }, { role: "model", text: result.body.answer }]);
    }
    assert.equal(history.length, 20);
    now = 30 * 60 * 1000 + 1;
    assert.equal((await post(f.base, request({ conversationId, history }))).body.error.code, "CONVERSATION_EXPIRED");
  } finally { await f.close(); }
});

test("concurrent duplicate UUID shares in-flight provider request", async () => {
  let calls = 0;
  const provider: AIProvider = { name: "mock", model: null, generate: async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 40)); return { answer: "DEMO" }; } };
  const f = await fixture({}, { provider });
  try {
    const body = request(); const [first, second] = await Promise.all([post(f.base, body), post(f.base, body)]);
    assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(calls, 1); assert.deepEqual(second.body, first.body);
  } finally { await f.close(); }
});

test("five tutor modes and paired multi-turn canonical context", async () => {
  const f = await fixture(); let conversationId: string | undefined; let history: AIChatRequest["history"] = [];
  try {
    for (const mode of ["tutor", "hint", "solve", "check_answer", "explain_concept"] as const) {
      const outgoing = request({ mode, conversationId, history });
      const result = await post(f.base, outgoing);
      assert.equal(result.status, 200); assert.equal(result.body.mode, mode);
      assert.match(result.body.answer, /DEMO/);
      conversationId = result.body.conversationId;
      history = trimAIHistory([...history, { role: "user", text: historyUserText(outgoing.message, 0) }, { role: "model", text: result.body.answer }]);
    }
    const bad = await post(f.base, request({ conversationId, history: [{ role: "user", text: "Giả" }, { role: "model", text: "Lịch sử giả" }] }));
    assert.equal(bad.body.error.code, "HISTORY_MISMATCH");
  } finally { await f.close(); }
});

test("validation rejects empty, roles/system/model injection, oversized message, odd history and unknown modes", async () => {
  const f = await fixture();
  try {
    for (const body of [request({ message: "   " }), request({ message: "x".repeat(6001) }), { ...request(), systemInstruction: "bad" }, { ...request(), model: "bad" }, { ...request(), mode: "root" }, { ...request(), history: [{ role: "system", text: "bad" }, { role: "model", text: "bad" }] }, { ...request(), history: [{ role: "user", text: "one" }] }]) {
      const result = await post(f.base, body); assert.equal(result.status, 422); assert.equal(result.body.error.code, "VALIDATION_ERROR");
    }
  } finally { await f.close(); }
});

test("valid JPEG PNG WebP decoded, reencoded; mock acknowledges receipt without OCR claims", async () => {
  const f = await fixture();
  try {
    const source = sharp({ create: { width: 16, height: 16, channels: 3, background: "white" } });
    const images = [];
    for (const [format, mimeType] of [["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]] as const) images.push({ mimeType, data: (await source.clone().toFormat(format).toBuffer()).toString("base64") });
    const result = await post(f.base, request({ message: "", images }));
    assert.equal(result.status, 200); assert.equal(result.body.metadata.imageCount, 3);
    assert.match(result.body.answer, /Mock chưa nhận diện/);
    const mismatch = await post(f.base, request({ images: [{ mimeType: "image/jpeg", data: images[1].data }] }));
    assert.equal(mismatch.body.error.code, "IMAGE_INVALID");
    const corrupted = await post(f.base, request({ images: [{ mimeType: "image/png", data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64") }] }));
    assert.equal(corrupted.body.error.code, "IMAGE_INVALID");
  } finally { await f.close(); }
});

test("image format, count, base64 and individual/aggregate byte budgets are enforced", async () => {
  const f = await fixture();
  try {
    const cases = [
      { images: [{ mimeType: "image/gif", data: "AAAA" }], code: "IMAGE_INVALID" },
      { images: [{ mimeType: "image/png", data: "data:image/png;base64,AA==" }], code: "IMAGE_INVALID" },
      { images: Array.from({ length: 5 }, () => ({ mimeType: "image/png", data: "AAAA" })), code: "VALIDATION_ERROR" },
      { images: [{ mimeType: "image/png", data: "A".repeat(Math.ceil(AI_LIMITS.maxImageBytes / 3) * 4 + 4) }], code: "IMAGE_TOO_LARGE" },
      { images: [{ mimeType: "image/png", data: "A".repeat(9 * 1024 * 1024) }, { mimeType: "image/png", data: "A".repeat(9 * 1024 * 1024) }], code: "PAYLOAD_TOO_LARGE" },
      { images: [{ mimeType: "image/png", data: "A".repeat(8 * 1024 * 1024 + 4) }, { mimeType: "image/png", data: "A".repeat(8 * 1024 * 1024 + 4) }], code: "IMAGE_TOO_LARGE" },
    ];
    for (const entry of cases) assert.equal((await post(f.base, { ...request(), images: entry.images })).body.error.code, entry.code);
  } finally { await f.close(); }
});

test("CORS allowlist and rate limit run before JSON decoding", async () => {
  const f = await fixture({ rateLimitPerMinute: 1 });
  try {
    assert.equal((await post(f.base, request(), { Origin: "https://evil.example" })).body.error.code, "ORIGIN_NOT_ALLOWED");
    const allowed = await fetch(`${f.base}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:8443" }, body: "{" });
    assert.equal(allowed.status, 400); assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "http://localhost:8443");
    const limited = await post(f.base, request()); assert.equal(limited.status, 429); assert.equal(limited.body.error.code, "RATE_LIMITED");
  } finally { await f.close(); }
});

test("retry same UUID idempotent after lost response, rejects changed payload, retry mock failure succeeds", async () => {
  const f = await fixture();
  try {
    const body = request(); const first = await post(f.base, body); const replay = await post(f.base, body);
    assert.equal(first.status, 200); assert.deepEqual(replay.body, first.body);
    assert.equal((await post(f.base, { ...body, message: "changed" })).body.error.code, "IDEMPOTENCY_CONFLICT");
    const failure = request({ message: "[mock:error]" });
    assert.equal((await post(f.base, failure)).body.error.code, "AI_UNAVAILABLE");
    assert.equal((await post(f.base, failure)).status, 200);
  } finally { await f.close(); }
});

test("timeout aborts provider; aborting HTTP cancels provider and releases conversation slot", async () => {
  let aborts = 0; let started: (() => void) | undefined;
  const provider: AIProvider = { name: "mock", model: null, generate: async ({ signal }) => {
    started?.(); await new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => { aborts++; reject(new Error("private provider secret")); }, { once: true }));
    return { answer: "unused" };
  } };
  const f = await fixture({ timeoutMs: 100 }, { provider });
  try {
    const timeout = await post(f.base, request()); assert.equal(timeout.status, 504); assert.equal(timeout.body.error.code, "AI_TIMEOUT"); assert.equal(aborts, 1);
    const controller = new AbortController();
    const begun = new Promise<void>((resolve) => { started = resolve; });
    const pending = fetch(`${f.base}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request()), signal: controller.signal });
    await begun; controller.abort(); await assert.rejects(pending);
    await new Promise((resolve) => setTimeout(resolve, 25)); assert.equal(aborts, 2);
  } finally { await f.close(); }
});

test("missing Gemini key gives clear configuration error; never mock fallback", async () => {
  const config = loadConfig({ AI_MODE: "gemini" });
  const app = createApp(config); const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const status = await (await fetch(`${base}/api/ai/status`)).json(); assert.equal(status.provider, "gemini"); assert.equal(status.configured, false);
    const result = await post(base, request()); assert.equal(result.status, 503); assert.equal(result.body.error.code, "CONFIGURATION_ERROR"); assert.equal(result.body.answer, undefined);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test("production fails closed without auth; ownership isolation and per-user daily policy hook", async () => {
  assert.throws(() => createApp(loadConfig({ NODE_ENV: "production" })), /authentication integration/);
  const f = await fixture({ production: true }, { authenticate: async (req) => req.headers.authorization ? { userId: String(req.headers.authorization), dailyLimit: 1 } : null });
  try {
    assert.equal((await post(f.base, request())).status, 401);
    const body = request(); const first = await post(f.base, body, { Authorization: "verified-test-user-a" }); assert.equal(first.status, 200);
    const response = first.body as AIChatResponse;
    const history = [{ role: "user" as const, text: body.message }, { role: "model" as const, text: response.answer }];
    const other = await post(f.base, request({ conversationId: response.conversationId, history }), { Authorization: "verified-test-user-b" }); assert.equal(other.body.error.code, "CONVERSATION_FORBIDDEN");
    const limit = await post(f.base, request({ conversationId: response.conversationId, history }), { Authorization: "verified-test-user-a" }); assert.equal(limit.body.error.code, "DAILY_LIMIT_REACHED");
  } finally { await f.close(); }
});
