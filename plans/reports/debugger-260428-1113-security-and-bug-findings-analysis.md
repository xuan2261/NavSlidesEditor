# NavSlides Editor — Security & Bug Findings: Comprehensive Analysis

## Executive Summary

| # | Severity | Issue | Root Cause | Fix Complexity |
|---|----------|-------|------------|----------------|
| 1 | Critical | Canvas crash (TDZ) | `slideRef` declared after usage | Trivial — 1 line |
| 2 | Critical | Admin API unauthenticated | No auth middleware on any route | High |
| 3 | High | Sanitizer bypass (unquoted attrs) | Regex only handles quoted attrs | Medium |
| 4 | High | HTML iframe no sandbox | `srcdoc` iframe missing `sandbox` attr | Trivial — 1 line |
| 5 | High | Rclone config injection | Raw string interpolation | Medium |
| 6 | Medium | Zod v4 breaking change | `err.errors` → `err.issues` | Trivial — 1 line |
| 7 | Medium | TemplatePreview XSS | `dangerouslySetInnerHTML` raw template | Trivial — 1 line |
| 8 | Medium | Dependency vulnerabilities | Unpinned/outdated transitive deps | Medium |

**Status:** 1 Trivial fix available immediately. 2 require architectural decision (threat model). 5 actionable with known fix path.

---

## Finding 1: Canvas Crash — `slideRef` TDZ (Critical)

### Root Cause Confirmed

```
Line 126:  const { ... } = useCanvasPointerInteraction({ ..., slideRef, ... })
Line 157:  const slideRef = useRef(slide)
```

JavaScript `const` không hoisted — accessing `slideRef` tại line 126 khi nó được khai báo tại line 157 là Temporal Dead Zone error. E2E test xác nhận: `Cannot access 'slideRef' before initialization`.

### Fix

Move `const slideRef = useRef(slide)` (và các `useEffect` update nó) lên **trước** dòng 114 (hook `useCanvasRubberBandSelection`) hoặc ít nhất trước dòng 126.

### Why This Wasn't Caught

- Unit tests không cover render flow khởi tạo SlideCanvas
- Lint rules không catch TDZ across hook calls
- E2E test cần thiết để phát hiện (đã reproduce được `5/5` test fail)

**Risk if not fixed:** Editor không load được, tất cả user bị crash on mount.

---

## Finding 2: Admin API Unauthenticated (Critical)

### Root Cause Confirmed

`server/index.js:102-116` — Tất cả route được mount mà không có auth middleware:

```js
app.use('/api/presentations', presentationsRouter)  // CRUD + export
app.use('/api/upload', uploadRouter)               // File upload
app.use('/api/github', githubRouter)               // GitHub token ops
app.use('/api/rclone', syncRouter)                // Cloud sync w/ credentials
app.use('/api/settings', settingsRouter)           // App settings
app.use('/api/media', mediaRouter)                // Media management
app.use('/api/ai', require('./routes/ai'))        // AI features
```

Và line 310: `server.listen(p, ...)` — server không bind localhost-only.

### Threat Model Ambiguity

**Đây là blocker nghiêm trọng nhất** vì nó phụ thuộc vào câu hỏi: app có intended là:
- **localhost-only** (localhost:3002 chỉ accessible bởi local user)?
- **public self-host** (exposed qua nginx/Caddy reverse proxy)?

Nếu localhost-only: threat giảm đáng kể vì attacker cần local access. Nhưng ngay cả trong localhost-only, một malicious webpage visited có thể `fetch('http://localhost:3002/api/presentations')` và leak data.

Nếu public: **RCE-level threat** — attacker có thể:
- Upload webshell qua `/api/upload`
- Exfiltrate GitHub tokens qua `/api/github`
- Exfiltrate rclone credentials qua `/api/rclone`
- Delete/modify all presentations
- Change app settings

### Recommendation

1. Xác định threat model (câu hỏi user cần trả lời)
2. Nếu public: implement token-based admin auth (bcryptjs đã có trong deps)
3. Nếu localhost-only: bind `server.listen(p, '127.0.0.1')` và thêm warning trong docs
4. Minimum: rate-limit public endpoints

---

## Finding 3: Sanitizer Bypass — Unquoted Attributes (High)

### Root Cause Confirmed

`content-safety.js:12` chỉ strip event handlers trong **quoted** attributes:

```js
// Chỉ match: onerror="alert(1)" hoặc onerror='alert(1)'
// KHÔNG match: onerror=alert(1) (không có quotes)
.replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, '')
```

`content-safety.js:16` chỉ sanitize URL attrs có quotes:

```js
// Chỉ match: href="..." hoặc src="..."
// KHÔNG match: href=... (không có quotes)
.replace(/\s(href|src|xlink:href)\s*=\s*(['"])(.*?)\2/gi, ...)
```

### Attack Vector

```html
<img src=x onerror=alert(1)>
```
Payload này bypass hoàn toàn `stripEventAttributes` vì không có quotes. Khi `element-renderers.js:73` render `renderText()` gọi `sanitizeRichTextHtml(el.content)` → output vẫn giữ nguyên payload.

### Why Regex Alone Can't Fix This

Unquoted attribute parsing requires understanding HTML grammar (attributes can contain spaces, `>`, etc.). Regex-based approach inherently fragile.

### Fix

`server/package.json:14` đã có `dompurify@^3.4.0`. Dùng DOMPurify thay regex hoàn toàn:

```js
const createDOMPurify = require('dompurify')
// use server-side JSDOM window
```

Lưu ý: `shared/src/content-safety.js` chạy cả client (bundled) lẫn server (Node.js). Cần check client-side DOMPurify import. Có thể dùng `isomorphic-dompurify` hoặc platform-specific import.

---

## Finding 4: HTML Iframe No Sandbox (High)

### Root Cause Confirmed

`element-renderers.js:125` render HTML iframe **không có sandbox**:

```js
// Editor canvas có sandbox (canvas-element-wrapper.jsx:103):
<iframe srcDoc={...} sandbox="allow-scripts" />

// Export/present iframe KHÔNG có sandbox:
return `<iframe${wrap} srcdoc="${escapeSrcdoc(wrappedContent)}" ...></iframe>`
```

### Attack Vector

Khi presentation được share/export, iframe trong reveal.js HTML output có thể:
- Access parent window (if same-origin)
- Call local API endpoints (`fetch('/api/presentations')`)
- Redirect parent
- Read local storage

### Fix

```js
// element-renderers.js:125
return `<iframe${wrap} srcdoc="${escapeSrcdoc(wrappedContent)}" sandbox="allow-scripts" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
```

Hoặc `sandbox="allow-scripts allow-same-origin"` nếu cần same-origin access (nhưng cân nhắc kỹ).

---

## Finding 5: Rclone Config Injection (High)

### Root Cause Confirmed

`sync.js:67` — raw string interpolation vào config file:

```js
const configContent = `[${name}]\ntype = protondrive\nusername = ${username}\npassword = ${obscuredPassword}\n`
```

Issues:
1. **No newline validation** — `username` chứa `\n` → inject thêm config section
2. **No character escaping** — `[` hoặc `=` trong name/username/password có thể break config format
3. **No schema whitelist** — bất kỳ `remoteName` nào cũng được accept
4. **Plaintext password fallback** (line 63-64): nếu `rclone obscure` fail, password được write plaintext

`sync.js:102` và `sync.js:134`: `remote` và `remotePath` từ request body được dùng trực tiếp không validate. Path traversal: `remotePath=../../../etc` có thể write ra ngoài intended sync directory.

### Fix

- Strip newlines từ tất cả user inputs
- Escape special chars theo rclone config format
- Validate `remoteName` against alphanumeric + dash + underscore
- Remove plaintext fallback (fail hard nếu `rclone obscure` fail)
- Validate `remotePath` không chứa `..` hoặc absolute paths không mong muốn

---

## Finding 6: Zod v4 Breaking Change (Medium)

### Root Cause Confirmed

`server/package.json:29`: `"zod": "^4.3.6"` — đang dùng Zod v4.

`validate.js:20`: `err.errors.map(...)` — Zod v4 dùng `err.issues` thay vì `err.errors`.

Khi user gửi invalid body: API trả `500 Cannot read properties of undefined (reading 'map')` thay vì `400` với validation errors.

### Fix

```js
// validate.js:20
details: (err.issues || err.errors).map(...)
```

Hoặc check instanceof:

```js
if (err instanceof ZodError) {
  const issues = err.issues || (err.errors || [])
  return res.status(400).json({ ... })
}
```

---

## Finding 7: TemplatePreview XSS (Medium)

### Root Cause Confirmed

`TemplatePreview.jsx:66`:

```jsx
dangerouslySetInnerHTML={{ __html: el.content || '' }}
```

Template text (từ user-created hoặc imported) được render trực tiếp không sanitize. Stored XSS có thể execute khi admin/viewer mở template gallery.

### Fix

Dùng `sanitizeRichTextHtml` đã có trong `shared/src/content-safety.js`:

```jsx
import { sanitizeRichTextHtml } from '../../../shared/src/content-safety'
dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(el.content || '') }}
```

---

## Finding 8: Dependency Vulnerabilities (Medium)

### Findings Confirmed

| Package | Severity | Note |
|---------|----------|------|
| `electron@33.4.11` | High | Dev dep — not in production bundle |
| `@xmldom/xmldom` | High | Transitive: jszip dep |
| `tar` | High | Transitive: multiple packages |
| `file-type@^16.5.4` | Moderate | Direct dep |
| `uuid@^9.0.0` | Moderate | Direct dep (server) |

`electron` là devDependency nên không ảnh hưởng server. Nhưng `@xmldom/xmldom` và `tar` trong production chain cần fix.

### Fix

- `npm audit fix --omit=dev` để apply auto-fixes
- Pin `file-type` và `uuid` đến patched version
- Consider replacing `uuid` với `crypto.randomUUID()` (Node.js built-in, v14.17+)
- For `@xmldom/xmldom`: upgrade `jszip` hoặc override version

---

## Prioritized Action Matrix

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| P0 | #1 Canvas TDZ | Move `slideRef` declaration above line 126 | 5 min |
| P0 | #6 Zod v4 | Change `err.errors` → `err.issues` | 5 min |
| P1 | #7 TemplatePreview XSS | Use `sanitizeRichTextHtml` | 5 min |
| P1 | #4 Iframe no sandbox | Add `sandbox="allow-scripts"` | 5 min |
| P1 | #8 Dependencies | `npm audit fix --omit=dev` + pin versions | 30 min |
| P2 | #3 Sanitizer | Replace regex with DOMPurify | 2-4h |
| P2 | #5 Rclone injection | Input validation + escape | 2-4h |
| P2 | #2 API auth | Architectural decision required | 4-8h+ |

### Immediate Wins (P0)

Finding #1 và #6 là 2 dòng code — không có risk khi fix. Nên fix **ngay bây giờ** trước khi làm bất cứ điều gì khác.

---

## Unresolved Questions

1. **Threat model**: App là localhost-only hay public self-host? Câu trả lời quyết định priority và scope của Finding #2.
2. **`shared/src/content-safety.js` usage**: Nơi nào đã import nó? Cần check tất cả consumers trước khi thay đổi sang DOMPurify (Finding #3).
3. **Rclone availability**: `rclone obscure` có được test trong CI không? Finding #5 fallback plaintext password có bao phủ được khi nào `rclone` không có?
4. **Zod v4 downgrade path**: Có nên downgrade Zod v4 → v3 để tránh breaking changes, hay fix `validate.js` là đủ?
