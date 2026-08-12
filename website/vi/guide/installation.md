# Cài đặt

NavSlides Editor có thể chạy qua Docker, dưới dạng ứng dụng desktop, hoặc trực tiếp từ mã nguồn với Node.js.

## Phương án 1: Docker (Khuyến nghị)

Docker là cách dễ nhất để chạy NavSlides Editor như một máy chủ chạy liên tục.

### Yêu cầu trước

- Đã cài đặt [Docker](https://docs.docker.com/get-docker/) và Docker Compose

### Các bước

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
docker compose up -d
```

Sau đó mở **http://127.0.0.1:3002** trong trình duyệt. Container lắng nghe
`0.0.0.0` nội bộ; địa chỉ publish trên máy chủ mặc định chỉ là loopback. Chỉ
đặt `NAVSLIDES_PUBLISH_HOST` khi đã có lớp xác thực bên ngoài.

### Chính sách request mutation và reverse proxy

Máy chủ không tích hợp xác thực người dùng. Mặc định hãy giữ các route mutation
trên loopback; khi triển khai ngoài loopback, cần đặt một lớp xác thực bên ngoài
ở phía trước. Biên CSRF cục bộ được cấu hình bằng:

- `NAVSLIDES_LOCAL_ALLOWED_HOSTS`: danh sách `host[:port]` cách nhau bằng dấu
  phẩy; mặc định là `localhost`, `127.0.0.1` và `[::1]`.
- `NAVSLIDES_LOCAL_ALLOWED_ORIGINS`: tùy chọn, danh sách origin `http(s)` chính
  xác; đường dẫn, thông tin đăng nhập, query và fragment đều bị từ chối.
- `NAVSLIDES_TRUSTED_PROXY_ADDRESSES`: địa chỉ IP proxy được phép cung cấp
  `X-Forwarded-Host` và `X-Forwarded-Proto`; các peer khác sẽ bị bỏ qua header
  forward.
- `NAVSLIDES_ALLOW_MISSING_ORIGIN`: mặc định cho phép thiếu `Origin` để giữ
  tương thích với client không phải trình duyệt và các tích hợp hiện có. Đặt
  `0` khi deployment bên ngoài phải yêu cầu header `Origin` cùng origin trên
  mọi request mutation.

Khi có `Origin`, origin phải khớp host/protocol hiệu dụng và allowlist đã cấu
hình. Đây là biên triển khai/CSRF, không phải xác thực ứng dụng hay cô lập tenant.

SVG tải lên được làm sạch khi nhận và một lần nữa khi phục vụ, kể cả tệp cũ;
response dùng CSP sandbox, `nosniff` và resource policy cùng origin.

### Các lệnh Docker hữu ích

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after pulling updates
git pull
docker compose up -d --build
```

### Lưu trữ dữ liệu bền vững

| Đường dẫn bên trong container | Nội dung lưu trữ |
|---|---|
| `/app/presentations` | Toàn bộ tệp bài trình chiếu đã lưu |
| `/app/uploads` | Hình ảnh và tài nguyên đã tải lên |

Theo mặc định, các thư mục này được gắn (mount) vào `./presentations` và `./uploads` trên máy chủ (xem `docker-compose.yml`).

---

## Phương án 2: Ứng dụng desktop (Electron)

Ứng dụng desktop đóng gói trình soạn thảo và máy chủ thành một ứng dụng độc lập — không cần Docker hay Node.js.

### Tải về

Truy cập [trang Releases](https://github.com/xuan2261/NavSlidesEditor/releases) và tải về bản dựng cho nền tảng của bạn:

| Nền tảng | Tệp | Ghi chú |
|---|---|---|
| Windows (trình cài đặt) | `NavSlides Editor Setup x.x.x.exe` | Cài vào Program Files và tạo lối tắt trong Start menu |
| Windows (portable) | `NavSlides Editor x.x.x.exe` | Chạy trực tiếp, không cần cài đặt |

::: tip Linux & macOS
Các gói Linux và macOS dựng sẵn chưa được phát hành. Bạn có thể tự build từ mã nguồn — xem [Build từ mã nguồn](/vi/develop/building-from-source) (`npm run electron:build:linux` hoặc `electron:build:mac`).
:::

::: tip
Trong lần khởi chạy đầu tiên, ứng dụng desktop sẽ mở cả cửa sổ trình soạn thảo và một máy chủ cục bộ trên cổng 3002. Bạn cũng có thể truy cập trình soạn thảo từ trình duyệt tại `http://127.0.0.1:3002`.
:::

---

## Phương án 3: Node.js từ mã nguồn

Dành cho nhà phát triển hoặc bất kỳ ai muốn tùy biến trình soạn thảo.

### Yêu cầu trước

- Node.js 20+ và npm

### Các bước

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
npm install
```

### Chế độ phát triển (hot reload)

```bash
npm run dev
```

Mở trình soạn thảo tại `http://localhost:5173` với Vite HMR.

### Chế độ production

```bash
npm run build
npm start
```

Phục vụ ứng dụng đã build tại `http://127.0.0.1:3002`.

### Lưu trữ dữ liệu bền vững

Dữ liệu JSON được lưu trong `server/data/`, tài nguyên tải lên trong
`server/uploads/`. Với Docker, named volume mount các thư mục này vào
`/app/server/data` và `/app/server/uploads`.

Khi chạy từ mã nguồn, hãy sao lưu `server/data/` — thư mục này không được git
theo dõi.
