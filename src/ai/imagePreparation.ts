import type { AIImage as ApiImage } from '../../shared/ai';
import type { AttachedImage } from '../ImageComposer';
import { AiClientError } from './aiClient';

const MiB = 1024 * 1024;
const maxEdge = 2048;
const maxPixels = 40_000_000;
const targetBytes = 2 * MiB;

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new AiClientError('ABORTED', 'Đã hủy chuẩn bị ảnh.');
}

/** Read ordinary format headers before allocating a decoder bitmap, especially for oversized PNG scans. */
function headerDimensions(bytes: Uint8Array, mimeType: ApiImage['mimeType']): [number, number] | undefined {
  if (mimeType === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (mimeType === 'image/webp' && bytes.length >= 30) {
    const format = String.fromCharCode(...bytes.slice(12, 16));
    if (format === 'VP8X') return [1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)];
    if (format === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) return [(bytes[26] | bytes[27] << 8) & 0x3fff, (bytes[28] | bytes[29] << 8) & 0x3fff];
    if (format === 'VP8L' && bytes[20] === 0x2f) return [1 + (bytes[21] | (bytes[22] & 0x3f) << 8), 1 + (bytes[22] >> 6 | bytes[23] << 2 | (bytes[24] & 15) << 10)];
  }
  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xd8 || marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) continue;
      if (offset + 1 >= bytes.length) break;
      const length = bytes[offset] << 8 | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && length >= 7) {
        return [bytes[offset + 5] << 8 | bytes[offset + 6], bytes[offset + 3] << 8 | bytes[offset + 4]];
      }
      offset += length;
    }
  }
}

export function parseLocalImage(src: string): { image: ApiImage; bytes: Uint8Array } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  if (!match || match[2].length % 4 !== 0) throw new AiClientError('INVALID_IMAGE', 'Ảnh phải là JPEG, PNG hoặc WebP hợp lệ.');
  const byteLength = match[2].length / 4 * 3 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
  if (!byteLength || byteLength > 10 * MiB) throw new AiClientError('IMAGE_TOO_LARGE', 'Mỗi ảnh được phép tối đa 10 MiB.');
  const raw = atob(match[2]);
  const bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
  const mimeType = match[1] as ApiImage['mimeType'];
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(mimeType === 'image/jpeg' && jpeg || mimeType === 'image/png' && png || mimeType === 'image/webp' && webp)) {
    throw new AiClientError('INVALID_IMAGE', 'Nội dung ảnh không khớp định dạng. Em chọn lại ảnh nhé.');
  }
  const dimensions = headerDimensions(bytes, mimeType);
  if (dimensions && (!dimensions[0] || !dimensions[1] || dimensions[0] * dimensions[1] > maxPixels)) {
    throw new AiClientError('IMAGE_DIMENSIONS_TOO_LARGE', 'Ảnh có quá nhiều điểm ảnh. Em chọn ảnh nhỏ hơn 40 megapixel nhé.');
  }
  return { image: { mimeType, data: match[2] }, bytes };
}

async function decode(blob: Blob, signal?: AbortSignal): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  checkAbort(signal);
  if (typeof createImageBitmap === 'function') {
    return new Promise((resolve, reject) => {
      let settled = false;
      const clean = () => signal?.removeEventListener('abort', abort);
      const abort = () => { if (settled) return; settled = true; clean(); reject(new AiClientError('ABORTED', 'Đã hủy chuẩn bị ảnh.')); };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      // createImageBitmap itself is not cancellable; dispose its eventual result after an immediate abort.
      void Promise.resolve().then(() => { checkAbort(signal); return createImageBitmap(blob); }).then(bitmap => {
        if (settled || signal?.aborted) { bitmap.close(); abort(); return; }
        settled = true; clean();
        resolve({ source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() });
      }, error => {
        if (settled) return;
        settled = true; clean();
        reject(error instanceof AiClientError ? error : new AiClientError('INVALID_IMAGE', 'Không giải mã được ảnh. Em chọn lại ảnh nhé.'));
      });
    });
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const clean = () => { image.onload = null; image.onerror = null; signal?.removeEventListener('abort', abort); URL.revokeObjectURL(url); };
    const abort = () => { image.src = ''; clean(); reject(new AiClientError('ABORTED', 'Đã hủy chuẩn bị ảnh.')); };
    signal?.addEventListener('abort', abort, { once: true });
    image.onload = () => { clean(); resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ''; } }); };
    image.onerror = () => { clean(); reject(new AiClientError('INVALID_IMAGE', 'Không giải mã được ảnh. Em chọn lại ảnh nhé.')); };
    image.src = url;
  });
}

async function encode(canvas: HTMLCanvasElement, quality: number, signal?: AbortSignal): Promise<Blob> {
  checkAbort(signal);
  const result = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  checkAbort(signal);
  if (result && (result.type === 'image/webp' || result.type === 'image/jpeg')) return result;
  // Some browsers cannot encode WebP. A white background keeps transparent math scans legible in JPEG.
  const context = canvas.getContext('2d');
  if (!context) throw new AiClientError('IMAGE_PROCESSING_ERROR', 'Trình duyệt chưa xử lý được ảnh này.');
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'source-over';
  const fallback = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  checkAbort(signal);
  if (!fallback || fallback.type !== 'image/jpeg') throw new AiClientError('IMAGE_PROCESSING_ERROR', 'Trình duyệt chưa xử lý được ảnh này.');
  return fallback;
}

async function prepareOne(src: string, signal?: AbortSignal): Promise<ApiImage> {
  checkAbort(signal);
  const parsed = parseLocalImage(src);
  const bitmap = await decode(new Blob([parsed.bytes.buffer as ArrayBuffer], { type: parsed.image.mimeType }), signal);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > maxPixels) {
      throw new AiClientError('IMAGE_DIMENSIONS_TOO_LARGE', 'Ảnh có quá nhiều điểm ảnh. Em chọn ảnh nhỏ hơn 40 megapixel nhé.');
    }
    if (Math.max(bitmap.width, bitmap.height) <= maxEdge && parsed.bytes.byteLength <= targetBytes) return parsed.image;
    const canvas = document.createElement('canvas');
    let scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        checkAbort(signal);
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new AiClientError('IMAGE_PROCESSING_ERROR', 'Trình duyệt chưa xử lý được ảnh này.');
        context.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);
        const compressed = await encode(canvas, Math.max(.62, .9 - attempt * .07), signal);
        if (compressed.size <= targetBytes) {
          const bytes = new Uint8Array(await compressed.arrayBuffer());
          checkAbort(signal);
          let binary = '';
          for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
          return { mimeType: compressed.type as ApiImage['mimeType'], data: btoa(binary) };
        }
        scale *= .8;
      }
    } finally { canvas.width = 0; canvas.height = 0; }
    throw new AiClientError('IMAGE_TOO_LARGE', 'Chưa tối ưu được ảnh dưới 2 MiB. Em chọn ảnh nhỏ hơn nhé.');
  } catch (error) {
    if (error instanceof AiClientError) throw error;
    throw new AiClientError('IMAGE_PROCESSING_ERROR', 'Chưa xử lý được ảnh. Em chọn lại ảnh nhé.');
  } finally { bitmap.close(); }
}

/** Prepares only the request payload. The composer's original local previews remain untouched. */
export async function prepareAiImages(images: readonly Pick<AttachedImage, 'src' | 'name'>[], signal?: AbortSignal): Promise<ApiImage[]> {
  checkAbort(signal);
  if (images.length > 4) throw new AiClientError('TOO_MANY_IMAGES', 'Mỗi câu hỏi được phép tối đa 4 ảnh.');
  const result: ApiImage[] = [];
  let total = 0;
  // Decode sequentially to bound peak mobile memory, rather than retaining four decoded images at once.
  for (const image of images) {
    const prepared = await prepareOne(image.src, signal);
    total += prepared.data.length / 4 * 3 - (prepared.data.endsWith('==') ? 2 : prepared.data.endsWith('=') ? 1 : 0);
    if (total > 12 * MiB) throw new AiClientError('PAYLOAD_TOO_LARGE', 'Tổng kích thước ảnh được phép tối đa 12 MiB.');
    result.push(prepared);
  }
  return result;
}
