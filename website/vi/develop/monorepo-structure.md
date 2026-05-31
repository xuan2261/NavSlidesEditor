# Cấu trúc Monorepo

NavSlides Editor sử dụng npm workspaces. Mỗi package cấp cao nhất phụ trách một mối quan tâm riêng. Để xem hành trình tham quan codebase có chú thích, xem [`docs/codebase-summary.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/codebase-summary.md).

## Bản đồ workspace

```
NavSlidesEditor/
├── client/    # React SPA (Vite) → client/dist/ in production
├── server/    # Express REST API + Socket.IO
├── shared/    # Pure Node.js utilities (client + server)
└── electron/  # Desktop shell embedding the server
```

## Mọi thứ nằm ở đâu

**`client/src/`**
- `pages/` — các component theo route: `EditorPage`, `HomePage`, `LiveViewPage`, `SpeakerViewPage`, settings, explore, game join
- `components/` — `SlideCanvas`, `PropertiesPanel`, `SlidePanel`, giao diện `ribbon/`, và các modal
- `stores/` — trạng thái Zustand: `editor-store`, `presentation-store`, `ui-store`
- `hooks/` — `use-keyboard`, `use-clipboard`, `use-live-presentation`, và nhiều nữa
- `extensions/` — các extension TipTap (FontSize, FontFamily, MathExtension, …)
- `data/` — `element-defaults.js` là **danh sách chuẩn của 19 loại phần tử**

**`server/`**
- `index.js` — đấu nối Express và import các route dạng module
- `routes/` — `presentations`, `templates`, `share`, `upload`, `github`, `sync`, `history`, `media`, `live`, `pptx-import`, `ai`, các endpoint game, …
- `services/` — `storage` (JSON dựa trên file), `socket-handler`, `live-rooms`, `pptx-exporter`, quy trình `pptx-import/`, AI provider + guard
- `data/` + `uploads/` — lưu trữ runtime (các file JSON + media), được tạo trong lần chạy đầu tiên

**`shared/src/`**
- `htmlGenerator.js` + `element-renderers.js` — JSON → reveal.js HTML
- `shapeUtils.js`, `presenterTools.js`, `content-safety.js`, và các helper màu sắc/văn bản/PPTX `shared-*`
- `theme-presets.js` — 39 preset thiết kế; `fx/` — 8 nền động

## Symlink của `shared`

Vì `shared` là một npm workspace, `client` và `server` import nó như một phụ thuộc (dependency) bình thường (`revealjs-shared`). Bất kỳ logic nào được dùng bởi cả hai phía đều thuộc về đây — không bao giờ sao chép nó vào một package.

Xem thêm: [Kiến trúc](/vi/develop/architecture) · [Đóng góp](/vi/develop/contributing).
