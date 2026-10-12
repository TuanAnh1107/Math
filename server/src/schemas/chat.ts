import sharp from "sharp";
import { AI_LIMITS, TUTOR_MODES, type AIChatRequest, type AIImageMime } from "../../../shared/ai.js";
import { AIError } from "../errors.js";

// Avoid retaining decoded image operations in libvips cache; bound CPU threads.
sharp.cache(false);
sharp.concurrency(2);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mimeFormats: Record<AIImageMime, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function fail(field: string, message: string): never { throw new AIError("VALIDATION_ERROR", message, 422, false, { [field]: message }); }
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail(field, "Yêu cầu chứa trường không được hỗ trợ.");
}
export function validateChat(body: unknown): AIChatRequest {
  if (!object(body)) fail("request", "Yêu cầu phải là một đối tượng JSON.");
  exactKeys(body, ["message", "conversationId", "clientMessageId", "history", "images", "mode"], "request");
  if (typeof body.message !== "string" || body.message.length > AI_LIMITS.maxMessageChars) fail("message", `Câu hỏi tối đa ${AI_LIMITS.maxMessageChars} ký tự.`);
  if (typeof body.clientMessageId !== "string" || !uuid.test(body.clientMessageId)) fail("clientMessageId", "Mã tin nhắn phải là UUID hợp lệ.");
  if (body.conversationId !== undefined && (typeof body.conversationId !== "string" || !uuid.test(body.conversationId))) fail("conversationId", "Mã hội thoại phải là UUID hợp lệ.");
  if (!TUTOR_MODES.includes(body.mode as AIChatRequest["mode"])) fail("mode", "Chế độ gia sư không hợp lệ.");
  if (!Array.isArray(body.history) || body.history.length > AI_LIMITS.maxHistoryMessages || body.history.length % 2) fail("history", "Lịch sử phải gồm các cặp user/model, tối đa 20 tin nhắn.");
  let historyChars = 0;
  for (const [index, entry] of body.history.entries()) {
    if (!object(entry)) fail("history", "Tin nhắn lịch sử không hợp lệ.");
    exactKeys(entry, ["role", "text"], "history");
    if (entry.role !== (index % 2 ? "model" : "user") || typeof entry.text !== "string" || !entry.text.trim() || entry.text.length > AI_LIMITS.maxAnswerChars) fail("history", "Lịch sử chỉ hỗ trợ cặp user/model có nội dung, không có system role.");
    historyChars += entry.text.length;
  }
  if (historyChars > AI_LIMITS.maxHistoryChars) fail("history", "Lịch sử vượt giới hạn 24000 ký tự.");
  if (!Array.isArray(body.images) || body.images.length > AI_LIMITS.maxImages) fail("images", "Mỗi tin nhắn tối đa 4 ảnh.");
  let totalBytes = 0;
  for (const image of body.images) {
    if (!object(image)) fail("images", "Ảnh không hợp lệ.");
    exactKeys(image, ["mimeType", "data"], "images");
    if (typeof image.mimeType !== "string" || !Object.hasOwn(mimeFormats, image.mimeType)) throw new AIError("IMAGE_INVALID", "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.", 422);
    if (typeof image.data !== "string" || !image.data.length) throw new AIError("IMAGE_INVALID", "Dữ liệu ảnh bị trống.", 422);
    if (image.data.length > Math.ceil(AI_LIMITS.maxImageBytes / 3) * 4) throw new AIError("IMAGE_TOO_LARGE", "Mỗi ảnh tối đa 10 MiB.", 413);
    if (image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) throw new AIError("IMAGE_INVALID", "Dữ liệu ảnh phải là base64 hợp lệ, không kèm data URL.", 422);
    const bytes = image.data.length / 4 * 3 - (image.data.endsWith("==") ? 2 : image.data.endsWith("=") ? 1 : 0);
    if (bytes > AI_LIMITS.maxImageBytes) throw new AIError("IMAGE_TOO_LARGE", "Mỗi ảnh tối đa 10 MiB.", 413);
    totalBytes += bytes;
  }
  if (totalBytes > AI_LIMITS.maxTotalImageBytes) throw new AIError("IMAGE_TOO_LARGE", "Tổng ảnh mỗi yêu cầu tối đa 12 MiB.", 413);
  if (!body.message.trim() && !body.images.length) fail("message", "Nhập câu hỏi hoặc chọn ít nhất một ảnh.");
  return body as AIChatRequest;
}

export type DecodedImage = { mimeType: AIImageMime; data: string };
export async function decodeImages(images: AIChatRequest["images"], signal: AbortSignal): Promise<DecodedImage[]> {
  const normalized: DecodedImage[] = [];
  for (const image of images) {
    if (signal.aborted) throw new AIError("REQUEST_ABORTED", "Yêu cầu đã được hủy.", 499, true);
    const bytes = Buffer.from(image.data, "base64");
    const detected = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpeg"
        : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "webp" : undefined;
    if (detected !== mimeFormats[image.mimeType]) throw new AIError("IMAGE_INVALID", "Nội dung ảnh không khớp định dạng đã khai báo.", 422);
    try {
      const options = { failOn: "warning" as const, limitInputPixels: 24_000_000 };
      const metadata = await sharp(bytes, options).metadata();
      if (metadata.format !== detected || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error("Invalid image");
      let output = await sharp(bytes, options).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      if (output.length > 2 * 1024 * 1024) output = await sharp(bytes, options).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
      if (output.length > 2 * 1024 * 1024) throw new AIError("IMAGE_TOO_LARGE", "Ảnh chưa tối ưu được dưới 2 MiB để gửi AI. Chụp vùng đề nhỏ hơn.", 413);
      if (signal.aborted) throw new AIError("REQUEST_ABORTED", "Yêu cầu đã được hủy.", 499, true);
      normalized.push({ mimeType: "image/webp", data: output.toString("base64") });
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError("IMAGE_INVALID", "Ảnh bị hỏng, quá nhiều điểm ảnh hoặc là ảnh động. Chọn ảnh tĩnh hợp lệ.", 422);
    }
  }
  return normalized;
}
