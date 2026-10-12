import { AIError } from "../errors.js";
import type { AIProvider, ProviderRequest, ProviderResult } from "./provider.js";

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new AIError("REQUEST_ABORTED", "Yêu cầu đã được hủy.", 499, true)); return; }
    const abort = () => { clearTimeout(timer); reject(new AIError("REQUEST_ABORTED", "Yêu cầu đã được hủy.", 499, true)); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export class MockAIService implements AIProvider {
  readonly name = "mock" as const;
  readonly model = null;
  private failedTestIds = new Set<string>();
  constructor(private testScenarios: boolean, private delayMs = 350) {}
  async generate(request: ProviderRequest): Promise<ProviderResult> {
    if (this.testScenarios && request.message.trim() === "[mock:timeout]") await wait(130000, request.signal);
    await wait(this.delayMs, request.signal);
    if (this.testScenarios && request.message.trim() === "[mock:error]" && !this.failedTestIds.has(request.clientMessageId)) {
      this.failedTestIds.add(request.clientMessageId);
      if (this.failedTestIds.size > 1000) this.failedTestIds.delete(this.failedTestIds.values().next().value!);
      throw new AIError("AI_UNAVAILABLE", "Lỗi MOCK để kiểm thử. Bấm Thử lại với cùng tin nhắn sẽ thành công.", 503, true);
    }
    const label = "**DEMO · phản hồi mẫu từ backend local, không phải Gemini.**\n\n";
    if (request.images.length) return { answer: `${label}Đã tiếp nhận hợp lệ **${request.images.length} ảnh** JPEG/PNG/WebP và kiểm tra nội dung file. Ảnh chỉ xử lý tạm trong bộ nhớ.\n\n**Mock chưa nhận diện nội dung đề từ ảnh.** Bạn có thể nhập lại đề; cần bật Gemini để phân tích ảnh thật.` };
    const answers = {
      tutor: "Hãy bắt đầu từ điều bạn đã biết và xác định dữ kiện cần tìm.\n\nVí dụ minh họa: với $y=2x+1$, khi $x=3$ ta cần thay số nào vào biểu thức? Hãy thử tự tính trước rồi kiểm tra lại bằng phép thế.",
      hint: "**Gợi ý mẫu:** Nếu bài có dạng $ax+b=c$ với $a\\ne0$, hãy trừ $b$ ở hai vế trước. Bước tiếp theo nên làm gì để tách $x$?\n\nĐây là ví dụ minh họa, chưa phải lời giải riêng cho câu hỏi của bạn.",
      solve: "**Lời giải mẫu**, không suy luận tự động từ câu hỏi:\n\nGiải $2x+1=7$.\n\n1. Trừ $1$ ở hai vế: $2x=6$.\n2. Chia hai vế cho $2$: $x=3$.\n\n$$x=\\frac{7-1}{2}=3$$\n\nKiểm tra: $2\\cdot3+1=7$, thỏa mãn phương trình.",
      check_answer: "**Ví dụ kiểm tra mẫu:** Nếu phương trình là $2x+1=7$ và học sinh chọn $x=4$, phép thế cho $2\\cdot4+1=9\\ne7$. Vậy đáp án chưa đúng.\n\nHãy chuyển $1$ sang vế phải bằng cách trừ ở cả hai vế, rồi chia cho $2$. Mock chưa kiểm tra lời giải thực tế của bạn.",
      explain_concept: "**Khái niệm mẫu: hàm số bậc nhất**\n\n$$y=ax+b,\\qquad a\\ne0$$\n\n- $a$ là hệ số góc; $a>0$ thì hàm số tăng, $a<0$ thì giảm.\n- $b$ là tung độ giao điểm với trục $Oy$.\n- Ví dụ $y=2x+1$: tại $x=0$ có $y=1$.\n\nBạn hãy thử tính $y$ khi $x=2$ và kiểm tra lại.",
    };
    return { answer: label + answers[request.mode] + (request.history.length ? `\n\nHội thoại phiên này đang có ${request.history.length / 2} lượt trước đó trong context local.` : "") };
  }
}
