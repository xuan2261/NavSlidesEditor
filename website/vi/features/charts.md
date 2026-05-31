# Biểu đồ

NavSlides Editor cung cấp sẵn một trình chỉnh sửa biểu đồ được hỗ trợ bởi [Chart.js](https://www.chartjs.org/), cho phép bạn tạo trực quan hóa dữ liệu trực tiếp trên slide mà không cần công cụ bên ngoài.

## Chèn một biểu đồ

1. Dùng tab dải lệnh **Insert** và chọn **Chart** (hoặc nhấp chuột phải vào canvas và chọn **Insert → Chart**).
2. Một biểu đồ cột (bar) với dữ liệu mẫu được đặt trên slide.
3. Khi biểu đồ được chọn, chọn một loại biểu đồ từ tab **Format** hoặc bảng thuộc tính:
   - **Bar** — biểu đồ cột dọc hoặc ngang
   - **Line** — biểu đồ đường với tô vùng tùy chọn
   - **Pie** — biểu đồ tròn theo tỷ lệ
   - **Doughnut** — biểu đồ tròn có lỗ ở giữa
   - **Radar** — biểu đồ radar/mạng nhện đa trục
   - **Polar area** — biểu đồ vùng tỏa tròn

## Chỉnh sửa dữ liệu biểu đồ

Nhấp đúp vào phần tử biểu đồ để mở **trình chỉnh sửa dữ liệu biểu đồ**:

- Trình chỉnh sửa hiển thị một lưới kiểu bảng tính với các cột cho nhãn và chuỗi dữ liệu.
- Nhấp vào bất kỳ ô nào để chỉnh sửa giá trị.
- Thêm hàng bằng nút **+ Row**; thêm chuỗi bằng **+ Series**.
- Xóa hàng hoặc chuỗi bằng biểu tượng thùng rác.
- Các thay đổi được phản ánh trong bản xem trước biểu đồ trực tiếp phía trên lưới.

## Tạo kiểu biểu đồ

Khi biểu đồ được chọn, bảng bên phải bộc lộ các tùy chọn tạo kiểu:

| Tùy chọn | Mô tả |
|---|---|
| Tiêu đề biểu đồ | Tiêu đề tùy chọn hiển thị phía trên biểu đồ |
| Chú giải (legend) | Bật/tắt; vị trí (trên, dưới, trái, phải) |
| Màu sắc | Đặt màu cho từng chuỗi dữ liệu |
| Độ rộng cột/đường | Độ rộng nét cho biểu đồ đường |
| Tô vùng | Tô vùng bên dưới biểu đồ đường |
| Đường lưới | Bật/tắt đường lưới trục X và Y |
| Nhãn trục | Nhãn tùy chỉnh cho trục X và Y |
| Cỡ chữ | Cỡ chữ chung cho nhãn và tiêu đề |

## Thay đổi kích thước và định vị

Thay đổi kích thước và di chuyển phần tử biểu đồ như bất kỳ phần tử nào khác — kéo để di chuyển vị trí, kéo các góc để điều chỉnh tỷ lệ.

::: tip
Để có biểu đồ chất lượng xuất bản, hãy cân nhắc xuất trực quan hóa dữ liệu của bạn từ một công cụ chuyên dụng (matplotlib, R ggplot2) và chèn nó dưới dạng hình ảnh. Trình chỉnh sửa biểu đồ tích hợp sẵn phù hợp nhất cho các biểu đồ nhanh, có thể chỉnh sửa ngay trên slide.
:::

## Định dạng dữ liệu ví dụ

Nếu bạn dán dữ liệu từ một bảng tính, hãy dùng các giá trị phân tách bằng tab:

```
Label   Series 1   Series 2
Q1      42         35
Q2      58         47
Q3      63         52
Q4      71         60
```

Dán trực tiếp vào lưới dữ liệu, và NavSlides Editor sẽ tự động phân tích các nhãn và chuỗi.
