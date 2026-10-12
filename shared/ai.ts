export const TUTOR_MODES = ["tutor", "hint", "solve", "check_answer", "explain_concept"] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];
export type AIProviderName = "mock" | "gemini";
export type AIImageMime = "image/jpeg" | "image/png" | "image/webp";

export const AI_LIMITS = {
  maxMessageChars: 6000,
  maxHistoryMessages: 20,
  maxHistoryChars: 24000,
  maxImages: 4,
  maxImageBytes: 10 * 1024 * 1024,
  maxTotalImageBytes: 12 * 1024 * 1024,
  maxAnswerChars: 24000,
} as const;

export type AIHistoryMessage = { role: "user" | "model"; text: string };
export type AIImage = { mimeType: AIImageMime; data: string };
export type AIChatRequest = {
  message: string;
  conversationId?: string;
  clientMessageId: string;
  history: AIHistoryMessage[];
  images: AIImage[];
  mode: TutorMode;
};
export type AIChatResponse = {
  answer: string;
  conversationId: string;
  mode: TutorMode;
  metadata: {
    provider: AIProviderName;
    model: string | null;
    imageCount: number;
    requestId: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  };
};
export type AIStatus = {
  provider: AIProviderName;
  configured: boolean;
  limits: typeof AI_LIMITS;
  modes: readonly TutorMode[];
  timeoutMs: number;
};
export type AIErrorCode =
  | "VALIDATION_ERROR" | "IMAGE_INVALID" | "IMAGE_TOO_LARGE" | "PAYLOAD_TOO_LARGE"
  | "CONFIGURATION_ERROR" | "ORIGIN_NOT_ALLOWED" | "AUTH_REQUIRED" | "RATE_LIMITED"
  | "DAILY_LIMIT_REACHED" | "CONVERSATION_EXPIRED" | "CONVERSATION_FORBIDDEN"
  | "CONVERSATION_BUSY" | "CONVERSATION_LIMIT" | "HISTORY_MISMATCH"
  | "IDEMPOTENCY_CONFLICT" | "REQUEST_ABORTED" | "AI_TIMEOUT" | "AI_QUOTA_EXCEEDED"
  | "AI_MODEL_UNAVAILABLE" | "AI_UNAVAILABLE" | "AI_EMPTY_RESPONSE" | "INTERNAL_ERROR";
export type AIErrorResponse = {
  error: { code: AIErrorCode; message: string; retryable: boolean; requestId: string; fieldErrors?: Record<string, string> };
};

/** Canonical text retained for image-only turns; image bytes are never retained. */
export function historyUserText(message: string, imageCount: number): string {
  return message.trim() || (imageCount ? "[Đính kèm ảnh]" : "");
}

/** Keep only complete user/model pairs, within both server context budgets. */
export function trimAIHistory(history: readonly AIHistoryMessage[]): AIHistoryMessage[] {
  const result = history.map((entry) => ({ ...entry }));
  while (result.length > AI_LIMITS.maxHistoryMessages || result.reduce((sum, entry) => sum + entry.text.length, 0) > AI_LIMITS.maxHistoryChars) {
    result.splice(0, 2);
  }
  return result;
}
