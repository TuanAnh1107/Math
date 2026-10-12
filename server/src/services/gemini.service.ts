import { GoogleGenAI, type Content, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { AI_LIMITS, historyUserText } from "../../../shared/ai.js";
import type { AIConfig } from "../config/env.js";
import { AIError, providerError } from "../errors.js";
import { systemInstruction } from "../prompts/math-mentor.js";
import type { AIProvider, ProviderRequest, ProviderResult } from "./provider.js";
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com';

export interface GeminiSDK {
  models: { generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse> };
}
export class GeminiService implements AIProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private readonly sdk: GeminiSDK;
  constructor(private config: AIConfig, sdk?: GeminiSDK) {
    this.model = config.model;
    if (!config.apiKey && !sdk) throw new AIError("CONFIGURATION_ERROR", "AI_MODE=gemini yêu cầu GEMINI_API_KEY phía backend.", 503);
    this.sdk = sdk ?? new GoogleGenAI({ apiKey: config.apiKey!, vertexai: false, httpOptions: { baseUrl: GEMINI_ENDPOINT, timeout: config.timeoutMs, retryOptions: { attempts: 1 } } });
  }
  async generate(request: ProviderRequest): Promise<ProviderResult> {
    try {
      const contents: Content[] = request.history.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] }));
      contents.push({ role: "user", parts: [{ text: historyUserText(request.message, request.images.length) }, ...request.images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } }))] });
      const response = await this.sdk.models.generateContent({
        model: this.model, contents,
        config: {
          systemInstruction: systemInstruction(request.mode),
          abortSignal: request.signal,
          maxOutputTokens: this.config.maxOutputTokens,
          httpOptions: { baseUrl: GEMINI_ENDPOINT, timeout: this.config.timeoutMs, retryOptions: { attempts: 1 } },
        },
      });
      const answer = response.text?.trim();
      if (!answer) throw new AIError("AI_EMPTY_RESPONSE", "AI chưa trả lời được nội dung này. Thử nhập lại đề rõ hơn.", 502, true);
      if (answer.length > AI_LIMITS.maxAnswerChars) throw new AIError("AI_UNAVAILABLE", "Phản hồi vượt giới hạn. Hãy chia câu hỏi thành phần nhỏ hơn.", 502);
      const usage = response.usageMetadata;
      const count = (value: unknown): number | undefined => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
      return { answer, ...(usage ? { usage: { inputTokens: count(usage.promptTokenCount), outputTokens: count(usage.candidatesTokenCount), totalTokens: count(usage.totalTokenCount) } } : {}) };
    } catch (error) { throw providerError(error); }
  }
}
