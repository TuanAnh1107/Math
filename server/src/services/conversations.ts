import { randomUUID } from "node:crypto";
import { AI_LIMITS, historyUserText, trimAIHistory, type AIChatRequest, type AIChatResponse, type AIHistoryMessage } from "../../../shared/ai.js";
import { AIError } from "../errors.js";
import { decodeImages } from "../schemas/chat.js";
import { requestFingerprint } from "../schemas/fingerprint.js";
import type { AIProvider } from "./provider.js";
import { UsageLimits } from "../middleware/limits.js";

type Conversation = { id: string; owner: string; history: AIHistoryMessage[]; expiresAt: number; busy: boolean };
type CachedReply = { fingerprint: string; response: AIChatResponse; expiresAt: number };
type Inflight = { fingerprint: string; promise: Promise<AIChatResponse> };
function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new AIError("REQUEST_ABORTED", "Yêu cầu đã được hủy.", 499, true)); };
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** Ephemeral context only. Images and secrets are never persisted or logged. */
export class ConversationService {
  private conversations = new Map<string, Conversation>();
  private replies = new Map<string, CachedReply>();
  private inflight = new Map<string, Inflight>();
  constructor(private provider: AIProvider, private limits: UsageLimits, private daily: number, private concurrent: number, private now: () => number = Date.now, private ttlMs = 30 * 60 * 1000) {}
  private cleanup(): void {
    for (const [id, conversation] of this.conversations) if (!conversation.busy && conversation.expiresAt <= this.now()) this.conversations.delete(id);
    for (const [id, reply] of this.replies) if (reply.expiresAt <= this.now()) this.replies.delete(id);
  }
  chat(request: AIChatRequest, owner: string, signal: AbortSignal, requestId: string, dailyLimit = this.daily): Promise<AIChatResponse> {
    this.cleanup();
    const key = `${owner}:${request.clientMessageId}`;
    const digest = requestFingerprint(request);
    const cached = this.replies.get(key);
    const pending = this.inflight.get(key);
    if (cached || pending) {
      if ((cached ?? pending)!.fingerprint !== digest) return Promise.reject(new AIError("IDEMPOTENCY_CONFLICT", "Mã tin nhắn đã dùng với nội dung khác. Tạo tin nhắn mới.", 409));
      return cached ? Promise.resolve(cached.response) : pending!.promise;
    }
    if (this.replies.size + this.inflight.size >= 1500) return Promise.reject(new AIError("RATE_LIMITED", "Bộ nhớ phiên đang đầy. Vui lòng thử lại khi phiên cũ hết hạn.", 429, true));
    const promise = this.perform(request, owner, signal, requestId, dailyLimit).then((response) => {
      this.replies.set(key, { fingerprint: digest, response, expiresAt: this.now() + this.ttlMs });
      return response;
    }).finally(() => { this.inflight.delete(key); });
    this.inflight.set(key, { fingerprint: digest, promise });
    return promise;
  }
  private async perform(request: AIChatRequest, owner: string, signal: AbortSignal, requestId: string, dailyLimit: number): Promise<AIChatResponse> {
    let conversation: Conversation;
    const isNew = !request.conversationId;
    if (request.conversationId) {
      const existing = this.conversations.get(request.conversationId);
      if (!existing) throw new AIError("CONVERSATION_EXPIRED", "Hội thoại đã hết phiên hoặc backend đã khởi động lại. Tạo hội thoại mới.", 409);
      if (existing.owner !== owner) throw new AIError("CONVERSATION_FORBIDDEN", "Bạn không có quyền truy cập hội thoại này.", 403);
      conversation = existing;
    } else {
      if (this.conversations.size >= 500 || [...this.conversations.values()].filter((entry) => entry.owner === owner).length >= 3) throw new AIError("CONVERSATION_LIMIT", "Đã đạt giới hạn 3 hội thoại trong phiên. Vui lòng đợi phiên cũ hết hạn.", 429, true);
      conversation = { id: randomUUID(), owner, history: [], expiresAt: this.now() + this.ttlMs, busy: false };
    }
    if (conversation.busy) throw new AIError("CONVERSATION_BUSY", "Hội thoại đang xử lý một câu hỏi. Vui lòng đợi.", 409, true);
    if (request.history.length !== conversation.history.length || request.history.some((entry, index) => entry.role !== conversation.history[index].role || entry.text !== conversation.history[index].text)) throw new AIError("HISTORY_MISMATCH", "Lịch sử không khớp phiên máy chủ. Tạo hội thoại mới hoặc gửi lại context đã xác nhận.", 409);
    const release = this.limits.begin(owner, dailyLimit, this.concurrent);
    conversation.busy = true;
    if (isNew) this.conversations.set(conversation.id, conversation);
    try {
      const { images, result } = await abortable((async () => {
        const images = await decodeImages(request.images, signal);
        if (signal.aborted) throw new AIError("REQUEST_ABORTED", "Yêu cầu đã được hủy.", 499, true);
        const result = await this.provider.generate({ message: request.message, mode: request.mode, history: conversation.history, images, signal, clientMessageId: request.clientMessageId });
        return { images, result };
      })(), signal);
      if (signal.aborted) throw new AIError("REQUEST_ABORTED", "Yêu cầu đã được hủy.", 499, true);
      if (!result.answer.trim() || result.answer.length > AI_LIMITS.maxAnswerChars) throw new AIError("AI_EMPTY_RESPONSE", "Phản hồi AI trống hoặc vượt giới hạn.", 502, true);
      const response: AIChatResponse = { answer: result.answer, conversationId: conversation.id, mode: request.mode, metadata: { provider: this.provider.name, model: this.provider.model, imageCount: images.length, requestId, ...(result.usage ? { usage: result.usage } : {}) } };
      conversation.history = trimAIHistory([...conversation.history, { role: "user", text: historyUserText(request.message, images.length) }, { role: "model", text: result.answer }]);
      conversation.expiresAt = this.now() + this.ttlMs;
      return response;
    } catch (error) {
      if (isNew) this.conversations.delete(conversation.id);
      throw error;
    } finally { conversation.busy = false; release(); }
  }
}
