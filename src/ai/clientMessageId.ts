import { AiClientError } from './aiClient';

/** randomUUID may be absent in older browsers or outside a secure context. */
export default function createClientMessageId(source: Crypto | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === 'function') {
    try { return source.randomUUID(); } catch { /* Try the secure random-byte API below. */ }
  }
  if (typeof source?.getRandomValues === 'function') {
    try {
      const bytes = source.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch { /* Do not substitute an insecure Math.random identifier. */ }
  }
  throw new AiClientError('CLIENT_ID_UNAVAILABLE', 'Trình duyệt chưa tạo được mã yêu cầu an toàn. Hãy cập nhật trình duyệt hoặc mở ứng dụng bằng localhost/HTTPS rồi thử lại.', true);
}
