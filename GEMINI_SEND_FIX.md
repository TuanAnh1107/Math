# Math Mentor — Sửa lỗi gửi AI Tutor

**Ngày:** 12/10/2026. **Phạm vi:** tạo ID và xử lý lỗi trước khi gửi request; không thay UI/animation, backend config hoặc `.env`.

## 1. Chẩn đoán trước khi sửa

- Backend 3001 và frontend `http://localhost:8443` đều trả status HTTP 200, `provider=gemini`, `configured=true`.
- Chrome headless trên localhost có `isSecureContext=true` và `crypto.randomUUID`; trước sửa đã gửi một câu hỏi qua Vite proxy và nhận HTTP 200, provider Gemini. Không tái hiện lỗi ban đầu trên Chrome mặc định trong môi trường Agent.
- Thông báo chính xác người dùng báo nằm trong `catch` của `ImageComposer.onSubmit`. Lỗi HTTP/API thông thường đã được `useAiConversation.run()` bắt và trả `false`, nên không đi vào catch đó.
- `useAiConversation.send()` gọi trực tiếp `crypto.randomUUID()` **trước** khối xử lý lỗi của request. Browser thiếu API này sẽ ném exception ra composer, chưa tạo POST.
- Đã tái hiện trên browser thật bằng cách tắt riêng `crypto.randomUUID`: nhận đúng thông báo **“Chưa gửi được câu hỏi. Nội dung đang soạn được giữ để em thử lại.”**, số POST `/api/ai/chat` bằng **0**, draft không mất.

Đây là lỗi frontend đã được chứng minh bằng tái hiện. Browser/secure-context của phiên lỗi gốc trên máy người dùng chưa được đo trực tiếp; không khẳng định mọi trường hợp gửi thất bại đều do UUID.

## 2. Kiểm tra các tầng liên quan

| Tầng | Kết quả |
|---|---|
| Composer/handler | Chỉ xóa text/ảnh sau ACK thành công và snapshot còn khớp; lỗi tạo UUID trước request trước đây chưa được hook bắt |
| AI client | POST same-origin `/api/ai/chat`; map error code an toàn, timeout/abort và validation response; không đọc key |
| Vite proxy | `/api/ai` đến 127.0.0.1:3001; status và chat thực tế đi qua proxy thành công; không cần sửa |
| Schema | Payload có `message`, `clientMessageId`, `history`, `images`, `mode`; lượt đầu bỏ `conversationId`, lượt sau dùng ID đã ACK; UUID fallback đúng version/variant backend chấp nhận |
| History | Các cặp user/model đã hoàn tất; kiểm thử Gemini thật lần lượt gửi 0, 2 và 4 messages history |
| Images | Base64 thuần/MIME, preview/decode/client resize và backend kiểm tra lại; request ảnh thật có một ảnh |
| Gemini service | Text/ảnh/context thành công; cũng quan sát HTTP 503 `AI_UNAVAILABLE` ở một số lần thử, retry thủ công cùng payload có lần thành công |

503 là lỗi khác với exception UUID trước POST. Không đủ dữ liệu từ response đã sanitize để xác định mọi 503 là HTTP 503 từ Google hay lỗi transport được proxy map thành 503; không suy đoán nguyên nhân credential/model/network. Một diagnostic server-side dùng cấu hình hiện tại cũng nhận response không rỗng; không in raw SDK error, key, prompt hoặc ảnh.

## 3. Thay đổi

- **`src/ai/clientMessageId.ts`**: ưu tiên native `randomUUID`; nếu thiếu hoặc ném lỗi, tạo UUID v4 từ **`crypto.getRandomValues`** với version/variant đúng. Không dùng `Math.random`. Nếu không có RNG an toàn, trả `CLIENT_ID_UNAVAILABLE` với hướng dẫn cập nhật browser hoặc mở localhost/HTTPS.
- **`src/ai/useAiConversation.ts`**: bắt lỗi tạo ID/chuẩn bị lượt ngay trong `send`, trả `false` và thông báo an toàn qua error state. Giữ snapshot chưa gửi để nút Retry có thể thực hiện lại khi điều kiện đã phục hồi. Request đã gửi vẫn retry với UUID/payload cũ, không tạo message trùng. Hội thoại mới bỏ snapshot retry cũ; draft composer vẫn giữ.
- **`tests/ai-client-id.test.cjs`**: bốn regressions cho native UUID, fallback đúng schema, lỗi RNG an toàn và retry sau lỗi trước request.
- **`tests/ai-browser.spec.ts`**: chạy luồng chat/ảnh/context/error/retry/abort với native UUID bị tắt, xác minh fallback xuyên suốt client → proxy → backend.
- **`GEMINI_SEND_FIX.md`**: báo cáo này.

Không sửa `server/.env`, backend service, validation, proxy, UI hoặc animation. Backend đang phục vụ người dùng vẫn là Gemini. Các Mock tests chỉ dùng fixture/backend riêng, không đổi provider của server 3001.

## 4. Kết quả kiểm thử

| Kiểm tra | Kết quả thực tế |
|---|---|
| Frontend strict typecheck | Đạt |
| Backend typecheck | Đạt |
| Frontend unit/regression | **81/81 đạt** |
| Backend HTTP/SDK/pure regression | **25/25 đạt** |
| Production build frontend/backend | Đạt |
| Bundle secret/SDK isolation | Đạt |
| Browser production regression, không có `randomUUID` | **1/1 đạt**, gồm mode/context/text/image/retry/abort/responsive/theme/reduced motion |
| Gemini thật: text với UUID fallback | HTTP **200**, provider Gemini, history 0, ảnh 0, response không rỗng |
| Gemini thật: nhiều lượt | Lần đầu **503 / AI_UNAVAILABLE**, Retry đúng payload và UUID nhận **200**; history 2, conversationId đã ACK |
| Gemini thật: ảnh đề mẫu + context | HTTP **200**, provider Gemini, history 4, ảnh 1, response không rỗng |

Các lần live check dùng câu hỏi và PNG phương trình được tạo cho kiểm thử, không dữ liệu cá nhân. Không gọi API trực tiếp từ frontend tới Google. Sau thành công, draft/preview được xóa; khi 503, draft vẫn giữ để retry. Không tuyên bố đã nghiệm thu độ chính xác toán học/OCR trên mọi ảnh hoặc độ ổn định lâu dài từ các lượt thành công này.

## 5. Kiểm tra lại ở phiên người dùng

1. Tải frontend mới, gửi câu hỏi; xem request POST trong Network. Nếu không có POST, thông báo lỗi browser/RNG mới giúp phân biệt với lỗi API.
2. Nếu có POST lỗi, kiểm tra `error.code` và `requestId`, không chia sẻ raw SDK error hoặc `.env`. `AI_UNAVAILABLE` có thể thử lại có kiểm soát; không chuyển provider sang Mock để xử lý.
3. Sau backend restart, dùng Hội thoại mới nếu nhận `CONVERSATION_EXPIRED`; đây là context trong RAM, không lỗi UUID.
4. Live tests sử dụng conversation/quota thật của development server. Giới hạn 3 conversation/owner và TTL 30 phút vẫn giữ; nếu gặp `CONVERSATION_LIMIT`, chờ TTL hoặc chủ động restart backend local theo quy trình hiện có, không bỏ limiter.

Các diagnostic tạm và browser artifacts nằm trong `.cache/` được Git ignore; không chứa key hoặc bản chụp `.env`. Những thay đổi chưa commit của các giai đoạn trước được giữ nguyên.
