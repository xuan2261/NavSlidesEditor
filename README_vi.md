# NavSlides Editor

A self-hostable WYSIWYG presentation editor được xây dựng dựa trên [reveal.js](https://revealjs.com/). Build và trình chiếu slide trực tiếp trên trình duyệt — không cần tài khoản, không cần đám mây, không bị theo dõi. Đồng thời cung cấp dưới dạng ứng dụng desktop độc lập thông qua Electron.

## Features

### Editing

- **WYSIWYG editing** — click và nhập liệu trực tiếp trên slide với trình soạn thảo văn bản phong phú TipTap
- **Rich formatting** — tiêu đề, in đậm/in nghiêng/gạch chân/gạch ngang, màu chữ, đánh dấu chữ, phông chữ, cỡ chữ, căn lề, danh sách, bảng, khối mã, liên kết, hình ảnh
- **Multi-select** — nhấn Shift và click để chọn nhiều thành phần, di chuyển hoặc xóa chúng cùng lúc
- **Group / ungroup** — nhóm nhiều thành phần để chọn, di chuyển, và thay đổi kích thước như một khối thống nhất
- **Align & distribute** — căn lề các thành phần được chọn sang trái/giữa/phải/trên/giữa/dưới, hoặc phân bố đều
- **Element rotation** — xoay bất kỳ thành phần nào bằng cách kéo tay cầm xoay hoặc nhập giá trị độ
- **Smart guides & snapping** — các đường căn chỉnh xuất hiện khi kéo gần cạnh của các đối tượng khác hoặc trung tâm canvas; bật/tắt bằng biểu tượng nam châm
- **Rulers & guides** — bật/tắt thước đo pixel ở cạnh trên/trái; kéo từ thước đo xuống canvas để đặt các đường gióng cố định; nhấp đúp vào một đường gióng để xóa nó
- **Element controls** — thay đổi kích thước, định vị, khóa, thứ tự z (z-order), đổ bóng, khóa tỷ lệ khung hình (giữ Shift khi thay đổi kích thước)
- **Round corners** — có thể điều chỉnh độ cong của các góc đối với hình ảnh và khối mã
- **Find & replace** — nhấn Ctrl+F để tìm kiếm văn bản trên tất cả các slide (có phân biệt chữ hoa/chữ thường), điều hướng giữa các kết quả, thay thế một hoặc toàn bộ
- **Undo / redo** — Ctrl+Z / Ctrl+Y với lịch sử 50 bước
- **Clipboard** — Ctrl+C/X/V và Ctrl+D để sao chép/cắt/dán/nhân bản đối tượng
- **Auto-save** — tự động lưu với thời gian trễ 1.5 giây kèm hiển thị mốc thời gian lưu gần nhất
- **Translucent Presenter UI** — các công cụ trôi nổi và điều hướng slide sẽ mờ đi còn 15% độ rọi khi không thao tác, giúp giảm thiểu sự phân tâm trong lúc trình bày
- **Interactive Onboarding** — tour hướng dẫn sản phẩm từng bước toàn diện sử dụng React-Joyride để hỗ trợ người dùng mới

### Element Types

- **Text boxes** — nội dung HTML phong phú với đầy đủ định dạng TipTap
- **Images** — tải lên hoặc qua URL, cắt (crop), thu phóng (pan), bộ lọc độ sáng/độ tương phản/ảnh đen trắng, bo góc
- **Shapes** — hình chữ nhật, hình tròn, hình tam giác, mũi tên, ngôi sao, đường kẻ với các tùy chọn về màu tô/viền/độ mờ/bo góc
- **Code blocks** — code được làm nổi bật cú pháp với 10 themes và hơn 25 ngôn ngữ, có bo góc
- **LaTeX / TikZ** — các khối toán học LaTeX đầy đủ và sơ đồ TikZ được render qua KaTeX và TikZJax, kèm theo trình soạn thảo chia đôi màn hình có live preview
- **Inline math** — hiển thị KaTeX dạng nội tuyến (inline) và khối (display) bên trong văn bản
- **HTML embeds** — nhúng tùy ý HTML/CSS/JS hoặc trực quan hóa D3 thông qua iframe
- **Markdown blocks** — viết mã Markdown thô và nó sẽ được render thành nội dung có định dạng
- **Charts** — biểu đồ cột, đường, tròn, doughnut, radar, và vùng cực qua Chart.js với dữ liệu có thể chỉnh sửa
- **Video / audio** — nhúng các tệp phương tiện qua URL hoặc tải lên với các phím điều khiển, tùy chọn tự động phát, lặp lại, và tắt tiếng
- **Tables** — đối tượng bảng có thể kéo/thay đổi kích thước với hàng tiêu đề, khả năng chỉnh sửa trực tiếp trên ô (inline cell editing), và tùy chỉnh phong cách
- **Icons** — thư viện có thể tìm kiếm với hơn 60 biểu tượng SVG dạng Lucide có thể tùy chỉnh màu sắc và đường viền
- **Callout bubbles** — các vòng tròn chú thích có đánh số với khả năng tùy chỉnh màu sắc và kích thước

### Slides

- **Full-Deck Templates** — thư viện gồm hơn 10 theme thuyết trình chất lượng cao có sẵn trực tiếp từ trang chủ
- **Slide templates** — trống, tiêu đề, hai cột, ba cột, hình ảnh+văn bản, tiêu đề phần, so sánh, số lớn
- **Global Settings** — quản lý tập trung các cấu hình Reveal.js (auto-slide, loop, navigation modes)
- **Slide backgrounds** — màu đơn sắc, dải màu gradient CSS, hoặc hình ảnh cho từng slide thông qua popup trên thanh công cụ
- **Fragment animations** — hoạt ảnh xuất hiện cho từng đối tượng, có kèm trình chỉnh sửa tiến trình trực quan
- **Per-slide page numbers** — bật/tắt đánh số trang riêng cho từng slide; các slide bị bỏ qua sẽ không tính vào số trang
- **Hidden slides** — đánh dấu slide là ẩn để bỏ qua trong quá trình trình chiếu

### Footer System

- **Basic mode** — nhãn phần ở bên trái, số trang ở bên phải
- **Sequence mode** — định nghĩa tiêu đề các phần (ví dụ: Intro / Methods / Results / Discussion) được trải đều ở phía dưới; phần đang hiển thị sẽ in đậm, các phần khác sẽ mờ đi; có thể tùy chỉnh màu sắc
- **Footer styling** — cấu hình font chữ, kích cỡ, màu đang hoạt động và không hoạt động

### Themes & Templates

- **11 reveal.js themes** — black, white, league, beige, sky, night, serif, simple, solarized, moon, dracula
- **Transitions** — none, fade, slide, convex, concave, zoom
- **Preset themes** — 6 cài đặt trước về thiết kế: Minimal Dark, Minimal Light, Academic, Gradient, Corporate, Neon
- **Custom templates** — tạo, chỉnh sửa, và quản lý các mẫu bài thuyết trình có thể tái sử dụng của riêng bạn; bắt đầu các bài thuyết trình mới từ bất kỳ mẫu nào
- **Dark / light editor theme** — chuyển đổi giao diện trình chỉnh sửa giữa chế độ tối (dark mode) và sáng (light mode)

### Export & Sharing

- **Present mode** — trình chiếu toàn màn hình với reveal.js kèm theo ghi chú diễn giả (nhấn phím `S`)
- **Advanced Markdown Import** — tạo toàn bộ bài thuyết trình từ Markdown với sự hỗ trợ cho các attributes nâng cao của slide
- **Export HTML** — tải xuống dưới dạng tệp HTML độc lập
- **Export offline HTML** — tích hợp sẵn tất cả tài nguyên CDN (Reveal.js, KaTeX, highlight.js) vào file và phân giải chính xác các iframe/plugin cục bộ để tệp hoạt động hoàn toàn offline
- **Export PDF** — bố cục in sẵn sàng với một trang trên mỗi slide, các trạng thái fragment được mở rộng, kèm tính năng khởi tạo iframe cải tiến cho nội dung nhúng
- **Export PPTX** — tạo tệp PowerPoint để chia sẻ với người dùng không chuyên kỹ thuật
- **Shareable links** — tạo các URL công khai để xem bản trình bày mà không cần vào trình chỉnh sửa; bật/tắt tính năng này tùy từng file
- **GitHub integration** — push các bài thuyết trình trực tiếp lên kho lưu trữ GitHub cùng với tệp README được tạo tự động

### Cloud Sync

- **Proton Drive sync** — đồng bộ slide của bạn lên Proton Drive qua rclone; định cấu hình credentials trong ứng dụng, có thể đồng bộ các bài thuyết trình riêng lẻ hoặc tất cả cùng lúc
- **Configurable remote** — hoạt động với bất kỳ nhà cung cấp đám mây nào được rclone hỗ trợ (Proton Drive, Google Drive, S3, v.v.)

### Version History

- **Named snapshots** — lưu các phiên bản được đặt tên của bài thuyết trình tại bất kỳ thời điểm nào
- **Restore** — khôi phục mọi snapshot trước đó, ghi đè lên trạng thái hiện tại
- **Delete** — xóa các snapshot riêng lẻ

---

## Installation

### Option A — Desktop App (Electron)

Chạy NavSlides Editor dưới dạng ứng dụng desktop native. Không cần server, không cần Docker, không cần browser.

#### Pre-built packages

Tải xuống từ trang [Releases](https://github.com/Xuan2261/navslides-editor/releases). Workflow phát hành hiện tại tự động build artifact Windows; Linux/macOS vẫn build được bằng script local bên dưới:

| Platform | Format                                                  |
| -------- | ------------------------------------------------------- |
| Linux    | `.AppImage` (chạy trực tiếp) hoặc `.deb` (cài qua dpkg) |
| macOS    | `.zip` (giải nén và mở file `.app`)                     |
| Windows  | file installer `.exe` hoặc bản `.exe` portable          |

**Cài đặt `.deb` trên Linux:**

```bash
sudo dpkg -i revealjs-editor_1.0.0_amd64.deb
```

**Bản `.AppImage` trên Linux:**

```bash
chmod +x Slides\ Editor-1.0.0.AppImage
./Slides\ Editor-1.0.0.AppImage
```

#### Build from source

Yêu cầu **Node.js 20+**.

```bash
git clone https://github.com/Xuan2261/navslides-editor.git
cd navslides-editor
npm install
```

Tiến hành build cho nền tảng của bạn:

```bash
npm run electron:build:linux   # → .AppImage + .deb
npm run electron:build:mac     # → .zip (giải nén lấy file .app)
npm run electron:build:win     # → file installer .exe + bản portable
```

Đầu ra sẽ nằm trong thư mục `dist-electron/`.

Hoặc chạy ở chế độ dev mà không cần build bộ cài:

```bash
npm run electron:dev
```

#### Data location

Ứng dụng desktop lưu trữ dữ liệu tại thư mục dữ liệu hệ điều hành của bạn:

| Platform | Path                                              |
| -------- | ------------------------------------------------- |
| Linux    | `~/.config/NavSlides Editor/`                     |
| macOS    | `~/Library/Application Support/NavSlides Editor/` |
| Windows  | `%APPDATA%/NavSlides Editor/`                     |

---

### Option B — Docker (khuyên dùng cho server)

Yêu cầu [Docker](https://docs.docker.com/get-docker/) và [Docker Compose](https://docs.docker.com/compose/install/).

#### 1. Clone repository

```bash
git clone https://github.com/Xuan2261/navslides-editor.git
cd navslides-editor
```

#### 2. Khởi chạy với Docker Compose

```bash
docker compose up -d
```

Quá trình này sẽ:

- Build giao diện React và đóng gói cùng với máy chủ Express
- Cài đặt rclone để hỗ trợ đồng bộ đám mây
- Khởi chạy container trên cổng **3002**
- Tạo 2 named volumes để giữ lại dữ liệu khi bạn restart:
  - `revealjs-data` — dữ liệu slide, templates, share tokens, version history
  - `revealjs-uploads` — hình ảnh, video và audio được upload

Mở `http://localhost:3002` trong trình duyệt của bạn.

#### Các lệnh hữu ích

```bash
# Xem logs
docker compose logs -f

# Dừng container
docker compose down

# Rebuild sau khi pull các thay đổi mã nguồn mới
docker compose up -d --build

# Xóa toàn bộ container VÀ volumes (điều này sẽ xóa tất cả dữ liệu thuyết trình và các nội dung đã tải lên)
docker compose down -v
```

#### Chạy trên một cổng tùy chỉnh

Sửa tệp `docker-compose.yml` và thay đổi host port (phía bên trái của port mapping):

```yaml
ports:
  - '8080:3002' # ứng dụng lúc này truy cập tại http://localhost:8080
```

---

### Option C — Node.js / npm from source

Yêu cầu **Node.js 20+** và npm 8+.

#### 1. Clone repository

```bash
git clone https://github.com/Xuan2261/navslides-editor.git
cd navslides-editor
```

#### 2. Cài đặt các dependencies

```bash
npm install
```

#### 3a. Development mode

Khởi chạy đồng thời cả máy chủ Vite dev và Express API server (tính năng hot-reload sẽ được bật):

```bash
npm run dev
```

| Dịch vụ               | URL                   |
| --------------------- | --------------------- |
| Frontend (Vite)       | http://localhost:5173 |
| Backend (Express API) | http://localhost:3002 |

Mở `http://localhost:5173`. Máy chủ dev của Vite sẽ tự động proxy tới `/api` và `/uploads` sang Express server.

#### 3b. Production mode

Build ứng dụng frontend, sau đó serve toàn bộ từ Express server trên cùng một cổng:

```bash
npm run build   # biên dịch mã React → client/dist/
npm start       # serve thư mục client/dist/ + API tại cổng 3002
```

Mở `http://localhost:3002`.

#### Chạy trên một cổng tùy chỉnh

```bash
PORT=8080 npm start
```

---

## Data & Persistence

| Path                             | Contents                              |
| -------------------------------- | ------------------------------------- |
| `server/data/presentations.json` | Toàn bộ dữ liệu của bài thuyết trình  |
| `server/data/templates.json`     | Custom templates                      |
| `server/data/share-tokens.json`  | Shareable link tokens                 |
| `server/data/github-config.json` | Thông tin xác thực GitHub integration |
| `server/data/history/`           | Lịch sử lưu các bản nháp (snapshots)  |
| `server/uploads/`                | Hình ảnh, audio, video được upload    |

Mọi file cấu hình và thư mục sẽ được tự động tạo vào lần chạy đầu tiên. Bạn nên thực hiện backup để tránh mất dữ liệu.

**Docker:** Dữ liệu nằm trong 2 named volumes (`revealjs-data`, `revealjs-uploads`). Để backup:

```bash
# Lệnh copy file JSON dữ liệu ra khỏi volume
docker run --rm \
  -v revealjs-data:/data \
  -v $(pwd):/backup \
  alpine cp /data/presentations.json /backup/presentations.json
```

---

## Save to GitHub

Bạn có thể push các bài slide lên repository trên GitHub trực tiếp từ trong editor.

### 1. Tạo GitHub Personal Access Token

Truy cập **GitHub → Settings → Developer settings → [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new)** và tạo một token với:

| Setting                    | Value                                              |
| -------------------------- | -------------------------------------------------- |
| **Repository access**      | **Only select repositories** → Chọn repo mong muốn |
| **Permissions → Contents** | **Read and write**                                 |

### 2. Tạo một target repository

Hãy tạo một kho repo rỗng trên GitHub (ví dụ: `presentations`).

### 3. Cấu hình trong editor

1. Mở bất kỳ bài thuyết trình nào và nhấp vào nút **GitHub**.
2. Nhập tên GitHub của bạn dưới dạng **Repository Owner**.
3. Điền vào tên repository.
4. Paste token ở phía trên và bấm **Save Settings**.

### 4. Push một bài presentation

Bấm nút **GitHub** → có thể nhập commit message nếu muốn → **Push to GitHub**.

```
my-repo/
├── README.md                          ← tự động tạo nội dung có link
├── my_first_talk/
│   ├── presentation.html              ← xem trực tiếp tại browser
│   └── presentation.json              ← file dữ liệu dự án gốc
└── another_presentation/
    ├── presentation.html
    └── presentation.json
```

---

## Cloud Sync (Proton Drive)

Đồng bộ mọi bản thuyết trình lên Proton Drive hoặc bất cứ nhà cung cấp đám mây nào khác hỗ trợ rclone.

1. Bấm nút **Sync** phía trên cùng ứng dụng.
2. Nhập thông tin đăng nhập của Proton Drive.
3. Chọn **Connect** để thử kết nối.
4. Chọn **Sync This Presentation** hoặc **Sync All** để bắt đầu upload lên đám mây.

Các slide sẽ được export theo cấu trúc HTML + JSON và được tự động upload via rclone. Bản cài đặt Docker đã bao gồm sẵn rclone. Đối với ứng dụng Desktop, bạn cần cài đặt rclone riêng trên hệ điều hành của mình.

---

## Reverse Proxy (optional)

**Nginx:**

```nginx
server {
    listen 443 ssl;
    server_name slides.example.com;

    ssl_certificate     /etc/letsencrypt/live/slides.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/slides.example.com/privkey.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

**Caddy:**

```
slides.example.com {
    reverse_proxy localhost:3002
}
```

---

## Keyboard Shortcuts

| Shortcut                  | Action                                |
| ------------------------- | ------------------------------------- |
| `Ctrl+Z`                  | Undo (Hoàn tác)                       |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo (Làm lại)                        |
| `Ctrl+C`                  | Copy phần tử                          |
| `Ctrl+X`                  | Cut phần tử                           |
| `Ctrl+V`                  | Paste phần tử                         |
| `Ctrl+D`                  | Duplicate (Nhân bản) phần tử          |
| `Ctrl+F`                  | Find & replace (Tìm kiếm & thay thế)  |
| `Delete` / `Backspace`    | Xóa đối tượng được chọn               |
| `Escape`                  | Bỏ chọn / dừng chỉnh sửa / đóng panel |
| `Shift+drag`              | Giữ tỷ lệ (aspect ratio) khi resize   |
| `Shift+rotate`            | Bám góc 15 độ khi rotate              |
| `S` (lúc trình chiếu)     | Mở speaker notes view                 |

---

## Requirements

| Method       | Requirement                                        |
| ------------ | -------------------------------------------------- |
| Desktop app  | Node.js 20+ (chỉ dành cho quá trình build)         |
| Docker       | Docker 20.10+ và Docker Compose v2+                |
| Node.js      | Node.js 20+ và npm 8+                              |
| Load Testing | [k6](https://k6.io/docs/get-started/installation/) |

---

## Testing & Performance

Quy trình kiểm tra thường chạy theo thứ tự:

1. Lint và build:
   ```bash
   npm run lint
   npm run build
   ```
2. Unit tests:
   ```bash
   npm run test
   ```
3. Browser tests:
   ```bash
   npm run test:e2e
   ```
4. PPTX corpus check:
   ```bash
   npm run test:corpus
   ```
5. Load tests với `k6`:
   ```bash
   npm run test:load:api
   npm run test:load:ws
   ```

Cài `k6` theo hướng dẫn chính thức nếu muốn chạy load suite local.

---

## Tech Stack

| Layer                | Technology                                                |
| -------------------- | --------------------------------------------------------- |
| Frontend             | React 18, Vite 5                                          |
| Rich text editor     | TipTap 2                                                  |
| Presentation engine  | reveal.js 5                                               |
| Math rendering       | KaTeX                                                     |
| Diagrams             | TikZJax                                                   |
| Charts               | Chart.js 4                                                |
| Syntax highlighting  | highlight.js                                              |
| Markdown             | Built-in converter + marked.js (export)                   |
| Icons                | Lucide (bộ ui trình chỉnh sửa) + inline SVG (slide icons) |
| PowerPoint export    | pptxgenjs                                                 |
| Backend              | Node.js, Express 4                                        |
| Desktop app          | Electron                                                  |
| Cloud sync           | rclone                                                    |
| Testing              | Vitest, Playwright, k6                                    |
| Linting & Formatting | ESLint, Prettier                                          |
| Storage              | JSON files + local filesystem                             |
