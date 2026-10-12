# Math Mentor — Hướng dẫn tích hợp Gemini

**Ngày cập nhật:** 12/10/2026, Asia/Saigon.  
**Trạng thái triển khai:** frontend đã nối API backend; backend có hai provider `mock` và `gemini`. Mock Mode đã kiểm thử bằng HTTP thật và Chrome headless. Runtime Gemini hiện tại đã trả lời text và ảnh/context qua LAN; vẫn quan sát một số 503 và chưa bảo đảm độ ổn định lâu dài. Typecheck/build frontend và backend đạt. Audit Origin/environment mới nhất: `AI_CONNECTION_ROOT_CAUSE_REPORT.md`; báo cáo preparation trước đó được giữ làm lịch sử.

## 1. Kiến trúc và phạm vi

```text
React / AI Tutor / AI Orb / ImageComposer
  → /api/ai/status, /api/ai/chat
  → Vite proxy khi phát triển hoặc reverse proxy khi triển khai
  → Express: CORS, xác thực, giới hạn sử dụng, validation, timeout
  → ConversationService: context phiên, ownership, idempotency
  → MockAIService hoặc GeminiService (@google/genai)
```

- `shared/ai.ts`: contract, mode và giới hạn dùng chung cho frontend/backend.
- `src/ai/`: API client, hook hội thoại, màn hình Tutor, chuẩn bị ảnh, Markdown/KaTeX.
- `server/src/app.ts`: Express app và điểm tích hợp xác thực.
- `server/src/config/env.ts`: cấu hình server.
- `server/src/schemas/chat.ts`: kiểm tra request, base64 và decode nội dung ảnh.
- `server/src/services/`: provider, context phiên và bộ nhớ idempotency.
- `server/src/prompts/math-mentor.ts`: system instruction và quy tắc mode do backend quản lý.

Không tạo database hoặc thay thế backend nghiệp vụ của đồng đội. Đây là proxy AI độc lập để bàn giao/tích hợp. Giữ React, Vite, TypeScript, Tailwind, Signature WOW, Living Math và logic phòng thi hiện có. Bản sao lưu trước tích hợp: `.backups/math-mentor-before-gemini-20261012-8ac3472a.zip`.

## 2. Chạy Mock Mode

Dùng Node.js 22 trở lên. Các lệnh dưới đây chạy từ thư mục gốc dự án; dùng npm. Root và server đều có `package-lock.json`, dùng `ci` để cài tái lập. Root `pnpm-lock.yaml` cũng đã cập nhật bằng pnpm 10.34.3 cho môi trường Figma Make; nếu dùng pnpm ở root, dùng `pnpm install --frozen-lockfile` thay cho `npm ci`, không trộn hai manager trong cùng thư mục `node_modules`. Server dùng npm với lockfile riêng. Kiểm thử lần này chạy bằng npm, Node 24.21.0; chưa chạy lại toàn bộ bộ test trên Node 22/pnpm.

```powershell
npm ci
npm --prefix server ci
npm --prefix server run dev
```

Backend mặc định là `AI_MODE=mock`, `HOST=127.0.0.1`, `PORT=3001`; không có `server/.env` vẫn chạy mock được. Lệnh cuối chạy server trong terminal hiện tại. Có thể mở một terminal khác để chạy frontend, nếu môi trường chưa có Vite chạy sẵn:

```powershell
npm run dev
```

Trong Figma Make, Vite đã chạy ở cổng 8443; tiếp tục dùng preview hiện có, không mở thêm server trùng cổng. `vite.config.ts` proxy `/api/ai` đến `http://127.0.0.1:3001`, cả dev và preview. Frontend không gọi Google trực tiếp và không đọc key. Nếu terminal kế thừa `PORT=8443`, đặt `$env:PORT='3001'` trong terminal backend trước khi chạy để tránh trùng cổng; hoặc mở terminal riêng không có biến PORT đó.

Kiểm tra backend bằng PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
Invoke-RestMethod http://127.0.0.1:3001/api/ai/status
```

Health trả `{ "status": "ok", "service": "math-mentor-ai" }`. Status cần có `provider: "mock"`, `configured: true`. Mở `http://localhost:8443`, vào **Trợ lý AI**; badge phải hiện **MOCK · DEMO**. Thử gửi câu hỏi: request thực sự đi qua backend local và câu trả lời được đánh dấu phản hồi mẫu.

Nếu muốn cấu hình riêng, sao chép file mẫu một lần, không ghi đè file đã chứa key/cấu hình của mình:

```powershell
Copy-Item -LiteralPath server/.env.example -Destination server/.env
```

`server/.env` được nạp từ đường dẫn backend, không phụ thuộc terminal đang đứng ở đâu. Environment của tiến trình có ưu tiên hơn `.env`; nếu kết quả cấu hình không đúng, kiểm tra các biến đã đặt trong terminal trước đó.

Lúc khởi động, backend in allowlist **có hiệu lực** và nguồn `server/.env`/`process environment`/`defaults`, không in key. Nếu biến terminal cũ đang ghi đè và bạn muốn dùng file, xóa riêng biến đó trong terminal backend (`Remove-Item Env:ALLOWED_ORIGINS -ErrorAction SilentlyContinue`) rồi chạy lại. Không tự ghi đè environment của deployment bằng `.env`.

`npm run ai:dev` dùng dev runner theo dõi metadata `.env` và restart process khi file đổi; source vẫn được tsx watch theo dõi. Không dùng `tsx watch --include .env` trực tiếp để giả định hot reload: bản tsx đã cài vẫn bỏ qua dotfile. Production `npm --prefix server start` cần restart sau thay đổi environment. Sau restart, context trong RAM mất; dùng Hội thoại mới hoặc tải trang lại.

### Origin/CORS và LAN

- Quyền API dựa trên `Origin`, không dựa vào Host, Referer hoặc forwarded headers. Missing Origin được phép cho CLI nhưng production vẫn phải xác thực; `Origin: null`/malformed bị chặn.
- `ALLOWED_ORIGINS` là danh sách origin đầy đủ, phân tách dấu phẩy. Có thể có khoảng trắng quanh mục, hostname viết hoa, default port hoặc một slash cuối **trong cấu hình**; parser chuẩn hóa và loại trùng. Không cho credentials, query/hash/path, wildcard hoặc danh sách rỗng.
- Request Origin phải là serialized origin, không kèm path/slash cuối. HTTP/HTTPS, port, localhost và IP LAN là các origin khác nhau. Không tự cho phép mọi IP hoặc dò mạng để mở allowlist.
- Nếu mở bằng LAN, thêm **đúng** `window.location.origin` vào `server/.env`, không chỉ sửa `.env.example`. IP có thể đổi khi chuyển Wi-Fi/hotspot. Audit lần này máy dùng `http://172.20.10.2:8443`; IP này chỉ được thêm vào cấu hình local hiện tại, không thành default trong source.
- Vite dev/preview giữ CORS loopback mặc định và `preflightContinue=true`, nên OPTIONS `/api/ai` đi tới proxy/Express. Backend quyết định allowlist/preflight thật; Origin lạ trả 403. `changeOrigin=false` giữ frontend Host và Origin; không rewrite path.
- Response có `X-Request-ID`; khi lỗi, đối chiếu với `error.requestId`. Lỗi provider được log chỉ với request ID, code, category và HTTP/network code an toàn, không log raw SDK error, key, cookie, prompt hoặc ảnh.

`server/.env.example` là file **có thể commit** và phải để key trống. Đã phát hiện secret bị đặt trong file mẫu ở audit này, loại bỏ và thêm test/build gate. Key đã xuất hiện trong output kiểm tra file mẫu cần được quản lý thu hồi/xoay; không dán key vào chat hoặc tài liệu.

## 3. Kiểm thử chat, retry và abort trong mock

1. Gửi câu hỏi, chọn lần lượt **Gia sư**, **Gợi ý**, **Giải chi tiết**, **Kiểm tra lời giải**, **Giải thích kiến thức**. Backend mô phỏng đúng contract và mode, nhưng không giải riêng đề người dùng.
2. Gửi câu hỏi tiếp theo. Context giữ thứ tự user/model; phản hồi mock cho biết số lượt trước trong context.
3. Nhấn Gửi hai lần nhanh: chỉ có một lượt/request được tạo. Ô soạn và ảnh chỉ được xóa sau khi có phản hồi thành công.
4. Rời trang AI rồi quay lại: hội thoại và draft giữ trong bộ nhớ của ứng dụng. Draft AI độc lập với các ô biểu thức ở Công cụ Toán.
5. Nhấn **Hội thoại mới**: xóa transcript/context phía frontend và hủy request đang chạy. Draft chưa gửi được giữ lại; response cũ không được thêm vào hội thoại mới.
6. Khi request đang chạy, nhấn **Hủy yêu cầu**: dừng chờ ở client, giữ draft, cho phép gửi lại. Abort không bảo đảm nhà cung cấp chưa tính phí nếu request đã đến Google.

### Tình huống lỗi dành cho môi trường phát triển

File mẫu bật `MOCK_TEST_SCENARIOS=true`. Cơ chế này chỉ hoạt động khi `AI_MODE=mock`, ngoài production, và nội dung tin nhắn khớp chính xác:

- `[mock:error]`: lần đầu trả lỗi 503; **Thử gửi lại** với cùng `clientMessageId` thành công. Retry cập nhật cùng một lượt, không thêm user message trùng.
- `[mock:timeout]`: provider chờ để backend phát sinh timeout. Mặc định khoảng 30 giây. Muốn kiểm tra nhanh, đổi `AI_TIMEOUT_MS=1000` trong `server/.env`, khởi động lại backend rồi gửi tin này. Sau kiểm tra trả lại 30000; retry cùng tình huống vẫn timeout cho đến khi đổi nội dung/cấu hình.

Đặt `MOCK_TEST_SCENARIOS=false` để tắt hai tình huống này. Trong production chúng luôn tắt, dù biến được đặt `true`. Không dùng key giả hoặc gọi Google để kiểm tra mock.

Để kiểm tra rate limit nhanh, tạm đặt `AI_RATE_LIMIT_PER_MINUTE=2`, khởi động lại và gửi hơn hai request POST trong một phút. API trả 429 với `Retry-After: 60`; cả request không hợp lệ cũng đi qua giới hạn rate. Khôi phục cấu hình sau kiểm thử. Nút retry là thao tác thủ công, không có retry tự động vô hạn.

## 4. Kiểm thử ảnh và camera

- Desktop: nút camera mở picker. Mobile: chọn **Chụp ảnh** hoặc **Chọn ảnh có sẵn**. Camera cần kiểm tra trên iOS/Android thật; thuộc tính `capture` là gợi ý cho browser, không bảo đảm thiết bị luôn mở camera trực tiếp.
- Chấp nhận ảnh tĩnh JPEG, PNG, WebP; tối đa 4 ảnh, mỗi file gốc tối đa 10 MiB. Có preview, xóa, đổi ảnh, đọc lỗi và thử lại.
- Khi gửi, client kiểm tra header/magic bytes và decode, xử lý tuần tự để giảm bộ nhớ mobile. Ảnh lớn được thu về cạnh tối đa 2048 px, hướng đến tối đa 2 MiB/ảnh; WebP hoặc JPEG fallback. Ảnh quá 40 megapixel bị từ chối ở bước chuẩn bị client.
- Tổng dữ liệu ảnh sau chuẩn bị không quá 12 MiB. Backend kiểm tra lại base64, từng ảnh, tổng bytes, MIME, nội dung thực tế, ảnh hỏng/động và giới hạn 24 triệu điểm ảnh, rồi chuẩn hóa về WebP/cạnh 2048 px.
- Backend nhận ảnh trực tiếp trong request JSON; không tải lên dịch vụ lưu trữ riêng và không lưu bytes ảnh vào database, file hoặc lịch sử server. Ảnh chuẩn hóa tối đa 2 MiB/ảnh trước khi gửi provider. Trong Gemini Mode, ảnh của request hiện tại được gửi đến Google để phân tích.
- Mock chỉ xác nhận **đã tiếp nhận ảnh hợp lệ**, không OCR hoặc nhận diện đề. Form **Nhập hoặc sửa đề trong ảnh** gửi văn bản đã nhập thành một lượt API mới.
- Khi lỗi mạng/timeout/validation hoặc abort, draft text và ảnh gốc còn nguyên. Gửi lại dùng cùng lượt và payload đã chuẩn bị khi có thể. Quick action và form nhập lại đề không được xóa draft trong composer.

Thử file trống, đổi đuôi giả, MIME sai, bytes hỏng, ảnh quá 10 MiB, chọn 5 ảnh, chọn liên tiếp khi đang đọc, thay/xóa ảnh, hủy picker, gửi trong lúc đọc ảnh. Kiểm tra camera và bàn phím mobile ở light/dark mode. Kéo thả ảnh không phải cơ chế nhập hiện tại; dùng picker/camera đã triển khai.

## 5. Kích hoạt Gemini khi nhận key

Chỉ chỉnh `server/.env` trên máy/backend sẽ chạy:

```dotenv
AI_MODE=gemini
GEMINI_API_KEY=<key do quản lý cung cấp>
GEMINI_MODEL=gemini-3.8-flash
```

Dòng key trên là vị trí điền key thật, không phải key thử nghiệm. Không đưa key vào `.env` frontend, biến `VITE_*`, source, request từ browser, screenshot, log hoặc Git. `.gitignore` bỏ qua `.env*`, chỉ cho phép commit `.env.example` không có key.

Khởi động lại backend; không cần sửa code hoặc rebuild frontend để đổi provider:

```powershell
npm --prefix server run dev
```

Kiểm tra `/api/ai/status`: `provider: "gemini"`, `configured: true`. `configured` chỉ xác nhận đã có key trong cấu hình, không chứng minh key còn hiệu lực hoặc model được cấp quyền. Tải lại trang để lấy status mới; reload sẽ mất transcript/draft trong bộ nhớ frontend. Nếu đang có cảnh báo kết nối, nút **Kiểm tra lại kết nối** cũng cập nhật status. Hội thoại cũ trên server mất khi restart; tạo hội thoại mới trước khi kiểm thử nếu giữ trang đang mở. Response thành công cũng cập nhật provider badge từ metadata thật.

Nếu `AI_MODE=gemini` nhưng thiếu key, status trả `configured: false` và chat trả `CONFIGURATION_ERROR`/503. Không tự động chuyển sang mock. Key sai/quyền chưa đủ cũng được trả dưới dạng lỗi cấu hình an toàn, không lộ thông điệp nhạy cảm từ provider.

Model mặc định `gemini-3.8-flash` được liệt kê trong [tài liệu model chính thức của Google](https://ai.google.dev/gemini-api/docs/models), đã đối chiếu ngày 12/10/2026. Khi đổi model, chọn model hỗ trợ text/image và `generateContent`, đúng ID và quyền của project. Không chọn model Live/TTS/image generation chỉ vì tên gần giống. Backend kiểm tra cú pháp ID; khả năng truy cập thực tế cần kiểm thử sau khi có key. Model và system prompt chỉ được quyết định ở server.

## 6. API contract bàn giao cho Backend Engineer

### Endpoint

| Endpoint | Ý nghĩa |
|---|---|
| `GET /health` | Liveness cơ bản, không trả key/model credential |
| `GET /api/ai/status` | Provider, cấu hình sẵn sàng, limits, modes, timeout |
| `POST /api/ai/chat` | Một lượt hội thoại text/ảnh, response JSON đầy đủ |

Health đi trực tiếp backend; Vite chỉ proxy nhóm `/api/ai`. API hiện dùng JSON response đầy đủ, không có SSE/token streaming.

### Request

```json
{
  "message": "Giải thích cách giải phương trình 2x + 1 = 7",
  "clientMessageId": "cc86bf90-6c7e-4b01-ae40-2a1b9d6d2ae3",
  "history": [],
  "images": [],
  "mode": "hint"
}
```

`conversationId` bỏ qua ở lượt đầu; các lượt sau dùng ID server trả về. `clientMessageId` là UUID cho một thao tác gửi, giữ nguyên khi retry cùng payload. Mỗi image có `{ "mimeType": "image/png", "data": "<base64 thuần>" }`, không có prefix data URL. Payload chỉ có các field được khai báo; thêm `model`, `systemPrompt`, role cấp cao hoặc field khác sẽ bị từ chối.

| Trường/giới hạn | Quy tắc |
|---|---|
| `message` | String, tối đa 6000 ký tự; cho phép trống nếu có ít nhất một ảnh |
| `mode` | `tutor`, `hint`, `solve`, `check_answer`, `explain_concept` |
| `clientMessageId`, `conversationId` | UUID hợp lệ; conversationId optional ở lượt đầu |
| `history` | Tối đa 20 messages/10 cặp, tối đa 24000 ký tự tổng; cặp `user` rồi `model`, text không trống, không `system` |
| Lịch sử server | Phải khớp đúng context đã ACK của conversation; không tin model text do frontend tự đặt |
| `images` | Tối đa 4; JPEG/PNG/WebP, 10 MiB/ảnh, 12 MiB tổng bytes decode |
| JSON body | Tối đa 18 MiB để chứa base64 và text; JSON strict, không nhận multipart trong contract này |
| `answer` | Tối đa 24000 ký tự; response rỗng hoặc quá giới hạn là lỗi |

History giữ các cặp hoàn chỉnh mới nhất trong cả hai ngân sách. Lượt chỉ có ảnh dùng text canonical `[Đính kèm ảnh]` trong context sau ACK; bytes ảnh cũ không được giữ hoặc tự gửi lại. Nếu cần hỏi lại nội dung ảnh cũ, đính kèm lại hoặc dùng đề đã nhập. Không tự tạo history cho lượt đầu để giả mạo một cuộc hội thoại mới.

### Response

```json
{
  "answer": "**DEMO** ... $x=3$ ...",
  "conversationId": "275a3d4f-1f83-4ea7-9670-5fd34b979745",
  "mode": "hint",
  "metadata": {
    "provider": "mock",
    "model": null,
    "imageCount": 0,
    "requestId": "43c6e62f-2ee0-4ddb-885c-fb7e5d250e12"
  }
}
```

Gemini trả `provider: "gemini"`, model đã cấu hình; có thể có `usage` với `inputTokens`, `outputTokens`, `totalTokens`. Metadata không chứa key hoặc toàn bộ prompt. Status có `{ provider, configured, limits, modes, timeoutMs }`.

### Error, ownership và idempotency

```json
{
  "error": {
    "code": "AI_TIMEOUT",
    "message": "Yêu cầu AI đã quá thời gian chờ.",
    "retryable": true,
    "requestId": "43c6e62f-2ee0-4ddb-885c-fb7e5d250e12"
  }
}
```

Có thể có `fieldErrors`. Frontend dùng thông điệp an toàn theo code, không in lỗi thô từ SDK.

| HTTP | Code tiêu biểu / xử lý |
|---|---|
| 401/403 | `AUTH_REQUIRED`, `CONVERSATION_FORBIDDEN`, `ORIGIN_NOT_ALLOWED` |
| 409 | `CONVERSATION_EXPIRED`, `CONVERSATION_BUSY`, `HISTORY_MISMATCH`, `IDEMPOTENCY_CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE`, `IMAGE_TOO_LARGE` |
| 422 | `VALIDATION_ERROR`, `IMAGE_INVALID` |
| 429 | `RATE_LIMITED`, `DAILY_LIMIT_REACHED`, `CONVERSATION_LIMIT`, `AI_QUOTA_EXCEEDED`; không spam retry |
| 499 | `REQUEST_ABORTED` nếu kết nối còn có thể trả response |
| 502/503/504 | `AI_EMPTY_RESPONSE`, `AI_UNAVAILABLE`, `AI_MODEL_UNAVAILABLE`, `CONFIGURATION_ERROR`, `AI_TIMEOUT` |

Conversation thuộc identity do server xác định. Idempotency scoped theo identity + `clientMessageId`; payload khác dùng cùng ID trả 409. Request đang chạy cùng ID/payload được gộp; reply đã thành công được cache để retry không gọi provider lần nữa. Failures không được cache thành thành công. Cache và context hết hạn sau 30 phút; không bảo đảm idempotency sau restart/TTL.

## 7. Cấu hình vận hành

| Biến server | Mặc định / ý nghĩa |
|---|---|
| `AI_MODE` | `mock`; chỉ chấp nhận `mock` hoặc `gemini` |
| `GEMINI_API_KEY` | Chỉ backend; mock không cần |
| `GEMINI_MODEL` | `gemini-3.8-flash` |
| `HOST`, `PORT` | `127.0.0.1`, `3001` |
| `ALLOWED_ORIGINS` | `http://localhost:8443,http://127.0.0.1:8443`; URL origin chính xác, không wildcard |
| `AI_TIMEOUT_MS` | 30000; khoảng hợp lệ 1000–120000 |
| `AI_RATE_LIMIT_PER_MINUTE` | 30; áp dụng theo socket IP và user identity |
| `AI_USER_DAILY_LIMIT` | 100 lần bắt đầu xử lý trong cửa sổ 24 giờ |
| `AI_USER_MAX_CONCURRENT` | 2; mỗi conversation vẫn chỉ có một request khác nhau đang chạy |
| `AI_MAX_CONCURRENT_REQUESTS` | 8 request HTTP toàn server, chặn trước khi đọc body lớn |
| `AI_MAX_OUTPUT_TOKENS` | 4096; khoảng hợp lệ 256–8192 |
| `MOCK_TEST_SCENARIOS` | Bật ngoài production trừ khi đặt `false` |

Backend không tự retry vô hạn; SDK cấu hình một attempt. Frontend lấy timeout từ status rồi cộng 5 giây dự phòng, tối đa 125 giây; trước khi nhận status dùng 35 giây. Có nút hủy và retry thủ công. Giữ timeout reverse proxy lớn hơn timeout xử lý server; tải lại status sau khi thay `AI_TIMEOUT_MS`.

## 8. Session và giới hạn dữ liệu

- Frontend giữ transcript/draft trong bộ nhớ của ứng dụng, hiện giữ tối đa 10 lượt hoàn tất và một lượt chưa hoàn tất. Điều hướng nội bộ giữ chúng; reload/đóng tab mất chúng. Không ghi chat/ảnh vào localStorage hoặc database.
- Server giữ text context và response idempotency trong bộ nhớ tiến trình, TTL 30 phút, tối đa 3 conversation còn hiệu lực cho một identity, 500 conversation toàn server, 1500 cache/inflight entries. Khởi động lại làm mất context/cache.
- Sau khi tạo quá 3 hội thoại mới, đợi TTL hoặc restart backend local để kiểm thử tiếp. Nút Hội thoại mới không có API xóa conversation server ngay lập tức.
- Development chưa có auth dùng identity hash theo socket IP với salt của tiến trình. Đây không phải tài khoản cá nhân; browser/client cùng IP có thể cùng chia sẻ hạn mức. Không dùng cơ chế này cho public production.
- Giới hạn sử dụng là in-memory: restart đặt lại hạn mức; nhiều instance không chia sẻ trạng thái. Request bắt đầu xử lý, kể cả sau đó fail/abort, có thể đã dùng ngân sách và phí provider.

## 9. Markdown, công thức và motion

Phản hồi được render bằng React Markdown, GFM, remark-math và KaTeX. Hỗ trợ inline `$...$`, display `$$...$$`, danh sách các bước và môi trường LaTeX nhiều dòng. Raw HTML bị bỏ qua; KaTeX `trust=false`, giới hạn expansion/size. Link chỉ http/https, tab mới có `noopener noreferrer`; URL ảnh do AI trả về không được tự tải để tránh tracking.

AI Orb lấy trạng thái thật từ đọc/chuẩn bị ảnh, request backend, response vừa render và error. Không có timer giả mô phỏng Gemini suy nghĩ. Animation tuân theo reduced motion và trạng thái ẩn/offscreen. Living Math ở Dashboard và phòng thi không được nối vào API này.

## 10. Build và kiểm thử không cần key

Từ root:

```powershell
npm run typecheck
npm --prefix server run typecheck
npm test
npm --prefix server test
npm run build
npm --prefix server run build
npm run check:ai-bundle
```

Production backend đã build chạy bằng:

```powershell
npm --prefix server start
```

Chạy lệnh trên với cấu hình development/local để kiểm tra artifact. Bootstrap mặc định sẽ từ chối production nếu chưa cung cấp auth adapter; xem mục tiếp theo. Không dùng kết quả mock, fake SDK hoặc build làm bằng chứng Gemini thật hoạt động.

Backend test hiện chạy 22 bài HTTP/SDK/Origin/environment/proxy, sau đó 10 bài pure unit. SDK adapter dùng dependency injection để kiểm tra payload và lỗi, không gọi Google và không chứng minh Gemini thật hoạt động. Kết quả live Gemini được ghi riêng trong root-cause report.

Kiểm thử browser production bằng Chrome đã cài trên máy:

```powershell
npm run test:ai-browser
```

Lệnh build frontend/backend, kiểm tra bundle không chứa marker secret phía server hoặc Gemini SDK/endpoint, khởi động backend Mock riêng ở 3002 và Vite production preview ở 8444, rồi đóng hai tiến trình kiểm thử khi kết thúc. Nó không dùng quota/context của backend local 3001. Cần Chrome; có thể đặt `AI_TEST_BROWSER_CHANNEL=msedge` nếu máy dùng Edge. Hai cổng kiểm thử phải đang trống. Screenshots nằm trong `.cache/playwright-ai/`.

Hai browser tests kiểm tra 5 mode, context, ảnh hợp lệ, lỗi/retry/abort, Origin bị Express chặn, proxy offline, draft sau navigation, light/dark và overflow ở 1440/1024/768/390/360/320 px, camera sheet/Escape, reduced motion và tin cuối trên composer. Đây là browser headless desktop giả lập viewport; camera thật, bàn phím iOS/Android và hiệu năng thiết bị vẫn cần nghiệm thu riêng.

Responsive QA cần thao tác browser ở 320/360/390/768/1024/1440 px, light/dark/system, keyboard và reduced motion. Kiểm tra composer không che tin cuối, camera sheet focus/Escape, ảnh/error/retry dài, keyboard iOS/Android và safe area. Sau tích hợp, thử lại phòng thi 10/25/40 câu, giữ deadline khi trở lại, hết giờ khóa bài, điểm demo và các animation hiện có.

## 11. Triển khai production và việc cần đồng đội Backend hoàn thiện

1. Tích hợp `createApp(config, { authenticate })` với session/JWT được backend xác minh. Adapter trả `{ userId, aiEnabled?, dailyLimit? }` hoặc `null`. Không đọc user ID/role từ header tùy ý của frontend. `NODE_ENV=production` không có adapter sẽ fail closed; `server/src/index.ts` mặc định chưa có adapter này.
2. Build frontend và server theo lockfile chuẩn. Serve static frontend qua HTTPS; reverse proxy **cùng origin** `/api/ai/*` đến Node. Production static hosting không tự có proxy Vite; phải cấu hình route ở ingress/web server. Đặt body limit tối thiểu 18 MiB và timeout phù hợp; không cache response AI.
3. Inject key qua secret manager hoặc environment server; không copy `server/.env` vào artifact frontend. Không ghi request body, ảnh, history, SDK error thô hoặc secrets vào access/error log. Nếu dùng telemetry, chỉ dùng request ID, outcome/code, latency và số liệu tổng hợp phù hợp.
4. Đặt `ALLOWED_ORIGINS` đúng domain HTTPS, `MOCK_TEST_SCENARIOS=false`, hạn mức phù hợp và hard budget phía Google. CORS là giới hạn browser origin, **không phải xác thực**. Requests không có Origin vẫn cần verified auth trong production.
5. Hoàn thiện CSRF/session-cookie policy, quyền AI theo user/nhóm và kiểm soát tài khoản. Các toggle quản trị prototype hiện chưa liên kết quyền/quota AI server.
6. Đưa rate limit, daily budgets, context và idempotency vào store chung nếu chạy nhiều instance. Thống nhất TTL/retention/mã lỗi trước khi thêm database; hiện không có persistence. Giới hạn socket IP đang không tin `X-Forwarded-For`; cấu hình trusted reverse proxy rõ ràng khi cần IP thật, tránh tin header tùy ý hoặc làm mọi user chia sẻ một IP cap.
7. Hoàn thiện graceful shutdown, health/readiness, monitoring, quota cảnh báo, chính sách dữ liệu gửi Google và quy trình xoay key. Không công khai server ở development mode để né auth blocker.

Frontend không cần thay đổi provider khi có key. Public production vẫn cần các bước auth/infrastructure trên; có key không tự làm hệ thống đạt nghiệm thu production.

## 12. Kiểm thử Gemini thật còn chờ

- Các mẫu text/ảnh/context đã có response thật; tiếp tục nghiệm thu key/project/model và chat tiếng Việt ở cả 5 mode, độ ổn định và retry có kiểm soát.
- Đề thật nhiều bước, kiểm tra lời giải, tính đúng toán học, không mặc định tiết lộ đáp án và tuân theo context.
- Ảnh JPEG/PNG/WebP rõ/mờ/nghiêng, nhiều ảnh; AI thừa nhận không chắc, không bịa dữ kiện; chất lượng sau resize/compress đủ đọc công thức.
- Prompt injection trong text và ảnh không thay đổi system instruction; không có bảo đảm tuyệt đối chỉ bằng prompt, cần đánh giá thực tế.
- Markdown/LaTeX từ output thật, biểu thức dài và các môi trường nhiều dòng không làm tràn mobile.
- Quota thật, model không khả dụng, quyền sai, timeout, abort, retry và token usage; kiểm tra retry không gây phí/lượt trùng trong phạm vi idempotency.
- Chính sách quyền riêng tư, retention và điều khoản provider theo cấu hình tổ chức; không suy ra Google không lưu dữ liệu chỉ vì proxy local không lưu ảnh.

Không yêu cầu key để hoàn thiện mock hoặc chạy bộ test hiện tại. Khi key được cấp, chỉ đặt vào environment backend và restart để bắt đầu các kiểm thử thật này.
