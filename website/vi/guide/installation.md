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

Sau đó mở **http://localhost:3002** trên trình duyệt của bạn.

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
Trong lần khởi chạy đầu tiên, ứng dụng desktop sẽ mở cả cửa sổ trình soạn thảo và một máy chủ cục bộ trên cổng 3002. Bạn cũng có thể truy cập trình soạn thảo từ trình duyệt tại `http://localhost:3002`.
:::

---

## Phương án 3: Node.js từ mã nguồn

Dành cho nhà phát triển hoặc bất kỳ ai muốn tùy biến trình soạn thảo.

### Yêu cầu trước

- Node.js 18+ và npm

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

Phục vụ ứng dụng đã build tại `http://localhost:3002`.

### Lưu trữ dữ liệu bền vững

Các bài trình chiếu được lưu vào `./presentations/` và các tệp tải lên vào `./uploads/` trong thư mục gốc của dự án.

::: warning
Khi chạy từ mã nguồn, hãy chắc chắn sao lưu thư mục `presentations/` — thư mục này không được git theo dõi.
:::
