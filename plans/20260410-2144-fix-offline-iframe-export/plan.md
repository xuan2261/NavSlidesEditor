# Fix Offline Export: Inline CDN trong iframe srcdoc

## Status: `superseded`

> **Superseded by:** [260410-2216-offline-lan-full-vendor](../260410-2216-offline-lan-full-vendor/plan.md)
> Scope mở rộng hơn — vendor server + LAN full independence + TikZJax self-host.
> srcdoc inline logic (phase duy nhất của plan này) đã được tích hợp vào Phase 05 của plan mới.

## Problem

Khi export offline HTML, các element sử dụng `<iframe srcdoc="...">` (HTML embed, chart, markdown, latex) chứa external CDN script/CSS bên trong `srcdoc`. Hàm `generateOfflineHTML()` chỉ xử lý CDN ở level trang chính (Reveal.js, KaTeX, highlight.js), **không inline CDN nào bên trong srcdoc attributes**.

Kết quả: mở offline → iframe không load được D3, Chart.js, marked.js, KaTeX → slide trống.

## Root Cause

| Element Type | CDN trong srcdoc | File | Line |
|---|---|---|---|
| `html` | User-defined (ví dụ D3.js) | `htmlGenerator.js` | 87-89 |
| `chart` | `chart.js@4` | `htmlGenerator.js` | 105-124 |
| `markdown` | `marked/marked.min.js` | `htmlGenerator.js` | 96-103 |
| `latex` | `katex@0.16.11` CSS+JS, tikzjax | `htmlGenerator.js` | 148-162 |

## Affected Files

- `client/src/utils/offlineExport.js` — main fix location (93 lines)
- `shared/src/htmlGenerator.js` — reference only, **no changes needed**

## Approach: Parse & Inline srcdoc CDN trong offlineExport.js

**Tại sao không sửa htmlGenerator?** Vì htmlGenerator phục vụ cả online mode (present, export HTML thường). Chỉ offline export mới cần inline.

### Strategy

Sau khi inline CDN ở level trang chính (step 1-5 hiện tại), thêm **step 6**: scan toàn bộ `srcdoc="..."` attributes, extract CDN URLs bên trong, fetch & inline chúng.

## Phases

### Phase 1: Inline CDN bên trong srcdoc (single file change)

#### File: `client/src/utils/offlineExport.js`

**Thêm step 6** sau step 5 (remove Google Fonts), trước `return result`:

```
Step 6: Find all srcdoc="..." attributes in the HTML
  → For each srcdoc:
    1. Decode HTML entities (&amp; → &, &quot; → ")
    2. Find all <script src="https://..."></script> tags
    3. Fetch each CDN URL, inline the JS (with safeInlineJS)
    4. Find all <link href="https://..."> CSS tags
    5. Fetch each CDN URL, inline as <style>
    6. Re-encode back to HTML entities
    7. Replace the original srcdoc value
```

#### Implementation Detail

```javascript
// ── 6. Inline CDNs inside iframe srcdoc attributes ─────────────────────
const srcdocRegex = /srcdoc="([^"]*)"/g
let match
const replacements = []

while ((match = srcdocRegex.exec(result)) !== null) {
  const raw = match[1]
  // Decode HTML entities to get actual HTML
  let inner = raw.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

  // Inline <script src="https://..."><\/script> inside srcdoc
  const scriptMatches = [...inner.matchAll(/<script\s+src=["'](https?:\/\/[^"']+)["'][^>]*><\\?\/script>/gi)]
  for (const sm of scriptMatches) {
    const url = sm[1]
    const js = await fetchText(url)
    const safe = safeInlineJS(js)
    // Use split/join to avoid regex special chars
    inner = inner.split(sm[0]).join(`<script>/* ${url} */\n${safe}\n<\\/script>`)
  }

  // Inline <link href="https://..." ...> CSS inside srcdoc
  const linkMatches = [...inner.matchAll(/<link[^>]*href=["'](https?:\/\/[^"']+\.css[^"']*)["'][^>]*\/?>/gi)]
  for (const lm of linkMatches) {
    const url = lm[1]
    const css = await fetchText(url)
    inner = inner.split(lm[0]).join(`<style>/* ${url} */\n${css}\n</style>`)
  }

  // Re-encode for srcdoc attribute 
  const encoded = inner.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  replacements.push({ from: match[0], to: `srcdoc="${encoded}"` })
}

// Apply replacements (reverse order to preserve indices)
for (const r of replacements.reverse()) {
  result = result.split(r.from).join(r.to)
}
```

#### Edge Cases cần xử lý

1. **`<\/script>` pattern**: srcdoc sử dụng `<\/script>` thay vì `</script>` để tránh parser conflict. Regex cần match cả 2 pattern.
2. **Fetch failure graceful**: nếu fetch CDN fail, giữ nguyên original `<script src="...">` (code hiện tại đã có fallback comment).
3. **Duplicate fetch**: D3, Chart.js... có thể xuất hiện nhiều lần → dùng cache Map để tránh fetch lại.
4. **HTML entity double-encoding**: decode đúng thứ tự, encode lại đúng thứ tự.
5. **srcdoc multi-line**: regex `[^"]*` chỉ match trên 1 line. Nếu srcdoc chứa newline literal → dùng `[\s\S]*?` hoặc đảm bảo srcdoc luôn trên 1 line (hiện tại htmlGenerator đều output 1 line).

#### CDN Cache

Thêm fetch cache để avoid duplicate requests (Chart.js, KaTeX có thể xuất hiện nhiều iframe):

```javascript
const fetchCache = new Map()
async function cachedFetchText(url) {
  if (fetchCache.has(url)) return fetchCache.get(url)
  const text = await fetchText(url)
  fetchCache.set(url, text)
  return text
}
```

## Verification Plan

### Test 1: Example project slide 2 (D3 visualization)
1. Mở app → chọn project "example"
2. Export offline HTML
3. Mở file offline → navigate đến slide 2
4. D3 network graph phải hiển thị và interactive (drag nodes)

### Test 2: Chart element
1. Tạo slide có chart element
2. Export offline → verify chart hiển thị

### Test 3: Markdown element
1. Tạo slide có markdown element
2. Export offline → verify markdown render

### Test 4: LaTeX element
1. Tạo slide có LaTeX element
2. Export offline → verify math render

### Test 5: Mixed slide
1. Slide có cả text + html embed + chart
2. Export offline → tất cả element đều hiển thị

### Test 6: Existing functionality preserved
1. Export HTML thường (không offline) → vẫn hoạt động bình thường
2. Present mode → vẫn hoạt động bình thường

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| File size tăng lớn | Low | Chart.js ~200KB, D3 ~300KB — chấp nhận được cho offline |
| Fetch timeout | Low | Existing fallback comment pattern |
| Double-encoding srcdoc | Medium | Unit test decode→process→encode roundtrip |
| User custom HTML có CDN lạ | None | Fetch tất cả `https://` URLs, không cần whitelist |

## Todo

- [ ] Add `cachedFetchText()` helper
- [ ] Add step 6: scan srcdoc attributes & inline CDNs
- [ ] Test with example project slide 2 (D3)
- [ ] Test with chart, markdown, latex elements
- [ ] Verify existing export (non-offline) không bị ảnh hưởng
