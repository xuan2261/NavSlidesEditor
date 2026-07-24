# Phase 5: Video URL + File Browser

**Priority:** P1
**Status:** pending
**Effort:** 8-10h
**Upstream Commits:** `31d8ffbe`, `916a63df`

---

## Context Links

- [Predict Report](predict-report-5-expert-personas-debate.md) — Persona 3: DO NOT port `window.prompt()`, use properties panel
- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.5

## Overview

**TDD: Write tests for video URL input and file browser API FIRST.**

Two features: (1) Video from URL — per Persona 3, use properties panel URL input NOT `window.prompt()`. (2) File browser — evaluate existing `MediaLibraryModal` vs upstream's approach.

## Key Decision (from Predict)

**DO NOT port `window.prompt()` video URL input.** Instead, add a URL input field in the video properties panel (`media-properties.jsx`). This is:
- Accessible (keyboard navigable, ARIA labels)
- Not blocking (doesn't freeze main thread)
- Consistent with existing UI patterns
- Can include URL validation

## TDD Approach

### RED Phase: Write failing tests
1. Create `shared/tests/video-url.test.js` — test video element with URL source
2. Create `server/tests/upload-api.test.js` — test uploads listing endpoint (if needed)
3. Run tests — FAIL

### GREEN Phase: Implement
4. Add URL input to `media-properties.jsx`
5. Add uploads listing API endpoint (if needed)
6. Run tests — PASS

## Test Files

### `shared/tests/video-url.test.js`
```js
describe('video from URL', () => {
  test('video element with URL renders correctly in present mode', () => {
    const presentation = {
      slides: [{ elements: [{
        type: 'video', src: 'https://example.com/video.mp4', id: 'v1',
        startTime: 0, endTime: 0, playbackRate: 1
      }]}]
    }
    const html = generateRevealHTML(presentation)
    expect(html).toMatch(/src="https:\/\/example.com\/video.mp4"/)
    expect(html).toMatch(/<video/)
  })

  test('video URL is validated (no javascript: protocol)', () => {
    // Security: reject javascript: URLs
    const url = 'javascript:alert(1)'
    expect(isValidVideoUrl(url)).toBe(false)
  })

  test('video URL accepts https', () => {
    expect(isValidVideoUrl('https://example.com/v.mp4')).toBe(true)
  })

  test('video URL accepts http', () => {
    expect(isValidVideoUrl('http://example.com/v.mp4')).toBe(true)
  })
})
```

## Implementation Steps

### Step 1: Write test files (RED)
Create test files. Run — FAIL.

### Step 2: Add URL validation utility
In `shared/src/` or `client/src/utils/`, add:
```js
function isValidVideoUrl(url) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
```

### Step 3: Add URL input to media-properties.jsx
In `client/src/components/properties/media-properties.jsx`, add after playback rate:
```jsx
{/* Video URL input */}
<div className="flex items-center gap-2">
  <label className="text-xs text-gray-500">Source URL</label>
  <Input
    type="url"
    value={element.src || ''}
    onChange={(e) => {
      const url = e.target.value
      if (!url || isValidVideoUrl(url)) {
        onUpdate({ src: url })
      }
    }}
    placeholder="https://..."
    className="h-7 text-xs"
    data-testid="prop-video-src-url"
  />
</div>
```

### Step 4: Evaluate file browser
1. Read existing `MediaLibraryModal.jsx`
2. Compare with upstream's file browser (thumbnail grid, type filter, URL copy)
3. Decision: if existing modal already covers the use case → document as "already covered"
4. If gap exists → add "Insert from URL" tab to existing modal

### Step 5: Add uploads listing API (if needed)
If upstream's `GET /api/presentations/:id/uploads` is needed:
```js
// In server/index.js or server/routes/upload.js
app.get('/api/presentations/:id/uploads', (req, res) => {
  const presDir = path.join(UPLOADS_DIR, req.params.id)
  if (!fs.existsSync(presDir)) return res.json([])
  const files = fs.readdirSync(presDir).map(f => ({
    name: f,
    url: `/uploads/${req.params.id}/${f}`,
    size: fs.statSync(path.join(presDir, f)).size
  }))
  res.json(files)
})
```

### Step 6: Run tests (GREEN)
```bash
npx vitest run shared/tests/video-url.test.js
npm run test
```

## Todo List

- [ ] Create `shared/tests/video-url.test.js` (RED)
- [ ] Add URL validation utility (`isValidVideoUrl`)
- [ ] Add URL input field to `media-properties.jsx`
- [ ] Add URL validation to video src update
- [ ] Evaluate existing `MediaLibraryModal` vs upstream file browser
- [ ] Add uploads listing API endpoint (if needed)
- [ ] Run tests — PASS (GREEN)
- [ ] Run `npm run test` — all pass
- [ ] Manual: add video by URL → verify playback
- [ ] Manual: video trim/speed works with URL source
- [ ] Manual: file browser shows uploaded files (if implemented)

## Success Criteria

- Video can be added by URL via properties panel input
- URL validation rejects `javascript:` and invalid URLs
- Existing video controls (trim, speed) work with URL source
- File browser accessible (or existing MediaLibraryModal documented as sufficient)
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| URL input allows XSS via javascript: protocol | HIGH | URL validation rejects non-http(s) protocols |
| Video URL CORS issues | Medium | Document that some URLs may be CORS-blocked |
| File browser conflicts with existing MediaLibraryModal | Low | Evaluate first, enhance existing if possible |
| window.prompt() accidentally ported | Medium | Explicitly DO NOT port — use Input component |

## Security Considerations

- URL validation MUST reject `javascript:`, `data:`, `vbscript:` protocols
- Only `http:` and `https:` protocols allowed
- URL input must be type="url" for browser-native validation
