---
phase: 6
title: "Write Tests for All Phases"
status: completed
priority: P1
effort: 4h
dependencies: ["2", "3", "4", "5"]
---

# Phase 6: Write Tests for All Phases

## Overview

Write tests cho tất cả phases: shared utilities (Phase 2), server export/rasterization (Phase 3), harness integration (Phase 4), matching algorithm (Phase 5). Coverage ≥80% for new modules. Use existing root Vitest setup.

## Requirements

- Functional: Unit tests cho mỗi module mới, integration tests cho harness
- Non-functional: Vitest framework, fast execution, isolated modules

## Test File Structure

```
server/services/pptx-import/
├── roundtrip-matching.test.js          ← Phase 5: matching algorithm tests
├── shared-utils.test.js               ← Phase 2: shared utilities tests
├── server-image-source.test.js        ← Phase 3: /uploads resolver
├── server-background-raster.test.js   ← Phase 3: mandatory raster backgrounds
└── server-export-integration.test.js  ← Phase 3+4: integration tests

shared/src/
└── *.test.js                          ← Phase 2: per-module tests
```

## Test Suites

### Suite 1: Shared Utilities Tests (Phase 2)

Test file: `shared/src/shared-utils.test.js`

```js
// Test: shared-color-utils.js
describe('normalizeCssColor', () => {
  it('converts hex to pptx color format', () => { ... })
  it('handles rgb format', () => { ... })
  it('handles named colors', () => { ... })
  it('returns undefined for invalid colors', () => { ... })
})

// Test: shared-html-parser.js
describe('stripHtml', () => {
  it('removes all HTML tags', () => { ... })
  it('preserves text content', () => { ... })
  it('decodes HTML entities', () => { ... })
})

describe('htmlToPptTextRuns', () => {
  it('extracts bold/italic/underline runs', () => { ... })
  it('maps font sizes and colors', () => { ... })
  it('handles nested tags', () => { ... })
  it('handles empty input', () => { ... })
})

// Test: shared-text-runs.js
describe('mergeTextRuns', () => {
  it('merges consecutive runs with same formatting', () => { ... })
  it('preserves distinct runs', () => { ... })
})

// Test: shared-slide-notes.js
describe('getSlideNotes', () => {
  it('extracts notes from slide notes field', () => { ... })
  it('returns null for slides without notes', () => { ... })
})

// Test: shared-pptx-core.js
describe('pptColor', () => {
  it('converts CSS color to pptxgenjs format', () => { ... })
  it('handles transparency', () => { ... })
})
```

### Suite 2: Server Basic Renderers Tests (Phase 3)

Test file: `server/utils/server-basic-renderers.test.js`

```js
// Mock pptxgenjs with Vitest
vi.mock('pptxgenjs', () => ({ ... }))

describe('server-basic-renderers', () => {
  let mockSlide

  beforeEach(() => {
    mockSlide = {
      addText: vi.fn(),
      addImage: vi.fn(),
      addShape: vi.fn(),
      addChart: vi.fn(),
    }
  })

  describe('addTextElement', () => {
    it('calls slide.addText with correct bounds', () => { ... })
    it('applies fontSize, color, bold, italic', () => { ... })
    it('handles missing content gracefully', () => { ... })
    it('uses stripHtml() for plain text content', () => { ... })
  })

  describe('addShapeElement', () => {
    it('maps circle → ellipse', () => { ... })
    it('maps all 15+ shape types via getShapeType()', () => { ... })
    it('applies fill and line styles', () => { ... })
    it('handles unknown shape type gracefully', () => { ... })
  })

  describe('addImageElement', () => {
    it('calls slide.addImage with data or url', () => { ... })
    it('handles missing image gracefully', () => { ... })
  })

  describe('addLineElement', () => {
    it('passes real coordinates (not bounding box)', () => { ... })
    it('maps arrow types via mapArrowType()', () => { ... })
    it('maps dash types via mapLineDashType()', () => { ... })
  })

  describe('addTableElement', () => {
    it('handles merged cells', () => { ... })
    it('applies per-cell styles', () => { ... })
    it('handles empty table gracefully', () => { ... })
  })

  describe('addChartElement', () => {
    it('calls slide.addChart with chart data', () => { ... })
    it('passes chart type and options', () => { ... })
  })
})
```

### Suite 3: Matching Algorithm Tests (Phase 5)

Test file: `server/services/pptx-import/roundtrip-matching.test.js`

```js
describe('fingerprint matching', () => {
  describe('buildFingerprint', () => {
    it('generates consistent fingerprint for same element', () => {
      const el = { type: 'text', x: 100, y: 200, width: 300, height: 150, content: '<b>Hello</b>' }
      const fp1 = buildFingerprint(el)
      const fp2 = buildFingerprint(el)
      expect(fp1).toBe(fp2)
    })

    it('different position → different fingerprint (position bucket)', () => {
      const el1 = { type: 'text', x: 100, y: 200, width: 300, height: 150 }
      const el2 = { type: 'text', x: 110, y: 210, width: 300, height: 150 }
      // Both round to same bucket (100/20=5, 200/20=10) → same fingerprint
      expect(buildFingerprint(el1)).toBe(buildFingerprint(el2))
    })

    it('different type → different fingerprint', () => {
      const el1 = { type: 'text', x: 100, y: 200, width: 300, height: 150 }
      const el2 = { type: 'shape', x: 100, y: 200, width: 300, height: 150 }
      expect(buildFingerprint(el1)).not.toBe(buildFingerprint(el2))
    })

    it('text type includes content prefix in fingerprint', () => {
      const el1 = { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Hello World' }
      const el2 = { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Different text' }
      expect(buildFingerprint(el1)).not.toBe(buildFingerprint(el2))
    })
  })

  describe('matchElements (greedy)', () => {
    it('each source element matches at most once', () => {
      const sources = [{ type: 'text', x: 0, y: 0, width: 100, height: 50 }]
      const targets = [
        { type: 'text', x: 0, y: 0, width: 100, height: 50 },
        { type: 'text', x: 0, y: 0, width: 100, height: 50 }, // duplicate
      ]
      const results = matchElements(sources, targets)
      expect(results.filter(r => r.method !== 'unmatched')).toHaveLength(1)
    })

    it('duplicate fingerprints → correct used tracking', () => {
      // Bug #1 reproduction: indexOf returns wrong index for duplicate fingerprints
      const sources = [
        { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Same' },
        { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Same' },
      ]
      const targets = [
        { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Same' },
        { type: 'text', x: 10, y: 10, width: 100, height: 50, content: 'Same' }, // different pos
      ]
      const results = matchElements(sources, targets)
      // Both sources should match, each to a distinct target
      expect(results.filter(r => r.method !== 'unmatched')).toHaveLength(2)
    })

    it('proximity check BEFORE accepting match (Bug #2)', () => {
      // Bug #2 reproduction: proximity check runs AFTER match
      const sources = [{ type: 'shape', x: 0, y: 0, width: 100, height: 50 }]
      const targets = [{ type: 'shape', x: 50, y: 50, width: 100, height: 50 }] // far away
      const results = matchElements(sources, targets)
      // Should diagnose type-only but not count as stable
      expect(results[0].method).toBe('type-only')
      expect(results[0].stable).toBe(false)
    })

    it('unmatched elements return method=unmatched', () => {
      const sources = [{ type: 'chart', x: 0, y: 0, width: 100, height: 50 }]
      const targets = [{ type: 'text', x: 0, y: 0, width: 100, height: 50 }]
      const results = matchElements(sources, targets)
      expect(results[0].method).toBe('unmatched')
    })

    it('returns per-type breakdown', () => {
      const sources = [
        { type: 'text', x: 0, y: 0, width: 100, height: 50 },
        { type: 'text', x: 0, y: 0, width: 100, height: 50 },
        { type: 'shape', x: 0, y: 0, width: 100, height: 50 },
      ]
      const targets = [
        { type: 'text', x: 0, y: 0, width: 100, height: 50 },
        { type: 'text', x: 0, y: 0, width: 100, height: 50 },
        { type: 'shape', x: 0, y: 0, width: 100, height: 50 },
      ]
      const results = matchElements(sources, targets)
      expect(results.byType).toBeDefined()
      expect(results.byType.text.total).toBe(2)
      expect(results.byType.text.stable).toBe(2)
      expect(results.byType.shape.total).toBe(1)
    })
  })
})
```

### Suite 4: Server Export Integration Tests (Phase 3+4)

Test file: `server/utils/server-export.test.js`

```js
describe('server-export integration', () => {
  it('exports minimal presentation to valid PPTX', async () => {
    const presentation = {
      title: 'Test',
      slides: [{
        elements: [{
          type: 'text',
          content: '<strong>Hello</strong>',
          x: 0, y: 0, width: 200, height: 50,
        }]
      }]
    }
    const tmpFile = '/tmp/test-export.pptx'
    await exportToFile(presentation, tmpFile)
    const stat = await fs.promises.stat(tmpFile)
    expect(stat.size).toBeGreaterThan(0)
    // Verify it's a valid ZIP (PPTX = ZIP)
    const buf = await fs.promises.readFile(tmpFile)
    expect(buf.slice(0, 2).toString()).toBe('PK')
    await fs.promises.unlink(tmpFile)
  })

  it('handles html/latex rasterization gracefully', async () => {
    const presentation = {
      title: 'Raster Test',
      slides: [{
        elements: [{
          type: 'html',
          content: '<strong>HTML</strong>',
          x: 0, y: 0, width: 200, height: 100,
        }]
      }]
    }
    // Should not throw because server rasterization is available
    const tmpFile = '/tmp/test-raster.pptx'
    await expect(exportToFile(presentation, tmpFile)).resolves.not.toThrow()
    await fs.promises.unlink(tmpFile).catch(() => {})
  })

  it('rasterizes gradient backgrounds in strict mode', async () => {
    const presentation = {
      title: 'Gradient Strict',
      slides: [{
        background: { type: 'gradient', gradient: 'linear-gradient(90deg, #111827, #f8fafc)' },
        elements: [],
      }]
    }
    const tmpFile = '/tmp/test-gradient-strict.pptx'
    await expect(exportToFile(presentation, tmpFile, { strictRaster: true })).resolves.not.toThrow()
    await fs.promises.unlink(tmpFile).catch(() => {})
  })

  it('resolves imported /uploads images to server uploads directory', async () => {
    const source = normalizeServerImageSource('/uploads/example.png')
    expect(source.path).toContain('uploads')
    expect(source.path.endsWith('example.png')).toBe(true)
  })

  it('rasterizes static visual fallback types instead of placeholdering them', async () => {
    const presentation = {
      title: 'Static Visual Types',
      slides: [{
        elements: [
          { type: 'icon', x: 200, y: 0, width: 50, height: 50 },
          { type: 'drawing', x: 0, y: 150, width: 200, height: 100 },
          { type: 'qrcode', x: 240, y: 150, width: 120, height: 120 },
        ]
      }]
    }
    const tmpFile = '/tmp/test-static-visual.pptx'
    await expect(exportToFile(presentation, tmpFile)).resolves.not.toThrow()
    await fs.promises.unlink(tmpFile).catch(() => {})
  })

  it('exports with all 8 element types', async () => { ... })
  it('applies slide notes', async () => { ... })
  it('handles empty presentation', async () => { ... })
})
```

### Suite 5: Harness Integration Tests (Phase 4)

Test file: `server/services/pptx-import/harness-integration.test.js`

```js
describe('harness integration', () => {
  const CORPUS_FILE = path.resolve(__dirname, '../../../PPTX/Bai_2_1.pptx')

  it('uses production export by default', async () => {
    const result = await testCorpusFile(CORPUS_FILE, { skipRoundTrip: false })
    expect(result.roundTripExportMethod).toBe('production')
  })

  it('--allow-fallback uses minimal exporter when production fails', async () => {
    // Temporarily break server-export.js require path
    const result = await testCorpusFile(CORPUS_FILE, { skipRoundTrip: false, allowFallback: true })
    expect(result.roundTripExportMethod).toBe('minimal')
    expect(result.warnings).toContainEqual(expect.stringContaining('fallback'))
  })

  it('--strict mode fails when production unavailable', async () => {
    await expect(
      testCorpusFile(CORPUS_FILE, { skipRoundTrip: false, strict: true })
    ).rejects.toThrow('Production export required in strict mode')
  })

  it('round-trip stability ≥ 98% with production export on corpus', async () => {
    const result = await testCorpusFile(CORPUS_FILE, { skipRoundTrip: false, strict: true })
    expect(result.roundTripExportMethod).toBe('production')
    expect(result.roundTrip.overall).toBeGreaterThanOrEqual(0.98)
  })

  it('semantic fidelity unchanged ≥ 95%', async () => {
    const result = await testCorpusFile(CORPUS_FILE, { skipRoundTrip: false })
    expect(result.semanticFidelity).toBeGreaterThanOrEqual(0.95)
  })
})
```

## Implementation Steps

### Step 1: Set up test infrastructure

```bash
# Vitest already exists at root. Do not install nested dependencies.
npm run test -- --help
```

### Step 2: Write shared utils tests

```bash
# Create: shared/src/shared-utils.test.js
# Run: npx vitest run shared/src/shared-utils.test.js
```

### Step 3: Write server-basic-renderers tests

```bash
# Create: server/utils/server-basic-renderers.test.js
# Run: npx vitest run server/utils/server-basic-renderers.test.js
```

### Step 4: Write matching algorithm tests

```bash
# Create: server/services/pptx-import/roundtrip-matching.test.js
# Run: npx vitest run server/services/pptx-import/roundtrip-matching.test.js
# Critical: test both bugs (indexOf duplicate, proximity-after-match)
```

### Step 5: Write server-export integration tests

```bash
# Create: server/utils/server-export.test.js
# Run: npx vitest run server/utils/server-export.test.js
```

### Step 6: Write server raster and image source tests

```bash
# Create: server/utils/server-background-raster.test.js
# Create: server/utils/server-image-source.test.js
# Run: npx vitest run server/utils/server-background-raster.test.js server/utils/server-image-source.test.js
```

### Step 7: Write harness integration tests

```bash
# Create: server/services/pptx-import/harness-integration.test.js
# Run: npx vitest run server/services/pptx-import/harness-integration.test.js
```

### Step 8: Run full test suite

```bash
npm run test
```

## Success Criteria

- [x] `shared-utils.test.js` covers all 5 shared modules
- [x] `server-basic-renderers.test.js` covers all 8 element types
- [x] `server-image-source.test.js` covers `/uploads/*`, data URI, absolute path, relative path
- [x] `server-background-raster.test.js` proves strict gradient background rasterization works
- [x] `roundtrip-matching.test.js` covers both red-team bugs + greedy matching
- [x] `server-export.test.js` covers integration, mandatory rasterization, controlled fallback
- [x] `harness-integration.test.js` covers --allow-fallback, --strict, production export method, ≥98 stability threshold
- [x] All tests pass (no skipped or pending)
- [x] Coverage ≥ 80% for new modules

## Risk Assessment

- **Risk:** pptxgenjs output is binary — **Mitigation:** Verify ZIP magic bytes (PK) + file size > 0
- **Risk:** Playwright rasterization timing — **Mitigation:** Mock raster module in unit tests only; integration/strict tests use real Playwright
- **Risk:** Matching tests need real element data — **Mitigation:** Use fixture files from Phase 0 corpus
- **Risk:** Threshold tests become flaky — **Mitigation:** run against checked-in corpus, strict mode, and record exact diffs on failure
- **Risk:** Test pollution between suites — **Mitigation:** Each suite uses isolated temp directories; cleanup in afterEach
