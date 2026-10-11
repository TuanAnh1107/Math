# FRONTEND AUDIT — Math Mentor

**Ngày kiểm tra:** 11/10/2026 (Asia/Saigon).  
**Phạm vi:** toàn bộ mã frontend, cấu hình build, tài nguyên public và các script Figma Make trong workspace hiện tại.  
**Nguyên tắc:** chỉ đọc ứng dụng; chỉ tạo báo cáo này. Không sửa source/config/lockfile, thiết kế lại UI, xóa tính năng, chuyển framework hoặc triển khai backend/database.

## 1. Kết luận và độ tin cậy

Math Mentor hiện là **prototype frontend có nhiều tương tác cục bộ hoạt động**, nhưng chưa có luồng nghiệp vụ kết nối máy chủ. Navigation, chọn đáp án, đồng hồ, lưu đáp án trong phiên trình duyệt, chọn/preview ảnh và đổi theme có implementation thật. Nội dung học tập, thống kê, kết quả và phản hồi AI chủ yếu hardcode. CRUD quản trị, upload lên máy chủ, OCR, chấm thi và công cụ tính toán chưa triển khai.

TypeScript và production build đạt trong môi trường hiện tại. Điều này không chứng minh các luồng nghiệp vụ hoặc giao diện trên thiết bị đã đạt.

### Cách phân loại

- **Cục bộ:** có handler và thay đổi state, DOM hoặc browser storage thực sự; không đồng nghĩa với nghiệp vụ đã lưu trên máy chủ.
- **Mock:** nội dung/kết quả hardcode, hoặc tương tác mô phỏng trên dữ liệu mẫu.
- **UI:** có giao diện/nút/form nhưng chưa thực hiện nghiệp vụ tương ứng.
- **Xác nhận từ source:** có bằng chứng trực tiếp trong mã hoặc CSS; các bước tái hiện dưới đây là hướng dẫn kiểm thử, không phải log thao tác đã chạy trên trình duyệt.
- **Cần xác minh trực quan:** suy luận từ layout/cascade; chưa đo trên trình duyệt hoặc thiết bị.

### Giới hạn kiểm thử

Dev server hiện có trả HTTP 200 tại `http://127.0.0.1:8443`. Tuy nhiên, công cụ browser trả danh sách trình duyệt rỗng, mở in-app browser thất bại (`Browser is not available: iab`), và tìm browser trả `No browser is available`.

Vì vậy, responsive, dark mode, focus, camera, bàn phím mobile, clipboard và print được kiểm tra bằng source/CSS, **chưa có screenshot, thao tác E2E hoặc kết quả đạt trực quan**. Chưa chạy Lighthouse, React Profiler hoặc đo Web Vitals. Không coi kiểm tra HTTP là kiểm tra React đã render thành công.

## 2. Cấu trúc, routing và state management

```text
Math Mentor UI_UX System/
├── src/
│   ├── main.tsx               # Mount React.StrictMode + ThemeProvider + App
│   ├── App.tsx                # Các trang học sinh/quản trị, navigation, modal, toast
│   ├── ExamRoom.tsx           # Giao diện làm bài thi và session autosave
│   ├── ImageComposer.tsx      # Đính kèm ảnh + ImageTutorMessage
│   ├── Theme.tsx              # Context, light/dark/system, ThemeSwitcher
│   ├── index.css              # Google Font, Tailwind v4, CSS nền và responsive
│   ├── practice.css           # Trang luyện tập và phiên luyện tập
│   ├── image-composer.css     # Composer, preview ảnh, sheet mobile
│   ├── exam.css               # Phòng thi, responsive và print
│   ├── exam-dark.css          # Palette thi tối + theme controls + print
│   ├── app-theme.css          # Theme toàn app + override mobile cuối cùng
│   └── vite-env.d.ts
├── public/favicon.svg        # Favicon scaffold Figma
├── index.html                # HTML shell với các slot Figma
├── package.json
├── package-lock.json         # Lockfile npm
├── pnpm-lock.yaml            # Lockfile pnpm, khác phiên bản npm
├── tsconfig.json
├── vite.config.ts            # React, Tailwind, alias @ và plugin Figma Make
├── .mise.toml                # Node 22, pnpm 10.34.3
└── .figma/make/              # Site config và script dev/build/deploy/format
```

### Thành phần và trang

- `App.tsx` dài 166 dòng nhưng khoảng 55 KB do nhiều JSX dồn vào dòng rất dài. Component hỗ trợ: `Icon`, `Button`, `Progress`, `Heading`, `Chart`.
- 13 mục navigation học sinh; thêm 5 màn hình con (bài học, câu luyện tập, hoàn thành luyện tập, làm kiểm tra, kết quả) và trang cài ứng dụng: **19 màn hình/nhánh học sinh**.
- 11 mục quản trị: Tổng quan, Chương trình, Bài học, Câu hỏi, Đề kiểm tra, Phòng thi, Học sinh, Nhóm học sinh, Kết quả, Thông báo, Cài đặt.
- Các trang chủ yếu là hàm render bên trong `App`, chưa tách thành module theo trang hoặc domain. Không có thư mục service/API/model/store riêng.
- Graph import: `main → App, Theme`; `App → ExamRoom, Theme, ImageComposer`; `ExamRoom → Theme`. Cả sáu CSS đều được import trong `main.tsx:5` trở đi; thứ tự này quyết định cascade.

### Routing

`page: string` và `switch(page)` đóng vai trò router (`src/App.tsx:50`, `:63`, `:154`). `go()` đổi trang, reset filter/search/đáp án luyện tập và scroll đầu trang.

- URL không phản ánh trang, entity hoặc attempt. Không có URL routing, deep link, history/popstate hay route guard.
- Reload về Trang chủ; Back/Forward không điều hướng lịch sử các trang nội bộ.
- Sao chép link trong thi sao chép URL ứng dụng, không định danh phòng/đề đang làm.
- `admin` chỉ là boolean đổi giao diện. Chưa có xác thực, session hoặc phân quyền; đây là khoảng trống production, không phải cơ chế bảo mật.

### State và persistence

| Vị trí | State | Persistence và hạn chế |
|---|---|---|
| `App.tsx:50`–`:67` | Page, admin, mobile sheet, toast, modal, search/filter, question/answer/feedback, chat/message, AI toggle, examConfig | Chỉ trong bộ nhớ; mất khi reload. `message` dùng chung giữa draft AI và biểu thức công cụ Toán. |
| `Theme.tsx:8` | Mode và systemDark qua Context | Mode lưu `localStorage` với key `math-mentor-theme`; theo dõi `prefers-color-scheme`; cập nhật `data-theme` và `colorScheme` trên HTML. |
| `ExamRoom.tsx:30` | Answers, bookmark, current, mode, dialog, seconds, saved | Chỉ answers lưu `sessionStorage`, debounce 500 ms, key theo **tiêu đề** đề. Không lưu deadline/attempt ID/status. |
| `ImageComposer.tsx:17` | Draft attachments, sheet, error, replacement ref | Ảnh đọc thành data URL; chưa upload hoặc lưu lịch sử máy chủ. |
| `ImageComposer.tsx:109` | Đề nhập lại và trạng thái xác nhận của message ảnh | State nằm trong component con; mất khi rời trang AI rồi quay lại. |

Không có Redux/Zustand/React Query hoặc thư viện router; điều này không tự thân là lỗi. Cần phân tách state theo nghiệp vụ và bổ sung server state khi tích hợp.

## 3. Danh sách chức năng hiện có

### 3.1 Học sinh và chức năng dùng chung

| Trang/chức năng | Phần hoạt động cục bộ | Mock / UI / chưa hoàn thiện | Bằng chứng |
|---|---|---|---|
| Navigation | Chuyển trang, chuyển giao diện học sinh/giáo viên, menu Thêm mobile, reset tìm kiếm/filter | Không URL/history/deep link/auth; menu quản trị mobile thiếu | `App.tsx:63`, `:154`–`:162` |
| Theme | Sáng/tối/theo hệ thống, lưu preference, nghe system theme, menu có Escape/click ngoài | Chưa chứng minh màu và layout đạt trên mọi trang; một số CSS xung đột | `Theme.tsx:8`–`:65` |
| Trang chủ | CTA tiếp tục học, ôn tập, AI, tiến độ, thành tích | Tên/ngày, XP, level, streak, missions, chart, hoạt động đều cố định | `App.tsx:72`–`:88` |
| Chương trình học | Mở/đóng chương bằng details, tìm tên bài, tab trạng thái | 4 chương/tiến độ mẫu; tìm kiếm làm thay số bài/status; mọi bài mở cùng bài học | `App.tsx:90` |
| Bài học chi tiết | Đọc lý thuyết/ví dụ, anchor mục lục, CTA luyện tập/AI | Một bài Hàm số; đánh dấu hoàn thành chỉ toast; step Hoàn thành không cập nhật trạng thái | `App.tsx:91` |
| Luyện tập | Bắt đầu phiên luyện, chọn thẻ mức độ, mở sổ lỗi | Đề xuất Căn thức và cả 4 mức độ đều mở cùng bộ câu Hàm số | `App.tsx:92`–`:129` |
| Câu luyện tập | Chọn/kiểm tra đáp án, feedback đúng/sai, thử lại, chuyển câu, gợi ý | 10 lượt lặp hai câu x=2/x=4; đáp án B luôn đúng; streak/XP hiển thị không tích lũy | `App.tsx:129` |
| Hoàn thành luyện tập | Link xem lỗi và luyện tiếp | Luôn 8/10, 80%, +120 XP, 2 lỗi; không tính từ quá trình làm | `App.tsx:130` |
| Kiểm tra | Danh sách 3 thẻ, mở ExamRoom với 10 câu/15 phút hoặc 25 câu/45 phút | Đề/thời hạn mẫu; tabs không lọc entity; Sắp tới vẫn bắt đầu được | `App.tsx:131` |
| Phòng thi | Mở ExamRoom với 40 câu/90 phút và title tương ứng | Chưa có phòng thật, mã vào phòng, lịch/eligibility, người tham gia hoặc realtime | `App.tsx:131` |
| Làm bài thi | Chọn trắc nghiệm, nhập trả lời ngắn/tự luận, đánh dấu, tiến độ, chuyển câu, một câu/tất cả, modal mobile | 6 câu hardcode lặp cho mọi đề; giáo viên/mã đề cố định; tiến độ chỉ đếm câu không trống | `ExamRoom.tsx:20`–`:26`, `:47`, `:98`–`:123` |
| Timer/autosave thi | Countdown theo thời gian thực phía trình duyệt; answers lưu trong phiên sau 500 ms | Không deadline máy chủ; vào lại restart timer; hết giờ chưa khóa/nộp; chưa đồng bộ | `ExamRoom.tsx:30`–`:83` |
| Nộp/kết quả thi | Modal xác nhận và điều hướng sang kết quả, toast ghi rõ bản mẫu | `onSubmit()` không gửi answers; kết quả luôn 8.5/10, 85%, 13:42 và title đề 15 phút | `ExamRoom.tsx:123`; `App.tsx:130`, `:154` |
| Sao chép/in đề | Gọi Clipboard API và `window.print()`; in chuyển tạm sang tất cả câu | Link không đưa đến phòng/attempt; bản in tối có cascade màu sai; chưa xác minh native API | `ExamRoom.tsx:90`–`:96`, `:112`, `:127` |
| AI chat chữ | Gửi text, append lịch sử trong state, quick actions, modal xin gợi ý | Hai nhánh phản hồi theo `text.includes('hiểu')`; không AI API/stream/cancel/retry; quota 8/20 cố định | `App.tsx:66`, `:132`, `:164` |
| Đính kèm ảnh AI | Chọn nhiều file, preview, xóa/thay, sheet mobile, input camera `capture=environment`, gửi ảnh vào chat | Chỉ đọc file cục bộ; **không upload máy chủ**. Camera phụ thuộc browser/thiết bị; chưa kiểm thử thật | `ImageComposer.tsx:40`–`:102` |
| Validation ảnh | MIME JPG/PNG/WEBP, tối đa 10 MiB/file, 4 ảnh/message; lỗi có `role=alert` | Race có thể vượt cap; không loading/abort/decode/pixel limit; không drag-drop/paste ảnh | `ImageComposer.tsx:44`–`:67`, `:96` |
| OCR/đề từ ảnh | Form cho nhập lại đề và chỉnh sửa xác nhận | Thông báo rõ chưa đọc ảnh tự động; không OCR/AI ảnh; đề nhập lại không lưu vào message model | `ImageComposer.tsx:109`–`:118` |
| Công cụ Toán | Đổi tab, nhập biểu thức; bảng 4 công thức tĩnh | Máy tính, vẽ đồ thị, so sánh biểu thức chỉ toast cần bộ xử lý | `App.tsx:139` |
| Sổ lỗi sai | CTA luyện chữa lỗi | 24/8/16 và 3 lỗi mẫu; tabs đổi badge cùng các lỗi; không chữa/lưu lỗi cụ thể | `App.tsx:133` |
| Tiến độ | Link xem kết quả trong lịch sử | Summary/chart/mastery/lịch sử cố định, không cập nhật sau học/thi | `App.tsx:134` |
| Lộ trình | CTA Bắt đầu | Mục tiêu 8.5, thời lượng, lịch 7 ngày và lý do đề xuất đều mẫu | `App.tsx:135` |
| Thành tích | Hiển thị level/XP/huy hiệu/locked state | Không tính hoặc mở khóa từ hoạt động | `App.tsx:136` |
| Thông báo | Click mở trang liên quan; nút đã đọc thay giao diện tạm | 6 thông báo cố định; Chưa đọc không lọc; trạng thái đọc/badge 3 không lưu | `App.tsx:137`, `:156` |
| Hồ sơ | Nhập tên, chọn theme, mở đổi mật khẩu/chuyển quản trị | Save không đọc/lưu tên; password không đổi; các trường khác readOnly; form password còn select Chủ đề | `App.tsx:138`, `:164` |
| Cài ứng dụng | Hướng dẫn Safari và toast hướng dẫn menu browser | Không manifest/service worker/install prompt handler hoặc offline support | `App.tsx:140`; `index.html`; `public/` |
| Toast/modal | Hiển thị/đóng, các form có một phần validation native | Toast race; modal App/mobile sheet thiếu quản lý focus đầy đủ | `App.tsx:42`, `:64`, `:162`–`:164` |

### 3.2 Quản trị

| Trang/chức năng | Phần hoạt động cục bộ | Mock / UI / chưa hoàn thiện | Bằng chứng |
|---|---|---|---|
| Tổng quan | Link sang Học sinh, chart hiển thị | Metrics/học sinh cần chú ý/kết quả gần đây mock; kết quả dùng bảng học sinh | `App.tsx:141`, `:143` |
| Chương trình, Bài học | Tìm tên dữ liệu mẫu, mở form thêm/sửa | Dùng chung bảng nội dung; không hierarchy, editor, CRUD hoặc persistence | `App.tsx:142`–`:152`, `:164` |
| Ngân hàng câu hỏi | Search, modal thêm câu hỏi, input đáp án/lời giải/mức độ | 5 câu mẫu, summary 248; filter select không handler; sửa không có context câu hỏi | `App.tsx:145`, `:146`, `:152`, `:164` |
| Nhập Excel/CSV | Chọn file native, download Blob CSV mẫu | Không parse/preview/validate/import; CSV mẫu sai newline | `App.tsx:164` |
| Đề kiểm tra, Phòng thi | Mở form; thời lượng input `min=5` | Không cấu trúc đề, lịch, phân phối, publish; lựa chọn Đề kiểm tra trong form phòng thực tế là tên chủ đề | `App.tsx:145`–`:152`, `:164` |
| Học sinh | Search tên, tick checkbox, mở modal | ID/tỷ lệ/statistics mẫu; modal không gắn record; không quản lý tài khoản | `App.tsx:143`–`:146` |
| Nhóm học sinh | Search bảng mẫu | Dùng cùng bảng học sinh, chưa có group entity/membership | `App.tsx:143`–`:146` |
| Kết quả | Search bảng mẫu | Dùng cùng bảng học sinh, thiếu attempt/điểm/trạng thái chấm/review | `App.tsx:143`–`:146` |
| Selection/pagination | Checkbox native tick được; nút trang có toast | Chọn tất cả không điều khiển rows; không bulk action; pagination không đổi data | `App.tsx:146` |
| Tạo thông báo | Nhập title/body/target | Nút chỉ toast bản mẫu; không validation, preview audience hoặc gửi máy chủ | `App.tsx:151` |
| Cài đặt AI | Toggle và disable input giới hạn khi tắt | Save chỉ toast; limit/threshold không lưu; toggle không chi phối AI học sinh | `App.tsx:150`, `:132` |

Không tìm thấy lời gọi `fetch`, axios, XMLHttpRequest hoặc WebSocket trong `src`. Chưa có client API nghiệp vụ; font Google tải ngoài ứng dụng không phải tích hợp backend.

## 4. Responsive desktop, tablet và mobile

Đây là **kiểm tra tĩnh**. Không có viewport nào được đánh dấu đạt trực quan.

| Nhóm màn hình | Desktop | Tablet | Mobile | Đánh giá từ source |
|---|---|---|---|---|
| Shell/navigation học sinh | Sidebar và topbar | Sidebar rút gọn ở các breakpoint | Bottom nav 5 mục + sheet Thêm; focus mode dùng controls riêng | Có triển khai; icon tablet mất accessible name; cần kiểm tra vùng 768–1199 |
| Trang chủ, tiến độ, lộ trình | Grid nhiều cột | Thu hẹp cột; một số panel vẫn song song | Dashboard xuống một cột; two-grid một cột; summary có nhóm hai cột | Có rules; kiểm tra bảng, chart và nội dung dài ở 320/360 px |
| Chương trình/bài học | Chapter/list + reading sidebar | Sidebar hẹp | Chapter progress/mục lục ẩn, reading một cột | Có rules; cần zoom/text wrap và kiểm tra trạng thái sau search |
| Luyện tập/câu/kết quả | Layout chuyên biệt trong practice.css | Overrides 768–1199 | Answer một cột, CTA lớn, result buttons dọc | Có rules; cần kiểm tra CTA, focus và viewport landscape |
| Kiểm tra/phòng thi catalog | Thẻ hai cột | Co layout | Thẻ một cột | Có rules; logic tab chưa phản ánh availability |
| Workspace thi | Sticky header + question + navigator | Đổi kích thước và grid | Navigator thành sheet, controls cố định dưới, theme trong strip | Có implementation rõ; cần đo chiều cao sticky/header và bảng câu trên thiết bị thật |
| AI và ảnh | Tutor + aside | Aside hẹp | Aside ẩn, composer/quick actions cố định, ảnh cuộn ngang, camera sheet | Có xung đột padding; cần kiểm tra bàn phím ảo, safe-area và 4 ảnh |
| Sổ lỗi/thành tích/thông báo/hồ sơ/công cụ/cài app | Cards, fields, tabs | Grid co lại | Fields một cột; error answers dọc; cards một/hai cột | Có rules chung; chưa đo overflow/touch target từng trang |
| Quản trị toàn bộ 11 mục | Sidebar + tables/forms | Icon sidebar; role switch mất ở 768–900 | Sidebar bị ẩn nhưng không có admin mobile menu | **Lỗi navigation xác nhận từ JSX/CSS**; tables có horizontal scroll nhưng chưa kiểm tra thao tác |

### Phát hiện responsive

1. **Quản trị mất navigation và entry đổi theme trên mobile — P1.** `index.css:10` và `app-theme.css:122` ẩn sidebar; `App.tsx:158` chỉ render bottom nav khi `!admin && !focus`; `exam-dark.css:123` ẩn theme trên topbar mobile. Admin không có sheet Thêm thay thế. Vào quản trị từ hồ sơ mobile sẽ không có menu để đi đủ các mục hoặc trở về học sinh; header Hồ sơ còn rơi vào bảng generic.
2. **Sidebar tablet không có tên truy cập — P2.** `index.css:9` và `practice.css:80` ẩn `.nav-item > span`; `App.tsx:156` không có `aria-label` và SVG icon là `aria-hidden`. Cần giữ accessible name khi chỉ còn icon. Role switch ở sidebar-bottom cũng bị ẩn trong vùng 768–900 px.
3. **AI mobile có nguy cơ che tin nhắn cuối — P2, cần xác minh trực quan.** `image-composer.css:35` dành 270 px cuối main, nhưng `app-theme.css:124` được import sau ghi đè còn 112 px với cùng specificity. Composer nằm tại 80 px trên bottom nav, quick actions tại 148 px, tăng lên 292 px khi có preview (`app-theme.css:146`–`:148`). Chưa có xác minh với keyboard/visualViewport.

Breakpoint thực tế nằm rải ở `index.css:7`–`:10` (1450, 1150, 900, 767), `practice.css:76`, `exam.css:133`, `image-composer.css:34`, `app-theme.css:121`. Không nên coi tên thiết bị tương ứng một breakpoint duy nhất; cần kiểm tra các điểm biên 767/768, 900/901, 1150/1151 và 1199/1200.

## 5. Dark mode trên toàn bộ các trang

ThemeProvider có đủ ba mode và persistence cục bộ. `app-theme.css` bổ sung dark styles cho shell, cards, inputs, tables, formula, feedback, chat, ảnh, modal và nav; `exam-dark.css` có palette riêng cho thi. **Có coverage CSS không đồng nghĩa đạt visual QA.**

| Trang/nhóm trang | Coverage đọc được trong CSS | Hạng mục cần kiểm tra |
|---|---|---|
| Trang chủ | Sidebar/topbar, continue card, stats, chart, missions, AI card, medals | SVG minh họa vẫn có màu hardcode/opacity; chart tooltip và chữ nhỏ |
| Chương trình, bài học | Chapter, lesson status, formula, note, help button, reading | Contrast badge/stepper/anchor và nội dung công thức |
| Luyện tập, câu, hoàn thành | Hero/difficulty, chosen/correct/incorrect, feedback, completion | Đúng/sai không chỉ dựa màu, disabled/hover/focus |
| Kiểm tra/phòng thi catalog, kết quả | Card/tab/button qua theme chung | Mọi status và kết quả; nội dung hiện vẫn mock |
| Workspace thi và modal/danh sách câu | Palette dedicated cho header, timer, input, choices, navigator, dialog | Urgent timer, bookmark, print; có lỗi cascade bản in |
| AI chữ/ảnh | Assistant/student bubble, composer, quick actions, previews, camera sheet | Label nhập lại đề thiếu override; keyboard/safe-area và error |
| Công cụ Toán | Tab, formula, tool panel và inputs | Empty/error/result states chưa có |
| Tiến độ, lộ trình, sổ lỗi, thành tích | Chart, mastery, timeline, medal, error cards và badge | Chart legend/tooltip, locked opacity, chữ nhỏ |
| Thông báo, hồ sơ, cài ứng dụng | Notification unread/hover, profile fields, settings, button | Trạng thái đọc, readonly, theme popover/hover |
| Quản trị: tổng quan/chương trình/bài học/câu hỏi/đề/phòng/học sinh/nhóm/kết quả | Cards, tables, headers, footer, checkbox, toolbar, modal | Horizontal scroll, row states, forms generic và focus |
| Quản trị: thông báo/cài đặt | Panel, inputs, textarea, toggle, note, button | Validation/disabled states; theme control mobile không truy cập được |

### Lỗi CSS theme xác nhận từ cascade

- **Label đề từ ảnh tối quá — P2.** `image-composer.css:30` đặt `.inline-question-edit label { color: #475569 }`, không có dark override. Nền assistant là `#151d2e` (`app-theme.css:84`). Tính từ cặp màu CSS cho contrast xấp xỉ **2.22:1**, thấp cho chữ nhỏ. Đây là tính toán từ màu khai báo, chưa phải đo pixel screenshot.
- **Hover theme control desktop tối dùng nền sáng — P2.** `exam-dark.css:89` đặt `.theme-switcher summary:hover` thành `#f1f5f9`; `app-theme.css:113` đặt foreground tối mode thành `#a3aec0`. Cặp màu xấp xỉ **2.05:1**; chưa có override hover phù hợp cho theme button topbar. Control riêng trong header thi có rule khác.
- **In đề khi dark có chữ trắng trên giấy trắng — P2.** `exam-dark.css:125`–`:129` có print reset text về tối, nhưng `app-theme.css:118`–`:119` import sau và specificity cao hơn đặt h1/h2/h3 và `.exam-math` về `#f8fafc`, kể cả print. Cần xác minh print preview rồi sửa scope/cascade.
- Chuyển mode dùng effect cập nhật HTML trong `Theme.tsx:16`, nên có khả năng chớp theme nền lúc khởi động; chưa đo thời gian/ảnh hưởng. Theme system có listener cleanup; reduced-motion có rule tắt transition ở `app-theme.css:120`, nhưng chưa xử lý animation toast và các lệnh smooth scroll.

Các tỷ lệ contrast trong báo cáo được tính từ màu hex: chuyển sRGB thành linear RGB, tính luminance với trọng số 0.2126/0.7152/0.0722, rồi `(L sáng + 0.05) / (L tối + 0.05)`. Chưa đo computed styles hoặc screenshot trên trình duyệt.

## 6. Lỗi logic, form, button và khoảng trống nghiệp vụ

**P1:** ảnh hưởng trực tiếp đường đi chính hoặc tính đúng của bài làm. **P2:** cần xử lý trước khi nghiệm thu đầy đủ. **P3:** chất lượng/maintainability hoặc tối ưu sau đo đạc. Khoảng trống backend trong prototype được liệt kê riêng, không coi mọi mock là lỗi regression.

| ID | Mức | Phát hiện và tác động | Bằng chứng / kiểm thử cần chạy |
|---|---|---|---|
| F01 | P1 | Hết giờ vẫn sửa bài. Effect chỉ mở modal; modal đóng được; input không khóa. Khi seconds giữ 0, effect không chạy lại | `ExamRoom.tsx:53`, `:59`, `:72`, `:118`, `:123`. Đợi 0, đóng modal, tiếp tục nhập |
| F02 | P1 | Rời/vào lại cùng đề cấp lại toàn bộ thời gian, trong khi phục hồi đáp án | `ExamRoom.tsx:30`–`:52`. Không có startedAt/expiresAt persistent |
| F03 | P1 | Kết quả luyện/thi không từ bài làm; title kết quả không theo đề/phòng | `App.tsx:129`–`:130`, `:154`. Thi 45/90 phút hoặc bỏ trắng vẫn đi cùng kết quả 8.5 |
| F04 | P1 | Search curriculum làm đổi số bài/status vì dùng index sau filter | `App.tsx:90`. Tìm “Đồ thị”: bài thứ ba trở thành Bài 1/Hoàn thành |
| F05 | P1 | Search admin làm đổi ID, topic, difficulty, tỷ lệ và trạng thái theo index mới | `App.tsx:146`. Tìm một học sinh/câu hỏi cuối danh sách và đối chiếu trước/sau |
| F06 | P1 | Admin mobile mất đường navigation/đổi theme/trở về học sinh | JSX/CSS tại mục 4; chưa thao tác trình duyệt |
| F07 | P2 | Autosave mất lần sửa cuối khi unmount trước 500 ms; không flush ở exit/submit | `ExamRoom.tsx:76`–`:83`, `:123`. Sửa rồi rời/nộp ngay; kiểm tra lưu phiên |
| F08 | P2 | Key lưu theo title, không attempt/user; bài cũ tồn tại sau nộp; bookmark/current/mode không phục hồi | `ExamRoom.tsx:32`, `:37`, `:79`, `:123`. Retake cùng đề còn answers cũ |
| F09 | P2 | Storage thất bại vẫn hiển thị “Đang lưu…”; không failed/retry state | `ExamRoom.tsx:79`–`:80`, `:109`. Giả lập storage exception/quota |
| F10 | P2 | Các lượt FileReader đồng thời có thể vượt cap 4; Send không chờ đọc xong nên ảnh có thể rơi vào draft sau | `ImageComposer.tsx:44`–`:66`, `:70`–`:75`, `:91`. Chọn liên tiếp/gửi khi đang đọc |
| F11 | P2 | Đổi một ảnh cho chọn nhiều file: đọc tất cả nhưng chỉ dùng ảnh đầu; MIME hợp lệ không đảm bảo decode đúng | `ImageComposer.tsx:50`–`:66`, `:93`. Thử replacement nhiều file, ảnh hỏng/file rỗng |
| F12 | P2 | Đề nhập lại từ ảnh mất khi rời trang; chat/draft chỉ trong memory | `ImageComposer.tsx:109`–`:118`; `App.tsx:59`, `:132`, `:154` |
| F13 | P2 | Tabs tests/errors chỉ đổi badge; Chưa đọc không lọc. Sắp tới vẫn bắt đầu thi được | `App.tsx:131`, `:133`, `:137`. Các entity không có status riêng |
| F14 | P2 | Bài học, difficulty và luyện chữa lỗi không mang context; mọi CTA dẫn bài/bộ câu giống nhau | `App.tsx:90`–`:91`, `:119`, `:129`, `:133` |
| F15 | P2 | Admin aiEnabled/limits không chi phối chat học sinh; quota là số mẫu | `App.tsx:132`, `:150`. Tắt AI, trở lại học sinh vẫn gửi canned chat |
| F16 | P2 | Header Hồ sơ/search admin đi route học sinh rồi rơi vào bảng generic; highlight phòng thi/result thành Kiểm tra | `App.tsx:70`, `:148`–`:157` |
| F17 | P2 | Sửa không truyền record ID/giá trị; form sửa câu hỏi mất fields chuyên biệt; phòng/password dùng fields không đúng nghiệp vụ | `App.tsx:146`, `:164` |
| F18 | P2 | Form hồ sơ/settings/notification không đọc payload để lưu; notification không required; limit không min/max. Button chung thiếu type, Hủy trong form mặc định submit | `App.tsx:42`, `:138`, `:150`–`:151`, `:164`. Không khẳng định double-submit đã xảy ra; cần kiểm thử native validation |
| F19 | P2 | CSV mẫu có literal backslash+n thay newline, không tách header/data | `App.tsx:164`. Đã đọc literal bằng TypeScript AST: containsNewline=false, recordCount=1 |
| F20 | P2 | Lesson step Hoàn thành scroll về concept; toast completion không lưu progress; thông báo đọc không giữ/badge không cập nhật | `App.tsx:91`, `:137`, `:156` |
| F21 | P2 | Modal App và sheet Thêm thiếu focus trap/Escape/restore focus/scroll lock; route switch không focus heading; icon tablet thiếu tên | `App.tsx:63`, `:156`, `:162`, `:164`; đối chiếu modal ExamRoom có quản lý focus tốt hơn |
| F22 | P2 | Chat mobile padding và dark/print cascade lỗi | Các selector/vị trí đã liệt kê tại mục 4–5; phần che nội dung cần visual QA |
| F23 | P2 | HTML ngôn ngữ/brand sai: output lang=en, title/og:title “Figma Make App” dù app tiếng Việt | `.figma/make/site.json`; default `vite.config.ts:84`; đã kiểm tra HTML dev và build |
| F24 | P3 | Toast mới bị timeout cũ xóa sớm; showNotice cũng không quản lý timer cleanup | `App.tsx:64`; `ExamRoom.tsx:89` |
| F25 | P3 | UI hiển thị phím ⌘ K nhưng không có shortcut handler; select-all/pagination chỉ thao tác native/toast | `App.tsx:146`, `:157` |
| F26 | P3 | Formatter báo 6 file chưa chuẩn format; nhiều dòng JSX/CSS rất dài khó review | `App.tsx`, `ExamRoom.tsx`, `ImageComposer.tsx`, `Theme.tsx`, `main.tsx`, `vite.config.ts` |
| F27 | P2 | Nút đánh dấu câu mất tên truy cập trên mobile khi span bị ẩn; switch AI admin không có tên truy cập | `exam.css:186`, `ExamRoom.tsx:117`: icon aria-hidden và không aria-label; `App.tsx:150`: switch thiếu aria-label/aria-labelledby |
| F28 | P2 | Một số chữ phụ light mode có contrast thấp và font nhỏ | `index.css:5`: stat label/chart scale/nav label dùng #94a3b8 trên trắng, tỷ lệ từ màu khoảng 2.56:1; cần QA đọc ở zoom và thiết bị |
| F29 | P3 | Reduced-motion chỉ tắt transition, vẫn có animation/smooth scroll | `app-theme.css:120`, animation toast trong `index.css:6`, `ExamRoom.tsx:86`–`:87` |

### Các yêu cầu production còn thiếu

- Authentication, authorization và route guard; role cần lấy từ phiên người dùng và enforced ở API. Hiện không có auth flow để audit login/logout.
- Content/entity IDs, CRUD thật, chấm bài, lưu progress, kết quả theo attempt và lịch sử học.
- Room lifecycle/availability, attempt deadline trên server, autosave ACK, xử lý offline/conflict và submit idempotent.
- AI thật, upload media, OCR, quota/settings enforcement, conversation persistence và streaming/error/retry states.
- Công cụ Toán thật; cài PWA đầy đủ nếu sản phẩm yêu cầu install/offline.
- Loading/empty/error/unauthorized states và validation nghiệp vụ cho các form/API.

Đặc biệt, thông báo “Đã lưu” ở hồ sơ/settings/bài học chưa phản ánh lưu thật; nên thống nhất cách biểu đạt prototype cho đến khi có API.

## 7. TypeScript, build, unused code và toolchain

### Kết quả đã chạy

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | Đạt, không diagnostic | `strict=true`, include src và vite.config.ts |
| Thêm `--noUnusedLocals --noUnusedParameters` | Đạt, không diagnostic | Không chứng minh không có nhánh dead code/selector CSS dư |
| Vite production build ra thư mục tạm hệ thống | Đạt, 24 modules, khoảng 2.17 s | Dùng Vite đã cài; không ghi đè `dist` hoặc start server mới |
| GET dev server 8443 | HTTP 200 | HTML đã qua plugin, lang/title như F23 |
| `oxfmt --check src vite.config.ts index.html package.json tsconfig.json` | Có format issues ở 6 file | Chỉ check; không chạy formatter sửa file |
| `npm ls --depth=0` | Đọc được dependency tree, không báo dependency invalid | Không install/update dependency |
| Literal CSV qua TypeScript AST | Sai newline được xác nhận | Chỉ đọc literal, không tải file qua UI |
| Browser/E2E/visual/performance | Chưa chạy được | Browser unavailable như mục 1 |

Build dùng `node node_modules/vite/bin/vite.js build --outDir <system-temp>/math-mentor-audit-build-... --emptyOutDir`; đích mới được tạo trong temp, không phải output source của dự án.

### Bundle production đo từ build

| Artifact | Kích thước | Gzip |
|---|---:|---:|
| JS một bundle | 306.35 kB | 90.52 kB |
| CSS một bundle | 103.66 kB | 20.62 kB |
| HTML | 1.05 kB | 0.47 kB |

Chưa có route code splitting; kích thước này là baseline, chưa đủ kết luận app chậm. Sourcemap production tắt; mode development của cấu hình bật inline sourcemap cho Figma preview.

### Phiên bản và reproducibility

- Môi trường audit: Node **24.21.0**, npm **11.19.0**; `.mise.toml` yêu cầu Node **22**, pnpm **10.34.3**. Chưa kiểm chứng chạy dưới đúng toolchain mise.
- Dependency thực cài: React/React DOM **19.3.0**, Vite **8.3.4**, TypeScript **5.9.3**, Tailwind **4.3.3**. `package.json` dùng khoảng semver, TypeScript `^5.7.0` không khóa ở 5.7.
- `package-lock.json` ghi React 19.3.0/Vite 8.3.4/Tailwind 4.3.3, trong khi `pnpm-lock.yaml` ghi React 19.2.4/Vite 8.0.5/Tailwind 4.2.2. Script Figma Make dùng pnpm. Cần chọn package manager/lockfile có thẩm quyền và xác minh build CI bằng lock đó; **chưa xóa hoặc chỉnh lockfile nào**.
- `package.json` chỉ có dev/build/preview/format; build chỉ chạy Vite, không chạy typecheck. Chưa có script lint/typecheck/test hoặc test source/CI config trong workspace.
- Build có cảnh báo tương thích config loader tương lai: `__dirname` tại `vite.config.ts:30`, JSON import thiếu import attributes tại `:6`. Đây là cảnh báo, **không phải lỗi build hiện tại**.
- Workspace không có metadata `.git` khả dụng (`git status` báo not a git repository). Dùng SHA-256 để đối chiếu source/config/lockfile trước–sau audit thay cho git diff.

### Component/logic không sử dụng

Không tìm thấy TSX component/file độc lập không được dùng trong import graph hiện tại. TypeScript không báo unused locals/parameters.

- `questionScreen()` chỉ render khi page là Câu luyện tập (`App.tsx:154`), còn `isTest` chỉ true khi page là Làm bài kiểm tra (`:68`), trang này render `ExamRoom`. Do đó nhánh `isTest` trong `questionScreen` (`:129`: timer 14:32, danh sách 15 câu, save/next/submit) không có đường UI để chạy.
- Nhánh modal App “Nộp bài?” (`:164`) cũng không được mở từ đường thi hiện tại. Đây là logic cũ cần đánh giá khi refactor, **chưa xóa**.
- Selector CSS cho `.composer`/`.upload-button` còn lại từ composer cũ; composer đang dùng `.image-composer`. Không đánh giá các class động như `medal-0`/`medal-2` là unused chỉ vì không thấy literal JSX.
- Các plugin Figma trong vite.config.ts có purpose dev/build cụ thể; không coi plugin dev-only là component dư.

## 8. Hiệu năng và khả năng bảo trì

| Vấn đề | Bằng chứng | Đề xuất và cách xác minh |
|---|---|---|
| Ảnh base64 tích lũy trong chat | `ImageComposer.tsx:53`–`:64`; `App.tsx:59`, `:132` | 4 × 10 MiB tạo khoảng 53.3 MiB dữ liệu base64, chưa tính ảnh decode. Resize/compress khi phù hợp, giới hạn pixel, upload asset, phân trang lịch sử; đo heap với nhiều ảnh |
| Chat render mọi message, không giới hạn | `App.tsx:66`, `:132` | Thử hội thoại dài, lịch sử phân trang; chỉ dùng virtualization nếu profiling cho thấy cần |
| Timer rerender toàn bộ ExamRoom mỗi giây | `ExamRoom.tsx:50`, `:114`–`:120` | Chế độ tất cả có 40 câu; tách timer/Question component và profile commit trước khi memo hóa |
| State và trang tập trung ở App | `App.tsx:48`–`:166` | Tách page/domain types/services, tách draft theo ngữ cảnh; giữ UI và hành vi hiện có |
| Icon dựng lại map của mọi SVG mỗi instance | `App.tsx:7`–`:31` | Có thể hoist definitions hoặc render theo name sau profiling; không coi đây là nút thắt đã đo |
| CSS khoảng 104 kB và nhiều override | Sáu CSS import toàn cục | Gom token/scope có kiểm soát, bảo toàn giao diện; regression test các breakpoint/theme trước khi dọn |
| Font tải qua CSS Google Fonts | `index.css:1` | Đo lần tải đầu/font fallback; cân nhắc self-host/preload nếu có yêu cầu tốc độ/offline; chưa đo network waterfall |

Không ghi nhận memory leak object URL trong upload ảnh chat: code dùng FileReader data URL. CSV download có create/revoke object URL. Không khuyến nghị thêm memo/useCallback đại trà khi chưa đo.

## 9. API contract đề xuất để thống nhất với Backend Engineer

Đây là **bản đề xuất**, chưa có endpoint hoặc backend nào được triển khai/kiểm thử. Đường dẫn có thể đổi theo quy ước backend; điều quan trọng là entity model, payload, lifecycle và error semantics.

### 9.1 Quy ước chung

- Prefix ví dụ `/api/v1`; stable IDs cho user/chapter/lesson/question/exam/room/attempt/conversation/message/asset, không dùng label/title/index làm ID.
- Thống nhất phương thức auth, session expiry, CSRF nếu dùng cookie, các role student/teacher/admin và quyền theo lớp/nhóm. Frontend lấy user/permission từ `GET /me`; backend kiểm tra quyền từng request.
- JSON UTF-8, số liệu dùng number; timestamp ISO 8601 UTC. Trả `serverNow` và deadline cho thi. Quy định timezone ngày học/reset quota, đề xuất `Asia/Ho_Chi_Minh` theo ngữ cảnh hiện tại.
- List API trả cursor/pageInfo và total khi có; query search/status/topicId/difficulty không thay entity ID/status. Sort mặc định ổn định.
- Mutation có idempotency cho tạo attempt, submit, gửi message/import; response có revision/updatedAt khi cần xử lý concurrent edits.
- Error ví dụ `{ error: { code, message, fieldErrors?, retryable?, requestId } }`; thống nhất HTTP 401/403/404/409/413/422/429/5xx và error codes theo domain. Frontend không tự diễn giải toast thành thành công khi request chưa ACK.
- Nội dung toán: thống nhất text/LaTeX hoặc cấu trúc blocks và cách render; nội dung HTML/Markdown cần quy tắc sanitize. Không trả answer key/lời giải đề thi khi chưa được phép review.
- Quy định loading/empty/error/offline, retry/backoff, hủy request, quyền xem đáp án và sự khác nhau giữa mock/demo với dữ liệu thật.

### 9.2 Nhóm endpoint và dữ liệu tối thiểu

| Domain | Endpoint đề xuất | Contract tối thiểu cần thống nhất |
|---|---|---|
| User/profile | `GET /me`, `PATCH /me`, endpoint đổi mật khẩu theo auth service | ID, displayName, username, class/groups, roles/permissions, preferences; password validation và session policy |
| Dashboard | `GET /me/dashboard` | Continue lesson, progress, XP/level/streak, missions, weekly activity, weak topics, recent events; range/date/timezone |
| Curriculum/lesson | `GET /curricula`, `/chapters`, `/lessons/:id`; `PUT /me/lessons/:id/progress` | Chapter/lesson IDs, thứ tự, status độc lập, completion %, blocks lý thuyết/ví dụ, prerequisites; lưu completion/resume position |
| Practice | `POST /practice-sessions`, `GET /practice-sessions/:id`, `POST /practice-sessions/:id/answers`, `/complete` | Topic/difficulty/error context, ordered question IDs, feedback/hints/retry policy, final score/XP/streak và mistake IDs |
| Exam/room catalog | `GET /exams`, `GET /rooms`, `GET /rooms/:id` | Status open/upcoming/completed theo user, availableAt/closesAt, duration, questionCount, eligibility, attempt limits, room/code policy |
| Attempt lifecycle | `POST /exams/:id/attempts`, `GET /attempts/:id` | Create hoặc resume, immutable question snapshot, attemptId, status, startedAt/expiresAt/serverNow, answers/revision; roomId khi liên quan |
| Autosave/submit | `PUT /attempts/:id/answers`, `POST /attempts/:id/submit` | Question IDs, typed answer, bookmarks, clientMutationId/expectedRevision; ACK savedAt/revision; final answers/ACK policy, idempotency, expiry/conflict |
| Result/review | `GET /attempts/:id/result`, `GET /me/attempts` | pending_grading/graded/expired, score/maxScore, duration, đúng/sai, câu cần ôn, tự luận pending và review permissions |
| Media/upload | `POST /assets/upload-sessions`, upload URL hoặc multipart, `POST /assets/:id/complete` | assetId, MIME/bytes/pixel dimensions, max count/size, signed URL expiry, validation/processing status, delete/retention policy |
| OCR | `POST /ocr-jobs`, `GET /ocr-jobs/:id`, confirm transcription | Asset IDs, job status, recognized text/math, confidence, failure code; bản đề học sinh sửa phải lưu gắn message/context |
| AI chat | `POST /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`, stream | Role/text/asset IDs/context; message ID/client ID, sending/failed/done, stream events, abort/retry/idempotency, pagination |
| AI availability/quota | `GET /me/ai-usage`, config từ backend | enabled, used/remaining/limit, resetsAt/timezone; codes AI_DISABLED/QUOTA_EXCEEDED; settings phải enforced ở send |
| Công cụ Toán | Contract thư viện frontend hoặc `POST /math/evaluate`, `/compare`, `/graph` | Parse syntax, exact/approx result, domain/units/precision, graph range/sampling/discontinuity, invalid expression; chốt xử lý ở client hay API |
| Progress/roadmap/achievements | `GET /me/progress`, `/roadmap`, `/achievements` | Date range, mastery theo topicId, goals/tasks/status, XP awards/level/unlock; nguồn số liệu nhất quán dashboard/result |
| Mistakes | `GET /me/mistakes`, `PATCH /me/mistakes/:id`, practice từ mistake IDs | Question/attempt/context, learner answer, permitted solution, category, resolvedAt và điều kiện đã chữa |
| Notifications | `GET /me/notifications`, `PATCH /me/notifications/:id/read`, `POST /me/notifications/read-all` | readAt, unreadCount, target resource/route, pagination; badge phản ánh server state |
| Admin content | CRUD `/admin/curricula`, `/chapters`, `/lessons`, `/questions`, `/exams`, `/rooms` | Resource riêng, draft/published/archive, validation fields, revision, quyền chỉnh sửa/publish, liên kết đề/câu/phòng |
| Admin students/groups/results | `/admin/students`, `/groups`, `/groups/:id/members`, `/results` | Không dùng chung một bảng model; membership, enrollment, attempt/result/grading data, search/filter/sort/pagination |
| Import question bank | `POST /admin/question-imports/preview`, `/commit`, job status | Template schema version, csv/xlsx/encoding, row-level errors/warnings, dry-run, duplicate policy, summary và rollback/error semantics |
| Admin notifications/config | `POST /admin/notifications`, `GET/PATCH /admin/settings/ai` | Audience IDs, preview/count/send outcome; limits/threshold validation, enabled, effectiveAt, revision và audit fields |

### 9.3 Contract quan trọng: thi

```ts
type AttemptStatus = "in_progress" | "submitted" | "expired" | "pending_grading" | "graded";
type Answer =
  | { questionId: string; type: "choice"; optionId: string }
  | { questionId: string; type: "short" | "written"; text: string };

type AttemptSnapshot = {
  attemptId: string;
  examId: string;
  roomId?: string;
  title: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  revision: number;
  questions: Array<{
    questionId: string;
    type: "choice" | "short" | "written";
    prompt: string;
    mathLatex?: string;
    options?: Array<{ optionId: string; label: string }>;
    points: number;
  }>;
  answers: Answer[];
  markedQuestionIds: string[];
};
```

Phải chốt: rời/vào lại không reset deadline; server đóng attempt nguyên tử khi nộp/hết hạn; không sửa attempt đã đóng; autosave có ACK và conflict policy; request nộp lặp không tạo kết quả lặp; bài tự luận có thể chờ chấm. Frontend flush câu cuối trước exit/submit theo contract, không chỉ đợi debounce.

### 9.4 Contract quan trọng: AI và ảnh

- Upload xong mới gửi `assetIds`; frontend có states reading/uploading/ready/failed và cancel, không coi preview là upload thành công.
- Hợp nhất giới hạn MIME, **10 MiB** và **4 ảnh** hiện có hoặc chốt giới hạn mới; backend xác minh bytes/decode/dimensions, không tin MIME phía client.
- Message payload ví dụ `{ clientMessageId, text, assetIds, context: { lessonId?, questionId?, attemptId?, topicId? }, confirmedTranscription? }`.
- Event stream ví dụ `message.started`, `message.delta`, `message.completed`, `message.failed`, `usage.updated`; mỗi event có messageId/eventId và thứ tự. Chốt cơ chế SSE hay phương thức khác, reconnect/cancel và retry không tạo message trùng.
- OCR có pending/processing/succeeded/failed; cho sửa/xác nhận đề trước khi suy luận. Lưu transcription vào message model, không chỉ component state.
- Chính sách AI trong lúc thi cần chốt với sản phẩm/backend; UI hiện chỉ ẩn navigation theo focus mode, chưa có permission contract.

## 10. Kế hoạch hoàn thiện theo thứ tự ưu tiên

Không thực hiện các thay đổi này trong audit. Kế hoạch giữ React/Vite/Tailwind và giao diện hiện có.

| Thứ tự | Ưu tiên | Công việc | Điều kiện hoàn thành |
|---|---|---|---|
| 1 | P1 | Sửa F01–F06: timer/attempt lifecycle, kết quả, stable entity IDs trước filter, navigation admin mobile | Hết giờ khóa/nộp theo policy; resume giữ deadline; search không đổi identity/status; admin đi đủ trang trên mobile |
| 2 | P1/P2 | Chốt contract auth, exam/attempt/result, media/AI với backend trước tích hợp | Có schema/examples/error codes, availability/deadline/retake/review/quota thống nhất |
| 3 | P2 | Sửa save lifecycle và ảnh: flush, ACK/failed/retry, chống concurrent reads, loading/cancel, cap/decode; lưu transcription | Không mất câu cuối; không vượt cap/chuyển ảnh sang draft khác; trạng thái lưu/gửi chính xác |
| 4 | P2 | Sửa tabs/context/form/CSV/navigation F13–F20 và thông báo thành công giả | Filter đúng entity; chọn bài/mức độ/lỗi mang ID; forms nhận payload/record/validation; CSV tách header/data |
| 5 | P2 | Sửa responsive/theme/accessibility F21–F23 theo QA | Mobile chat không che nội dung; keyboard dialog/nav đạt; dark/hover/print đọc được; lang=vi/title Math Mentor |
| 6 | P2 | Tách types/page components/API layer/state theo domain; thống nhất toolchain/lockfile; thêm typecheck/checks CI | Build reproducible bằng package manager chuẩn; domain state không dùng label/index; không đổi UI/tính năng |
| 7 | P2 | Tích hợp auth + nội dung + practice + exam/results, sau đó dashboard/progress/mistakes/roadmap/achievements | Thay mock có kiểm soát, xử lý loading/empty/error; số liệu học/thi và thống kê nhất quán |
| 8 | P2 | Tích hợp upload/OCR/AI/quota, CRUD admin/import/notification/settings; quyết định math engine/PWA | Nghiệp vụ lưu thật; server enforcement; import preview/errors; công cụ trả kết quả thật |
| 9 | P3 | Dọn logic/CSS cũ sau đối chiếu, format, toast cleanup; profile bundle/chat/exam/ảnh | Không xóa tính năng đang dùng; profiling có baseline và regression checks |

### Ma trận nghiệm thu cần chạy khi có browser

- **Viewport:** desktop 1440×900, 1280×800; tablet 1024×768, 768×1024; mobile 390×844, 360×800, 320×568; thêm landscape và điểm biên breakpoint ở mục 4.
- **Theme:** light/dark/system cho đủ 19 màn hình học sinh + 11 mục admin, các modal/sheets/toast, readonly/disabled/focus/hover, đúng/sai, answered/marked và print. System đổi theo OS, reload giữ preference.
- **Navigation:** đi tất cả mục bằng mouse/touch/keyboard, admin↔student, Back/Forward/reload/deep link sau bổ sung router; focus sau chuyển trang; không mắc kẹt admin mobile.
- **Forms/buttons:** required/min/max, dữ liệu sai/trống/dài, submit Enter, Hủy không submit, double-click, pending/error/retry, record edit đúng ID, select-all/pagination/filter thật.
- **Practice:** chọn sai→retry→đúng, từng topic/difficulty/mistake context, completion tính đúng score/XP và cập nhật progress.
- **Exam:** một câu/tất cả, 10/25/40 câu, bookmark, answers autosave/resume, sửa rồi exit nhanh, storage failure/offline, deadline 0, submit lặp và pending grading; print cả theme; link mở đúng room.
- **AI/ảnh:** text/quick actions/context, dài nhiều lượt, IME tiếng Việt/Enter/Shift+Enter, 4 ảnh/5 ảnh, 10 MiB/over-limit, MIME sai/hỏng, replace/cancel, chọn đồng thời/send khi đọc; camera và bàn phím iOS/Android; OCR sửa/xác nhận; upload/API fail, quota/disabled, cancel/retry stream.
- **Hiệu năng:** đo build production/Web Vitals và React Profiler/heap với hội thoại dài, nhiều ảnh và thi tất cả 40 câu; đặt ngân sách sau baseline đo thực tế.

## 11. Tính toàn vẹn của audit

Không sửa application source/config/dependency/lockfile. Không chạy install/update, formatter ghi file, deploy hoặc gửi dữ liệu cho tài khoản thật. Build artifacts tạo trong thư mục temp ngoài source. Báo cáo này là artifact duy nhất được tạo trong workspace theo yêu cầu.

Đối chiếu SHA-256 cho 12 file `src` và 7 file cấu hình/lockfile/HTML/site config trước–sau được dùng để xác minh không thay đổi chúng. Các kết quả chưa kiểm thử trực quan đã được ghi rõ, không thay thế cho nghiệm thu trên trình duyệt thật.
