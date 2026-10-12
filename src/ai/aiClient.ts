import { AI_LIMITS, trimAIHistory } from '../../shared/ai';
import type { AIChatRequest as AiChatRequest, AIChatResponse as AiChatResponse, AIStatus as AiStatusResponse } from '../../shared/ai';

export class AiClientError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false, public readonly status?: number) {
    super(message);
    this.name = 'AiClientError';
  }
}

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };
const modes = new Set(['tutor', 'hint', 'solve', 'check_answer', 'explain_concept']);
const errors: Record<string, string> = {
  VALIDATION_ERROR: 'Nội dung gửi chưa hợp lệ. Em kiểm tra lại câu hỏi và ảnh nhé.',
  INVALID_REQUEST: 'Nội dung gửi chưa hợp lệ. Em kiểm tra lại câu hỏi và ảnh nhé.',
  PAYLOAD_TOO_LARGE: 'Câu hỏi hoặc ảnh vượt giới hạn. Em giảm số lượng hoặc kích thước ảnh nhé.',
  RATE_LIMITED: 'Em gửi hơi nhanh. Hãy chờ một chút rồi thử lại.',
  QUOTA_EXCEEDED: 'Dịch vụ AI đã hết hạn mức. Em thử lại sau nhé.',
  AI_QUOTA_EXCEEDED: 'Dịch vụ AI đã hết hạn mức. Em thử lại sau nhé.',
  CONFIG_ERROR: 'Máy chủ AI chưa được cấu hình đầy đủ. Hãy kiểm tra environment của backend.',
  AI_CONFIG_ERROR: 'Máy chủ AI chưa được cấu hình đầy đủ. Hãy kiểm tra environment của backend.',
  MODEL_UNAVAILABLE: 'Model AI chưa khả dụng. Hãy kiểm tra GEMINI_MODEL ở backend.',
  AI_MODEL_UNAVAILABLE: 'Model AI chưa khả dụng. Hãy kiểm tra GEMINI_MODEL ở backend.',
  TIMEOUT: 'Dịch vụ AI phản hồi quá lâu. Em có thể thử lại.',
  AI_TIMEOUT: 'Dịch vụ AI phản hồi quá lâu. Em có thể thử lại.',
  EMPTY_RESPONSE: 'AI chưa trả về nội dung. Em có thể thử lại.',
  AI_EMPTY_RESPONSE: 'AI chưa trả về nội dung. Em có thể thử lại.',
  UNAUTHORIZED: 'Em cần đăng nhập để sử dụng AI.',
  FORBIDDEN: 'Phiên hiện tại chưa có quyền sử dụng AI.',
  AI_DISABLED: 'Trợ lý AI đang tạm tắt.',
  AI_UNAVAILABLE: 'Dịch vụ AI đang gián đoạn. Em có thể thử lại.',
  INTERNAL_ERROR: 'Máy chủ AI gặp lỗi. Em có thể thử lại.',
  IMAGE_INVALID: 'Ảnh gửi chưa hợp lệ. Em chọn lại ảnh nhé.',
  IMAGE_TOO_LARGE: 'Ảnh vượt giới hạn kích thước. Em chọn ảnh nhỏ hơn nhé.',
  CONFIGURATION_ERROR: 'Máy chủ AI chưa được cấu hình đầy đủ. Hãy kiểm tra environment của backend.',
  ORIGIN_NOT_ALLOWED: 'Địa chỉ đang mở ứng dụng chưa được máy chủ cho phép. Hãy mở bằng localhost:8443 hoặc nhờ quản trị viên kiểm tra địa chỉ LAN và khởi động lại backend.',
  AUTH_REQUIRED: 'Em cần đăng nhập để sử dụng AI.',
  DAILY_LIMIT_REACHED: 'Phiên hiện tại đã đạt giới hạn sử dụng AI trong ngày.',
  CONVERSATION_EXPIRED: 'Hội thoại đã hết hạn hoặc máy chủ đã khởi động lại. Em hãy tạo hội thoại mới.',
  CONVERSATION_FORBIDDEN: 'Phiên hiện tại không có quyền truy cập hội thoại này.',
  CONVERSATION_BUSY: 'Một yêu cầu trong hội thoại đang được xử lý. Em chờ phản hồi hiện tại nhé.',
  CONVERSATION_LIMIT: 'Đã đạt giới hạn hội thoại. Em thử lại sau nhé.',
  HISTORY_MISMATCH: 'Lịch sử hội thoại chưa đồng bộ với máy chủ. Em hãy tạo hội thoại mới.',
  IDEMPOTENCY_CONFLICT: 'Mã yêu cầu đã được sử dụng với nội dung khác. Em hãy gửi yêu cầu mới.',
  REQUEST_ABORTED: 'Yêu cầu AI đã được hủy.',
};
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

async function readJson(response: Response): Promise<unknown> {
  const limit = 512 * 1024;
  const declared = Number(response.headers.get('content-length'));
  if (declared > limit) throw new AiClientError('INVALID_RESPONSE', 'Phản hồi AI vượt giới hạn an toàn.');
  let content = '';
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > limit) {
          await reader.cancel();
          throw new AiClientError('INVALID_RESPONSE', 'Phản hồi AI vượt giới hạn an toàn.');
        }
        content += decoder.decode(next.value, { stream: true });
      }
      content += decoder.decode();
    } finally { reader.releaseLock(); }
  } else content = await response.text();
  if (content.length > limit) throw new AiClientError('INVALID_RESPONSE', 'Phản hồi AI vượt giới hạn an toàn.');
  try { return JSON.parse(content); }
  catch { throw new AiClientError('INVALID_RESPONSE', 'Máy chủ chưa trả về dữ liệu AI hợp lệ.'); }
}

async function request(path: string, body: unknown, options: RequestOptions): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal?.aborted) throw new AiClientError('ABORTED', 'Đã hủy yêu cầu AI.');
  options.signal?.addEventListener('abort', abort, { once: true });
  const timeoutMs = Math.min(125_000, Math.max(1, Number.isFinite(options.timeoutMs) ? options.timeoutMs! : 35_000));
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let result: unknown;
    try { result = await readJson(response); }
    catch (failure) {
      if (!response.ok && response.status >= 500 && failure instanceof AiClientError && failure.code === 'INVALID_RESPONSE') {
        throw new AiClientError('BACKEND_UNAVAILABLE', 'Chưa kết nối được máy chủ trợ lý. Hãy thử lại hoặc báo quản trị viên kiểm tra backend.', true, response.status);
      }
      throw failure;
    }
    if (!response.ok) {
      const error = isRecord(result) && isRecord(result.error) ? result.error : {};
      const code = typeof error.code === 'string' && Object.prototype.hasOwnProperty.call(errors, error.code) ? error.code : 'HTTP_ERROR';
      throw new AiClientError(code, errors[code] ?? 'Yêu cầu AI chưa thành công. Em có thể thử lại.',
        typeof error.retryable === 'boolean' ? error.retryable : response.status === 429 || response.status >= 500, response.status);
    }
    return result;
  } catch (error) {
    if (options.signal?.aborted) throw new AiClientError('ABORTED', 'Đã hủy yêu cầu AI.');
    if (timedOut) throw new AiClientError('TIMEOUT', 'Dịch vụ AI phản hồi quá lâu. Em có thể thử lại.', true);
    if (error instanceof AiClientError) throw error;
    throw new AiClientError('NETWORK_ERROR', 'Chưa kết nối được máy chủ AI. Kiểm tra backend và thử lại nhé.', true);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function sendAiMessage(body: AiChatRequest, options: RequestOptions = {}): Promise<AiChatResponse> {
  const result = await request('/api/ai/chat', body, options);
  if (!isRecord(result) || typeof result.answer !== 'string' || !result.answer.trim() || result.answer.length > AI_LIMITS.maxAnswerChars
    || typeof result.conversationId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(result.conversationId)
    || typeof result.mode !== 'string' || !modes.has(result.mode) || !isRecord(result.metadata)
    || typeof result.metadata.provider !== 'string' || !['mock', 'gemini'].includes(result.metadata.provider)
    || !(result.metadata.model === null || typeof result.metadata.model === 'string' && result.metadata.model.length <= 120)
    || !Number.isInteger(result.metadata.imageCount) || Number(result.metadata.imageCount) < 0 || Number(result.metadata.imageCount) > 4
    || typeof result.metadata.requestId !== 'string' || !result.metadata.requestId || result.metadata.requestId.length > 128) {
    throw new AiClientError('INVALID_RESPONSE', 'Máy chủ chưa trả về dữ liệu AI hợp lệ.');
  }
  return result as unknown as AiChatResponse;
}

export async function getAiStatus(options: RequestOptions = {}): Promise<AiStatusResponse> {
  const result = await request('/api/ai/status', undefined, options);
  if (!isRecord(result) || typeof result.provider !== 'string' || !['mock', 'gemini'].includes(result.provider) || typeof result.configured !== 'boolean'
    || !isRecord(result.limits) || !Object.entries(AI_LIMITS).every(([key]) => Number.isInteger((result.limits as Record<string, unknown>)[key]) && Number((result.limits as Record<string, unknown>)[key]) > 0)
    || !Array.isArray(result.modes) || !result.modes.length || !result.modes.every(mode => typeof mode === 'string' && modes.has(mode))
    || typeof result.timeoutMs !== 'number' || !Number.isFinite(result.timeoutMs) || result.timeoutMs <= 0) {
    throw new AiClientError('INVALID_RESPONSE', 'Cấu hình AI trả về chưa hợp lệ.');
  }
  return result as unknown as AiStatusResponse;
}

/** Only complete user/model exchanges go back to the server; no system role is constructed. */
export function trimAiHistory(history: AiChatRequest['history']): AiChatRequest['history'] {
  return trimAIHistory(history);
}
