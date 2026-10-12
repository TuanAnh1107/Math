import express, { type Request, type RequestHandler } from "express";
import { createHash, randomUUID } from "node:crypto";
import { AI_LIMITS, TUTOR_MODES, type AIStatus } from "../../shared/ai.js";
import type { AIConfig } from "./config/env.js";
import { AIError, publicError } from "./errors.js";
import { UsageLimits } from "./middleware/limits.js";
import { validateChat } from "./schemas/chat.js";
import { ConversationService } from "./services/conversations.js";
import { GeminiService } from "./services/gemini.service.js";
import { MockAIService } from "./services/mock-ai.service.js";
import type { AIProvider } from "./services/provider.js";
import { normalizeOrigin } from './config/origins.js';

export type AuthIdentity = { userId: string; aiEnabled?: boolean; dailyLimit?: number };
/** Backend teammate supplies a verified session/JWT resolver. Never trust a frontend user-ID header. */
export type Authenticate = (request: Request) => Promise<AuthIdentity | null>;
export type AppDependencies = { authenticate?: Authenticate; provider?: AIProvider; now?: () => number };

export function createApp(config: AIConfig, dependencies: AppDependencies = {}) {
  if (config.production && !dependencies.authenticate) throw new Error("Production AI server requires a verified authentication integration. Supply createApp(config, { authenticate }).");
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  const limits = new UsageLimits(dependencies.now);
  const provider = dependencies.provider ?? (config.mode === "mock" ? new MockAIService(config.mockTestScenarios) : config.apiKey ? new GeminiService(config) : {
    name: "gemini" as const, model: config.model,
    generate: async () => { throw new AIError("CONFIGURATION_ERROR", "AI_MODE=gemini yêu cầu GEMINI_API_KEY trong môi trường backend. Không chuyển sang mock tự động.", 503); },
  });
  const conversations = new ConversationService(provider, limits, config.userDailyLimit, config.userMaxConcurrent, dependencies.now);
  const developmentSalt = randomUUID();
  let activeHttpRequests = 0;
  const status: AIStatus = { provider: config.mode, configured: config.mode === "mock" || Boolean(config.apiKey), limits: AI_LIMITS, modes: TUTOR_MODES, timeoutMs: config.timeoutMs };
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-ID', res.locals.requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');
    const normalizedOrigin = typeof origin === 'string' ? normalizeOrigin(origin) : null;
    if (origin !== undefined && (!normalizedOrigin || !config.allowedOrigins.includes(normalizedOrigin))) {
      res.removeHeader('Access-Control-Allow-Origin'); res.removeHeader('Access-Control-Allow-Credentials');
      next(new AIError("ORIGIN_NOT_ALLOWED", "Nguồn truy cập không được phép.", 403)); return;
    }
    if (origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Access-Control-Allow-Credentials", "true"); }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") {
      const method = req.headers['access-control-request-method'];
      const headers = req.headers['access-control-request-headers'];
      if (method && !['GET', 'POST'].includes(String(method)) || headers && String(headers).split(',').some(header => !['content-type', 'authorization'].includes(header.trim().toLowerCase()))) {
        next(new AIError('VALIDATION_ERROR', 'CORS preflight yêu cầu method hoặc header không được hỗ trợ.', 400)); return;
      }
      res.status(204).end(); return;
    }
    next();
  });
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "math-mentor-ai" }));
  app.get("/api/ai/status", (_req, res) => res.json(status));
  const guard: RequestHandler = async (req, res, next) => {
    try {
      // Both socket-IP and verified user controls run before reading large JSON bodies.
      const ip = req.socket.remoteAddress || "unknown";
      limits.ip(ip, config.rateLimitPerMinute);
      if (activeHttpRequests >= config.maxConcurrentRequests) throw new AIError("RATE_LIMITED", "Máy chủ đang xử lý nhiều yêu cầu. Vui lòng thử lại sau.", 429, true);
      activeHttpRequests++;
      let released = false;
      const release = () => { if (released) return; released = true; activeHttpRequests--; res.off("finish", release); res.off("close", release); };
      res.on("finish", release); res.on("close", release);
      if (dependencies.authenticate) {
        let authTimeout: ReturnType<typeof setTimeout> | undefined;
        let identity: AuthIdentity | null;
        try {
          identity = await Promise.race([dependencies.authenticate(req), new Promise<never>((_resolve, reject) => {
            authTimeout = setTimeout(() => reject(new AIError("AUTH_REQUIRED", "Không xác minh được phiên đăng nhập trong thời gian cho phép. Vui lòng thử lại.", 503, true)), 5000);
          })]);
        } finally { if (authTimeout) clearTimeout(authTimeout); }
        if (res.destroyed) return;
        if (!identity || !identity.userId || identity.userId.length > 160 || identity.aiEnabled === false) throw new AIError("AUTH_REQUIRED", "Phiên đăng nhập chưa hợp lệ hoặc tài khoản chưa được phép sử dụng AI.", 401);
        res.locals.owner = `user:${identity.userId}`;
        res.locals.dailyLimit = typeof identity.dailyLimit === "number" && Number.isInteger(identity.dailyLimit) && identity.dailyLimit >= 1 && identity.dailyLimit <= 10000 ? identity.dailyLimit : config.userDailyLimit;
      } else res.locals.owner = `dev-ip:${createHash("sha256").update(developmentSalt + ip).digest("hex")}`;
      limits.user(res.locals.owner, config.rateLimitPerMinute);
      next();
    } catch (error) { next(error); }
  };
  app.post("/api/ai/chat", guard, express.json({ limit: "18mb", strict: true, type: "application/json" }), async (req, res, next) => {
    const controller = new AbortController();
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    req.on("aborted", disconnect); res.on("close", disconnect);
    try {
      const request = validateChat(req.body);
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => { timedOut = true; controller.abort(); reject(new AIError("AI_TIMEOUT", "Yêu cầu AI đã quá thời gian chờ. Bạn có thể thử lại.", 504, true)); }, config.timeoutMs);
      });
      const response = await Promise.race([conversations.chat(request, res.locals.owner, controller.signal, res.locals.requestId, res.locals.dailyLimit ?? config.userDailyLimit), timeoutPromise]);
      if (!res.destroyed) res.json(response);
    } catch (error) {
      if (!res.destroyed) next(timedOut ? new AIError("AI_TIMEOUT", "Yêu cầu AI đã quá thời gian chờ. Bạn có thể thử lại.", 504, true) : error);
    } finally { if (timeout) clearTimeout(timeout); req.off("aborted", disconnect); res.off("close", disconnect); }
  });
  app.use((_req, _res, next) => next(new AIError("VALIDATION_ERROR", "Endpoint không tồn tại.", 404)));
  app.use((error: unknown, _req: Request, res: express.Response, _next: express.NextFunction) => {
    const bodyParserError = error as { type?: string; status?: number } | null;
    const sanitized = bodyParserError?.type === "entity.too.large" ? new AIError("PAYLOAD_TOO_LARGE", "Yêu cầu vượt giới hạn 18 MiB. Giảm kích thước ảnh.", 413)
      : bodyParserError?.type === "entity.parse.failed" ? new AIError("VALIDATION_ERROR", "JSON không hợp lệ.", 400) : error;
    const result = publicError(sanitized, res.locals.requestId || randomUUID());
    if (sanitized instanceof AIError && sanitized.providerDiagnostic) {
      console.warn(JSON.stringify({ event: 'ai.provider.error', requestId: res.locals.requestId, code: sanitized.code, ...sanitized.providerDiagnostic }));
    }
    if (result.status === 429) res.setHeader("Retry-After", "60");
    res.status(result.status).json(result.body);
  });
  return app;
}
