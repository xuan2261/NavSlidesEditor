# Nghiên cứu accessibility cho learning runtime

Ngày nghiên cứu: 2026-10-01. Phạm vi: quiz, memory/flashcards, drag/drop và image-hotspot; chỉ lập yêu cầu cho plan, không triển khai hoặc chạy gates.

## Kết luận và giới hạn hợp đồng
Ưu tiên native HTML controls trên shared DOM presenter; kéo thả là cách nhập bổ sung, không phải điều kiện để hoàn thành bài. Dùng cùng reducer/evaluator cho pointer, touch và keyboard.
Giữ execution-contracts.md: 19 canonical types, 19 game subtypes; quiz có bảy question kinds; không thêm dependency, element type hoặc public lifecycle API.
Memory/flashcards/sorting là local classroom; quiz/matching chỉ live khi catalog và transport hỗ trợ thật. file:// không có multiplayer và không bảo mật được answerKey.

## Bốn nguồn sơ cấp và độ tin cậy
1. [S1] W3C WCAG 2.2 Recommendation, bản 2024-12-12: https://www.w3.org/TR/2024/REC-WCAG22-20241212/ . Đây là nguồn normative cho SC 2.1.1, 2.1.2, 2.2.1, 2.4.11, 2.5.2, 2.5.7, 2.5.8 và 4.1.3.
2. [S2] WAI APG Radio Group: https://www.w3.org/WAI/ARIA/apg/patterns/radio/ . Hướng dẫn chính thức về radio, accessible names, Space/arrows/Tab; informative, không phải chứng nhận WCAG hoặc một pattern quiz toàn diện.
3. [S3] Reveal Keyboard: https://revealjs.com/keyboard/ . Tài liệu maintainer xác nhận keyboard overrides, addKeyBinding/removeKeyBinding và precedence; không mô tả đầy đủ việc bỏ qua từng HTML control.
4. [S4] Reveal Events: https://revealjs.com/events/ . Tài liệu maintainer xác nhận ready/isReady, initialize Promise, slidechanged, slidetransitionend, resize và on/off.
Bốn tài liệu chỉ đến từ hai tổ chức; không có ba nguồn độc lập cho mọi claim. Không dùng tutorial, không suy diễn tài liệu Reveal hiện hành thành bảo đảm cho mọi phiên bản; đối chiếu source cài trong repo bên dưới.

## Xếp hạng phương án và trade-offs
| Hạng | Phương án | Hiệu năng / độ phức tạp | Chi phí / bảo trì / rủi ro | Fit |
| --- | --- | --- | --- | --- |
| 1 | Native radio/checkbox/button/select/input, shared reducer, click-select/place và optional drag. | Không thêm bundle; keyboard mặc định ít logic. | Không dependency mới; phải kiểm tra browser/AT và event ownership. | Phù hợp IIFE, React adapter và portable HTML. |
| 2 | Custom ARIA composite chỉ khi native không đáp ứng interaction đã chốt. | Thêm quản lý focus và key handling. | Dễ sai aria-state/roving tabindex; nhiều surface bảo trì hơn. | Không làm mặc định cho quiz, memory hoặc matching. |
| 3 | Drag-only hoặc keyboard-only thay cho drag. | Ít UI nhưng thiếu đường nhập. | Drag-only vi phạm yêu cầu keyboard; keyboard-only chưa thỏa SC 2.5.7. | Loại vì trái hợp đồng. |
Native HTML/WCAG là nền tảng ổn định; rủi ro adoption chính là browser/assistive technology và Reveal event behavior, không phải thư viện mới bị bỏ hoang. Không khảo sát community hoặc breaking-change history để chọn dependency vì scope cấm dependency mới.

## Quyết định interaction và feedback
- [S1] SC 2.5.7 đòi cùng chức năng bằng single pointer không kéo. Bắt buộc chọn item rồi click/tap đích, song song keyboard; không coi arrow-only là đủ.
- Quiz single-choice/true-false dùng fieldset/legend và radio cùng name; multi-choice dùng checkbox có label. Fill-blank dùng input có label; instruction/feedback liên kết bằng aria-describedby.
- [S2] Radio dùng Space để chọn, arrows để đổi đáp án, Tab/Shift+Tab để vào/ra. Không submit, chấm điểm hoặc chuyển câu khi chỉ đổi selection; khác biệt Shift+Tab ban đầu của native radio giữa browser không tự động là lỗi.
- Native button nhận Enter/Space qua một click handler; form chỉ có một submit handler, các nút phụ dùng type=button. Không cộng thêm keydown activation gây hai attempt/điểm cho cùng thao tác.
- [S1, quyết định áp dụng] Tạo vùng role=status, aria-live=polite trước interaction; cập nhật kết quả/đang chờ/điểm bằng textContent mà không lấy focus. Không dùng màu hoặc animation làm feedback duy nhất.
- Lỗi nhập có mô tả liên kết với control; aria-invalid chỉ cho dữ liệu nhập không hợp lệ, không mặc định coi đáp án học tập sai là lỗi form. Không phát timer tick liên tục qua live region.
- Memory dùng button có vị trí và trạng thái nghe được; card úp không lộ identity ảnh/text qua label, alt hay cây accessibility. Khi lật mới đọc nội dung; thông báo pair/mismatch, giữ hoặc chuyển focus tới control hợp lệ nếu card hiện tại bị disabled/removed.
- Flashcards có Flip/Previous/Next native buttons; mặt ẩn không được đọc hoặc nhận focus. Reduced motion không thay đổi kết quả, lượt hoặc thời điểm cho phép input.
- Drag/drop cho ordering/matching/sorting dùng stable item/target IDs; click-select/place và drag gọi cùng transition. Ordering có cách đổi vị trí bằng nút hoặc chọn vị trí; matching/sorting có đích được đặt tên.
- Escape hủy selection/drag chưa commit và trả focus về item; pointercancel/drop ngoài đích không đổi cấu hình, score hoặc trạng thái accepted. Commit ở thao tác hoàn tất, không chấm ngay pointerdown [S1, SC 2.5.2].
- Hotspot có ảnh với alt và danh sách region label trung tính, không tiết lộ correct region. Keyboard/text-region alternative chọn đúng region ID rồi submit cùng evaluator với tọa độ normalized 0..1; không mở rộng hitbox làm thay đổi answerKey.
- Sau resize/Reveal scale, tính tọa độ từ rendered image bounds thực tế, kể cả letterboxing; kiểm tra biên rect/circle theo evaluator đã chốt. Các region controls phải đủ target hoặc có equivalent control đủ target.
- [S1] SC 2.5.8 là 24×24 CSS px hoặc ngoại lệ hợp lệ, không phải yêu cầu tất cả hotspot phải lớn 44px. Đo control thực tế sau Reveal scaling ở 320/768/desktop; focus có chỉ báo và không bị nội dung tác giả che hoàn toàn.

## Bằng chứng repo và quyền sở hữu tích hợp
- C:/Work/NavSlidesEditor/shared/src/reveal-runtime-assets.js:3 và node_modules/reveal.js/package.json:3 cùng chỉ Reveal 6.0.2.
- C:/Work/NavSlidesEditor/node_modules/reveal.js/js/controllers/keyboard.js:149-179 có keyboardCondition, rồi loại input/textarea/contenteditable/notes; không loại button/select. Space gọi next/prev và preventDefault ở :335-346,386-389; Escape có thể bật overview ở :392-397.
- Vì vậy Space trên memory/native button hoặc arrows trên custom control có rủi ro đổi slide/fragment hoặc chặn activation. Đây là bằng chứng source, CHƯA là browser reproduction; input radio native và button cần ca kiểm tra riêng.
- C:/Work/NavSlidesEditor/shared/src/htmlGenerator.js:220-221 bắt click/Enter/Space qua closest([data-ns-action]); child control nằm trong wrapper có action có thể kích hoạt action ngoài ý muốn. :418-433 chưa đặt keyboardCondition trong config hiện đọc.
- Integration owner nối một scoped keyboardCondition vào config sẵn có, giữ điều kiện trước đó; Reveal nhường phím khi event/focus thuộc playable root, nhưng Tab vẫn thoát và deck navigation hoạt động ngoài root. Không keyboard=false toàn deck, không preventDefault mọi key.
- Integration owner cũng bảo đảm delegated action không chiếm form/control bên trong playable root và chỉ activate một lần; domain owners chỉ viết modules shared/src/education/ và browser/, mỗi production module mới <200 LOC.

## Lifecycle bắt buộc
- [S4] Mount initial slide sau ready hoặc initialize Promise; xử lý isReady nếu đăng ký muộn. Một root chỉ có một mount và một bộ listeners; adapter không tạo socket hoặc presenter thứ hai.
- slidechanged cập nhật active effective slide ngay: top-level/vertical/master đúng scope. Hide/leave giữ progress; local timer và delayed mismatch/feedback cần pause theo remaining time, không reset saved config.
- Live deadline vẫn do server tiếp tục; return/reconnect lấy authoritative state, không tự cộng điểm hoặc chuyển sang local. Gửi answerKey/feedback riêng tư chỉ theo accepted/reveal projection đã chốt.
- slidetransitionend chỉ dùng nếu cần layout/focus khi slide đã hiện; không trì hoãn pause đến transition end. Không tự cướp focus mỗi lần đổi slide; nếu focus thuộc widget vừa ẩn, chuyển sang điểm focus hợp lệ trên slide hiện tại.
- Fragment gate AND trigger visibility quyết định tương tác: root ẩn không nằm trong Tab/accessibility tree hoặc phát feedback; show không tự vượt fragment chưa reveal. Return khôi phục progress và lịch local còn lại.
- Reset/replay/destroy hủy timers, pointer capture, listeners, subscriptions và pending feedback; replay đổi generation, callback generation cũ không lật card, thông báo, gửi answer hay cộng điểm. on/off dùng cùng callback identity [S4].

## Ca RED/GREEN cần đưa vào phase, chưa chạy
| Ưu tiên | Journey thực tế | Kết quả quan sát bắt buộc |
| --- | --- | --- |
| Critical | Generated localhost Present: Tab vào quiz/card, Space/Enter, arrows rồi Tab ra. | Một activation/attempt; đáp án/card đổi đúng; slide/fragment không đổi trong widget, navigation ngoài widget vẫn chạy. |
| Critical | Ordering/matching/sorting hoàn tất bằng click/tap không drag, rồi keyboard và drag. | Cùng stable IDs, kết quả và score; Escape/pointercancel/drop sai không commit. |
| Critical | Chọn đáp án, rời/ẩn slide, quay lại; replay khi mismatch/feedback còn pending. | Progress giữ khi hide; local remaining pause/resume; replay không có callback cũ hoặc duplicate scoring. |
| Critical | Live host và hai learner contexts; late/duplicate/disconnect/reconnect/replay. | Server score đồng nhất, waiting/read-only khi disconnect, deadline không pause theo slide, không lộ keys trước reveal. |
| High | Hotspot rect/circle tại cạnh ảnh, scale/resize/letterbox và region keyboard alternative. | Hit-test theo bounds thực, cùng evaluator/score; alt và region labels không tiết lộ đáp án. |
| High | Screen reader + keyboard với quiz, card úp/lật, mismatch, lỗi nhập và kết quả. | Tên/trạng thái được đọc đúng; feedback không cần focus, không spam tick, không đọc identity card úp. |
| High | Download portable HTML, double-click file:// khi network blocked, lặp các local journeys. | Tương tác/reset đầy đủ không HTTP/WS/parent globals; ảnh và vùng hotspot tải được; không hứa live. |
| Medium | 320/768/desktop, touch và reduced motion. | Control targetable, focus nhìn thấy, không trap hoặc animation bắt buộc; geometry và results không đổi theo input. |
Những test này phải assertion trên behavior/state/focus/geometry/score, không kiểm tra source text hoặc wording. Mỗi phase scout lại source trước implementation; docs/changelog chỉ cập nhật sau smoke thành công.

## Câu hỏi chưa được xác minh
- Chưa chạy browser, screen reader hoặc generated file smoke; cần fresh scout xác nhận vendor artifact thực dùng source 6.0.2, handler order, touch navigation và accessibility tree của slide/fragment ẩn.
- SC 2.2.1 đòi tắt/điều chỉnh/gia hạn time limit hoặc ngoại lệ hợp lệ. Cần xác minh timeLimit authoring hiện có cho phép đường không giới hạn; competitive live không tự động được miễn chỉ vì gọi là game. Không tự thêm chính sách timeout ngoài execution contracts.
- Chưa có bằng chứng manual AT interoperability; DOM role assertions không chứng minh announcement. Đây là nghiên cứu interaction hẹp, không phải audit hoặc tuyên bố conform toàn bộ WCAG 2.2.

