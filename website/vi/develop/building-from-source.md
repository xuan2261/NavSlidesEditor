# Build từ mã nguồn

Cách chạy NavSlides Editor cục bộ để phát triển. Yêu cầu **Node.js 20+** và npm 8+.

## Clone và cài đặt

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
npm install
```

`npm install` chạy một bước `postinstall` (`npm run vendor`) để sao chép các asset reveal.js đi kèm vào đúng chỗ.

## Chạy ở chế độ phát triển

```bash
npm run dev
```

Lệnh này khởi động Vite dev server (client) trên **5173** và Express API trên **3002** đồng thời. Vite dev server proxy `/api`, `/uploads`, `/vendor`, và `/ws` tới `:3002`, vì vậy hãy mở **http://localhost:5173** trong khi phát triển.

## Build production

```bash
npm run build      # compile React → client/dist/
npm start          # serve the built client + API on :3002
PORT=8080 npm start # custom port
```

## Ứng dụng desktop (Electron)

```bash
npm run electron:dev          # run in dev mode (no packaging)
npm run electron:build:win    # Windows .exe installer
npm run electron:build:linux  # Linux .AppImage + .deb
npm run electron:build:mac    # macOS .zip
```

## Docker

```bash
docker compose up -d          # server on :3002 with persistent volumes
docker compose logs -f        # tail logs
docker compose down -v        # stop + delete volumes
```

## Kiểm thử

```bash
npm run test          # unit tests (Vitest)
npm run test:e2e      # end-to-end tests (Playwright)
npm run test:corpus   # PPTX import/round-trip fidelity
npm run test:load:api # k6 load test — REST API
npm run test:load:ws  # k6 load test — WebSocket / Socket.IO
```

Chạy một file kiểm thử đơn lẻ bằng `npx vitest run <path>` hoặc `npx playwright test <path>`.

## Trang tài liệu

```bash
npm run docs:dev      # this VitePress site, locally
npm run docs:build    # production build
```

Xem thêm: [Kiến trúc](/vi/develop/architecture) · [Đóng góp](/vi/develop/contributing).
