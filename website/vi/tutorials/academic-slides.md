# Slide Học Thuật

Hướng dẫn này chỉ cách xây dựng một bài thuyết trình học thuật chỉn chu: chân trang theo phần, phương trình LaTeX, sơ đồ TikZ, bố cục hai cột, và xuất ngoại tuyến.

## 1. Chọn mẫu thiết kế Academic

1. Tạo một bài trình chiếu mới và chọn mẫu **Academic**.
2. Khi đã vào trình soạn, mở thẻ **Design** trong dải lệnh (ribbon).
3. Mở thư viện **Themes** và chọn mẫu thiết kế (preset) **Academic Paper**. Điều này áp dụng:
   - Một cặp phông chữ serif/sans-serif gọn gàng
   - Một màu tiêu đề tinh tế
   - Các chân trang slide được đánh số sẵn sàng cho việc gắn nhãn theo phần

## 2. Thiết lập chuỗi chân trang

Hệ thống chân trang hiển thị một thanh tiến trình theo phần ở dưới cùng của mỗi slide.

1. Nhấn **Slide → Footer Settings** (hoặc biểu tượng chân trang trên thanh công cụ).
2. Trong bảng **Sections**, thêm tên các phần của bạn:
   - Introduction
   - Methods
   - Results
   - Discussion
3. Gán phạm vi slide hiện tại cho mỗi phần bằng cách nhấn **Assign Slides**.
4. Chọn một kiểu chân trang — chấm, nhãn, hoặc thanh tiến trình.
5. Nhấn **Apply to All Slides**.

::: tip
Chân trang tự động làm nổi bật phần đang hoạt động khi bạn tiến qua bài trình chiếu. Điều này cho khán giả của bạn một cảm giác liên tục về việc bạn đang ở đâu trong bài thuyết trình.
:::

## 3. Thêm phương trình LaTeX

1. Điều hướng đến một slide nơi bạn muốn hiển thị một kết quả (ví dụ, phần Results).
2. Nhấn chuột phải vào vùng canvas và chọn **Insert → LaTeX**.
3. Trong bảng trình soạn LaTeX, gõ một phương trình hiển thị:

```latex
\[
  \chi^2 = \sum_{i=1}^{N} \left(\frac{y_i - f(x_i;\boldsymbol{\theta})}{\sigma_i}\right)^2
\]
```

4. Bản xem trước trực tiếp hiển thị phương trình đã kết xuất ở bên phải.
5. Nhấn ra ngoài bảng để nhúng phương trình vào slide.
6. Đổi kích thước và định vị lại khối LaTeX khi cần.

## 4. Thêm một sơ đồ TikZ

Cho một sơ đồ phương pháp hoặc lược đồ:

1. Chèn một khối LaTeX khác.
2. Trong trình soạn, gõ một sơ đồ TikZ:

```latex
\begin{tikzpicture}[node distance=1.8cm]
  \node[draw, rectangle, rounded corners] (obs) {Observations};
  \node[draw, rectangle, rounded corners, right of=obs, xshift=1cm] (model) {Model};
  \node[draw, diamond, below of=model] (fit) {Fit?};
  \node[draw, rectangle, rounded corners, below of=fit] (out) {Best-fit params};

  \draw[->] (obs) -- (model) node[midway, above] {input};
  \draw[->] (model) -- (fit);
  \draw[->] (fit) -- node[right] {yes} (out);
  \draw[->] (fit.west) -- ++(-0.8,0) |- node[left, near start] {no} (model.west);
\end{tikzpicture}
```

## 5. Tạo một bố cục hai cột

Reveal.js dùng HTML, nên bạn có thể dùng một **lưới hai cột** bên trong một slide:

1. Chèn một **Text Box** và đổi kích thước nó để chiếm nửa trái của slide.
2. Chèn một **Text Box** thứ hai (hoặc khối hình ảnh/LaTeX) ở nửa phải.
3. Dùng **Align → Left edge** trên phần tử bên trái và **Align → Right edge** trên phần tử bên phải để khớp chúng vào vị trí.

Ngoài ra, dùng nút **Layout** trên thanh công cụ để chọn một mẫu thiết kế (preset) hai cột, thao tác này sẽ chèn vào các hộp giữ chỗ đã được định vị sẵn.

## 6. Sử dụng khối mã với tô màu cú pháp

1. Bên trong một hộp văn bản, nhấn nút **code block** của thanh công cụ.
2. Chọn ngôn ngữ từ danh sách thả xuống (ví dụ, Python, R, Julia).
3. Gõ hoặc dán mã của bạn:

```python
import numpy as np
from scipy.optimize import minimize

def neg_log_likelihood(theta, x, y, sigma):
    model = theta[0] * x + theta[1]
    return 0.5 * np.sum(((y - model) / sigma) ** 2)

result = minimize(neg_log_likelihood, x0=[1, 0], args=(x_data, y_data, sigma_data))
```

4. Mã được kết xuất với tô màu cú pháp bằng highlight.js.

## 7. Xuất HTML ngoại tuyến để dùng tại hội nghị

Trước bài thuyết trình của bạn, hãy xuất bài trình chiếu dưới dạng một gói ngoại tuyến:

1. Nhấn **File → Export → Offline HTML**.
2. Chờ quá trình nhúng tài nguyên hoàn tất (thường 5–15 giây).
3. Lưu tệp `.html` vào ổ USB hoặc máy tính xách tay của bạn.
4. Mở tệp trong bất kỳ trình duyệt nào — không cần internet.

::: tip
Hãy kiểm tra bản xuất ngoại tuyến trước hội nghị. Mở tệp trên chính máy tính bạn sẽ dùng để trình chiếu, không chỉ trên máy phát triển của bạn.
:::
