import { createHash } from "node:crypto";
import type { AIChatRequest } from "../../../shared/ai.js";

/** Canonical field ordering and length-delimited images prevent ambiguous retries. */
export function requestFingerprint(request: AIChatRequest): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ message: request.message, mode: request.mode, conversationId: request.conversationId, clientMessageId: request.clientMessageId, history: request.history.map((entry) => ({ role: entry.role, text: entry.text })), images: request.images.map((image) => ({ mimeType: image.mimeType })) }));
  for (const image of request.images) { hash.update(String(image.data.length)); hash.update(":"); hash.update(image.data); }
  return hash.digest("hex");
}
