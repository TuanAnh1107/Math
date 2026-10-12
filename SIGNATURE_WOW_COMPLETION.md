# Math Mentor — Signature WOW Experience

**Ngày:** 11/10/2026, Asia/Saigon.  
**Trạng thái:** đã triển khai code và đạt kiểm tra tự động; **chưa nghiệm thu đầy đủ visual/mobile trên browser và thiết bị thật**.

Giữ React + Vite + TypeScript + Tailwind CSS, cấu trúc navigation hiện có và nhận diện tím/xanh của Math Mentor. Không thêm dependency, backend, database hoặc AI API. Không thay đổi logic phòng thi.

## 1. Bảo vệ thay đổi và nền tảng motion

Đã kiểm tra Git status trước khi triển khai. Workspace có thay đổi chưa commit của các phase trước; không reset, stash, xóa hoặc ghi đè chúng bằng phiên bản từ Git.

Snapshot source, tests và cấu hình trước Signature:

- `.backups/math-mentor-before-signature-20261011-204250.zip`
- 136.075 bytes, 50 file; đã kiểm tra nội dung snapshot.
- SHA-256: `952970CE9A0DC50FF41E3193A912F438C42280480122506B583FB596A5FC51B7`.

Đối chiếu lại 50 file trong snapshot sau triển khai: chỉ `src/App.tsx`, `src/ImageComposer.tsx`, `src/main.tsx`, `tests/component-harness.cjs` và `tests/phase1-practice.test.cjs` thay đổi. Không có file trong snapshot bị mất. Các file cấu hình, lockfile, theme/responsive của Phase 2/3 và `ExamRoom.tsx`/`examModel.ts` giữ nguyên byte so với snapshot. Các module Signature mới được thêm riêng.

Các hiệu ứng Phase 3 đã có và được giữ: count-up, scroll reveal, progress/chart, phản hồi button/icon, message entrance và preview ảnh. Nâng cấp chọn lọc phần hero pointer motion và chuyển trang; không áp dụng spotlight hoặc animation lặp cho mọi card.

Motion tokens dùng chung:

| Nhóm | Giá trị |
|---|---|
| Phản hồi / chi tiết / chuyển cảnh / reveal | 160 / 260 / 380 / 540 ms |
| Easing | `cubic-bezier(.16,1,.3,1)` và `cubic-bezier(.22,.68,0,1)` |
| Pointer damping | Response 86 ms, ngưỡng dừng 0.002; không overshoot |
| Chiều sâu | Perspective 1000 px, tilt tối đa 1.5° / 2° |
| Ánh sáng | Bán kính 340 px, strength 0.16 |

Damping tính theo thời gian frame; không dùng vòng RAF chạy liên tục khi con trỏ đã ổn định.

## 2. Ba tương tác Signature

### Đồ thị hàm số có phép tính thật

Thay SVG minh họa tĩnh ở dashboard bằng `FunctionGraph`:

- Vẽ hệ trục, grid, đường `y = ax + b`, điểm P, đường gióng và tooltip bằng SVG.
- Điều chỉnh `a` từ −3 đến 3, bước 0.25; `b` từ −5 đến 5, bước 0.5. Có Đặt lại.
- Pointer/touch chọn điểm theo hoành độ; hỗ trợ ←/→, Home/End khi đồ thị có focus và thanh trượt native qua bàn phím.
- Phạm vi trục x là [−5, 5], y là [−10, 10]. Đường và điểm được giới hạn trong phần nhìn thấy; nếu hoành độ nằm ngoài đoạn nhìn thấy, điểm được chặn về biên hợp lệ.
- Hoành độ điểm được làm tròn 2 chữ số; tung độ tính từ **chính hoành độ được hiển thị**. Đường, điểm, tooltip, equation và readout cập nhật cùng một frame.
- Ví dụ mặc định: `y = 1.5x + 1`, P(1, 2.5). Hỗ trợ `a = 0` để khám phá hàm hằng.
- Vẽ đường khi mount, reveal đường gióng, halo nhẹ quanh điểm; hero không tilt để tránh làm sai phép ánh xạ tọa độ.
- Giữ tham số và điểm trong phiên App khi rời dashboard rồi quay lại. Touch dùng `pan-y`, không chặn cuộn dọc.

Pointer không cập nhật React state. Một frame gộp các sự kiện liên tiếp; cache bounds được vô hiệu hóa khi resize/scroll. Có cleanup frame, observer và listener. Điều chỉnh tham số được phản hồi trên frame kế tiếp, không làm trễ phép tính để tạo hiệu ứng.

### Ánh sáng không gian theo con trỏ

Áp dụng cho hero, card hoạt động tuần, phần cần củng cố và AI teaser ở dashboard:

- Spotlight có damping nhẹ; viền tím/xanh phản ứng quanh vị trí con trỏ.
- Overlay giới hạn trong card, không bắt sự kiện click; cường độ nhẹ để giữ nội dung đọc được.
- Card phù hợp có tilt giới hạn; hero giữ phẳng. Background aurora và lớp grid dịch chuyển khác tốc độ.
- Aurora chỉ nằm trong hero, gồm hai lớp chuyển động chậm 22/29 giây. Thiết bị coarse pointer giảm về một lớp tĩnh, không phụ thuộc hover.
- Dừng RAF sau khi ổn định; trở về trung tính khi rời card, hủy frame khi card ngoài viewport hoặc document bị ẩn. Aurora pause khi hero không nhìn thấy.

### AI Orb phản hồi trạng thái thật của demo

Orb là SVG với các quỹ đạo ellipse/ribbon, điểm sáng và core; dùng CSS animation, không có vòng React render liên tục. Có phiên bản dashboard teaser, presence trong AI Tutor và icon message tĩnh.

| State | Nguồn trạng thái |
|---|---|
| Idle | Không có thao tác đang diễn ra |
| Focused | Composer đang có focus |
| Processing | Đang đọc/decode ảnh thật **trên thiết bị**, có nhãn “chưa upload” |
| Responding | Nội dung phản hồi demo vừa được thêm vào chat; pulse 900 ms, không giả chờ server |
| Error | Validation hoặc đọc ảnh thất bại; lỗi vẫn hiển thị trong composer |

AI Tutor ghi rõ “Demo cục bộ · chưa kết nối AI”; quota cũng được ghi là demo. Giữ chức năng camera/chọn ảnh, giới hạn và retry đã có từ Phase 2. Orb pause khi document/element không hiển thị; icon trong lịch sử chat không animate để tránh nhiều vòng lặp.

## 3. Navigation, chuyển cảnh và giữ state

- Sidebar giữ nguyên vị trí. Nội dung chuyển cảnh 380 ms bằng opacity; heading có translate/clip reveal, toolbar/breadcrumb xuất hiện phối hợp. Không transform toàn `main`, để composer fixed giữ đúng vị trí.
- Hủy animation trước khi chạy cảnh tiếp theo khi click nhanh. Không dùng màn hình chờ hoặc trì hoãn navigation nghiệp vụ. Bỏ chuyển cảnh Signature trong phòng thi.
- Active indicator sidebar di chuyển giữa các mục; xóa indicator khi trang không có mục tương ứng. Tab indicator đo cả X/Y/width/height để theo đúng nút khi tabs wrap trên mobile.
- Lesson row có accent rail và arrow reveal qua hover/focus. Giữ count-up, progress và icon interaction của Phase 3.
- Modal và sheet có entrance theo chiều sâu. **Đóng vẫn ngay lập tức** để giữ Escape, focus restoration và thao tác cũ; chưa thêm exit animation cần giữ DOM sau đóng.
- Không ép shared transition lesson card → detail: các CTA hiện mở chung một bài mẫu, chưa có entity/context phù hợp cho continuity an toàn.
- Giữ AI route mounted và ẩn bằng `hidden` khi rời trang: draft text, ảnh và đề nhập lại trong component không mất do navigation. Composer off-route đóng sheet và bỏ trạng thái focus.
- Tách draft Công cụ Toán khỏi chat; cả hai biểu thức giữ khi đổi tab/rời trang. Giữ draft form native ở hồ sơ/quản trị trong memory; loại trừ password/file và các input thuộc domain được điều khiển riêng.
- Phiên luyện tập đang làm có “Tiếp tục phiên luyện”; rời rồi quay lại giữ lựa chọn/feedback. Bắt đầu một phiên mới vẫn reset có chủ đích.
- Phòng thi giữ nguyên store, deadline tuyệt đối, khóa sau hết hạn và tính điểm demo. Không có aurora/spotlight/Orb nhìn thấy trong workspace thi.

Navigation ứng dụng vẫn dùng page state như trước: chưa có URL routing/deep link/history nội bộ. Bản nâng cấp không thêm history entry hay can thiệp Back/Forward của browser. Draft form/chat/graph/luyện tập giữ trong phiên App, **không tồn tại sau reload**; persistence phòng thi tiếp tục dùng cơ chế sessionStorage đã có.

## 4. File mới và file chỉnh sửa

| File mới | Vai trò |
|---|---|
| `src/FunctionGraph.tsx` | Component SVG, sliders, pointer/keyboard controller |
| `src/functionGraphModel.ts` | Phép tính, clipping, projection và formatting |
| `src/AIOrb.tsx` | Component SVG Orb và pause theo visibility |
| `src/tutorPresence.ts` | State mapping và mô tả trung thực của demo |
| `src/motionTokens.ts` | Tokens dùng chung và pointer damping |
| `src/useNavigationMotion.ts` | Geometry indicator, resize/visibility/cleanup |
| `src/useFormDrafts.ts` | Giữ draft form native trong memory |
| `src/signature.css` | Graph, Orb, lighting, aurora, indicator và theme/mobile/reduced-motion |

File source chỉnh so với snapshot trước Signature:

- `src/App.tsx`: tích hợp graph/Orb/lighting/chuyển cảnh, draft và giữ phiên luyện.
- `src/ImageComposer.tsx`: cung cấp activity thật cho Orb; prop active giữ draft nhưng đóng sheet khi rời trang.
- `src/main.tsx`: import stylesheet Signature sau stylesheet hiện có.

Kiểm thử chỉnh/thêm cho Signature:

- `tests/component-harness.cjs`: hook/effect/ref và module-loading harness dùng chung; không thay thế browser.
- `tests/phase1-practice.test.cjs`: thêm kiểm tra rời rồi tiếp tục phiên luyện.
- `tests/signature-graph.test.cjs`, `tests/signature-graph-controller.test.cjs`.
- `tests/signature-presence.test.cjs`, `tests/signature-navigation.test.cjs`.
- `tests/signature-drafts.test.cjs`, `tests/signature-tool-drafts.test.cjs`.
- `SIGNATURE_WOW_COMPLETION.md`: báo cáo này.

Các file xuất hiện trong Git diff từ Phase 2/3 như cấu hình HTML/site, `vite.config.ts`, `app-theme.css`, `image-composer.css`, `imageAttachments.ts`, `motion.css` và báo cáo phase trước **không phải thay đổi mới của Signature**. Chúng được giữ nguyên so với snapshot.

## 5. Kết quả kiểm tra

Đã chạy typecheck và production build sau từng nhóm lớn:

| Nhóm | TypeScript | Production build |
|---|---|---|
| Motion foundation | Đạt | Đạt |
| Living Mathematics | Đạt | Đạt |
| Interactive Lighting | Đạt | Đạt |
| AI Orb | Đạt | Đạt |
| Navigation/transitions/draft | Đạt | Đạt |
| Review fixes và regression cuối | Đạt | Đạt |

Kiểm tra cuối:

- `node node_modules/typescript/bin/tsc --noEmit --noUnusedLocals --noUnusedParameters`: exit 0, không diagnostic.
- `node --test tests/*.test.cjs`: **48 test đạt, 0 thất bại**, gồm 38 regression Phase 1/2/3 và 10 test Signature.
- Production build Vite 8.3.4: exit 0, 39 modules; output trong thư mục temp mới, không ghi đè `dist`.
- `git diff --check`: đạt. Git có cảnh báo LF/CRLF; không có lỗi whitespace.
- Build vẫn có hai warning cấu hình đã có: `__dirname` và JSON import thiếu import attributes khi dùng native config loader tương lai. Không sửa cấu hình ngoài phạm vi.

Coverage có bằng chứng tự động:

- Ma trận 2.625 tổ hợp tham số/điểm đồ thị; slope dương/âm/0, clipping và tính tọa độ nhất quán.
- SSR markup: slider labels, reset, hướng dẫn keyboard/touch và unique SVG gradient IDs.
- Hook/fake DOM: pointer burst chỉ tạo một frame, bounds cache, cập nhật đồng bộ, keyboard announcement, hidden/visible và cleanup.
- Damping không overshoot và hội tụ nhất quán ở các frame rate; Orb state gắn đọc ảnh/focus/error/phản hồi demo.
- Indicator theo hàng tab wrap, xóa highlight khi route không có active, gộp click nhanh và cleanup khi vào exam.
- Draft native không lưu password/input được bảo vệ; hai biểu thức và draft AI không ghi đè nhau.
- Regression: hết hạn tự đóng một lần, handler cũ không sửa bài tại deadline, remount giữ deadline, submit lấy đáp án cuối ngay; kết quả objective và tự luận pending; giữ đáp án khi tiếp tục luyện.
- Regression còn đạt cho stable IDs/search, mobile admin menu/theme/role switch, validation/decode/cap ảnh và rules motion Phase 3.

Đây là kiểm tra model, SSR, source và hook/fake DOM; **không gọi chúng là E2E hoặc kiểm thử browser**.

### Bundle và giới hạn đo hiệu năng

| Artifact | Trước Signature | Sau Signature | Tăng gzip |
|---|---:|---:|---:|
| JS | 331.57 kB / gzip 97.58 kB | 348.53 kB / gzip 103.04 kB | 5.46 kB, khoảng 5.6% |
| CSS | 117.17 kB / gzip 23.31 kB | 132.65 kB / gzip 26.31 kB | 3.00 kB, khoảng 12.9% |

Không thêm thư viện đồ họa nặng, WebGL hoặc dependency. Các module SVG nhẹ được import trực tiếp; chưa cần lazy-load module đồ họa nặng. Chưa đo Web Vitals, Lighthouse, GPU, FPS hoặc heap trên thiết bị thật; số bundle không chứng minh thời gian tải/animation đạt ngân sách hiệu năng.

## 6. Nghiệm thu còn chờ và kiểm thử thủ công

Công cụ browser hiện trả danh sách browser rỗng; không có screenshot hoặc thao tác E2E trong lần triển khai này. Không kế thừa kết quả browser của báo cáo phase trước làm bằng chứng cho Signature.

| Tiêu chí | Trạng thái hiện tại |
|---|---|
| Phép tính đồ thị, a/b, clipping, reset/controller | Đạt tự động; cảm giác tương tác cần browser |
| Spotlight/depth/Orb/chuyển cảnh | Có implementation, review source; cần visual QA |
| Reduced motion/visibility pause | Có code/CSS và coverage liên quan; cần kiểm tra OS/browser thực |
| Mobile không overflow/che navigation, dark mode | Có responsive/theme rules; chưa xác nhận trực quan |
| Không phá logic thi và regression hiện có | Test đạt; cần E2E tương tác thực |
| TypeScript/build | Đạt |

Chạy trên **320, 360, 390, 768, 1024 và 1440 px**, theme light/dark/system; thêm landscape và zoom 200%:

1. **Dashboard/graph:** mặc định x=1 cho y=2.5; thử a âm/dương/0, a=±3, b=±5, điểm sát biên. So tooltip, readout, đường gióng với phép tính. Kéo slider, chạm/kéo đồ thị, cuộn dọc, dùng Tab/←/→/Home/End và reset. Rời/quay lại giữ tham số; không có overflow hoặc tilt làm lệch điểm.
2. **Lighting:** di chuột nhanh/chậm trên bốn vùng được chọn; kiểm tra inertia, ánh sáng không che chữ và CTA vẫn click được. Cuộn card ra ngoài viewport, chuyển tab browser rồi quay lại. Mobile có aurora tĩnh, không cần hover mới đọc/thao tác được.
3. **AI/Orb/ảnh:** focus/blur composer; chọn ảnh thật để thấy processing local, dùng ảnh hỏng/sai MIME để thấy error, retry/xóa rồi gửi. Phản hồi demo xuất hiện ngay và Orb phản hồi theo nội dung. Camera/library, 4/5 ảnh, đúng/vượt 10 MiB; keyboard và safe-area iOS/Android. Không coi preview là upload/OCR/AI thật.
4. **Giữ draft:** soạn chat, đính ảnh, nhập lại đề rồi đổi trang và trở lại; nội dung vẫn còn. Công cụ Toán giữ cả hai biểu thức khi đổi tab. Hồ sơ, form thông báo/cài đặt admin giữ draft sau rời/quay lại; password không được giữ. Reload xóa draft memory như giới hạn đã nêu.
5. **Navigation/chuyển cảnh:** click nhanh nhiều mục; không trắng trang, không mắc animation, focus indicator còn rõ. Tab Công cụ Toán xuống hàng phải highlight đúng hàng; trang Cài Math Mentor không giữ highlight sidebar cũ. Admin mobile truy cập đủ 11 mục, theme và trở về học sinh. Back/Forward giữ hành vi browser hiện có.
6. **Modal/sheet:** mở, đóng, Escape, click ngoài, Tab/Shift+Tab, focus restoration và scroll lock; entrance không cản click. Composer sheet ẩn/đóng khi rời AI.
7. **Reduced motion:** bật trước load và đổi khi App đang mở. Graph/Orb/aurora/lighting/chuyển cảnh Signature tĩnh hoặc giảm theo preference; nội dung vẫn xuất hiện. Smooth scroll bằng JS của phòng thi là hành vi cũ, không tuyên bố đã loại bỏ mọi chuyển động trong exam.
8. **Phòng thi:** đề 10/25/40 câu, một câu/tất cả, bookmark, trắc nghiệm/short/written; rời/quay lại/reload giữ deadline. Sửa rồi submit ngay; hết giờ không tiếp tục làm, quay lại không tạo phiên mới. Điểm chỉ cho câu có key demo, tự luận vẫn chờ chấm. Không có hiệu ứng Signature gây mất tập trung hoặc che controls.

## 7. Chức năng vẫn mock hoặc chưa có nghiệp vụ thật

- AI text dùng phản hồi mẫu; không request/stream AI, không OCR hoặc upload server. Orb không thay đổi điều này.
- Quota, dashboard metrics, tiến độ, lộ trình, thành tích và lịch sử mẫu chưa lấy từ backend.
- Nội dung luyện/thi là bộ câu mẫu có ID ổn định; điểm/XP tính cục bộ, không phải kết quả hay phần thưởng máy chủ. Deadline client chưa có đồng hồ server tin cậy.
- CRUD quản trị, lưu hồ sơ/settings, thông báo, import, authentication và công cụ tính toán ở trang Công cụ Toán vẫn theo implementation demo/UI hiện có. Graph thật mới nằm ở dashboard, không biến các công cụ khác thành math engine.
- Chưa có URL router/deep link, database, conversation persistence hoặc PWA offline đầy đủ.

Các tính năng Signature mới không hiển thị thông báo lưu/gửi thành công lên server. Những toast và nghiệp vụ demo cũ ngoài phạm vi vẫn cần tích hợp/chuẩn hóa trong giai đoạn tương ứng. Báo cáo này ghi nhận triển khai và bằng chứng hiện có; chưa đánh dấu toàn bộ acceptance visual/device là hoàn tất.
