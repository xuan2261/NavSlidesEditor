# Nghiên cứu sandbox và HTML portable
Ngày nghiên cứu: 2026-10-01. Phạm vi: xác minh contract 01/04/14; chỉ đọc tài liệu và mã, không chạy build/test/lint.

## Kết luận
Giữ kiến trúc đã chốt: runtime IIFE dùng chung, HTML do tác giả viết chạy trong sandbox="allow-scripts", portable HTML tự chứa tài nguyên.
Thiết kế này phù hợp nhưng chưa được chứng minh chạy thực tế. Sandbox không chặn mạng; bundling không tự đóng toàn bộ asset graph.
Ưu tiên inline JS/CSS đã đóng gói cho file portable; không hứa mọi data: script hoặc font hoạt động trong mọi iframe/Electron.
Không khôi phục allow-same-origin để sửa asset lỗi; xử lý URL, CSP/CORS và đóng gói ở đúng lớp.

## Bốn nguồn chính và độ tin cậy
1. [S1] MDN iframe: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox
   Tài liệu nền tảng do MDN duy trì; tin cậy cao về token sandbox, srcdoc/base URL và cảnh báo PDF, nhưng không thay thế thử nghiệm trình duyệt.
2. [S2] MDN data: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data
   Tin cậy cao về unique opaque origin, encoding và giới hạn data URL; cùng nhà xuất bản S1, không tính thành nguồn độc lập thứ hai.
3. [S3] Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
   Tài liệu maintainer chính thức; tin cậy cao về CSP, contextIsolation, process sandbox, navigation và rủi ro file:// riêng của Electron.
4. [S4] esbuild API: https://esbuild.github.io/api/#platform ; https://esbuild.github.io/api/#format-iife ; https://esbuild.github.io/api/#global-name
   Cùng một trang nguồn: https://esbuild.github.io/api/#bundle ; https://esbuild.github.io/api/#supported . Tài liệu maintainer có độ tin cậy cao về bundling/escaping.
Ba nhà xuất bản độc lập được tham khảo; mỗi nguồn chứng minh lớp riêng, không tuyên bố cả ba cùng kiểm chứng một API.

## Bằng chứng gốc của repo
- C:/Work/NavSlidesEditor/plans/261001-0639-interactive-html-education-deep-tdd/reports/execution-contracts.md là contract cố định; đã đọc đầu tiên.
- C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx:622-634 đang dùng allow-scripts allow-same-origin.
- C:/Work/NavSlidesEditor/shared/src/element-renderers.js:357-383 có nhánh PDF iframe, Mermaid srcdoc và HTML data: chưa khai báo sandbox tại các nhánh này.
- C:/Work/NavSlidesEditor/client/src/utils/offlineExport.js:368-470 đổi srcdoc/data: thành about:blank rồi blob: trên HTTP hoặc srcdoc trên file:.
- C:/Work/NavSlidesEditor/client/src/utils/offlineExport.js:79-80 dùng split("</script"), phân biệt hoa/thường dù comment nói ngược lại. Chưa tái hiện exploit.
- C:/Work/NavSlidesEditor/electron/content-security-policy.js:1-22 cho script self/inline/blob/https, KHÔNG data:; style self/inline/https, KHÔNG data:/blob:.
- C:/Work/NavSlidesEditor/electron/main.js:65-79,99-105 bật nodeIntegration:false, contextIsolation:true, sandbox:true và thêm CSP cho APP_ORIGIN HTTP.
- C:/Work/NavSlidesEditor/package.json:100-104 chốt Electron 42.9.3, esbuild 0.25.12; C:/Work/NavSlidesEditor/scripts/copy-vendor.js:78-91 đã có browser IIFE QRCode.

## Các kết luận phải đưa vào phase
1. [S1/S2] data: document vốn opaque; không coi mọi data: iframe hiện tại là same-origin với parent. srcdoc không có allow-same-origin cũng opaque.
2. [S1] Opaque origin và URL resolution là hai vấn đề khác nhau: srcdoc dùng URL parent làm base. Relative classic script có thể tải nếu CSP cho phép; fetch/module/font còn phụ thuộc CORS. Cần smoke, không suy ra mọi /vendor đều thất bại.
3. [S1] allow-scripts cho JS trong frame, không cho popup/top-navigation/same-origin mặc định. Script vẫn có thể gửi request mạng; đây không phải cam kết chống exfiltration hoặc cách ly CPU tuyệt đối.
4. [Contract] Bridge cần event.source, instance token và schema; origin opaque thường báo null nên không dùng origin null làm allowlist. Nếu bắt buộc targetOrigin=* thì chỉ gửi payload tối thiểu sau xác thực; không gửi host capability/secret.
5. [S1 + repo] Mọi nhánh canvas/Present/Share/Mermaid/print/offline phải giữ sandbox trong frame cuối, kể cả sau rewrite blob/srcdoc. Không dùng parent.contentDocument/document.write để nạp frame đã opaque.
6. [S1] Sandbox có thể chặn built-in PDF viewer. Phân biệt HTML frame phục vụ forPrint với iframe mở PDF thực; kiểm tra bản in và viewer, không nới quyền hàng loạt cho HTML tác giả.
7. [S3 + repo] Desktop CSP không đồng nghĩa CSP của file HTML mở bằng browser ngoài. File không có HTTP header; nếu áp dụng CSP thì phải kiểm tra meta policy tương thích. Không tắt webSecurity hoặc thêm unsafe-eval để chữa lỗi.
8. [S4] Chốt bundle:true, platform:browser, format:iife, globalName:NavSlidesEducation và một entry export API thật. IIFE không tự bảo đảm thiếu eval/import/network khi input/dependency vẫn chứa chúng.
9. [S4] Không tắt supported inline-script/inline-style: browser output escape chuỗi đóng script/style để nhúng HTML. Bảo đảm này không bao phủ raw JSON/bootstrap/user HTML/vendor code được ghép sau bundling.
10. [Contract + S4] Với JSON trong script, encode theo ngữ cảnh HTML, ví dụ escape ký tự < thành Unicode escape; với srcdoc/attribute dùng escaping riêng. Base64 UTF-8 giải quyết payload transport, không tự sandbox tài liệu sau decode.
11. [S4 + contract] Runtime core không external import/dynamic dependency/CDN; optional Socket.IO chỉ xuất hiện ở live boundary. Offline local không tải Socket.IO, HTTP/WebSocket hoặc dò window.parent.
12. [Contract] Đóng recursive scripts/styles/@import/url/fonts/images/audio/video/question assets/plugin files; dynamic dependency có manifest rõ. Unknown dependency hoặc fetch lỗi phải trả lỗi có slide/element/resource, không xuất file giả thành công.

## Xếp hạng cách phân phối trong kiến trúc đã chốt
| Hạng | Cách đóng gói | Hiệu năng/chi phí | Độ phức tạp/bảo trì | Rủi ro áp dụng và độ phù hợp |
|---|---|---|---|---|
| 1 | Hosted dùng vendor IIFE/CSS; portable inline bản đã đóng closure. | Không cần CDN hoặc runtime compiler; HTML lớn hơn, mất cache giữa các file. | Tái sử dụng staging/hash manifest và exporter; cần escape an toàn. | Phù hợp nhất với CSP hiện tại và file://; phải smoke font/media/nested frame. |
| 2 | Dùng data:/blob: cho asset/frame đã xác định theo từng loại. | Base64 tăng kích thước; blob cần lifecycle/revoke. | Nhiều tổ hợp CSP/CORS/MIME hơn; chỉ dùng nơi đã chứng minh cần thiết. | Không áp dụng blanket: desktop chặn data: script và stylesheet blob/data; giữ sandbox khi rewrite. |
| 3 | ESM/CDN/runtime eval hoặc nới same-origin để cứu dependency. | Có tải mạng/runtime overhead và điểm lỗi ngoài repo. | Tăng maintenance và phụ thuộc môi trường. | Loại bỏ vì trái contract; không phải đề xuất thay React/vanilla. |
MDN/browser primitives và Electron đều trưởng thành, cộng đồng lớn; rủi ro là browser/version/CSP khác nhau, không phải API mới.
esbuild có hệ sinh thái rộng nhưng nhánh 0.x vẫn có rủi ro breaking change; dùng phiên bản đã pin, không nâng dependency trong phạm vi này. Chưa khảo sát lịch sử breaking change hoặc abandonment định lượng.

## Tests cụ thể cần tạo/chạy ở implementation, chưa chạy hiện tại
- [ ] RED/GREEN isolation: HTML có nút hợp lệ vẫn tăng counter; thử parent DOM/cookie/storage, top navigation cả khi click, popup và sửa sandbox đều không chiếm parent.
- [ ] Kiểm tra cùng payload trên editor srcdoc, generated Present/Share data:/Mermaid, print HTML frame và nested frame sau portable rewrite; assert hành vi, không assert source string/token đơn thuần.
- [ ] Parser escaping: </script>, </ScRiPt>, </SCRIPT >, </style>, dấu nháy, ampersand, backslash, tiếng Việt và ký tự Unicode trong câu hỏi/vendor/frame; text phục hồi đúng, runtime vẫn trả lời/reset, injected parent marker không chạy.
- [ ] Bridge: frame khác, token sai, schema sai, instance đã destroy và message replay không đổi state; message hợp lệ đổi đúng instance, không rò capability live.
- [ ] Download thật từ UI, mở file:// trong browser context mới rồi chặn mạng: từng 19 subtype applicable local trả lời/score/reset; ảnh câu hỏi/font/media/sáu simulation/plugin hoạt động, không có request HTTP/WebSocket ngoài ý muốn.
- [ ] Kiểm tra opacity với classic script inline/absolute, image/font data:, CSS url/@import và manifest động; missing/cycle/unknown resource trả lỗi cấu trúc thay vì success thiếu asset.
- [ ] Dùng Electron thật để exercise current CSP: IIFE/inline CSS hợp lệ chạy, eval bị chặn, data: script không được mặc định coi là hợp lệ; giữ app trên localhost, file acceptance dùng browser ngoài.
- [ ] Live hosted vẫn có host và hai learner, server scoring/redaction đúng; file chỉ local classroom mode, không nối mạng hoặc tự fallback chấm điểm live.
- [ ] C:/Work/NavSlidesEditor/tests/e2e/element-preview-offline-runtime.spec.js hiện chủ yếu đọc source và page.setContent; thay assertion source/wiring bằng generated-document/file journey thật, không coi test này là bằng chứng closure.
CREATE đề xuất: C:/Work/NavSlidesEditor/tests/e2e/security/sandbox-offline-runtime.spec.js; tạo fixtures và spec ở phase14 trước khi chạy.
Lệnh focused từ repo root, chỉ chạy sau implementation: npx vitest run client/src/utils/offlineExport.test.js shared/tests/htmlGenerator.test.js server/vendor-assets.test.js
Lệnh browser proposed: npx playwright test tests/e2e/security/sandbox-offline-runtime.spec.js --project=chromium --workers=1
Playwright hiện dùng server/build artifact đã chuẩn bị; không lấy page.setContent hoặc React-only tests thay cho Download/file:// smoke.

## Giới hạn và câu hỏi chưa kiểm chứng
Chưa chạy browser/Electron, build, test hoặc lint; tất cả checklist trên vẫn unchecked. Tài liệu latest không chứng minh từng hành vi ở phiên bản repo.
Chưa khảo sát CVE, benchmark, proxy CSP triển khai hoặc ma trận browser ngoài Chromium; không tuyên bố security audit hoàn tất.
Cần scout lại CSP/CORS thực tế cho opaque font/module/iframe và từng simulation manifest trước implementation; comment "blob URLs wont work" của exporter không phải bằng chứng mọi file:// đều cấm blob.
Giữ integration owner sửa shared chokepoints tuần tự; domain owner chỉ thêm module được giao. Sau smoke thành công mới cập nhật docs/changelog, không cập nhật bây giờ.
Bổ sung bằng chứng từ Main: shared/src/reveal-runtime-assets.js:3 và node_modules/reveal.js/package.json:3 hiện là Reveal 6.0.2; dùng asset hiện tại cho keyboard/lifecycle regression, không nâng dependency hoặc lấy 6.0.1 từ plan lịch sử.
