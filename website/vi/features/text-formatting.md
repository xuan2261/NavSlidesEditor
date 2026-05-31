# Văn bản & Định dạng

NavSlides Editor dùng [TipTap](https://tiptap.dev/) làm bộ máy văn bản phong phú, cho bạn toàn quyền kiểm soát kiểu chữ trực tiếp trên vùng canvas của slide.

## Kích hoạt trình soạn thảo văn bản

Nhấp đúp vào bất kỳ phần tử văn bản nào để vào chế độ chỉnh sửa. Một **thanh công cụ định dạng** xuất hiện phía trên hoặc dưới phần tử với tất cả tùy chọn có sẵn.

::: tip
Bạn cũng có thể nhấp một lần vào phần tử văn bản để chọn nó, rồi nhấn `Enter` để bắt đầu chỉnh sửa.
:::

## Tiêu đề

Dùng menu thả tiêu đề trên thanh công cụ để đặt cấp độ:

- **Heading 1** — văn bản tiêu đề lớn
- **Heading 2** — phụ đề / tiêu đề mục
- **Heading 3** — tiểu mục
- **Paragraph** — văn bản thân bài thông thường

## Kiểu nội dòng

| Kiểu | Nút trên thanh công cụ | Phím tắt |
|---|---|---|
| Bold | **B** | `Ctrl+B` |
| Italic | *I* | `Ctrl+I` |
| Underline | U&#x0332; | `Ctrl+U` |
| Strikethrough | ~~S~~ | `Ctrl+Shift+X` |
| Highlight | H | `Ctrl+Shift+H` |
| Inline code | `{ }` | `` Ctrl+` `` |
| Inline math | ∑ | qua thanh công cụ |

## Màu chữ & tô sáng

Nhấp biểu tượng **A** (màu chữ) hoặc **highlight** trên thanh công cụ để mở bảng chọn màu. Bạn có thể chọn:

- Một màu từ bảng màu có sẵn
- Một giá trị hex hoặc RGB tùy chỉnh
- Trong suốt (để xóa phần tô sáng)

## Phông chữ & cỡ chữ

- **Phông chữ** — chọn từ một bộ phông web-safe và Google Fonts được tuyển chọn (serif, sans-serif, monospace, display)
- **Cỡ chữ** — nhập giá trị vào ô cỡ chữ hoặc dùng mũi tên lên/xuống; cỡ chữ tính theo point tương đối với slide

## Căn chỉnh văn bản

| Căn chỉnh | Phím tắt |
|---|---|
| Trái | `Ctrl+Shift+L` |
| Giữa | `Ctrl+Shift+E` |
| Phải | `Ctrl+Shift+R` |
| Đều hai bên | `Ctrl+Shift+J` |

## Danh sách

- **Danh sách dấu đầu dòng** — biểu tượng dấu đầu dòng trên thanh công cụ hoặc `Ctrl+Shift+8`
- **Danh sách có thứ tự** — biểu tượng số trên thanh công cụ hoặc `Ctrl+Shift+7`
- Lồng các mục bằng cách nhấn `Tab`; bỏ lồng bằng `Shift+Tab`

## Bảng

Chèn một bảng từ nút **Table** trên thanh công cụ. Sau khi chèn:

- Nhấp vào một ô để chỉnh sửa nội dung
- Nhấp chuột phải để xem tùy chọn thêm/xóa hàng/cột
- Kéo viền cột để thay đổi kích thước

## Khối mã

Chèn một khối mã (fenced code block) từ thanh công cụ. Chọn ngôn ngữ từ menu thả để tô màu cú pháp (được hỗ trợ bởi highlight.js).

```python
# Example Python code block on a slide
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

## Liên kết

Chọn văn bản và nhấp biểu tượng **link** trên thanh công cụ (hoặc nhấn `Ctrl+K`) để thêm siêu liên kết. Liên kết sẽ mở trong tab mới khi được nhấp ở chế độ trình chiếu.

## Math nội dòng

Gõ một biểu thức LaTeX bao quanh bằng dấu `$` bên trong bất kỳ phần tử văn bản nào, hoặc dùng nút **math** (∑) trên thanh công cụ:

- `$E = mc^2$` hiển thị nội dòng dưới dạng $E = mc^2$
- Math nội dòng được kết xuất qua KaTeX

::: tip
Để có phương trình display-math đầy đủ hoặc sơ đồ TikZ, hãy dùng phần tử **LaTeX block** chuyên dụng thay thế. Xem [LaTeX & Math](/vi/features/latex) để biết chi tiết.
:::
