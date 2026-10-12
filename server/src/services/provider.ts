import type { AIHistoryMessage, AIProviderName, TutorMode, AIChatResponse } from "../../../shared/ai.js";
import type { DecodedImage } from "../schemas/chat.js";
export type ProviderRequest = {
  message: string; mode: TutorMode; history: readonly AIHistoryMessage[];
  images: readonly DecodedImage[]; clientMessageId: string; signal: AbortSignal;
};
export type ProviderResult = { answer: string; usage?: AIChatResponse["metadata"]["usage"] };
export interface AIProvider {
  readonly name: AIProviderName;
  readonly model: string | null;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}
