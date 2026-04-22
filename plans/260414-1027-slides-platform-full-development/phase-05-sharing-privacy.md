# Phase 5 — Sharing & Privacy Enhancement

## Overview

- **Priority**: P2
- **Status**: ⬜ Pending
- **Effort**: 2-3 tuần
- **Dependencies**: Phase 0 (Foundation), Phase 1 (UI/UX)
- **Mục tiêu**: Advanced sharing controls giống slides.com

## Features to Implement

### 5.1 Password-Protected Links

**Mô tả**: Yêu cầu mật khẩu để xem shared presentation.

**Implementation**:

- Thêm `password: string (hashed)` vào share token data
- Share modal: optional password field
- Server: hash password (bcrypt) khi tạo share
- Viewer endpoint `/share/:token` → nếu có password → hiện form nhập password
- Verify password trước khi serve HTML

**Data model update**:

```json
// share-tokens.json
{
  "token-uuid": {
    "presentationId": "pres-uuid",
    "password": "$2b$10$...", // bcrypt hash, null = no password
    "expiresAt": "2026-05-14T...", // null = never
    "name": "For Client Review", // named link
    "views": 5, // view counter
    "createdAt": "2026-04-14T..."
  }
}
```

**Files**: `server/routes/share.js`, ShareModal, NEW share password page

---

### 5.2 Auto-Expiring Links

**Mô tả**: Share links tự hết hạn sau thời gian cài đặt.

**Implementation**:

- Share modal: expiry selector (1 hour, 1 day, 7 days, 30 days, custom, never)
- Server: check `expiresAt` before serving presentation
- Expired → show "This link has expired" page

---

### 5.3 Named Private Links

**Mô tả**: Tạo nhiều named links cho cùng 1 deck, track views.

**Implementation**:

- Mỗi presentation có thể có nhiều share tokens
- Share modal: list tất cả links, thêm/xoá/edit
- Mỗi link có name, password (optional), expiry (optional)
- View counter tăng mỗi lần truy cập
- Share status table:

```
┌──────────────────────────────────────────────────┐
│ Share Links                                      │
├──────────┬────────┬─────────┬──────┬────────────┤
│ Name     │ Views  │ Expires │ 🔒   │ Actions    │
├──────────┼────────┼─────────┼──────┼────────────┤
│ Client   │ 12     │ May 14  │ Yes  │ [Copy][Del]│
│ Team     │ 45     │ Never   │ No   │ [Copy][Del]│
│ Public   │ 230    │ Never   │ No   │ [Copy][Del]│
└──────────┴────────┴─────────┴──────┴────────────┘
│ [+ Create New Link]                              │
└──────────────────────────────────────────────────┘
```

---

### 5.4 Embed Code Generator

**Mô tả**: Generate iframe embed code cho websites.

**Implementation**:

- Share modal: "Embed" tab
- Generate iframe HTML:
  ```html
  <iframe
    src="https://your-server/share/{token}"
    width="960"
    height="540"
    frameborder="0"
    allowfullscreen
  >
  </iframe>
  ```
- Customization: width, height, auto-play, start slide
- Copy to clipboard button

---

### 5.5 Public Gallery

**Mô tả**: Browse presentations đã public (cho deployment nhiều users).

**Implementation**:

- Hiện tại single-user → Gallery = tất cả shared presentations
- URL: `/explore`
- Grid view với thumbnails
- Presentasion metadata: title, slide count, created date
- Click → view presentation

**Files**: NEW `client/src/pages/ExplorePage.jsx`, `server/routes/explore.js`

---

### 5.6 Forking (Clone/Copy)

**Mô tả**: Clone shared presentation thành bản mới.

**Implementation**:

- Button "Fork" trên shared presentation page
- API: `POST /api/presentations/:id/fork` hoặc `POST /api/share/:token/fork`
- Tạo bản copy của presentation
- Redirect đến editor

---

### 5.7 View Analytics Dashboard

**Mô tả**: Track view counts, traffic cho shared presentations.

**Implementation**:

- Mỗi view → increment counter + log timestamp + referrer
- Analytics data: `server/data/analytics.json`
- Dashboard modal trong editor:
  ```
  ┌──────────────────────────────┐
  │ Analytics - My Presentation  │
  ├──────────────────────────────┤
  │ Total Views: 347             │
  │ Unique Visitors: 128         │
  │ Avg. Time on Deck: 4m 23s   │
  ├──────────────────────────────┤
  │ Views over time:             │
  │ ▄█▄▄██▄▄▄█▄▄█              │
  │ Apr 1     Apr 14            │
  ├──────────────────────────────┤
  │ By Link:                     │
  │ - Client link: 45 views      │
  │ - Public: 302 views          │
  └──────────────────────────────┘
  ```

**Files**: `server/data/analytics.json`, `server/routes/analytics.js`, Analytics modal

---

## API Changes

| Method | Path                               | Purpose                                     |
| ------ | ---------------------------------- | ------------------------------------------- |
| POST   | `/api/presentations/:id/share`     | Create named share link (updated)           |
| GET    | `/api/presentations/:id/shares`    | List all share links for presentation       |
| PUT    | `/api/shares/:token`               | Update share link (name, password, expiry)  |
| DELETE | `/api/shares/:token`               | Delete share link                           |
| POST   | `/share/:token/verify`             | Verify password for protected link          |
| GET    | `/share/:token`                    | View presentation (check password + expiry) |
| POST   | `/api/share/:token/fork`           | Fork shared presentation                    |
| GET    | `/api/explore`                     | List all public presentations               |
| GET    | `/api/presentations/:id/analytics` | Get analytics data                          |

## Todo List

- [ ] Upgrade share-tokens data model (password, expiry, name, views)
- [ ] Password protection: hash, verify, password form page
- [ ] Auto-expiring links: expiry selector, server validation
- [ ] Named private links: multi-link management UI
- [ ] View counter increment on each access
- [ ] Embed code generator tab in share modal
- [ ] Public gallery page (/explore)
- [ ] Fork/clone shared presentations
- [ ] Analytics data collection (views, timestamps)
- [ ] Analytics dashboard modal
- [ ] Migrate existing share-tokens to new format
- [ ] Install bcrypt dependency

## Success Criteria

- [ ] Can create multiple named share links per presentation
- [ ] Password-protected links require password to view
- [ ] Expired links show "expired" message
- [ ] Embed code generates valid iframe HTML
- [ ] View counter tracks accurately
- [ ] Fork creates a full copy of the presentation
- [ ] Analytics shows view trends over time
