# Phase 01 — Security Patches

> **Priority:** 🔴 Critical  
> **Effort:** 1-2 days  
> **Dependencies:** None  
> **Goal:** Fix tất cả lỗ hổng bảo mật trước khi expose share links ra internet

---

## Context

Từ kết quả Red-team review, 3 critical + 3 high vulnerabilities đã được xác nhận:

- XSS qua HTML embed + share links (Critical)
- Password lộ trong URL query string (Critical)
- Plaintext credentials lưu trên disk (High)
- Upload chỉ check extension, không check MIME header (High)
- customCSS injection (High)
- Không có rate limiting (Medium)

## Related Files

### Files to Modify:

- [server/index.js](file:///d:/NCKH_2025/revealjs_gui/server/index.js) — Share password form + renderShareView
- [server/routes/upload.js](file:///d:/NCKH_2025/revealjs_gui/server/routes/upload.js) — MIME validation
- [server/routes/sync.js](file:///d:/NCKH_2025/revealjs_gui/server/routes/sync.js) — rclone password obscure
- [shared/src/htmlGenerator.js](file:///d:/NCKH_2025/revealjs_gui/shared/src/htmlGenerator.js) — HTML sanitization
- [server/package.json](file:///d:/NCKH_2025/revealjs_gui/server/package.json) — New dependencies

### New Dependencies:

- `dompurify` + `jsdom` (server-side sanitization)
- `express-rate-limit` (API rate limiting)
- `file-type` (MIME magic bytes detection)

---

## Implementation Steps

### Task 1.1: Fix Share Password Form (GET → POST)

**File:** `server/index.js`  
**Effort:** 30 min

**Current code (line 166-175):**

```javascript
// VULNERABLE: password in URL
if (!req.query.pwd || !(await bcrypt.compare(req.query.pwd, tokenData.password))) {
  return res.send(`<form method="GET">
    <input type="password" name="pwd" />
```

**Target code:**

```javascript
// Step 1: Change GET handler to show POST form
if (tokenData.password && req.method === 'GET') {
  // No query-string check — always show form for GET
  return res.send(`
    <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;background:#1e1e2e;">
      <form method="POST" style="text-align:center;color:#e0e0e0;">
        <h2>Password Required</h2>
        <input type="password" name="pwd" placeholder="Enter password" 
               style="padding:8px 12px;border-radius:6px;border:1px solid #3a3a4e;background:#2a2a3e;color:#e0e0e0;font-size:14px;" />
        <button type="submit" style="padding:8px 18px;background:#6366f1;color:white;border:none;border-radius:6px;margin-left:8px;cursor:pointer;">
          View
        </button>
      </form>
    </body></html>
  `)
}

// Step 2: Add POST handler for password verification
app.post('/share/:token', async (req, res) => {
  const tokens = await readShareTokens()
  let tokenData = tokens[req.params.token]
  if (typeof tokenData === 'string') tokenData = { presentationId: tokenData }
  if (!tokenData) return res.status(404).send('Not found')
  if (!canViewShare(tokenData)) return res.status(403).send('Expired')

  // urlencoded body from form
  const pwd = req.body?.pwd
  if (!pwd || !(await bcrypt.compare(pwd, tokenData.password))) {
    return res.redirect(`/share/${req.params.token}`) // back to form
  }

  tokenData.views = (tokenData.views || 0) + 1
  tokens[req.params.token] = tokenData
  await writeShareTokens(tokens)
  await renderShareView(tokenData.presentationId, res)
})
```

**Cần thêm middleware:** `app.use(express.urlencoded({ extended: false }))` trước share routes.

**Checklist:**

- `[ ]` Thêm `express.urlencoded` middleware
- `[ ]` Tách GET handler: chỉ show form (không check query.pwd nữa)
- `[ ]` Thêm POST handler cho password verification
- `[ ]` Loại bỏ `req.query.pwd` check khỏi GET handler
- `[ ]` Test: truy cập share link protected → form hiện → submit → view slide

---

### Task 1.2: DOMPurify cho HTML Embed trong Share/Present Views

**File:** `shared/src/htmlGenerator.js`  
**Effort:** 2 hours

**Vấn đề:** `el.content` cho type `html` được inject trực tiếp vào `srcdoc` iframe mà không sanitize. Khi share link public, đây là XSS vector.

**Approach:** Sanitize HTML content ở **server-side** khi render share view, KHÔNG sanitize ở editor (user cần full HTML control khi edit).

**Implementation:**

```javascript
// server/index.js - chỉ sanitize khi serve share view
const createDOMPurify = require('dompurify')
const { JSDOM } = require('jsdom')
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

async function renderShareView(presentationId, res) {
  const presentations = await readPresentations()
  const presentation = presentations.find((p) => p.id === presentationId)
  if (!presentation) return res.status(404).send('Not found')

  // Deep clone and sanitize HTML elements for share view
  const sanitized = JSON.parse(JSON.stringify(presentation))
  for (const slide of sanitized.slides || []) {
    for (const el of slide.elements || []) {
      if (el.type === 'html') {
        el.content = DOMPurify.sanitize(el.content, {
          FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
        })
      }
    }
  }
  // Also sanitize customCSS
  if (sanitized.customCSS) {
    sanitized.customCSS = sanitized.customCSS
      .replace(/expression\s*\(/gi, '/* blocked */(')
      .replace(/javascript\s*:/gi, '/* blocked */:')
      .replace(/url\s*\(\s*['"]?\s*javascript/gi, 'url(/* blocked */')
  }

  const html = generateRevealHTML(sanitized)
  res.setHeader('Content-Type', 'text/html')
  res.send(html)
}
```

**Checklist:**

- `[ ]` Install `dompurify` + `jsdom` vào `server/package.json`
- `[ ]` Import và init DOMPurify với JSDOM window
- `[ ]` Sanitize HTML elements trước khi gọi `generateRevealHTML` trong `renderShareView`
- `[ ]` Sanitize `customCSS` (strip `expression()`, `javascript:`)
- `[ ]` Test: tạo slide có `<script>alert(1)</script>` trong HTML element → share → verify script bị strip

---

### Task 1.3: Upload MIME Validation (Magic Bytes)

**File:** `server/routes/upload.js`  
**Effort:** 1 hour

**Current:** Chỉ check file extension.  
**Target:** Check cả magic bytes bằng `file-type` package.

```javascript
const { fileTypeFromFile } = require('file-type')

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf']

// Sau khi multer upload xong, validate MIME
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  // Verify actual file content matches claimed type
  try {
    const detected = await fileTypeFromFile(req.file.path)
    if (detected && !ALLOWED_MIME_PREFIXES.some((p) => detected.mime.startsWith(p))) {
      // Delete the uploaded file
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ error: `File type ${detected.mime} not allowed` })
    }
  } catch {
    // If file-type can't detect (e.g., SVG/text), fall back to extension check (already passed)
  }

  res.json({ url: `/uploads/${req.file.filename}` })
})
```

**Checklist:**

- `[ ]` Install `file-type` vào `server/package.json`
- `[ ]` Thêm MIME validation sau multer upload
- `[ ]` Xóa file nếu MIME không match
- `[ ]` Fallback cho SVG/text files (file-type không detect được)
- `[ ]` Test: upload renamed `.exe` → `.jpg` → verify bị reject

---

### Task 1.4: Rate Limiting

**File:** `server/index.js`  
**Effort:** 30 min

```javascript
const rateLimit = require('express-rate-limit')

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { error: 'Too many requests' },
})
app.use('/api/', apiLimiter)

// Strict rate limit for upload
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many uploads' },
})
app.use('/api/upload', uploadLimiter)

// Strict rate limit for share password attempts
const shareLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: 'Too many attempts. Try again later.',
})
app.use('/share/', shareLimiter)
```

**Checklist:**

- `[ ]` Install `express-rate-limit`
- `[ ]` Add general API limiter (300 req/15min)
- `[ ]` Add upload limiter (30 req/15min)
- `[ ]` Add share password limiter (10 req/5min)
- `[ ]` Test: spam share password → verify 429 response

---

### Task 1.5: Rclone Password Obscure

**File:** `server/routes/sync.js`  
**Effort:** 1 hour

**Current (line 48):** Password written plaintext.  
**Target:** Use `rclone obscure` để mã hóa password.

```javascript
router.post('/config', async (req, res) => {
  try {
    const { username, password, remoteName } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Required' })
    const name = remoteName || 'protondrive'

    // Obscure password using rclone itself
    let obscuredPassword
    try {
      obscuredPassword = await runRclone(['obscure', password])
    } catch {
      // Fallback: store as-is if rclone obscure fails
      obscuredPassword = password
    }

    const configContent = [
      `[${name}]`,
      `type = protondrive`,
      `username = ${username}`,
      `password = ${obscuredPassword}`,
      '',
    ].join('\n')

    await fs.writeFile(RCLONE_CONFIG_FILE, configContent)
    // ... rest unchanged
  }
})
```

**Checklist:**

- `[ ]` Thêm `rclone obscure` call trước khi lưu password
- `[ ]` Fallback nếu obscure fails (rclone chưa installed)
- `[ ]` Test: configure rclone → verify password trong config file là obscured

---

### Task 1.6: GitHub Token — API Response Masking

**File:** `server/routes/github.js`  
**Effort:** 15 min

GET `/api/github/config` đã mask token (trả `hasToken: !!config.token`). Nhưng cần verify không có endpoint nào khác leak token.

**Checklist:**

- `[ ]` Verify GET config chỉ trả `hasToken`, không trả token value
- `[ ]` Verify `.gitignore` có exclude `server/data/` directory
- `[ ]` Thêm comment ghi chú security consideration

---

## Verification Plan

### Automated Tests

```bash
# Run E2E tests
npx playwright test

# Specific security tests
npx playwright test tests/e2e/sharing.spec.js
npx playwright test tests/e2e/media.spec.js
```

### Manual Verification

1. **XSS test:** Tạo slide chứa `<script>alert('XSS')</script>` trong HTML element → Share → Mở share link → Verify không có alert
2. **Password test:** Mở share link protected → URL bar KHÔNG chứa `?pwd=` → Form POST hoạt động
3. **Upload test:** Rename `.exe` → `.jpg` → Upload → Verify bị reject
4. **Rate limit test:** Spam 11 requests tới `/share/:token` → Verify 429 response
5. **Rclone test:** Configure rclone → Verify password trong file là obscured string

---

## Todo

- `[ ]` Task 1.1: Fix share password form (GET → POST)
- `[ ]` Task 1.2: DOMPurify cho HTML embed
- `[ ]` Task 1.3: Upload MIME validation
- `[ ]` Task 1.4: Rate limiting
- `[ ]` Task 1.5: Rclone password obscure
- `[ ]` Task 1.6: GitHub token masking verification
- `[ ]` Run full E2E test suite
- `[ ]` Manual security verification
