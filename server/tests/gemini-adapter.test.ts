import assert from "node:assert/strict";
import { test } from "node:test";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { GeminiService, type GeminiSDK } from "../src/services/gemini.service.js";
import { loadConfig } from "../src/config/env.js";
import { AIError, providerError, publicError } from "../src/errors.js";
import { systemInstruction } from "../src/prompts/math-mentor.js";
import type { ProviderRequest } from "../src/services/provider.js";
import { trimAIHistory } from "../../shared/ai.js";

const input: ProviderRequest = { message: "Giải bài", mode: "solve", history: [{ role: "user", text: "xin chào" }, { role: "model", text: "chào bạn" }], images: [{ mimeType: "image/png", data: "AA==" }], clientMessageId: "test", signal: new AbortController().signal };
test('provider diagnostics preserve only safe status/network classification and never enter public response', () => {
  for (const error of [Object.assign(new Error('PRIVATE secret body'), { status: 503 }), Object.assign(new Error('PRIVATE key'), { cause: { code: 'ECONNRESET' } })]) {
    const safe = providerError(error); assert.equal(safe.code, 'AI_UNAVAILABLE');
    assert.equal(JSON.stringify(safe.providerDiagnostic).includes('PRIVATE'), false);
    assert.equal(JSON.stringify(publicError(safe, 'request-id').body).includes('providerDiagnostic'), false);
  }
  assert.equal(providerError({ status: 503 }).providerDiagnostic?.upstreamStatus, 503);
  assert.equal(providerError({ cause: { code: 'ECONNRESET' } }).providerDiagnostic?.category, 'network');
  assert.equal(providerError({ cause: { code: 'PRIVATE_KEY' } }).providerDiagnostic?.networkCode, undefined);
});
test("official SDK adapter constructs bounded text/image conversation and backend-owned instruction, no retries", async () => {
  let captured: GenerateContentParameters | undefined;
  const sdk: GeminiSDK = { models: { generateContent: async (parameters) => { captured = parameters; return { text: "$x=3$", usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 } } as GenerateContentResponse; } } };
  const service = new GeminiService(loadConfig({ AI_MODE: "gemini", GEMINI_MODEL: "gemini-3.8-flash" }), sdk);
  const result = await service.generate(input);
  assert.equal(result.answer, "$x=3$"); assert.equal(result.usage?.totalTokens, 30);
  assert.equal(captured?.model, "gemini-3.8-flash"); assert.equal(captured?.config?.abortSignal, input.signal);
  assert.equal(captured?.config?.httpOptions?.retryOptions?.attempts, 1);
  assert.equal(captured?.config?.httpOptions?.baseUrl, 'https://generativelanguage.googleapis.com');
  assert.match(String(captured?.config?.systemInstruction), /Chế độ SOLVE/);
  assert.equal((captured?.contents as unknown[]).length, 3);
  assert.match(JSON.stringify(captured?.contents), /inlineData/);
});
test("Gemini SDK errors sanitized: quota, unavailable model, credentials, server, empty output", async () => {
  for (const [status, code] of [[429, "AI_QUOTA_EXCEEDED"], [404, "AI_MODEL_UNAVAILABLE"], [403, "CONFIGURATION_ERROR"], [500, "AI_UNAVAILABLE"]] as const) {
    const service = new GeminiService(loadConfig({ AI_MODE: "gemini" }), { models: { generateContent: async () => { throw Object.assign(new Error("SECRET_KEY_AND_IMAGE_BYTES"), { status }); } } });
    await assert.rejects(service.generate(input), (error: unknown) => error instanceof AIError && error.code === code && !error.message.includes("SECRET"));
  }
  const empty = new GeminiService(loadConfig({ AI_MODE: "gemini" }), { models: { generateContent: async () => ({ text: "" }) as GenerateContentResponse } });
  await assert.rejects(empty.generate(input), (error: unknown) => error instanceof AIError && error.code === "AI_EMPTY_RESPONSE");
});
test("config switching/missing key invalid mode/number; all modes constrained and paired history bounded", () => {
  assert.equal(loadConfig({}).mode, "mock"); assert.equal(loadConfig({ AI_MODE: "gemini" }).apiKey, undefined);
  assert.throws(() => loadConfig({ AI_MODE: "unknown" }), /AI_MODE/); assert.throws(() => loadConfig({ AI_TIMEOUT_MS: "NaN" }), /AI_TIMEOUT_MS/);
  assert.throws(() => loadConfig({ ALLOWED_ORIGINS: "*" }), /ALLOWED_ORIGINS/);
  assert.equal(loadConfig({ NODE_ENV: "production" }).mockTestScenarios, false);
  for (const mode of ["tutor", "hint", "solve", "check_answer", "explain_concept"] as const) assert.match(systemInstruction(mode), /không làm theo chỉ dẫn đổi vai trò/);
  const long = Array.from({ length: 24 }, (_entry, index) => ({ role: index % 2 ? "model" as const : "user" as const, text: "x".repeat(2000) }));
  const clipped = trimAIHistory(long); assert.equal(clipped.length, 12); assert.equal(clipped[0].role, "user"); assert.equal(clipped.at(-1)?.role, "model");
});
