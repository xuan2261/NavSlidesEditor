# CẨM NANG HƯỚNG DẪN SỬ DỤNG PHẦN MỀM NAVSLIDES
*(Phiên bản 1.4.0 - Năm 2026)*

## Chương 1: Giới thiệu tổng quan hệ thống

### 1.1. Sứ mệnh và Tầm nhìn của NavSlides
Trong bối cảnh chuyển đổi số giáo dục đang diễn ra mạnh mẽ, phần mềm NavSlides Editor ra đời nhằm phá vỡ những giới hạn của các công cụ thuyết trình truyền thống. Được xây dựng trên nền tảng thư viện mã nguồn mở Reveal.js và React 18, NavSlides không chỉ là một công cụ thiết kế slide mà còn là một môi trường phát triển bài giảng điện tử tương tác toàn diện.

Sứ mệnh của NavSlides là mang đến cho giảng viên, đặc biệt là các khối ngành khoa học kỹ thuật, một công cụ có thể kết nối liền mạch giữa văn bản, công thức Toán học phức tạp, mã nguồn lập trình và các mô phỏng vật lý động, giúp bài giảng trở nên sinh động và sâu sắc hơn bao giờ hết. Khác với PowerPoint thường chỉ tạo ra các file tĩnh, NavSlides biên dịch bài giảng thành một ứng dụng Web (HTML5/CSS3/JS) hiện đại, có thể nhúng trực tiếp vào các hệ thống E-Learning (LMS) như Moodle hay Canvas.

### 1.2. Các tính năng cốt lõi vượt trội
Hệ thống được thiết kế với hàng loạt công cụ mạnh mẽ:
- **Trình soạn thảo WYSIWYG nâng cao:** Kết hợp hoàn hảo giữa giao diện kéo thả trực quan và khả năng chỉnh sửa mã nguồn HTML/CSS/JS cục bộ cho từng đối tượng (Element).
- **Hệ thống Toán học và Code Block:** Tích hợp sẵn KaTeX/MathJax để render công thức toán học sắc nét. Code block hỗ trợ syntax highlighting (làm nổi bật cú pháp) cho hơn 50 ngôn ngữ lập trình.
- **Presenter Tools (Công cụ dành cho diễn giả):** Không chỉ trình chiếu, NavSlides cung cấp bảng đen tương tác (Chalkboard), bút vẽ dạ quang (Pen/Highlighter), và khả năng thu phóng khung hình (Zoom) tự do lên bất kỳ điểm nào trên slide.
- **Quản lý đa phương tiện cục bộ (Local Media Handling):** Hệ thống tự động chuyển đổi ảnh/video tải lên thành định dạng Base64 hoặc Blob URL an toàn, sau đó đóng gói tất cả vào một file nén `.navslides` duy nhất để sử dụng offline.
- **Tính năng AI Copywriter và AI Generator:** Hỗ trợ trực tiếp gọi các mô hình Ngôn ngữ lớn (LLM) để dịch thuật, tóm tắt hoặc viết mã HTML tạo các mô phỏng ngay bên trong Editor.

### 1.3. Yêu cầu kỹ thuật và Cấu hình khuyến nghị
Để đảm bảo trải nghiệm tốt nhất khi sử dụng NavSlides, hệ thống máy tính của người dùng cần đáp ứng:
- **Trình duyệt (Browser):** Bắt buộc sử dụng các trình duyệt dựa trên nhân Chromium (Google Chrome 100+, Microsoft Edge) hoặc Mozilla Firefox 110+. Không khuyến nghị sử dụng Internet Explorer.
- **Độ phân giải màn hình:** Tối thiểu 1366x768. Khuyến nghị độ phân giải Full HD (1920x1080) hoặc 2K để không gian làm việc (Workspace) hiển thị đầy đủ thanh công cụ và Properties Panel.
- **Cấu hình phần cứng:** RAM tối thiểu 4GB (Khuyến nghị 8GB khi thiết kế bài giảng chứa nhiều video/Canvas hoạt họa). Hệ thống sử dụng GPU acceleration của trình duyệt, do đó máy có Card đồ họa rời là một lợi thế.

---

## Chương 2: Làm quen với Không gian làm việc (Workspace)

### 2.1. Giao diện Màn hình Chính (Home Dashboard)
Ngay sau khi khởi động hệ thống qua đường dẫn `http://localhost:5173`, bạn sẽ được đưa vào giao diện Dashboard hiện đại. Tại đây, phần mềm cung cấp cho bạn cái nhìn bao quát về toàn bộ các dự án đang thực hiện.
- **Recent Presentations:** Danh sách các bài giảng bạn đã lưu gần đây trên bộ nhớ trình duyệt (LocalStorage/IndexedDB).
- **Create New (Tạo mới):** Nút khởi tạo một dự án trắng (Blank).
- **Template Library (Thư viện mẫu):** Khu vực chứa các Mẫu bài giảng (Templates) được thiết kế sẵn cho nhiều mục đích: Kỹ thuật, Kinh doanh, Giáo án điện tử.
- **Import Project (Nhập dự án):** Hỗ trợ kéo-thả (Drag & Drop) trực tiếp file `.navslides` từ máy tính của bạn vào trình duyệt để mở và tiếp tục chỉnh sửa.

[SCREENSHOT: 01_home_full.png]

### 2.2. Phân phẫu Giao diện Editor (Editor Anatomy)
Khi bạn nhấp mở một bài giảng, bạn sẽ bước vào Không gian soạn thảo chính (Editor Workspace). Giao diện này được chia làm 4 khu vực tĩnh mạch lạc, lấy cảm hứng từ các phần mềm đồ họa chuyên nghiệp:

1. **Top Menu Bar (Thanh Menu trên cùng):** Chứa các chức năng hệ thống như Tên bài giảng, trạng thái lưu tự động (Auto-save), nút Trình chiếu (Present), Chia sẻ (Share) và Xuất dự án (Export).
2. **Slide Navigator (Thanh cuộn bên trái):** Hiển thị danh sách hình thu nhỏ (Thumbnails) của toàn bộ các trang slide. Hỗ trợ thao tác kéo thả (Drag & Drop) để thay đổi thứ tự trang.
3. **Canvas Area (Khu vực vẽ trung tâm):** Nơi hiển thị WYSIWYG của slide hiện tại. Đây là khung giới hạn tỉ lệ 16:9 (thường là 960x700). Mọi yếu tố thiết kế nằm ngoài khung này có thể không hiển thị đúng khi trình chiếu.
4. **Properties Panel (Bảng thuộc tính bên phải):** Một thanh Sidebar động, sẽ thay đổi nội dung dựa trên đối tượng bạn đang nhấp chọn (Text, Image, Shape, hay Background của Slide).

[SCREENSHOT: 02_editor_workspace.png]

### 2.3. Khởi tạo và Lưu trữ Bài giảng cục bộ
NavSlides sử dụng công nghệ Offline-first. Điều này có nghĩa là khi bạn tạo một bài giảng mới, mọi thông tin đều được lưu trữ trực tiếp trên trình duyệt của bạn (thông qua IndexedDB). 
Tuy nhiên, để đảm bảo an toàn dữ liệu:
- Khi kết thúc ngày làm việc, bạn BẮT BUỘC phải nhấp vào biểu tượng `Export` (Tải xuống) trên Menu Bar.
- Chọn định dạng `.navslides` (bao gồm cả ảnh và video) hoặc `.navslides.json` (chỉ chứa văn bản và cấu trúc).
- Tệp tin tải về là tài sản sở hữu cá nhân của bạn, có thể lưu vào USB hoặc Google Drive. Để mở lại vào hôm sau, chỉ cần nhấp nút Import tại trang chủ.

---

## Chương 3: Thao tác Chỉnh sửa và Thiết kế cơ bản

### 3.1. Thao tác với Slide và Bố cục
Trong thanh Slide Navigator bên trái, bạn có các công cụ để cấu trúc nội dung bài thuyết trình:
- **Thêm Slide:** Bấm vào nút `+ Add Slide` hoặc phím tắt `Ctrl + M`. Slide mới sẽ được chèn ngay phía sau slide hiện tại.
- **Nhân bản (Duplicate):** Kích chuột phải vào thumbnail của một slide và chọn Duplicate. Tính năng này cực kỳ hữu ích khi bạn muốn giữ nguyên một form thiết kế nền phức tạp.
- **Background (Nền slide):** Nếu bạn không click vào phần tử nào trên Canvas, Properties Panel bên phải sẽ hiển thị cấu hình nền. Bạn có thể đặt nền là màu trơn (Solid), chuyển sắc (Gradient), hoặc tải lên một hình nền chuyên nghiệp (Image Background).

[SCREENSHOT: 08_slide_menu.png]

### 3.2. Soạn thảo Văn bản chuyên sâu (Rich Text)
NavSlides tích hợp trình soạn thảo văn bản mạnh mẽ (TipTap Editor). 
Khi bạn nhấp đúp (double-click) vào một hộp văn bản, một thanh công cụ (Floating Toolbar) sẽ xuất hiện trôi nổi ngay trên đối tượng đó.
Thanh công cụ này cho phép:
- Thay đổi Headings (H1, H2, H3), định dạng in đậm, nghiêng, gạch dưới.
- Tùy chỉnh màu chữ (Text Color) và màu nền chữ (Highlight Color).
- Căn lề đa hướng (Trái, Phải, Giữa, Đều hai bên).
- Đặc biệt, với các đoạn mã (Code Snippets), bạn có thể chọn thẻ `< >` để biến đoạn văn bản thành định dạng mã nguồn (Monospace font với nền xám tối).

[SCREENSHOT: 03_editor_toolbar.png]

### 3.3. Xử lý Đa phương tiện và Hình học
Để bài giảng thêm trực quan, bạn cần nhúng các tài nguyên đa phương tiện.
1. **Hình học (Shapes):** Cung cấp các khối cơ bản như Hình chữ nhật, Hình tròn, Mũi tên. Các khối này có thể được tùy chỉnh màu viền (Stroke) và màu tô (Fill). Đặc biệt, bạn có thể chỉnh độ bo góc (Border Radius) để tạo các thẻ (Cards) hiện đại (Glassmorphism).
2. **Hình ảnh/Video (Media):** 
   - Mở Tab `Media` từ thanh công cụ hoặc Properties Panel.
   - Khi tải ảnh lên, NavSlides tự động nén và nhúng ảnh thành định dạng an toàn. 
   - Với hình ảnh, bạn có thể áp dụng các CSS Filter trực tiếp như: Blur (Làm mờ), Brightness (Độ sáng), Contrast (Độ tương phản) ngay trên Properties Panel mà không cần phần mềm Photoshop.

[SCREENSHOT: 04_properties_panel.png]

### 3.4. Cấu hình Hiệu ứng chuyển cảnh (Transitions)
Reveal.js nổi tiếng với các hiệu ứng chuyển cảnh điện ảnh 3D. Trong NavSlides, bạn có thể gán hiệu ứng cho toàn bộ bài giảng hoặc từng slide riêng lẻ.
Các hiệu ứng hỗ trợ bao gồm:
- **None:** Chuyển ngay lập tức.
- **Fade:** Mờ dần tinh tế (Phù hợp cho các hội thảo khoa học nghiêm túc).
- **Slide:** Trượt ngang cổ điển.
- **Convex / Concave:** Cuộn khối 3D (Lồi hoặc lõm) tạo cảm giác chiều sâu không gian.
- **Zoom:** Hiệu ứng thu phóng mạnh mẽ.

---

## Chương 4: Trình chiếu và Công cụ Diễn giả (Presenter Tools)

### 4.1. Môi trường Trình chiếu (Live View)
Khi bạn đã hoàn tất thiết kế, hãy nhấp vào nút `Present` trên góc phải. Không gian làm việc sẽ biến mất, thay vào đó là môi trường Live View hiển thị nội dung toàn màn hình (Full-screen).
- Môi trường này sử dụng Engine cốt lõi của Reveal.js.
- Bạn điều hướng bài giảng bằng phím mũi tên Trái/Phải/Lên/Xuống hoặc bằng chuột.
- Để thoát chế độ này, chỉ cần nhấn phím `ESC` hoặc click biểu tượng X ở góc dưới.

[SCREENSHOT: 05_present_mode.png]

### 4.2. Bảng đen tương tác (Chalkboard Plugin)
Đây là tính năng quan trọng nhất dành cho giáo viên và người thuyết trình trực tiếp.
- **Mở bảng đen:** Trong lúc đang trình chiếu, hãy nhấn phím `C` (Chalkboard). Màn hình bài giảng sẽ cuộn lên trên, để lộ ra một chiếc bảng đen (hoặc bảng trắng, tùy cấu hình) nguyên sơ. 
- **Chức năng:** Bạn có thể dùng chuột hoặc bút cảm ứng (Stylus) vẽ trực tiếp lên bảng để nháp, giải bài tập Toán, hoặc minh họa thêm ý tưởng.

[SCREENSHOT: 06_chalkboard_active.png]

### 4.3. Bút dạ quang (Highlighter / Pen Plugin)
Khác với Bảng đen (cung cấp một không gian trống), Bút dạ quang cho phép bạn vẽ trực tiếp đè lên Slide hiện tại.
- **Sử dụng:** Nhấn phím `B` (Board Pen) hoặc biểu tượng Cây bút ở góc dưới màn hình trình chiếu.
- **Ứng dụng:** Bạn có thể khoanh tròn một từ khóa quan trọng trong đoạn văn, gạch chân một công thức Hóa học, hoặc vẽ mũi tên kết nối hai sơ đồ trong lúc đang giảng bài để thu hút sự chú ý của người xem.

[SCREENSHOT: 07_chalkboard_drawing.png]

### 4.4. Công cụ Thu phóng chi tiết (Zoom Plugin)
Một vấn đề thường gặp khi thuyết trình là sơ đồ khối quá nhỏ, khán giả ngồi xa không thể thấy rõ.
- NavSlides giải quyết bằng tính năng Zoom.
- **Cách dùng:** Nhấn giữ phím `Alt` (trên Windows) hoặc `Option` (trên Mac) và click chuột trái vào vùng muốn phóng to. Màn hình sẽ mượt mà trượt và phóng to sâu vào chi tiết đó.
- Nhấn `Alt + Click` lần nữa để zoom-out trả về khung hình ban đầu.

---

## Chương 5: Cẩm nang AI Prompt — Sinh mã Slide tương tác

### 5.1. Tổng quan phương pháp
NavSlides cho phép nhúng mã HTML/CSS/JavaScript trực tiếp vào slide thông qua tính năng Custom Code. Kết hợp với AI (ChatGPT, Claude, Gemini), giảng viên có thể tạo ra các mô phỏng, bài tập tương tác và trực quan hóa dữ liệu chỉ trong vài phút mà không cần biết lập trình sâu.
Quy trình sử dụng gồm 3 bước đơn giản: (1) Copy khối System Prompt ở mục 5.2 và dán vào đầu cuộc hội thoại AI; (2) Viết thêm yêu cầu nội dung cụ thể (Task Prompt); (3) Dán mã AI trả về vào NavSlides Editor qua nút "< > HTML".

### 5.2. System Prompt — Khối quy tắc bắt buộc (Copy 1 lần, dùng mãi)
Đây là đoạn văn bản cố định mà bạn phải dán vào ĐẦU TIÊN trong mỗi cuộc trò chuyện với AI. Nó đảm bảo mọi đoạn mã sinh ra đều tương thích 100% với NavSlides:

> "Bạn là trợ lý chuyên viết mã HTML/CSS/JS cho hệ thống bài giảng NavSlides (nền tảng Reveal.js). Mọi đoạn mã bạn sinh ra PHẢI tuân thủ nghiêm ngặt 5 quy tắc sau:
> QUY TẮC 1 — INLINE CSS: Chỉ dùng thuộc tính style nội tuyến (style="..."). Tuyệt đối KHÔNG dùng thẻ < style > vì sẽ gây xung đột với theme chung.
> QUY TẮC 2 — JAVASCRIPT IIFE: Bọc toàn bộ mã JS trong hàm tự thực thi (function(){ ... })(); để không ô nhiễm biến toàn cục.
> QUY TẮC 3 — KÍCH THƯỚC: Giới hạn tối đa 960px chiều rộng và 700px chiều cao. Mọi phần tử phải nằm gọn trong khung này.
> QUY TẮC 4 — KHÔNG THƯ VIỆN NGOÀI: Chỉ dùng Vanilla JS, trừ khi tôi yêu cầu cụ thể.
> QUY TẮC 5 — MỘT DIV GỐC: Toàn bộ code nằm trong 1 thẻ < div > gốc duy nhất, gọn gàng, dễ paste."

Sau khi dán xong System Prompt, bạn chỉ cần viết tiếp phần yêu cầu nội dung (Task Prompt) ở các mục bên dưới.

### 5.3. Nhóm 1 — Điện tử số (Kỹ thuật số)

#### Mẫu 1: Cổng logic AND/OR/XOR tương tác
> Tạo mô hình tương tác cổng logic AND có 2 công tắc đầu vào (A, B) và 1 bóng đèn đầu ra. Click công tắc để đổi trạng thái 0/1 (xám/đỏ). Bóng đèn tự động sáng vàng khi cả hai đầu vào bằng 1. Vẽ bằng SVG nội tuyến, kích thước 700x500.

#### Mẫu 2: Bảng Karnaugh (K-Map) tương tác
> Tạo bảng Karnaugh 4 biến (A,B,C,D) dạng bảng 4x4. Người dùng click vào ô để đổi giá trị 0/1. Tự động tô màu các nhóm gộp (2, 4, 8 ô liền kề) và hiển thị biểu thức Boolean tối giản bên dưới bảng. Kích thước 800x600.

#### Mẫu 3: Flip-Flop JK tương tác
> Mô phỏng hoạt động Flip-Flop JK: vẽ sơ đồ khối có 2 đầu vào J, K, 1 đầu vào Clock, 2 đầu ra Q và Q'. Khi bấm nút Clock, tính toán trạng thái mới theo bảng chân trị JK và cập nhật đầu ra. Hiển thị bảng trạng thái lịch sử bên cạnh.

#### Mẫu 4: Bộ cộng toàn phần (Full Adder)
> Vẽ sơ đồ mạch bộ cộng toàn phần với 3 đầu vào (A, B, Carry-in) và 2 đầu ra (Sum, Carry-out). Người dùng click vào đầu vào để đổi 0/1. Mạch tự tính toán và hiển thị kết quả. Vẽ các cổng logic bên trong bằng SVG.

### 5.4. Nhóm 2 — Vi xử lý và Kiến trúc máy tính

#### Mẫu 5: Thanh ghi 8-bit tương tác
> Vẽ một thanh ghi 8-bit hiển thị 8 ô vuông (mỗi ô là 1 bit). Người dùng click vào từng ô để đổi 0/1. Bên dưới hiển thị giá trị thập phân (Decimal), thập lục phân (Hex) và bát phân (Octal) tương ứng. Có nút "Reset" và "Dịch trái/Dịch phải".

#### Mẫu 6: Mô phỏng chu kỳ lệnh CPU (Fetch-Decode-Execute)
> Tạo hoạt ảnh minh họa 3 giai đoạn của chu kỳ lệnh CPU: Fetch (nạp lệnh từ bộ nhớ), Decode (giải mã), Execute (thực thi). Vẽ sơ đồ khối gồm PC, IR, ALU, Memory. Khi bấm "Next Step", highlight khối đang hoạt động và hiển thị mô tả bằng tiếng Việt.

#### Mẫu 7: Bộ nhớ RAM mô phỏng
> Vẽ bảng ô nhớ 16 địa chỉ (0x00-0x0F), mỗi ô chứa giá trị 8-bit. Có ô nhập Address và Data. Nút "Write" ghi giá trị vào địa chỉ, nút "Read" đọc và highlight ô tương ứng. Hiển thị bus Address/Data bằng đường kẻ SVG.

### 5.5. Nhóm 3 — Lý thuyết mạch điện

#### Mẫu 8: Mạch RLC nối tiếp
> Vẽ sơ đồ mạch RLC nối tiếp (Điện trở R, Cuộn cảm L, Tụ điện C) nối với nguồn xoay chiều. Có 3 slider điều chỉnh giá trị R (0-1000Ω), L (0-1H), C (0-100μF). Tự động tính và hiển thị: tổng trở Z, dòng điện I, tần số cộng hưởng f₀, hệ số công suất cosφ.

#### Mẫu 9: Định luật Kirchhoff minh họa
> Vẽ mạch điện có 2 vòng kín với 3 điện trở và 2 nguồn điện. Hiển thị chiều dòng điện bằng mũi tên chạy động (animation). Khi hover vào nút mạch, hiển thị phương trình Kirchhoff tương ứng (KVL/KCL). Có nút "Giải hệ" tự động tính dòng điện từng nhánh.

#### Mẫu 10: Đặc tuyến V-A của Diode
> Vẽ đồ thị đặc tuyến Volt-Ampere của diode bán dẫn trên canvas. Trục X là điện áp V (-1V đến 1V), trục Y là dòng I. Có slider điều chỉnh nhiệt độ T và hiển thị đường cong thay đổi theo phương trình Shockley. Đánh dấu vùng phân cực thuận/ngược.

### 5.6. Nhóm 4 — Vật lý và Cơ học

#### Mẫu 11: Con lắc đơn (Canvas animation)
> Mô phỏng con lắc đơn bằng Canvas: vẽ điểm treo, dây treo và quả cầu. Quả cầu dao động qua lại có giảm chấn. Có slider điều chỉnh chiều dài dây L và góc lệch ban đầu θ₀. Hiển thị giá trị chu kỳ T và năng lượng toàn phần theo thời gian thực. Có nút Bắt đầu/Tạm dừng.

#### Mẫu 12: Chuyển động ném xiên
> Mô phỏng chuyển động ném xiên trên canvas: vẽ quỹ đạo parabol của vật. Có 2 slider: vận tốc ban đầu v₀ (10-50 m/s) và góc ném α (0-90°). Khi bấm "Bắn", hoạt ảnh vật bay theo quỹ đạo, để lại vết. Hiển thị tầm xa, độ cao cực đại và thời gian bay.

#### Mẫu 13: Chuyển động tròn đều
> Mô phỏng một chất điểm chuyển động tròn đều trên canvas. Vẽ quỹ đạo tròn, vectơ vận tốc tiếp tuyến (xanh) và gia tốc hướng tâm (đỏ) cập nhật liên tục. Có slider điều chỉnh bán kính R và tốc độ góc ω. Hiển thị giá trị v, a_ht, T.

### 5.7. Nhóm 5 — Tự động hóa và Điều khiển

#### Mẫu 14: Sơ đồ PLC Ladder Logic
> Vẽ sơ đồ bậc thang (Ladder Diagram) đơn giản gồm 2 tiếp điểm NO (Normally Open), 1 tiếp điểm NC (Normally Closed) và 1 cuộn coil đầu ra. Click vào tiếp điểm để đóng/mở. Cuộn coil tự sáng khi mạch logic thỏa mãn. Hiển thị trạng thái TRUE/FALSE bên cạnh mỗi phần tử.

#### Mẫu 15: Bộ điều khiển PID trực quan
> Mô phỏng hệ thống điều khiển PID: vẽ đồ thị đáp ứng hệ thống (setpoint vs. actual value) trên canvas. Có 3 slider: Kp (0-10), Ki (0-5), Kd (0-5). Khi thay đổi thông số, đồ thị cập nhật realtime cho thấy overshoot, settling time. Có nút "Step Response" và "Reset".

### 5.8. Nhóm 6 — Đo lường và Cảm biến

#### Mẫu 16: Đồng hồ đo kim (Analog Gauge)
> Vẽ đồng hồ đo dạng kim chỉ bằng SVG/Canvas: mặt số tròn có vạch chia từ 0 đến 100, kim quay mượt mà. Có slider điều chỉnh giá trị và kim di chuyển theo. Vùng 0-30 màu xanh lá, 30-70 màu vàng, 70-100 màu đỏ. Hiển thị giá trị số bên dưới.

#### Mẫu 17: Oscilloscope mô phỏng
> Mô phỏng màn hình dao động ký (Oscilloscope) trên canvas: vẽ tín hiệu hình sin chạy liên tục. Có slider Tần số f (1-100Hz), Biên độ A (0-5V), và dropdown chọn dạng sóng (Sin, Vuông, Tam giác, Răng cưa). Nền đen, lưới xanh lá kiểu oscilloscope thật.

### 5.9. Nhóm 7 — Thủy khí và Nhiệt động

#### Mẫu 18: Nguyên lý Bernoulli — Dòng chảy trong ống
> Mô phỏng dòng chảy qua ống có tiết diện thay đổi (ống Venturi). Vẽ ống ngang bằng SVG, các hạt nước (chấm xanh) chạy qua. Ở chỗ ống hẹp, hạt chạy nhanh hơn và áp suất giảm (cột đo áp suất thấp hơn). Có slider điều chỉnh lưu lượng Q.

#### Mẫu 19: Chu trình Carnot (P-V diagram)
> Vẽ đồ thị P-V của chu trình Carnot trên canvas: 4 quá trình (2 đẳng nhiệt, 2 đoạn nhiệt) tạo thành vòng kín. Khi bấm "Animate", một điểm sáng chạy dọc theo chu trình. Hiển thị hiệu suất η = 1 - T_cold/T_hot. Có slider chỉnh T_hot và T_cold.

### 5.10. Nhóm 8 — Toán học và Thống kê

#### Mẫu 20: Đồ thị hàm số tương tác
> Vẽ hệ trục tọa độ Oxy trên canvas. Có ô nhập để người dùng gõ biểu thức hàm số (ví dụ: sin(x), x^2-3x+1). Khi bấm "Vẽ", đồ thị hàm số hiển thị mượt mà. Hỗ trợ zoom in/out bằng nút +/- và hiển thị tọa độ điểm khi di chuột trên đường cong.

#### Mẫu 21: Phép biến đổi Ma trận 2D
> Minh họa phép biến đổi tuyến tính trên mặt phẳng: vẽ một hình vuông đơn vị trên canvas. Có 4 ô nhập cho ma trận 2x2 [[a,b],[c,d]]. Khi thay đổi giá trị, hình vuông biến dạng theo phép biến đổi tương ứng (co giãn, xoay, lệch). Hiển thị định thức det(A) và eigenvectors.

### 5.11. Nhóm 9 — Hóa học

#### Mẫu 22: Bảng tuần hoàn thu gọn tương tác
> Vẽ bảng tuần hoàn các nguyên tố hóa học (20 nguyên tố đầu tiên) bằng HTML div grid. Mỗi ô hiển thị ký hiệu và số hiệu nguyên tử, tô màu theo nhóm (Kim loại kiềm: đỏ, Khí hiếm: tím, Phi kim: xanh lá). Khi click vào ô, hiển thị popup chứa: tên đầy đủ, khối lượng nguyên tử, cấu hình electron.

#### Mẫu 23: Cân bằng phương trình hóa học
> Tạo giao diện cân bằng phương trình hóa học: hiển thị phương trình chưa cân bằng (ví dụ: Fe + O₂ → Fe₂O₃). Có ô nhập hệ số cho mỗi chất. Nút "Kiểm tra" so sánh số nguyên tử mỗi nguyên tố hai vế. Đúng → hiển thị "Đã cân bằng!" màu xanh; Sai → chỉ ra nguyên tố nào chưa khớp.

### 5.12. Nhóm 10 — Sư phạm và Gamification

#### Mẫu 24: Bài tập kéo thả (Drag and Drop)
> Tạo bài tập kéo thả: bên trái là 5 thuật ngữ (ví dụ: CPU, RAM, ROM, HDD, GPU), bên phải là 5 ô trống có mô tả chức năng. Người dùng kéo thuật ngữ thả vào ô đúng. Khi thả đúng, ô chuyển xanh và khóa. Thả sai, ô nhấp nháy đỏ và thuật ngữ bật về vị trí cũ. Cuối cùng hiển thị điểm X/5.

#### Mẫu 25: Flashcard lật 2 mặt
> Tạo bộ 6 thẻ Flashcard dạng lưới 3x2. Mặt trước hiển thị câu hỏi (ví dụ: "HTTP Status 404 là gì?"). Click vào thẻ → hiệu ứng lật 3D (CSS transform rotateY) hiển thị mặt sau chứa đáp án. Click lần nữa → lật về. Có nút "Xáo trộn" để random lại vị trí các thẻ.

#### Mẫu 26: Đồng hồ đếm ngược Countdown
> Tạo đồng hồ đếm ngược cho phần thi/kiểm tra: hiển thị lớn ở giữa màn hình dạng MM:SS với font số digital. Có ô nhập thời gian (phút), nút "Bắt đầu", "Tạm dừng", "Reset". Khi còn 10 giây, chữ đổi sang màu đỏ và nhấp nháy. Hết giờ phát âm thanh beep (sử dụng AudioContext API).

Khi AI trả về đoạn mã, bạn nhấp nút "< > HTML" trên thanh công cụ NavSlides Editor, dán mã vào và nhấn Lưu. Slide của bạn ngay lập tức sẽ có một ứng dụng tương tác chuyên nghiệp.

---

## Chương 6: Xử lý sự cố và Kinh nghiệm (Troubleshooting)

### 6.1. Xử lý lỗi không lưu được dự án (Quota Exceeded)
**Nguyên nhân:** Lỗi này xảy ra khi bộ nhớ trong (IndexedDB) của trình duyệt bị đầy, thường do bạn tải lên hàng loạt video 4K hoặc file ảnh `.PNG` không nén có dung lượng quá khổng lồ (hàng trăm MB). Trình duyệt mặc định giới hạn bộ nhớ cấp phát cho một website (Local Storage giới hạn 5MB, IndexedDB giới hạn từ 50MB-250MB tùy trình duyệt).
**Khắc phục:** 
1. Nén toàn bộ video qua các phần mềm như Handbrake hoặc trang web nén video online trước khi upload.
2. Đối với hình ảnh, chuyển đổi từ PNG/JPG sang định dạng WebP hiện đại để giảm 80% dung lượng mà không mất chất lượng.
3. Xóa bớt các dự án cũ trong phần "Recent Presentations" trên màn hình Home. Hãy nhớ Export chúng ra file `.navslides` cất vào ổ cứng máy tính trước khi xóa.

### 6.2. Mất hiệu ứng hoạt hình khi xuất HTML
**Nguyên nhân:** Khi bạn sử dụng chức năng `Export to HTML` (Biên dịch thành Web tĩnh để đưa lên hosting), một số file JS/CSS nội bộ có thể không đường liên kết đúng (CORS policy) nếu mở file HTML trực tiếp từ ổ cứng `C:\` bằng nhấp đúp (File Protocol).
**Khắc phục:**
- Không nên nhấp đúp để mở file HTML vừa xuất. Trình duyệt hiện đại chặn Javascript khi chạy ở chế độ file cục bộ (Cross-Origin Read Blocking).
- Hãy upload thư mục được xuất bản lên một máy chủ Web (như GitHub Pages, Vercel, Netlify) hoặc các hệ thống LMS (Moodle).
- Nếu muốn xem thử ở máy cá nhân, hãy dùng tính năng Export Offline `(.navslides)` hoặc cài đặt một tiện ích như Live Server trên VS Code.

### 6.3. Khôi phục bài giảng khi trình duyệt bị treo (Crash Recovery)
**Nguyên nhân:** Trình duyệt bị tắt đột ngột do cúp điện hoặc hết RAM.
**Khắc phục:** 
NavSlides có hệ thống Auto-save cực kỳ mạnh mẽ kích hoạt sau mỗi 2 giây mỗi khi bạn có thao tác mới. Ngay cả khi tab bị đóng đột ngột, bạn chỉ cần mở lại đường dẫn của NavSlides. Bài giảng gần nhất sẽ lập tức xuất hiện trong mục "Recent Presentations" với trạng thái chính xác đến từng ký tự cuối cùng bạn gõ. 
Tuy nhiên, hệ thống này phụ thuộc vào profile trình duyệt. Nếu bạn vô tình chạy phần mềm dọn rác (CCleaner) và xóa lịch sử/Cookie của trình duyệt, dữ liệu Auto-save sẽ bị hủy hoàn toàn. Luôn ghi nhớ quy tắc vàng: **"Hãy bấm Export sau mỗi phiên làm việc dài!"**.
