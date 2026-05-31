# LaTeX & Math

NavSlides Editor cung cấp hỗ trợ hạng nhất cho ký hiệu toán học và sơ đồ thông qua hai hệ thống bổ trợ cho nhau: **KaTeX** cho math nội dòng và display, và **TikZJax** cho sơ đồ vector.

## Chèn một khối LaTeX

1. Nhấp chuột phải vào vùng canvas của slide và chọn **Insert → LaTeX**, hoặc dùng nút **Insert** trên thanh công cụ.
2. Một phần tử LaTeX được đặt trên slide, và **bảng trình chỉnh sửa LaTeX** mở ra bên phải.
3. Gõ mã nguồn LaTeX vào khung bên trái; khung bên phải hiển thị một **bản xem trước trực tiếp** cập nhật khi bạn gõ.
4. Nhấp vào nơi khác trên slide để đóng trình chỉnh sửa và thấy kết quả kết xuất cuối cùng được nhúng vào slide của bạn.

::: tip
Bạn có thể thay đổi kích thước và di chuyển khối LaTeX giống như bất kỳ phần tử nào khác — kéo để di chuyển, kéo các góc để điều chỉnh tỷ lệ.
:::

## Display math với KaTeX

KaTeX được dùng để kết xuất ký hiệu math LaTeX tiêu chuẩn. Dùng `\[...\]` hoặc môi trường `equation` cho display math:

```latex
\[
  \hat{H}\psi = E\psi
\]
```

```latex
\begin{equation}
  \nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
\end{equation}
```

### Phương trình được căn chỉnh

```latex
\begin{align}
  f(x) &= x^2 + 3x + 2 \\
       &= (x+1)(x+2)
\end{align}
```

### Phân số, tổng và tích phân

```latex
\[
  \int_0^\infty e^{-x^2}\, dx = \frac{\sqrt{\pi}}{2}
\]
```

```latex
\[
  \sum_{n=0}^{\infty} \frac{x^n}{n!} = e^x
\]
```

## Sơ đồ TikZ

Đối với đồ họa vector và sơ đồ phức tạp, NavSlides Editor hỗ trợ **TikZJax** — một bản port WebAssembly của PGF/TikZ chạy hoàn toàn trong trình duyệt.

### Ví dụ đơn giản

```latex
\begin{tikzpicture}
  \draw[thick, ->] (0,0) -- (3,0) node[right] {$x$};
  \draw[thick, ->] (0,0) -- (0,3) node[above] {$y$};
  \draw[blue, thick] (0,0) parabola (2,2);
  \node at (1.5,0.8) [right] {$y = x^2$};
\end{tikzpicture}
```

### Sơ đồ khối

```latex
\begin{tikzpicture}[node distance=2cm, auto]
  \node[draw, rectangle] (A) {Input};
  \node[draw, rectangle, right of=A] (B) {Process};
  \node[draw, rectangle, right of=B] (C) {Output};
  \draw[->] (A) -- (B);
  \draw[->] (B) -- (C);
\end{tikzpicture}
```

::: warning
Kết xuất TikZ dùng WebAssembly và có thể mất một chút thời gian ở lần tải đầu tiên. Sơ đồ phức tạp với nhiều node có thể kết xuất chậm hơn trong bản xem trước trực tiếp.
:::

## Math nội dòng trong phần tử văn bản

Bên trong bất kỳ **phần tử văn bản** nào, bạn có thể chèn math nội dòng bằng dấu đô-la:

- Gõ `$f(x) = x^2$` để kết xuất $f(x) = x^2$ nội dòng cùng văn bản xung quanh.
- Dùng `$$...$$` cho một phương trình kiểu display được căn giữa trong khối văn bản.

Math nội dòng được kết xuất qua **KaTeX** tự động khi bạn thoát khỏi trình chỉnh sửa văn bản.

## Các gói và lệnh KaTeX thông dụng

KaTeX hỗ trợ một tập con lớn của LaTeX. Các lệnh thường dùng:

| Lệnh | Kết quả |
|---|---|
| `\frac{a}{b}` | Phân số |
| `\sqrt{x}` | Căn bậc hai |
| `\vec{v}`, `\mathbf{v}` | Ký hiệu vector |
| `\hat{x}`, `\tilde{x}` | Dấu phụ (accent) |
| `\text{word}` | Văn bản bên trong math |
| `\begin{pmatrix}...\end{pmatrix}` | Ma trận |
| `\left( ... \right)` | Dấu ngoặc tự động co giãn |

Xem [bảng hỗ trợ KaTeX](https://katex.org/docs/support_table.html) đầy đủ để có tài liệu tham khảo hoàn chỉnh.

## Khắc phục sự cố kết xuất

**Bản xem trước hiển thị thông báo lỗi**
Kiểm tra mã nguồn LaTeX để tìm lỗi cú pháp — thiếu `\end{}`, dấu ngoặc không khớp, hoặc lệnh không được hỗ trợ.

**Kết quả TikZ trống**
Đảm bảo bạn có một khối `\begin{tikzpicture}...\end{tikzpicture}`. Một số thư viện PGF (ví dụ `tikz-cd`) có thể không có sẵn trong TikZJax.

**Math nội dòng không kết xuất**
Thoát khỏi trình chỉnh sửa văn bản (nhấn `Escape`) — math nội dòng kết xuất sau khi bạn hoàn tất chỉnh sửa.
