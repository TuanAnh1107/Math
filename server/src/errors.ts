import type { AIErrorCode, AIErrorResponse } from "../../shared/ai.js";

export class AIError extends Error {
  providerDiagnostic?: { category: 'http' | 'network' | 'timeout' | 'unknown'; upstreamStatus?: number; networkCode?: string };
  constructor(public code: AIErrorCode, message: string, public status = 400, public retryable = false, public fieldErrors?: Record<string, string>) { super(message); }
}
export function publicError(error: unknown, requestId: string): { status: number; body: AIErrorResponse } {
  if (error instanceof AIError) return { status: error.status, body: { error: { code: error.code, message: error.message, retryable: error.retryable, requestId, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) } } };
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.", retryable: true, requestId } } };
}
export function providerError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  const value = error as { status?: number; statusCode?: number; name?: string; cause?: { code?: string }; code?: string } | null;
  const rawStatus = value?.status ?? value?.statusCode;
  const status = Number.isInteger(rawStatus) && rawStatus! >= 400 && rawStatus! <= 599 ? rawStatus : undefined;
  const knownNetworkCodes = ['ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN'];
  const rawCode = value?.cause?.code ?? value?.code;
  const networkCode = rawCode && knownNetworkCodes.includes(rawCode) ? rawCode : undefined;
  const mapped = (failure: AIError) => {
    failure.providerDiagnostic = { category: status ? 'http' : value?.name === 'AbortError' || value?.name === 'TimeoutError' ? 'timeout' : networkCode ? 'network' : 'unknown', ...(status ? { upstreamStatus: status } : {}), ...(networkCode ? { networkCode } : {}) };
    return failure;
  };
  if (value?.name === "AbortError" || value?.name === "TimeoutError") return mapped(new AIError("AI_TIMEOUT", "Yêu cầu AI đã quá thời gian chờ. Bạn có thể thử lại.", 504, true));
  if (status === 429) return mapped(new AIError("AI_QUOTA_EXCEEDED", "Dịch vụ AI đang vượt hạn mức. Vui lòng thử lại sau.", 429, true));
  if (status === 404) return mapped(new AIError("AI_MODEL_UNAVAILABLE", "Model AI đã cấu hình không khả dụng. Liên hệ quản trị viên.", 503));
  if (status === 400) return mapped(new AIError("AI_UNAVAILABLE", "Dịch vụ AI không chấp nhận yêu cầu này. Kiểm tra nội dung hoặc cấu hình model.", 502));
  if (status === 401 || status === 403) return mapped(new AIError("CONFIGURATION_ERROR", "Dịch vụ Gemini chưa được cấp quyền hợp lệ. Liên hệ quản trị viên.", 503));
  return mapped(new AIError("AI_UNAVAILABLE", "Dịch vụ AI tạm thời không khả dụng. Bạn có thể thử lại.", 503, true));
}
