# Mã, LaTeX & Markdown

Hướng dẫn này bao gồm các khối mã, phần tử LaTeX/TikZ, và các khối Markdown.

## Khối mã

1. Nhấn **Code** trên thanh công cụ.
2. Một phần tử khối mã xuất hiện. Nhấn đúp vào nó để mở trình soạn mã.
3. Chọn một ngôn ngữ từ danh sách thả xuống (Python, JavaScript, TypeScript, C++, v.v.).
4. Viết hoặc dán mã của bạn. Tô màu cú pháp được áp dụng tự động.
5. Nhấn **Apply** để lưu.

![Một phần tử mã được tô màu cú pháp trên slide](/img/editor-code-element.png)

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/code-block.html" style="width:100%;height:260px;border:none"></iframe>
</div>

## LaTeX & TikZ

1. Nhấn nút **TeX** trên thanh công cụ.
2. Một phần tử LaTeX xuất hiện. Nhấn đúp vào nó để mở trình soạn LaTeX.
3. Nhập mã LaTeX — toán hiển thị, phương trình căn lề, hoặc sơ đồ TikZ.
4. Một bản xem trước trực tiếp hiển thị ở bên trái khi bạn gõ.
5. Nhấn **Apply** để lưu.

![Một phần tử LaTeX/toán đã hiển thị trên slide](/img/editor-latex-element.png)

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/latex-equation.html" style="width:100%;height:100px;border:none"></iframe>
</div>

::: tip
Đối với sơ đồ TikZ, trình soạn dùng TikZJax để hiển thị phía máy khách. Bao bọc mã của bạn trong `\begin{tikzpicture}...\end{tikzpicture}`.
:::

## Khối Markdown

1. Nhấn nút **Markdown** trên thanh công cụ (hoặc tìm nó trong menu chèn).
2. Một phần tử markdown xuất hiện. Nhấn đúp vào nó để chỉnh sửa.
3. Viết Markdown chuẩn — tiêu đề, danh sách, liên kết, đậm/nghiêng, khối mã.
4. Kết quả đã hiển thị xuất hiện khi bạn bỏ chọn phần tử.

Các khối Markdown hữu ích để chèn nhanh văn bản đã định dạng mà không cần tạo kiểu thủ công.
