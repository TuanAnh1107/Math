import { parseAllowedOrigins } from './origins.js';

export type AIConfig = {
  mode: "mock" | "gemini"; apiKey?: string; model: string;
  host: string; port: number; production: boolean; allowedOrigins: string[];
  timeoutMs: number; rateLimitPerMinute: number; userDailyLimit: number;
  userMaxConcurrent: number; maxConcurrentRequests: number; maxOutputTokens: number; mockTestScenarios: boolean;
};

function integer(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid server configuration: ${key}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AIConfig {
  const mode = env.AI_MODE || "mock";
  if (mode !== "mock" && mode !== "gemini") throw new Error("Invalid server configuration: AI_MODE");
  const model = env.GEMINI_MODEL || "gemini-3.8-flash";
  if (!/^[a-z0-9][a-z0-9._-]{1,99}$/i.test(model)) throw new Error("Invalid server configuration: GEMINI_MODEL");
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  return {
    mode, model, apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    host: env.HOST || "127.0.0.1", port: integer(env, "PORT", 3001, 1, 65535),
    production: env.NODE_ENV === "production", allowedOrigins,
    timeoutMs: integer(env, "AI_TIMEOUT_MS", 30000, 1000, 120000),
    rateLimitPerMinute: integer(env, "AI_RATE_LIMIT_PER_MINUTE", 30, 1, 1000),
    userDailyLimit: integer(env, "AI_USER_DAILY_LIMIT", 100, 1, 10000),
    userMaxConcurrent: integer(env, "AI_USER_MAX_CONCURRENT", 2, 1, 10),
    maxConcurrentRequests: integer(env, "AI_MAX_CONCURRENT_REQUESTS", 8, 1, 64),
    maxOutputTokens: integer(env, "AI_MAX_OUTPUT_TOKENS", 4096, 256, 8192),
    mockTestScenarios: env.MOCK_TEST_SCENARIOS !== "false" && env.NODE_ENV !== "production",
  };
}
