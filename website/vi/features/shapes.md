# Hình khối & Phần tử

NavSlides Editor cung cấp sẵn một bộ hình khối vector mà bạn có thể đặt, tạo kiểu và tạo hoạt ảnh trên bất kỳ slide nào.

## Chèn một hình khối

1. Nhấp chuột phải vào vùng canvas của slide và chọn **Insert → Shape**, hoặc nhấp nút **Shape** trên thanh công cụ Insert.
2. Một menu con hiển thị các loại hình khối có sẵn:
   - **Rectangle** — hộp tô màu hoặc viền; hỗ trợ bo góc
   - **Ellipse / Circle** — hình bầu dục hoặc hình tròn hoàn hảo (giữ `Shift` khi kéo để ràng buộc thành hình tròn)
   - **Line** — đường thẳng với đầu mũi tên tùy chọn ở hai đầu
   - **Arrow** — mũi tên một đầu hoặc hai đầu
   - **Triangle** — tam giác đều, vuông hoặc cân
   - **Star** — ngôi sao 4, 5 hoặc 6 cánh

3. Nhấp vào hình khối mong muốn. Nó sẽ được đặt ở giữa slide.

## Thay đổi kích thước và định vị

- **Kéo** phần tử để di chuyển vị trí.
- **Kéo một tay nắm ở góc** để thay đổi kích thước (giữ `Shift` để khóa tỷ lệ khung hình).
- **Kéo tay nắm xoay** (vòng tròn phía trên phần tử) để xoay; giữ `Shift` để bắt theo bước 15°.
- Dùng bảng **Position & Size** bên phải để nhập giá trị pixel chính xác cho X, Y, chiều rộng và chiều cao.

## Tạo kiểu cho hình khối

Khi một hình khối được chọn, bảng bên phải hiển thị các tùy chọn tạo kiểu:

| Thuộc tính | Tùy chọn |
|---|---|
| Màu tô | Đặc, gradient (tuyến tính hoặc tỏa tròn), hoặc không (trong suốt) |
| Màu viền | Bất kỳ màu nào, hoặc không |
| Độ rộng viền | 0–20 px |
| Kiểu viền | Đặc, gạch nét, chấm |
| Bán kính bo góc | 0–50 px (chỉ áp dụng cho hình chữ nhật) |
| Độ mờ | 0–100% |
| Đổ bóng | Độ lệch, độ nhòe và màu |

## Tùy chọn cho đường thẳng và mũi tên

Đối với phần tử **Line** và **Arrow**:

- Đặt kiểu đầu mũi tên ở điểm **đầu** và **cuối**: không có, mũi tên hở, mũi tên đặc, hình tròn
- Đặt **độ rộng nét** và **kiểu nét** (đặc, gạch nét)
- Đường thẳng sẽ bắt theo các góc 45° khi bạn giữ `Shift` lúc vẽ

## Phân lớp

Dùng các điều khiển lớp để điều chỉnh thứ tự xếp chồng của các phần tử chồng lên nhau:

- **Bring to Front** — đưa ra trước tất cả các phần tử khác
- **Send to Back** — đưa ra sau tất cả các phần tử khác
- **Bring Forward** — đưa lên một lớp
- **Send Backward** — đưa xuống một lớp

Nhấp chuột phải vào một phần tử và chọn tùy chọn lớp, hoặc dùng các nút trên thanh công cụ.

## Nhóm các phần tử

Chọn nhiều phần tử (nhấp một phần tử, rồi `Shift+click` các phần tử khác, hoặc kéo một khung chọn) và nhấn `Ctrl+G` để nhóm chúng lại. Một tập hợp phần tử đã nhóm có thể được di chuyển và thay đổi kích thước như một khối duy nhất.

Nhấn `Ctrl+Shift+G` để bỏ nhóm.

::: tip
Nhóm hữu ích khi xây dựng sơ đồ hoặc các thành phần slide mà bạn muốn tái sử dụng. Sau khi nhóm, nhấp chuột phải và chọn **Save as Template** để thêm nhóm vào thư viện mẫu của bạn.
:::
