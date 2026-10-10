# Xuất & Chia sẻ

NavSlides Editor hỗ trợ nhiều định dạng xuất để bạn có thể chia sẻ bài trình chiếu trong mọi bối cảnh — trực tiếp trên web, ngoại tuyến tại hội nghị, hoặc nhúng vào một tài liệu.

## Xuất HTML (độc lập)

Xuất HTML thông thường tạo tệp `.html` tham chiếu runtime cục bộ `/vendor/` do manifest quản lý, không dùng CDN. Đây không phải là tệp ngoại tuyến hoàn toàn tự chứa.

- Mở bài trình chiếu của bạn trong trình soạn thảo.
- Nhấp **File → Export → HTML**.
- Lưu tệp `.html` về máy tính của bạn.
- Mở tệp trong bất kỳ trình duyệt nào để trình chiếu.

::: tip
Khi mở HTML thông thường, các tài nguyên runtime cục bộ và media được tham chiếu phải còn truy cập được. Xem [Export Fidelity and Known Limitations](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/export-fidelity-and-limits.md#revealjs-runtime-contract) để biết nguồn quản lý runtime và yêu cầu tài nguyên.
:::

## HTML ngoại tuyến

HTML ngoại tuyến nhúng các tài nguyên runtime cục bộ bắt buộc đã được công bố và chặn xuất nếu thiếu tài nguyên bắt buộc. Điều này không làm cho mọi iframe, script, media hoặc dịch vụ bên ngoài có thể dùng ngoại tuyến.

- Nhấp **File → Export → Offline HTML**.
- Quá trình xuất nhúng các tài nguyên runtime cục bộ bắt buộc.
- Lưu tệp kết quả để phân phối ngoại tuyến; kiểm tra riêng nội dung bên ngoài.

::: tip
Dùng HTML ngoại tuyến khi Wi-Fi không ổn định, nhưng hãy kiểm tra bộ slide đã xuất trên máy trình chiếu. Nội dung nhúng bên ngoài, nhà cung cấp AI và đồng bộ đám mây vẫn cần tài nguyên hoặc dịch vụ mạng tương ứng.
:::

## PDF

Xuất một **PDF sẵn sàng để in** bằng hộp thoại in của trình duyệt với kiểu in của reveal.js được áp dụng.

- Nhấp **File → Export → PDF**.
- Trình soạn thảo mở một chế độ xem tối ưu cho in trong tab mới với tất cả fragment được mở rộng.
- Dùng **Ctrl+P** (hoặc Cmd+P) và chọn "Save as PDF" trong hộp thoại in.
- Đặt lề thành "None" để có kết quả tốt nhất.

::: warning
Xuất PDF dựa vào bộ máy in của trình duyệt. Bố cục phức tạp, phông chữ tùy chỉnh hoặc sơ đồ TikZ có thể kết xuất hơi khác so với trên màn hình. Hãy kiểm tra bản xem trước in trước khi hoàn tất.
:::

## PPTX (PowerPoint)

Xem [Nhập & Xuất PPTX](/vi/features/pptx-import-export) để chọn giữa **Download Original**, **Export Validated Edited Revision** và **Generate Reconstructed PPTX**. Các chế độ có giới hạn khác nhau về khôi phục, xác thực và khả năng chỉnh sửa; tệp được tạo không phải là bằng chứng đã xác thực độ trung thực khi chỉnh sửa trong Microsoft Office hoặc Google Slides.

## Liên kết chia sẻ

Tạo một **URL chỉ xem** mà người khác có thể mở trong trình duyệt. Liên kết chia sẻ không cấp quyền cộng tác chỉnh sửa.

- Nhấp **Share → Get Link**.
- Có thể đặt tên liên kết, mật khẩu hoặc thời hạn hết hạn.
- Sao chép và chia sẻ URL.

::: tip
Liên kết chia sẻ yêu cầu phiên bản NavSlides Editor của bạn có thể truy cập được từ internet (hoặc mạng cục bộ của bạn). Nếu chạy cục bộ sau tường lửa, hãy chia sẻ tệp HTML đã xuất thay thế.
:::

## Đồng bộ & lưu trữ với GitHub

Đẩy các bài trình chiếu của bạn lên một **kho lưu trữ GitHub** và lưu trữ chúng miễn phí với **GitHub Pages** — không cần thiết lập lưu trữ riêng.

### Thiết lập GitHub

1. Mở bất kỳ bài trình chiếu nào và nhấp nút **GitHub** trên thanh công cụ trên cùng.
2. Nhập **chủ kho** (tên người dùng hoặc tổ chức của bạn) và **tên kho**.
3. Tạo một [Personal Access Token](https://github.com/settings/tokens) với phạm vi `repo` và dán nó vào ô token.
4. Tùy chọn đặt một **Pages URL** nếu bạn dùng tên miền tùy chỉnh (ví dụ `https://yoursite.com/presentations`). Nếu để trống, nó mặc định thành `https://<owner>.github.io/<repo>`.
5. Nhấp **Save Settings**.

Cấu hình này được lưu một lần và tái sử dụng trên tất cả bài trình chiếu của bạn.

### Đẩy một bài trình chiếu

1. Nhấp nút **GitHub**, nhập một thông điệp commit tùy chọn, và nhấp **Push to GitHub**.
2. NavSlides Editor xuất một tệp `presentation.html` tự chứa và tệp `presentation.json` thô vào một thư mục được đặt tên theo tiêu đề bài trình chiếu của bạn.
3. Tất cả hình ảnh và tài nguyên được tham chiếu trong bài trình chiếu được tải lên cùng với HTML vào một thư mục con `assets/`.
4. Một tệp `README.md` ở gốc kho được tự động tạo với các liên kết đến tất cả bài trình chiếu bạn đã đẩy.

Mỗi lần đẩy tạo một commit mới, nên bạn có đầy đủ lịch sử phiên bản của mọi bài trình chiếu trong kho.

### Lưu trữ trên GitHub Pages

Sau khi đẩy, bạn có thể phục vụ các bài trình chiếu dưới dạng một trang web trực tiếp bằng GitHub Pages:

1. Truy cập kho lưu trữ của bạn trên GitHub → **Settings → Pages**.
2. Trong mục **Source**, chọn nhánh (thường là `main`) và thư mục (`/ (root)`).
3. Nhấp **Save**. GitHub sẽ xuất bản trang của bạn trong vòng một hai phút.
4. Các bài trình chiếu của bạn giờ đã trực tuyến tại `https://<owner>.github.io/<repo>/<folder>/presentation.html`.

Tệp `README.md` được tạo tự động chứa các liên kết trực tiếp đến mọi bài trình chiếu. Bạn có thể chia sẻ các liên kết này với bất kỳ ai — chúng nạp tức thì trong bất kỳ trình duyệt nào mà không cần đăng nhập hay phần mềm.

::: tip
Nếu bạn có nhiều bài trình chiếu trong một kho, mỗi bài có thư mục riêng. Hãy đẩy bao nhiêu tùy thích — chỉ mục README tự cập nhật sau mỗi lần đẩy.
:::

### Lịch sử phiên bản từ GitHub

NavSlides Editor cũng có thể kéo lịch sử commit từ GitHub để duyệt và khôi phục các phiên bản trước của một bài trình chiếu:

- Nhấp nút **History** (biểu tượng đồng hồ) trên thanh công cụ của trình soạn thảo.
- Duyệt các commit trước với dấu thời gian và thông điệp.
- Nhấp vào bất kỳ phiên bản nào để xem trước, và khôi phục nó nếu cần.

Điều này cho bạn kiểm soát phiên bản được hỗ trợ bởi git bên cạnh hệ thống ảnh chụp tích hợp sẵn.
