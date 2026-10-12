# Math Mentor — Gemini preparation completion

**Ngày:** 12/10/2026, Asia/Saigon.  
**Kết quả:** AI Tutor chạy được bằng **Mock Mode**, frontend gọi backend local qua proxy. Frontend/backend đã qua typecheck, production build, unit/API tests và browser test. **Gemini thật chưa được kiểm thử; chưa có API key và không yêu cầu key trong quá trình triển khai.**

## 1. Khôi phục và bảo toàn công việc trước đó

Đã kiểm tra `git status`, `git diff`, cấu trúc source, các file AI đã tạo, `CLAUDE.md`/`AGENTS.md` và báo cáo các giai đoạn trước. Giữ nguyên các thay đổi chưa commit; không reset, stash, xóa hoặc ghi đè chúng, không tạo backend/component trùng lặp.

Lần trước đã có `shared/ai.ts`, proxy Express, Gemini/Mock providers, prompt, context/idempotency, client AI, hook hội thoại, composer gửi async, AI Orb theo request, Markdown/KaTeX và các test. Điểm dở dang là dependencies backend chưa cài, HTTP/SDK tests chưa chạy và báo cáo completion chưa tạo. Lần tiếp tục hoàn thiện các điểm đó, không bắt đầu lại dự án.

Bản sao lưu trước tích hợp vẫn giữ tại `.backups/math-mentor-before-gemini-20261012-8ac3472a.zip`. SHA-256: `B452AA0D0C178265E3F5ABF2FEC6A26C37D59781D14A209C1336F4AFC89A5393`.

Đã đối chiếu SHA-256 với snapshot và xác nhận 13 file ngoài phạm vi AI không đổi: `ExamRoom.tsx`, `examModel.ts`, `practiceSession.ts`, `sampleData.ts`, `LivingMathVisual.tsx`, `livingMathModel.ts`, `living-math.css`, `Theme.tsx`, `app-theme.css`, `image-composer.css`, `signature.css`, `motion.css`, `main.tsx` trong `src/`. Các test phòng thi, luyện tập, search/admin navigation và motion vẫn đạt.

## 2. Phân loại trạng thái

| Nhóm | Trạng thái và bằng chứng |
|---|---|
| **Implemented** | Secure proxy, SDK adapter chính thức, Mock provider, 5 mode, prompt do server quản lý, text/ảnh, context phiên, ownership/idempotency, validation, timeout/abort, rate/budget/concurrency, CORS, health/status, client/loading/error/retry/Orb, Markdown/LaTeX an toàn |
| **Tested with mock** | HTTP thật trên localhost, JPEG/PNG/WebP decode bằng sharp, hạn mức/timeout/abort/retry, canonical history, thiếu key không fallback; Chrome headless chạy production bundle/proxy và giao diện thật |
| **Pending real API key** | Credential/model entitlement, Gemini text/image thực tế, chất lượng giải toán/OCR và prompt injection, quota/token usage/chi phí thật, ảnh mờ/nghiêng và độ đọc sau nén |
| **Pending backend/database integration** | Verified auth adapter, quyền/quota AI theo user, liên kết settings quản trị với backend, shared store cho budgets/context/idempotency khi nhiều instance; database chỉ bổ sung khi thống nhất retention |
| **Production blockers** | Bootstrap hiện fail closed nếu `NODE_ENV=production` mà chưa có auth adapter; cần HTTPS/reverse proxy, CSRF/session policy, trusted proxy, shared limits, monitoring/readiness và chính sách dữ liệu Google |

## 3. Hành vi đã triển khai

- Browser chỉ gọi `/api/ai/status` và `/api/ai/chat`; SDK và key chỉ tồn tại phía server. `AI_MODE=mock` không cần key; `AI_MODE=gemini` thiếu key trả `CONFIGURATION_ERROR`, không tự chuyển mock.
- Backend kiểm soát system instruction và mode `tutor`, `hint`, `solve`, `check_answer`, `explain_concept`; từ chối field lạ, model/system prompt hoặc system role do client gửi.
- Message tối đa 6000 ký tự, response 24000 ký tự. Context tối đa 10 cặp/20 messages và 24000 ký tự, chỉ lấy các lượt đã ACK; server đối chiếu canonical history theo owner.
- `clientMessageId` giữ nguyên khi retry cùng payload. Duplicate đang chạy được gộp; response thành công được cache trong phiên. Double click, late response sau Abort/Hội thoại mới và unmount có guard/fence.
- Draft text/ảnh chỉ xóa sau response thành công và còn khớp snapshot gửi. Lỗi/abort giữ draft; quick action không xóa composer. Hội thoại giữ khi điều hướng nội bộ, mất khi reload; không ghi chat/ảnh vào localStorage.
- JPEG/PNG/WebP, tối đa 4 ảnh, 10 MiB/file gốc. Client kiểm tra bytes/decode và tối ưu ảnh; backend kiểm tra lại magic/MIME/decode, giới hạn 24 MP, tổng 12 MiB ảnh và body 18 MiB, chuẩn hóa WebP/cạnh 2048 px/tối đa 2 MiB mỗi ảnh gửi provider.
- Mock ghi rõ DEMO, chỉ xác nhận tiếp nhận ảnh hợp lệ, không nhận diện đề. Form nhập/sửa đề gửi một lượt text thật tới API.
- Orb processing gắn với đọc ảnh/request, responding gắn với response nhận được và animation kết thúc; có error/reduced-motion/visibility handling, không dùng timer giả để chờ Gemini.
- Markdown/GFM/inline-display math/aligned formulas được render bằng React Markdown/KaTeX. Bỏ raw HTML, KaTeX `trust=false` với expansion/size cap, chặn link nguy hiểm và ảnh URL từ output AI.
- Server không ghi key, ảnh hay toàn bộ history vào log; context text/response trong RAM có TTL 30 phút. Không lưu ảnh lên dịch vụ storage hoặc database. Trong Gemini Mode, ảnh hiện tại sẽ được gửi Google.

## 4. Những phần vừa hoàn thiện khi tiếp tục

1. Cài dependencies server, tạo `server/package-lock.json`, chạy full typecheck/build và HTTP/SDK adapter tests thực tế.
2. Nâng sharp lên 0.35.5 để xử lý các cảnh báo upstream về bộ giải mã ảnh. Thống nhất KaTeX 0.19.0 cho renderer/CSS/transitive packages bằng overrides, tránh version cũ và cảnh báo trust bypass. Tham khảo [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) và [KaTeX advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7). `npm audit` hiện không có cảnh báo, không đồng nghĩa bảo đảm không còn lỗ hổng chưa biết.
3. Thêm browser regression bằng Playwright + Chrome đã cài. Test dùng backend/production preview riêng 3002/8444, tự đóng sau chạy, không dùng quota/context bản local 3001.
4. Thêm script build với marker environment phía server rồi scan artifact để kiểm tra cách ly secret/SDK. Marker chỉ truyền cho Vite build, không truyền backend hoặc gọi provider.
5. Cập nhật root npm/pnpm locks, env hướng dẫn và tài liệu bàn giao. Không thay UI Dashboard, sidebar, theme hoặc logic phòng thi.

## 5. File tạo/chỉnh sửa

### Trong lần tiếp tục này

| File | Thay đổi |
|---|---|
| `package.json`, `package-lock.json` | Playwright test dependency, KaTeX overrides, scripts bundle/browser kiểm thử |
| `pnpm-lock.yaml` | Cập nhật dependencies/overrides bằng pnpm 10.34.3, không chạy install lại node_modules bằng pnpm |
| `server/package.json`, `server/package-lock.json` | sharp đã vá, lockfile server, test script chạy cả HTTP/SDK và pure units |
| `playwright.ai.config.ts` | Chrome headless, backend Mock và production preview riêng |
| `tests/ai-browser.spec.ts` | Browser regression thực tế cho AI chat/ảnh/error/retry/abort/context/responsive/theme |
| `scripts/check-ai-bundle.mjs` | Production build và scan secret marker/SDK/provider endpoint |
| `GEMINI_INTEGRATION_GUIDE.md` | Cập nhật trạng thái, lệnh ci/test, activation, contract và handoff |
| `GEMINI_PREPARATION_COMPLETION.md` | Báo cáo này |

`server/.env.example` đã kiểm tra: mặc định mock, key để trống, đầy đủ model/origin/timeout/budget settings; giữ nguyên vì đã đúng. Không tạo file chứa key thật.

### Code đã có từ lần tích hợp trước và được giữ lại

- `shared/ai.ts` và toàn bộ `server/src/`, `server/tests/`, `server/tsconfig.json`.
- `src/ai/{aiClient.ts,imagePreparation.ts,MathMarkdown.tsx,useAiConversation.ts,AiTutor.tsx,ai-tutor.css}`.
- Kết nối AI trong `src/App.tsx`, gửi async/ACK trong `src/ImageComposer.tsx`, trạng thái `src/AIOrb.tsx`/`src/tutorPresence.ts`, proxy `vite.config.ts`, env ignore `.gitignore`.
- `tests/ai-client.test.cjs`, `ai-conversation.test.cjs`, `ai-image-preparation.test.cjs`, `ai-math-renderer.test.cjs` và cập nhật regression Orb/draft trong `signature-presence.test.cjs`, `signature-tool-drafts.test.cjs`.

Git status còn bao gồm thay đổi từ các giai đoạn trước; không quy toàn bộ dirty files cho lần tiếp tục này.

## 6. Kết quả kiểm thử thực tế

Môi trường: Windows, Node 24.21.0, npm 11.19.0. Server SDK 2.28.0, sharp 0.35.5; KaTeX 0.19.0 dùng thống nhất. `.mise.toml` vẫn quy định Node 22/pnpm 10.34.3; chưa chạy lại toàn bộ checks dưới Node 22.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt strict/no-unused frontend |
| `npm run ai:typecheck` | Đạt full backend TypeScript |
| `npm test` | **77/77 đạt**, gồm API client/hook, ảnh, LaTeX/security SSR và regression chức năng cũ |
| `npm run ai:test` | **25/25 đạt**: 15 HTTP/SDK adapter + 10 pure backend units |
| Production Vite build | Đạt; AI module lazy-load riêng, không đưa SDK server vào frontend |
| `npm run ai:build` | Đạt, output `server/dist/` |
| `npm run check:ai-bundle` | Đạt: build marker không lộ trong JS/CSS/HTML/map, không chứa Google SDK/AI endpoint hoặc mẫu key Google |
| `npm run test:ai-browser` | **1 browser integration test đạt**, nhiều bước thực tế trên production bundle và proxy |
| Direct/proxied status | Backend 3001 và Vite 8443 `/api/ai/status` đều HTTP 200, provider mock/configured true |
| `npm audit`, `npm --prefix server audit` | 0 vulnerabilities tại thời điểm kiểm tra |
| SHA-256 13 file ngoài AI | Khớp snapshot trước tích hợp |

Browser kiểm tra: text chat 5 mode, multi-turn context, PNG preview/gửi/ACK, mock không OCR, error giữ draft, Retry, Abort, New conversation, draft qua navigation, KaTeX render, camera sheet/Escape, reduced motion, không page error. Viewport 1440/1024/768/390/360/320 px ở light và dark không tràn ngang; mobile dock nằm trên bottom nav và phản hồi mới nhất không bị dock che. Đã xem screenshots desktop light/mobile dark; artifact ở `.cache/playwright-ai/`.

SDK adapter tests dùng SDK interface được inject để kiểm tra nội dung request và mapping lỗi. Chúng **không gọi Google**, không xác nhận credential hoặc Gemini thật hoạt động. HTTP mock tests dùng Express và sharp thật trên localhost.

Trong quá trình làm ổn định browser test, chạy lặp với backend local cũ đã gặp 429 do giới hạn 3 conversation/owner. Test hiện dùng backend fresh riêng cho mỗi lần chạy và đạt; không gỡ bỏ limiter để làm test qua.

## 7. Chạy và kích hoạt

Backend mặc định chạy mock không cần `.env` hoặc key:

```powershell
npm ci
npm --prefix server ci
npm run ai:dev
```

Tiếp tục dùng Vite đang có ở 8443. Nếu không có dev server, mở terminal khác chạy `npm run dev`. Nếu backend terminal kế thừa PORT của Vite, đặt `$env:PORT='3001'` trước khi chạy. Trong phiên triển khai đã mở backend Mock ở 3001; có thể dùng preview ngay khi tiến trình còn chạy. Không cần khởi động thêm backend trùng cổng.

Khi được cấp key, cấu hình **chỉ environment backend**: `AI_MODE=gemini`, `GEMINI_API_KEY` là secret, `GEMINI_MODEL` là model text/image hợp lệ, rồi restart backend và lấy status mới. Không sửa frontend. Hướng dẫn đầy đủ: `GEMINI_INTEGRATION_GUIDE.md`. Không đặt key trong biến VITE/source/browser request hoặc commit.

## 8. Lỗi/giới hạn còn tồn tại và việc bàn giao

- Chưa kiểm thử Gemini thật hoặc chất lượng suy luận/nhận diện ảnh; mock không giải riêng đề người dùng.
- Chưa kiểm tra camera thật, bàn phím/safe-area iOS/Android, screen reader hoặc Web Vitals/heap/FPS trên thiết bị. Browser viewport QA không thay thế các kiểm tra này.
- Context và idempotency in-memory mất khi restart/TTL; không lưu bytes ảnh cũ vào history. Hỏi lại ảnh cũ cần gửi lại ảnh hoặc dùng đề đã nhập. Sau 3 conversation còn hiệu lực phải đợi TTL; chưa có delete endpoint.
- Quota/rate/context không dùng shared store; cần bàn giao multi-instance policy. SDK Abort không bảo đảm Google ngừng xử lý/tính phí; retry thủ công sau timeout có thể phát sinh thêm phí.
- Auth adapter, quota/aiEnabled theo user và settings quản trị phải nối backend nghiệp vụ. Toggle quản trị prototype chưa enforced bởi proxy theo tài khoản; production bootstrap hiện từ chối chạy thiếu verified adapter.
- Vite vẫn có cảnh báo cấu hình cho config loader tương lai (`__dirname`, JSON import attributes), không gây lỗi build hiện tại; không sửa ngoài phạm vi AI.
- Root npm và pnpm locks đều có dependencies mới nhưng vẫn giữ phiên bản framework khác nhau đã có trước đó; lần này kiểm thử bản npm. Đồng đội cần chọn manager/toolchain CI có thẩm quyền và chạy checks bằng lock tương ứng.
- Cần triển khai HTTPS/same-origin reverse proxy, cookie/CSRF, trusted forwarding policy, readiness/monitoring, budget Google, rotation và chính sách dữ liệu/retention trước khi public. Không dùng development mode để bỏ qua auth blocker.

Không triển khai database, không deploy public, không gửi key giả tới Gemini, không báo lưu server thành công cho dữ liệu chỉ nằm cục bộ. Các báo cáo giai đoạn trước được giữ làm lịch sử, không dùng chúng thay cho kết quả kiểm thử AI lần này.
