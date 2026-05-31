# Sử Dụng LaTeX & Toán Học

Hướng dẫn này đi sâu vào việc viết ký hiệu toán học và sơ đồ trong NavSlides Editor — từ các biểu thức nội dòng đơn giản đến các hình TikZ phức tạp.

## 1. Chèn một khối LaTeX

Một **khối LaTeX** là một phần tử slide chuyên dụng cho toán hiển thị và sơ đồ.

1. Nhấn chuột phải vào bất kỳ đâu trên vùng canvas của slide.
2. Chọn **Insert → LaTeX** từ menu ngữ cảnh.
3. Một phần tử LaTeX được đặt lên slide và **bảng trình soạn LaTeX** mở ra ở phía bên phải.
4. Bảng có hai ngăn: ngăn bên trái là trình soạn, ngăn bên phải là bản xem trước trực tiếp.

Bạn có thể di chuyển và đổi kích thước khối LaTeX như bất kỳ phần tử nào khác sau khi đóng bảng.

## 2. Viết toán hiển thị

Dùng các dấu phân cách LaTeX chuẩn cho toán hiển thị. Tất cả những cách sau đều hoạt động:

```latex
\[ E = mc^2 \]
```

```latex
\begin{equation}
  \oint_{\partial \Sigma} \mathbf{B} \cdot d\boldsymbol{\ell} = \mu_0 I_{\text{enc}}
\end{equation}
```

```latex
\begin{equation*}
  \hat{H} \left| \psi \right\rangle = E \left| \psi \right\rangle
\end{equation*}
```

### Phương trình nhiều dòng căn lề

```latex
\begin{align}
  \nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
  \nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{align}
```

### Ma trận

```latex
\[
  \mathbf{A} = \begin{pmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{pmatrix},
  \quad
  \det(\mathbf{A}) = a_{11}a_{22} - a_{12}a_{21}
\]
```

### Cases (hàm từng khúc)

```latex
\[
  f(x) = \begin{cases}
    x^2 & \text{if } x \geq 0 \\
    -x  & \text{if } x < 0
  \end{cases}
\]
```

## 3. Dùng TikZ cho sơ đồ

TikZJax chạy trong trình duyệt bằng WebAssembly. Dùng môi trường `tikzpicture`:

### Sơ đồ nút đơn giản

```latex
\begin{tikzpicture}[>=stealth, node distance=2.5cm]
  \node[circle, draw] (x) {$x$};
  \node[circle, draw, right of=x] (f) {$f$};
  \node[circle, draw, right of=f] (y) {$y$};
  \draw[->] (x) -- (f) node[midway, above] {\small input};
  \draw[->] (f) -- (y) node[midway, above] {\small output};
\end{tikzpicture}
```

### Sơ đồ giao hoán

```latex
\begin{tikzpicture}
  \node (A) at (0,2) {$A$};
  \node (B) at (2,2) {$B$};
  \node (C) at (0,0) {$C$};
  \node (D) at (2,0) {$D$};
  \draw[->] (A) -- node[above] {$f$} (B);
  \draw[->] (A) -- node[left]  {$g$} (C);
  \draw[->] (B) -- node[right] {$h$} (D);
  \draw[->] (C) -- node[below] {$k$} (D);
\end{tikzpicture}
```

### Đồ thị / đường cong hàm số

```latex
\begin{tikzpicture}[scale=1.2]
  \draw[->] (-0.2,0) -- (3.5,0) node[right] {$x$};
  \draw[->] (0,-0.2) -- (0,2.5) node[above] {$y$};
  \draw[domain=0:3, smooth, thick, blue] plot (\x, {exp(-\x)*2});
  \node at (2.5,1.2) [blue] {$y=2e^{-x}$};
\end{tikzpicture}
```

## 4. Toán nội dòng trong các phần tử văn bản

Bên trong bất kỳ **hộp văn bản** nào, bao quanh các biểu thức bằng `$...$`:

- `The variance is $\sigma^2 = \frac{1}{N}\sum_i (x_i - \mu)^2$.`
- `Set $\alpha = 0.05$ for a 95% confidence interval.`

Toán nội dòng được hiển thị qua KaTeX khi bạn thoát khỏi trình soạn văn bản (nhấn `Escape`).

## 5. Các gói và lệnh KaTeX phổ biến

KaTeX đi kèm với hỗ trợ tích hợp sẵn cho các gói LaTeX phổ biến nhất. Một số lựa chọn:

| Gói / tính năng | Ví dụ |
|---|---|
| `amsmath` | `\begin{align}`, `\begin{cases}`, `\text{}` |
| `amssymb` | `\mathbb{R}`, `\mathcal{L}`, `\varnothing` |
| `boldsymbol` | `\boldsymbol{\theta}`, `\boldsymbol{\mu}` |
| `physics` (một phần) | `\bra{}`, `\ket{}`, `\braket{}` |
| `cancel` | `\cancel{x}`, `\bcancel{x}` |
| `color` | `\color{red}{x}` |

Xem [bảng hỗ trợ KaTeX](https://katex.org/docs/support_table.html) để có danh sách đầy đủ các hàm được hỗ trợ.

## 6. Khắc phục sự cố hiển thị

**Lỗi "Unknown command" trong bản xem trước**
Lệnh đó không được KaTeX hỗ trợ. Kiểm tra bảng hỗ trợ KaTeX và tìm một lệnh tương đương. Ví dụ, dùng `\mathbf` thay vì `\bm`.

**Phương trình hiển thị nhưng bị cắt cụt**
Phần tử khối LaTeX quá nhỏ. Đổi kích thước nó bằng cách kéo các tay nắm ở góc.

**Sơ đồ TikZ bị trống (không có kết quả, không có lỗi)**
- Đảm bảo bạn có `\begin{tikzpicture}` và `\end{tikzpicture}`.
- Một số thư viện TikZ (`tikz-cd`, `pgfplots`) có thể không khả dụng trong TikZJax. Thử xóa các lệnh gọi `\usetikzlibrary{...}` nếu bạn đã thêm bất kỳ lệnh nào — TikZ cơ bản hoạt động mà không cần chúng.

**Toán nội dòng không hiển thị sau khi gõ**
Nhấn `Escape` để thoát khỏi trình soạn văn bản trước. Toán nội dòng chỉ hiển thị ở chế độ xem.
