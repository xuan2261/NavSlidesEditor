---
phase: 6
title: "Integration Tests & Fidelity Validation"
status: pending
priority: P1
effort: ~1 day
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Integration Tests & Fidelity Validation

## Overview

Viết unit tests cho từng gap fix + run existing fidelity tester để confirm improvements. Tạo test PPTX samples cho video/audio/math/shadow.

## Red Team Fixes Applied
- **[FIX #9]** `mapVideo`/`mapAudio` exported từ mapper.js — tests call được
- **[FIX #10]** Test mocks dùng `new Map()` không phải plain object
- **[FIX #14]** Tạo programmatic test PPTX files cho fidelity validation

## Context Links
- Mapper: `server/services/pptx-import/mapper.js`
- Existing tests: `server/services/pptx-import/mapper.test.js`
- E2E tests: `server/services/pptx-import/pptx-import-e2e-flow.test.js`
- Fidelity tester: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- Corpus: `server/data/test-corpus/`

## Requirements
- Functional: Tất cả 5 gap fixes có unit tests, fidelity scores improve
- Non-functional: Tests pass, no regressions, fidelity score measurable improvement

## Related Code Files
- Modify: `server/services/pptx-import/mapper.test.js` — bổ sung test cases
- Create: `server/services/pptx-import/pptx-import-e2e-flow.test.js` — integration tests
- Create: `server/data/test-corpus/` — programmatic test PPTX files

## Implementation Steps

### 1. Unit Tests in mapper.test.js

#### Video Import Tests

```js
// [FIX #10] Mock phải dùng new Map(), không phải plain object
const mockZipEntry = { async: () => Promise.resolve(Buffer.from('fake-video-data')) }
const mockMediaIndex = { files: new Map([['ppt/media/video1.mp4', mockZipEntry]]) }

describe('mapVideo', () => {
  // [FIX #9] mapVideo exported from mapper.js
  it('maps type=video ZIP ref to video element with src', async () => {
    const element = { type: 'video', left: 10, top: 20, width: 100, height: 80, ref: 'ppt/media/video1.mp4' }
    const context = { mediaIndex: mockMediaIndex, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { videoCount: 0 }, uploadsDir: '/tmp' }
    const results = await mapVideo(element, context)
    assert.equal(results.length, 1)
    assert.equal(results[0].type, 'video')
    assert.include(results[0].src, '/uploads/')
  })
  it('maps type=video external URL ref directly', async () => {
    const element = { type: 'video', left: 10, top: 20, width: 100, height: 80, ref: 'https://example.com/video.mp4' }
    const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { videoCount: 0 }, uploadsDir: '/tmp' }
    const results = await mapVideo(element, context)
    assert.equal(results[0].src, 'https://example.com/video.mp4')
  })
  it('returns placeholder when ref missing', async () => {
    const element = { type: 'video', left: 10, top: 20, width: 100, height: 80 }
    const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { placeholderCount: 0 }, uploadsDir: '/tmp' }
    const results = await mapVideo(element, context)
    assert.equal(results[0].importPlaceholderType, 'video-missing')
  })
})
```

#### Audio Import Tests

```js
describe('mapAudio', () => {
  // [FIX #9] mapAudio exported from mapper.js
  it('maps type=audio ZIP ref to audio element', async () => {
    const mockAudioEntry = { async: () => Promise.resolve(Buffer.from('fake-audio')) }
    const mockMediaIndex = { files: new Map([['ppt/media/audio1.mp3', mockAudioEntry]]) }
    const element = { type: 'audio', left: 10, top: 20, width: 100, height: 80, ref: 'ppt/media/audio1.mp3' }
    const context = { mediaIndex: mockMediaIndex, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { audioCount: 0 }, uploadsDir: '/tmp' }
    const results = await mapAudio(element, context)
    assert.equal(results[0].type, 'audio')
    assert.include(results[0].src, '/uploads/')
  })
})
```

#### Math LaTeX Tests

```js
describe('mapMath', () => {
  it('maps type=math with latex string to latex element', async () => {
    const element = { type: 'math', left: 10, top: 20, width: 100, height: 50, latex: '\\frac{a}{b}' }
    const context = { scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { mathCount: 0 } }
    const results = await mapMath(element, context)
    assert.equal(results[0].type, 'latex')
    assert.equal(results[0].content, '\\frac{a}{b}')
    assert.equal(results[0].latex, '\\frac{a}{b}')
    assert.equal(results[0]._fallbackSrc, null)
  })
  it('preserves picBase64 as _fallbackSrc', async () => {
    const element = { type: 'math', left: 10, top: 20, width: 100, height: 50, latex: '\\frac{a}{b}', picBase64: 'data:image/png;base64,xyz' }
    const context = { scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { mathCount: 0 } }
    const results = await mapMath(element, context)
    assert.equal(results[0]._fallbackSrc, 'data:image/png;base64,xyz')
  })
  it('falls back to image when no latex text', async () => {
    const element = { type: 'math', left: 10, top: 20, width: 100, height: 50, picBase64: 'data:image/png;base64,xyz' }
    const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { imageCount: 0 }, uploadsDir: '/tmp' }
    const results = await mapMath(element, context)
    assert.equal(results[0].type, 'image') // fallback to image
  })
})
```

#### Shadow Extraction Tests

```js
describe('extractShadow', () => {
  // [FIX #2 from Phase 3] extractShadow returns flat fields, not nested object
  it('maps pptxtojson shadow to flat NavSlides fields', () => {
    const el = { shadow: { h: 5, v: 3, blur: 4, color: '#333333' } }
    const shadow = extractShadow(el)
    // [FIX #4] Flat fields, not shadow.shadowX
    assert.equal(shadow.shadowX, 5)
    assert.equal(shadow.shadowY, 3)
    assert.equal(shadow.shadowBlur, 4)
    assert.equal(shadow.shadowColor, '#333333')
  })
  it('returns null when no shadow', () => {
    const el = {}
    const shadow = extractShadow(el)
    assert.equal(shadow, null)
  })
  it('handles partial shadow object with defaults', () => {
    const el = { shadow: { h: 5 } }
    const shadow = extractShadow(el)
    assert.equal(shadow.shadowX, 5)
    assert.equal(shadow.shadowY, 0) // default
    assert.equal(shadow.shadowBlur, 0) // default
  })
})
```

#### Image Filter Tests

```js
describe('mapImage — filters', () => {
  it('extracts brightness/contrast with /1000 divisor', async () => {
    // [FIX #3] pptxtojson fixed-point: 15000 = 150% → /1000 = 150 → CSS brightness(150%)
    const mockEntry = { async: () => Promise.resolve(Buffer.from('fake-image')) }
    const element = {
      type: 'image', left: 0, top: 0, width: 100, height: 100, base64: 'data:image/png;base64,fake',
      filters: { brightness: 15000, contrast: 12000 }
    }
    const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { imageCount: 0 }, uploadsDir: '/tmp' }
    const results = await mapImage(element, context)
    assert.equal(results[0].filterBrightness, 15)  // 15000/1000 = 15
    assert.equal(results[0].filterContrast, 12)     // 12000/1000 = 12
  })
  it('maps saturation=0 to grayscale=100', async () => {
    const element = { type: 'image', left: 0, top: 0, width: 100, height: 100, filters: { saturation: 0 } }
    const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { imageCount: 0 }, uploadsDir: '/tmp' }
    const results = await mapImage(element, context)
    assert.equal(results[0].filterGrayscale, 100)
  })
})
```

### 2. Create Test PPTX Corpus

**[FIX #14]** Tạo programmatic test files cho fidelity validation:

```js
// server/services/pptx-import/generate-test-corpus.js
// Dùng pptxgenjs để generate minimal PPTX files với:
const testCases = [
  { name: 'video-shape.pptx', elements: [{ type: 'video', ... }] },
  { name: 'audio-shape.pptx', elements: [{ type: 'audio', ... }] },
  { name: 'math-equation.pptx', elements: [{ type: 'math', latex: '\\frac{a}{b}' }] },
  { name: 'shadow-shape.pptx', elements: [{ type: 'shape', shadow: { h: 5, v: 3, blur: 4 } }] },
  { name: 'image-filters.pptx', elements: [{ type: 'image', filters: { brightness: 15000, contrast: 12000 } }] },
  { name: 'smartart-diagram.pptx', elements: [{ type: 'diagram', ... }] },
]
// Output: server/data/test-corpus/
```

### 3. Fidelity Score Validation

Run fidelity tester trên corpus mới + existing corpus:
- Video/audio: placeholder → actual elements
- Math: placeholder → `latex` element
- Shadow: elements get `shadowX/shadowY/shadowBlur/shadowColor` populated
- Filters: image elements get `filterBrightness/filterContrast` populated
- Diagram: connector nodes → `type: 'line'` elements

## Success Criteria
- [ ] All 5 gap fixes có unit test coverage với `Map`-based mocks
- [ ] `mapper.test.js` pass
- [ ] Programmatic test PPTX corpus tạo được
- [ ] E2E flow tests pass
- [ ] Fidelity tester run — capture improved scores
- [ ] No regressions in existing tests

## Risk Assessment
- **Risk:** Mock không match real behavior của `persistZipMediaRef` → **Mitigation:** Dùng real JSZip instance trong integration tests thay vì mock.
- **Risk:** Test corpus không cover edge cases → **Mitigation:** Thêm edge case samples sau khi có real user PPTX files để validate against.
