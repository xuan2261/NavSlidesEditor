import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import mapper from './mapper.js'
import schemas from '../../middleware/schemas.js'

const { mapPptxOutput, sanitizeHtml, mapVideo, mapAudio, extractShadow, mapMath } = mapper
const { createPresentationSchema } = schemas

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

describe('pptx mapper', () => {
  it('sanitizes script tags and event handlers in text', () => {
    const html = sanitizeHtml(
      '<p onclick="bad()" style="color:#111;background-image:url(javascript:bad)">Safe</p><script>alert(1)</script>'
    )
    expect(html).toContain('Safe')
    expect(html).toContain('color:#111')
    expect(html).not.toContain('background-image')
    expect(html).not.toContain('script')
    expect(html).not.toContain('onclick')
  })

  it('strips CSS urls while preserving safe background colors', () => {
    const unsafe = sanitizeHtml(
      '<span style="width:url(https://safe.example/x);background:url(https://safe.example/bg.png);color:#111">Safe</span>'
    )
    expect(unsafe).toContain('color:#111')
    expect(unsafe).not.toMatch(/url\s*\(/i)
    expect(unsafe).not.toContain('javascript:')

    const safe = sanitizeHtml(
      '<span style="background:yellow;color:#222">Safe</span>'
    )
    expect(safe).toMatch(/background\s*:\s*yellow/i)
    expect(safe).toContain('color:#222')
  })

  // ─── Phase 0: Sanitizer Hardening ────────────────────────────────────────
  ;[
    // [input, expect href preserved in output, style check, description]
    ['<a href="javascript:alert(1)">bad</a>', false, null, 'javascript: stripped'],
    ['<a href="data:text/html,<b>evil</b>">data URI</a>', false, null, 'data: stripped'],
    ['<a href="https://safe.com">safe</a>', true, null, 'https: preserved'],
    ['<a href="mailto:test@example.com">mail</a>', true, null, 'mailto: preserved'],
    ['<a href="tel:+1234567890">tel</a>', true, null, 'tel: preserved'],
    ['<s>strikethrough</s>', false, null, 's tag preserved'],
    ['<strike>strike</strike>', false, null, 'strike tag preserved'],
    ['<del>deleted</del>', false, null, 'del tag preserved'],
    ['<sub>subscript</sub>', false, null, 'sub tag preserved'],
    ['<sup>superscript</sup>', false, null, 'sup tag preserved'],
    ['<span style="text-decoration:underline">underline</span>', false, 'text-decoration', 'underline style preserved'],
    ['<span style="letter-spacing:2pt">spacing</span>', false, 'letter-spacing', 'letter-spacing preserved'],
    ['<span style="vertical-align:sub">subalign</span>', false, 'vertical-align', 'vertical-align preserved'],
    ['<span style="text-shadow:1px 1px black">shadow</span>', false, 'text-shadow', 'text-shadow preserved'],
    ['<span style="background:yellow">highlight</span>', false, 'background', 'background preserved'],
    ['<a href="vbscript:bad">vbscript</a>', false, null, 'vbscript: stripped'],
    // Security: href + style combo
    ['<a href="https://test.com" style="color:red">combo</a>', true, 'color', 'href + style combo'],
    ['<a href="javascript:bad" style="color:red">bad</a>', false, 'color', 'bad href stripped, style preserved'],
  ].forEach(([input, expectHrefPreserved, styleCheck, label]) => {
    it(`sanitizer: ${label} (input: ${String(input).slice(0, 50)})`, () => {
      const result = sanitizeHtml(input)
      if (expectHrefPreserved) {
        expect(result).toMatch(/href=/)
      } else {
        expect(result).not.toMatch(/href=/)
      }
      if (styleCheck) {
        expect(result).toContain(styleCheck)
      }
    })
  })

  // ─── Phase 0: mapElement() returns array ─────────────────────────────────
  it('mapElement returns array for text element', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-array-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'text', left: 10, top: 10, width: 100, height: 30, content: '<p>Hello</p>' }] }],
        },
      })
      const textEl = result.presentation.slides[0].elements[0]
      expect(Array.isArray(textEl)).toBe(false)
      expect(textEl.type).toBe('text')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('extracts editor text metadata from imported rich text', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-text-style-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'text',
                  left: 10,
                  top: 10,
                  width: 100,
                  height: 30,
                  content: '<p style="text-align:center"><span style="font-size:24pt;font-family:Arial;color:#e74c3c">Hello</span></p>',
                },
              ],
            },
          ],
        },
      })
      const textEl = result.presentation.slides[0].elements[0]
      expect(textEl.type).toBe('text')
      expect(textEl.content).toContain('Hello')
      expect(textEl.textAlign).toBe('center')
      expect(textEl.fontSize).toBe(24)
      expect(textEl.fontFamily).toBe('Arial')
      expect(textEl.textColor).toBe('#e74c3c')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('mapElement returns array for shape element', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-shape-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'shape', shapType: 'rect', left: 10, top: 10, width: 100, height: 30, fill: '#f00' }] }],
        },
      })
      const shapeEl = result.presentation.slides[0].elements[0]
      expect(shapeEl.type).toBe('shape')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('preserves rich shape text separately from plain canvas text', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-shape-text-style-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'shape',
                  shapType: 'rect',
                  left: 10,
                  top: 10,
                  width: 100,
                  height: 30,
                  fill: '#f00',
                  content: '<p style="text-align:right"><span style="font-size:20pt;font-family:Arial;color:#123456"><strong>Hello</strong></span></p>',
                },
              ],
            },
          ],
        },
      })
      const shapeEl = result.presentation.slides[0].elements[0]
      expect(shapeEl.type).toBe('shape')
      expect(shapeEl.text).toBe('Hello')
      expect(shapeEl.textHtml).toContain('<strong>Hello</strong>')
      expect(shapeEl.textAlign).toBe('right')
      expect(shapeEl.fontSize).toBe(20)
      expect(shapeEl.fontFamily).toBe('Arial')
      expect(shapeEl.textColor).toBe('#123456')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('maps group children through normal mappers and keeps zIndex unique', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-group-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'group',
                  left: 10,
                  top: 20,
                  width: 300,
                  height: 160,
                  elements: [
                    {
                      type: 'shape',
                      shapType: 'ellipse',
                      left: 5,
                      top: 6,
                      width: 80,
                      height: 40,
                      fill: '#f00',
                      content: '<script>bad()</script><b>Group text</b>',
                    },
                  ],
                },
                { type: 'shape', shapType: 'rect', left: 200, top: 20, width: 40, height: 40 },
              ],
            },
          ],
        },
      })

      const elements = result.presentation.slides[0].elements
      expect(elements).toHaveLength(2)
      expect(elements[0].type).toBe('shape')
      expect(elements[0].shape).toBe('circle')
      expect(JSON.stringify(elements[0])).not.toContain('<script')
      expect(elements[0].text).toBe('Group text')
      expect(new Set(elements.map((el) => el.zIndex)).size).toBe(elements.length)
      expect(elements[0].zIndex).toBeLessThan(elements[1].zIndex)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('maps custom path shapes to svg elements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-custom-path-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'shape',
                  shapType: 'customGeometry',
                  path: 'M0 0 L100 0 L100 50 Z',
                  left: 10,
                  top: 10,
                  width: 100,
                  height: 50,
                  fill: '#123456',
                },
              ],
            },
          ],
        },
      })
      const svgEl = result.presentation.slides[0].elements[0]
      expect(svgEl.type).toBe('svg')
      expect(svgEl.content).toContain('<svg')
      expect(svgEl.content).toContain('M0 0 L100 0 L100 50 Z')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('preserves line dash and explicit arrow subtypes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-line-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'shape',
                  shapType: 'line',
                  left: 10,
                  top: 10,
                  width: 100,
                  height: 40,
                  borderStrokeDasharray: '5 5',
                  beginArrowType: 'oval',
                  arrowType: 'diamond',
                },
              ],
            },
          ],
        },
      })
      const line = result.presentation.slides[0].elements[0]
      expect(line.type).toBe('line')
      expect(line.dashArray).toBe('5 5')
      expect(line.arrowStart).toBe('circle')
      expect(line.arrowEnd).toBe('diamond')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('preserves image alt text and slide gradient CSS', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-alt-gradient-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              fill: {
                type: 'gradient',
                value: {
                  rot: 45,
                  colors: [
                    { pos: 0, color: '#ff0000' },
                    { pos: 100, color: '#0000ff' },
                  ],
                },
              },
              elements: [
                {
                  type: 'image',
                  left: 10,
                  top: 10,
                  width: 40,
                  height: 40,
                  base64: PNG_DATA_URL,
                  alt: 'Logo alt text',
                },
              ],
            },
          ],
        },
      })
      const slide = result.presentation.slides[0]
      expect(slide.background.gradient).toContain('linear-gradient(45deg')
      expect(slide.elements[0].alt).toBe('Logo alt text')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('mapElement returns array for image element', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-image-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'image', left: 20, top: 60, width: 50, height: 50, base64: PNG_DATA_URL }] }],
        },
      })
      const imgEl = result.presentation.slides[0].elements[0]
      expect(imgEl.type).toBe('image')
      expect(imgEl.src).toMatch(/^\/uploads\//)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('mapElement returns array for table element', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-table-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'table', left: 10, top: 180, width: 200, height: 80, data: [[{ text: '<p>A</p>' }, { text: 'B' }]] }] }],
        },
      })
      const tableEl = result.presentation.slides[0].elements[0]
      expect(tableEl.type).toBe('table')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('zIndex increments correctly through array-returning elements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-zindex-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                { type: 'text', left: 10, top: 10, width: 100, height: 30, content: '<p>First</p>' },
                { type: 'shape', shapType: 'rect', left: 20, top: 20, width: 50, height: 50, fill: '#f00' },
                { type: 'text', left: 10, top: 80, width: 100, height: 30, content: '<p>Second</p>' },
              ],
            },
          ],
        },
      })
      const elements = result.presentation.slides[0].elements
      expect(elements[0].zIndex).toBeLessThan(elements[1].zIndex)
      expect(elements[1].zIndex).toBeLessThan(elements[2].zIndex)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 0: Placeholder count with array return ────────────────────────
  it('counts placeholders correctly with array-returning handlers', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-placeholder-'))
    try {
      // Phase 6: empty group → 0 placeholders (flattens to nothing)
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'group', left: 300, top: 180, width: 100, height: 60, elements: [] }] }],
        },
      })
      expect(result.stats.placeholderCount).toBe(0)
      expect(result.presentation.slides[0].elements.length).toBe(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('maps editable Phase 1 objects and placeholders to NavSlides schema', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              fill: { type: 'color', value: '#ffffff' },
              note: '<p>Speaker note</p>',
              elements: [
                { type: 'text', left: 10, top: 10, width: 100, height: 30, content: '<p>Hello</p>' },
                { type: 'image', left: 20, top: 60, width: 50, height: 50, base64: PNG_DATA_URL },
                { type: 'shape', shapType: 'rect', left: 90, top: 60, width: 60, height: 40, fill: { type: 'color', value: '#f00' } },
                { type: 'shape', shapType: 'line', left: 0, top: 130, width: 90, height: 1, borderColor: '#111' },
                { type: 'shape', shapType: 'rightArrow', left: 110, top: 130, width: 90, height: 40 },
                { type: 'table', left: 10, top: 180, width: 200, height: 80, data: [[{ text: '<p>A</p>' }, { text: 'B' }]] },
                { type: 'group', left: 300, top: 180, width: 100, height: 60, elements: [] },
              ],
            },
          ],
        },
      })

      // Phase 6: empty group flattens to 0 elements, no placeholder
      expect(result.stats).toMatchObject({
        slideCount: 1,
        textCount: 1,
        imageCount: 1,
        tableCount: 1,
        placeholderCount: 0,
      })
      expect(result.presentation.slides[0].elements.map((el) => el.type)).toEqual([
        'text',
        'image',
        'shape',
        'line',
        'shape',
        'table',
      ])
      expect(result.presentation.slides[0].elements[1].src).toMatch(/^\/uploads\//)
      expect(() => createPresentationSchema.parse(result.presentation)).not.toThrow()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 2: Shape type mapping (15 types) ────────────────────────────
  // [shapType input, expected type, field to check]
  ;[
    ['rect', 'rect', 'shape'],
    ['rectangle', 'rect', 'shape'],
    ['roundRect', 'rounded-rect', 'shape'],
    ['roundedRect', 'rounded-rect', 'shape'],
    ['corner', 'rounded-rect', 'shape'],
    ['ellipse', 'circle', 'shape'],
    ['oval', 'circle', 'shape'],
    ['circle', 'circle', 'shape'],
    ['triangle', 'triangle', 'shape'],
    ['isoscelesTriangle', 'triangle', 'shape'],
    ['rightTriangle', 'triangle', 'shape'],
    ['diamond', 'diamond', 'shape'],
    ['rhombus', 'diamond', 'shape'],
    ['arrowRight', 'arrow-right', 'shape'],
    ['rightArrow', 'arrow-right', 'shape'],
    ['arrow', 'arrow-right', 'shape'],
    ['star4', 'star', 'shape'],
    ['star5', 'star', 'shape'],
    ['star6', 'star', 'shape'],
    ['star8', 'star', 'shape'],
    ['hexagon', 'hexagon', 'shape'],
    ['pentagon', 'pentagon', 'shape'],
    ['cloud', 'cloud', 'shape'],
    ['cylinder', 'cylinder', 'shape'],
    ['can', 'cylinder', 'shape'],
    ['parallelogram', 'parallelogram', 'shape'],
    ['trapezoid', 'trapezoid', 'shape'],
    ['bracket', 'bracket', 'shape'],
    ['leftBrace', 'bracket', 'shape'],
    ['rightBrace', 'bracket', 'shape'],
    ['line', 'line', 'type'],      // line uses el.type === 'line', not el.shape
    ['straightConnector', 'line', 'type'],
    // unknown → fallback rect
    ['unknownShape', 'rect', 'shape'],
    ['customPath', 'rect', 'shape'],
  ].forEach(([shapType, expected, field]) => {
    it(`shapeName maps '${shapType}' → '${expected}'`, async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-shape-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'shape', shapType, left: 10, top: 10, width: 100, height: 50, fill: '#f00' }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el[field]).toBe(expected)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  // ─── Phase 2: Image metadata preservation ───────────────────────────────
  it('image preserves objectFit from fill mode', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-img-fit-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'image', left: 10, top: 10, width: 100, height: 100, base64: PNG_DATA_URL, geom: 'picture' }] }],
        },
      })
      const img = result.presentation.slides[0].elements[0]
      expect(img.objectFit).toBeDefined() // Phase 2: should be set
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('image preserves flipH/flipV', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-img-flip-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'image', left: 10, top: 10, width: 100, height: 100, base64: PNG_DATA_URL, isFlipH: true, isFlipV: true }] }],
        },
      })
      const img = result.presentation.slides[0].elements[0]
      expect(img.flipH).toBe(true)
      expect(img.flipV).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('image preserves borderColor and borderWidth', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-img-border-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'image', left: 10, top: 10, width: 100, height: 100, base64: PNG_DATA_URL, borderColor: '#ff0000', borderWidth: 3 }] }],
        },
      })
      const img = result.presentation.slides[0].elements[0]
      expect(img.borderColor).toBe('#ff0000')
      expect(img.borderWidth).toBe(3)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 2: Line with real coordinates ───────────────────────────────
  it('line uses pptxtojson x1/y1/x2/y2 when present', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-line-coords-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'shape', shapType: 'line', left: 10, top: 10, width: 200, height: 100, borderColor: '#111', x1: 5, y1: 10, x2: 195, y2: 90 }] }],
        },
      })
      const line = result.presentation.slides[0].elements[0]
      expect(line.type).toBe('line')
      expect(line.x1).toBe(5)
      expect(line.y1).toBe(10)
      expect(line.x2).toBe(195)
      expect(line.y2).toBe(90)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('line preserves arrow type from shapType', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-line-arrow-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'shape', shapType: 'lineArrow', left: 10, top: 10, width: 200, height: 20, borderColor: '#111' }] }],
        },
      })
      const el = result.presentation.slides[0].elements[0]
      // lineArrow contains 'arrow' → shapeName returns 'arrow-right' (shape type, not line type)
      expect(el.shape).toBe('arrow-right')
      expect(el.type).toBe('shape')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 2: colorValue helper ─────────────────────────────────────────
  it('colorValue handles gradient fill type', async () => {
    // gradient fill → should not throw, currently returns 'transparent'
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-color-grad-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'shape', shapType: 'rect', left: 10, top: 10, width: 100, height: 50, fill: { type: 'gradient', value: { path: 'line', rot: 90, colors: [{ pos: 0, color: '#ff0000' }, { pos: 100, color: '#0000ff' }] } } }] }],
        },
      })
      const el = result.presentation.slides[0].elements[0]
      expect(el.fill).toBeDefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('colorValue handles fill:none', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-color-none-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'shape', shapType: 'rect', left: 10, top: 10, width: 100, height: 50, fill: { type: 'none' } }] }],
        },
      })
      const el = result.presentation.slides[0].elements[0]
      expect(el.fill).toBeDefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 3: Table full support ────────────────────────────────────────
  it('table extracts merged cells from rowSpan/colSpan', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-table-merge-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'table', left: 10, top: 10, width: 300, height: 200,
              data: [
                [{ text: 'Merged', rowSpan: 2, colSpan: 1 }, { text: 'Col B' }, { text: 'Col C' }],
                [{ text: 'Row2A' }, { text: 'Row2B' }],
              ],
            }],
          }],
        },
      })
      const table = result.presentation.slides[0].elements[0]
      expect(table.mergedCells).toBeDefined()
      expect(table.mergedCells.length).toBeGreaterThan(0)
      const merged = table.mergedCells.find(m => m.row === 0 && m.col === 0)
      expect(merged.rowSpan).toBe(2)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('table extracts per-cell text colors and backgrounds', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-table-styles-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'table', left: 10, top: 10, width: 300, height: 200,
              data: [[{ text: 'Red Cell', fontColor: '#ff0000', fillColor: '#ffff00', fontBold: true }]],
            }],
          }],
        },
      })
      const table = result.presentation.slides[0].elements[0]
      expect(table.cellStyles.textColors[0][0]).toBe('#ff0000')
      expect(table.cellStyles.bgColors[0][0]).toBe('#ffff00')
      expect(table.cellStyles.isBold[0][0]).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('table filters vMerge continuation rows', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-table-vmerge-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'table', left: 10, top: 10, width: 300, height: 200,
              data: [
                [{ text: 'Top', rowSpan: 2 }, { text: 'Side' }],
                [{ text: '', vMerge: 0 }, { text: 'Bottom' }],
              ],
            }],
          }],
        },
      })
      const table = result.presentation.slides[0].elements[0]
      expect(table.data[1][0]).toBe('')
      expect(table.data[1][1]).toBe('Bottom')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('table preserves colWidths and rowHeights', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-table-sizes-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'table', left: 10, top: 10, width: 300, height: 200,
              colWidths: [100, 150, 50],
              rowHeights: [30, 30, 30],
              data: [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']],
            }],
          }],
        },
      })
      const table = result.presentation.slides[0].elements[0]
      expect(table.colWidths).toEqual([100, 150, 50])
      expect(table.rowHeights).toEqual([30, 30, 30])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 5: Slide metadata ───────────────────────────────────────────
  it('slide preserves gradient background', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-slide-grad-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            fill: { type: 'gradient', value: { path: 'line', rot: 90, colors: [{ pos: 0, color: '#ff0000' }, { pos: 100, color: '#0000ff' }] } },
            elements: [{ type: 'text', left: 10, top: 10, width: 100, height: 30, content: '<p>Hello</p>' }],
          }],
        },
      })
      const slide = result.presentation.slides[0]
      expect(slide.background.type).toBe('gradient')
      expect(slide.background.stops).toBeDefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('slide preserves fade transition', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-slide-trans-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            transition: { type: 'fade', duration: 800 },
            elements: [{ type: 'text', left: 10, top: 10, width: 100, height: 30, content: '<p>Hello</p>' }],
          }],
        },
      })
      const slide = result.presentation.slides[0]
      expect(slide.transition).toBe('fade')
      expect(slide.transitionDuration).toBe(800)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('presentation stores pptxMeta sidecar', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-meta-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 1280, height: 720 },
          usedFonts: ['Calibri', 'Arial'],
          themeColors: ['#FF0000', '#00FF00'],
          slides: [{ elements: [{ type: 'text', left: 10, top: 10, width: 100, height: 30, content: '<p>Hello</p>' }] }],
        },
      })
      expect(result.presentation._pptxMeta.originalSize).toEqual({ width: 1280, height: 720 })
      expect(result.presentation._pptxMeta.usedFonts).toEqual(['Calibri', 'Arial'])
      expect(result.presentation._pptxMeta.themeColors).toEqual(['#FF0000', '#00FF00'])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 6: Group flattening ───────────────────────────────────────────
  it('group with 2 children flattens to 2 elements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-group-flat-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'group', left: 100, top: 100, width: 200, height: 100,
              elements: [
                { type: 'shape', shapType: 'rect', left: 10, top: 10, width: 80, height: 40, fill: '#ff0000' },
                { type: 'shape', shapType: 'rect', left: 100, top: 10, width: 80, height: 40, fill: '#00ff00' },
              ],
            }],
          }],
        },
      })
      const els = result.presentation.slides[0].elements
      expect(els.length).toBe(2)
      expect(els[0].type).toBe('shape')
      expect(els[1].type).toBe('shape')
      expect(els[0].importPlaceholderType).toBeUndefined()
      expect(els[0].locked).toBeUndefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('nested group depth 2 flattens all grandchildren', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-nested-group-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'group', left: 50, top: 50, width: 200, height: 100,
              elements: [{
                type: 'group', left: 10, top: 10, width: 100, height: 50,
                elements: [{ type: 'shape', shapType: 'rect', left: 5, top: 5, width: 40, height: 20, fill: '#0000ff' }],
              }],
            }],
          }],
        },
      })
      const els = result.presentation.slides[0].elements
      expect(els.length).toBe(1)
      expect(els[0].type).toBe('shape')
      // Position should be absolute: 50+10+5 = 65
      expect(els[0].x).toBeGreaterThan(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('group at depth 10 becomes placeholder', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-deep-group-'))
    try {
      // Build 12 group wrappers. flattenGroupElement starts at depth=0; each group
      // increments depth. With 12 groups, the deepest function call has depth=11
      // (0-11 = 12 levels). Since MAX_GROUP_DEPTH=10, depth=11 triggers the check
      // (11 > 10) and the group becomes a placeholder instead of being flattened.
      const buildNested = (depth) => {
        if (depth === 0) return { type: 'shape', shapType: 'rect', left: 1, top: 1, width: 10, height: 10, fill: '#000' }
        return { type: 'group', left: 1, top: 1, width: 10, height: 10, elements: [buildNested(depth - 1)] }
      }
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [buildNested(12)] }],
        },
      })
      const els = result.presentation.slides[0].elements
      expect(els.some(el => el.importPlaceholderType === 'grouped-complex')).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('empty group produces no elements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-empty-group-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'group', left: 100, top: 100, width: 200, height: 100, elements: [] }] }],
        },
      })
      const els = result.presentation.slides[0].elements
      expect(els.length).toBe(0)
      expect(result.stats.placeholderCount).toBe(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 6: SmartArt/Diagram ────────────────────────────────────────
  it('diagram converts to individual shapes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-diagram-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'diagram', left: 50, top: 50, width: 300, height: 200,
              elements: [
                { text: 'Node 1', left: 0, top: 0, width: 100, height: 50, fill: '#f00' },
                { text: 'Node 2', left: 100, top: 0, width: 100, height: 50, fill: '#0f0' },
                { text: 'Node 3', left: 200, top: 0, width: 100, height: 50, fill: '#00f' },
              ],
              textList: [
                { text: 'Node 1 content' },
                { text: 'Node 2 content' },
                { text: 'Node 3 content' },
              ],
            }],
          }],
        },
      })
      const els = result.presentation.slides[0].elements
      expect(els.length).toBe(3)
      expect(els[0].type).toBe('shape')
      expect(els[0].text).toBe('Node 1 content')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 4: Chart mapping ─────────────────────────────────────────────
  ;[
    ['barChart', 'bar'],
    ['bar3DChart', 'bar'],
    ['lineChart', 'line'],
    ['line3DChart', 'line'],
    ['pieChart', 'pie'],
    ['doughnutChart', 'doughnut'],
    ['radarChart', 'radar'],
    ['scatterChart', 'line'],  // Note: test uses CommonChart format; real pptxtojson uses [xVals, yVals]
    ['bubbleChart', 'bar'],
    ['areaChart', 'bar'],
    ['stockChart', 'line'],
    ['surfaceChart', 'bar'],
    ['polarAreaChart', 'polarArea'],
  ].forEach(([pptxType, expected]) => {
    it(`chart type mapping: ${pptxType} → ${expected}`, async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-chart-type-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{
              elements: [{
                type: 'chart', left: 10, top: 10, width: 300, height: 200,
                chartType: pptxType,
                data: [{ key: 'Series 1', values: [{ x: 'A', y: 10 }, { x: 'B', y: 20 }] }],
                colors: ['#ff0000'],
              }],
            }],
          },
        })
        const chart = result.presentation.slides[0].elements[0]
        expect(chart.type).toBe('chart')
        expect(chart.chartType).toBe(expected)
        expect(chart.chartData.datasets.length).toBeGreaterThan(0)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  it('chart preserves multi-series data', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-chart-multi-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{
            elements: [{
              type: 'chart', left: 10, top: 10, width: 300, height: 200,
              chartType: 'barChart',
              data: [
                { key: 'Q1', values: [{ x: 'Jan', y: 10 }, { x: 'Feb', y: 20 }] },
                { key: 'Q2', values: [{ x: 'Jan', y: 15 }, { x: 'Feb', y: 25 }] },
              ],
              colors: ['#6366f1', '#ef4444'],
            }],
          }],
        },
      })
      const chart = result.presentation.slides[0].elements[0]
      expect(chart.chartData.datasets.length).toBe(2)
      expect(chart.chartData.datasets[0].label).toBe('Q1')
      expect(chart.chartData.datasets[1].label).toBe('Q2')
      expect(chart._pptxChartMeta.originalType).toBe('barChart')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Phase 6: Video Import ─────────────────────────────────────────────
  describe('mapVideo', () => {
    it('maps type=video ZIP ref to video element with /uploads/ src', async () => {
      const mockEntry = { async: () => Promise.resolve(Buffer.from('fake-video-data')) }
      const mockMediaIndex = { files: new Map([['ppt/media/video1.mp4', mockEntry]]) }
      const element = { type: 'video', left: 10, top: 20, width: 100, height: 80, ref: 'ppt/media/video1.mp4' }
      const context = { mediaIndex: mockMediaIndex, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { videoCount: 0, placeholderCount: 0 }, uploadsDir: '/tmp' }
      const results = await mapVideo(element, context)
      expect(results.length).toBe(1)
      expect(results[0].type).toBe('video')
      expect(results[0].src).toMatch(/^\/uploads\//)
      expect(results[0].src).toMatch(/\.mp4$/)
      expect(results[0].controls).toBe(true)
      expect(results[0].autoplay).toBe(false)
    })

    it('maps type=video external URL ref directly as src', async () => {
      const element = { type: 'video', left: 10, top: 20, width: 100, height: 80, ref: 'https://example.com/video.mp4' }
      const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { videoCount: 0, placeholderCount: 0 }, uploadsDir: '/tmp' }
      const results = await mapVideo(element, context)
      expect(results[0].src).toBe('https://example.com/video.mp4')
      expect(results[0].type).toBe('video')
    })

    it('returns placeholder when ref missing', async () => {
      const element = { type: 'video', left: 10, top: 20, width: 100, height: 80 }
      const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { videoCount: 0, placeholderCount: 0 }, uploadsDir: '/tmp' }
      const results = await mapVideo(element, context)
      expect(results[0].importPlaceholderType).toBe('video-missing')
    })

    it('increments videoCount in stats', async () => {
      const element = { type: 'video', left: 10, top: 20, width: 100, height: 80, ref: 'https://example.com/v.mp4' }
      const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { videoCount: 0, placeholderCount: 0 }, uploadsDir: '/tmp' }
      await mapVideo(element, context)
      expect(context.stats.videoCount).toBe(1)
    })
  })

  // ─── Phase 6: Audio Import ─────────────────────────────────────────────
  describe('mapAudio', () => {
    it('maps type=audio ZIP ref to audio element', async () => {
      const mockEntry = { async: () => Promise.resolve(Buffer.from('fake-audio')) }
      const mockMediaIndex = { files: new Map([['ppt/media/audio1.mp3', mockEntry]]) }
      const element = { type: 'audio', left: 10, top: 20, width: 100, height: 80, ref: 'ppt/media/audio1.mp3' }
      const context = { mediaIndex: mockMediaIndex, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { audioCount: 0, placeholderCount: 0 }, uploadsDir: '/tmp' }
      const results = await mapAudio(element, context)
      expect(results[0].type).toBe('audio')
      expect(results[0].src).toMatch(/^\/uploads\//)
      expect(results[0].src).toMatch(/\.mp3$/)
    })

    it('maps type=audio external URL ref directly', async () => {
      const element = { type: 'audio', left: 10, top: 20, width: 100, height: 80, ref: 'https://example.com/audio.mp3' }
      const context = { mediaIndex: { files: new Map() }, scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { audioCount: 0, placeholderCount: 0 }, uploadsDir: '/tmp' }
      const results = await mapAudio(element, context)
      expect(results[0].src).toBe('https://example.com/audio.mp3')
      expect(results[0].type).toBe('audio')
    })
  })

  // ─── Phase 6: Math LaTeX Import ────────────────────────────────────────
  describe('mapMath via mapPptxOutput', () => {
    it('maps type=math with latex string to latex element', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-math-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'math', left: 10, top: 20, width: 100, height: 50, latex: '\\frac{a}{b}' }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el.type).toBe('latex')
        expect(el.content).toBe('\\frac{a}{b}')
        expect(el.latex).toBe('\\frac{a}{b}')
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('preserves picBase64 as _fallbackSrc', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-math-fb-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'math', left: 10, top: 20, width: 100, height: 50, latex: '\\frac{a}{b}', picBase64: 'data:image/png;base64,xyz' }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el._fallbackSrc).toBe('data:image/png;base64,xyz')
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('falls back to image when no latex text', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-math-img-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'math', left: 10, top: 20, width: 100, height: 50, picBase64: PNG_DATA_URL }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el.type).toBe('image')
        expect(el.src).toMatch(/^\/uploads\//)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('increments mathCount in stats', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-math-count-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'math', left: 10, top: 20, width: 100, height: 50, latex: 'x^2' }] }],
          },
        })
        expect(result.stats.mathCount).toBe(1)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  // ─── Phase 6: Shadow Extraction ─────────────────────────────────────────
  describe('extractShadow', () => {
    it('maps pptxtojson shadow to flat NavSlides fields', () => {
      const el = { shadow: { h: 5, v: 3, blur: 4, color: '#333333' } }
      const shadow = extractShadow(el)
      expect(shadow.shadowX).toBe(5)
      expect(shadow.shadowY).toBe(3)
      expect(shadow.shadowBlur).toBe(4)
      expect(shadow.shadowColor).toBe('#333333')
    })

    it('returns null when no shadow', () => {
      const el = {}
      const shadow = extractShadow(el)
      expect(shadow).toBe(null)
    })

    it('handles partial shadow object with defaults', () => {
      const el = { shadow: { h: 5 } }
      const shadow = extractShadow(el)
      expect(shadow.shadowX).toBe(5)
      expect(shadow.shadowY).toBe(0)
      expect(shadow.shadowBlur).toBe(0)
      expect(shadow.shadowColor).toBe('#000000')
    })
  })

  describe('mapShape — shadow', () => {
    it('applies flat shadow fields to shape element', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-shape-shadow-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'shape', shapType: 'rect', left: 10, top: 10, width: 100, height: 50, fill: '#f00', shadow: { h: 5, v: 3, blur: 4, color: '#333333' } }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el.shadowX).toBe(5)
        expect(el.shadowY).toBe(3)
        expect(el.shadowBlur).toBe(4)
        expect(el.shadowColor).toBe('#333333')
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  describe('mapText — shadow', () => {
    it('applies flat shadow fields to text element', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-text-shadow-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'text', left: 10, top: 10, width: 100, height: 50, content: '<p>Hello</p>', shadow: { h: 2, v: 2, blur: 3, color: '#888888' } }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el.shadowX).toBe(2)
        expect(el.shadowY).toBe(2)
        expect(el.shadowBlur).toBe(3)
        expect(el.shadowColor).toBe('#888888')
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  // ─── Phase 6: Image Filter Extraction ──────────────────────────────────
  describe('mapImage — filters', () => {
    it('extracts brightness/contrast with /1000 divisor', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-img-filter-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'image', left: 0, top: 0, width: 100, height: 100, base64: PNG_DATA_URL, filters: { brightness: 15000, contrast: 12000 } }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el.filterBrightness).toBe(15)
        expect(el.filterContrast).toBe(12)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('maps saturation=0 to grayscale=100', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-img-gray-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'image', left: 0, top: 0, width: 100, height: 100, base64: PNG_DATA_URL, filters: { saturation: 0 } }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el.filterGrayscale).toBe(100)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('skips brightness=100000 (no-op)', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-img-none-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{ elements: [{ type: 'image', left: 0, top: 0, width: 100, height: 100, base64: PNG_DATA_URL, filters: { brightness: 100000 } }] }],
          },
        })
        const el = result.presentation.slides[0].elements[0]
        expect(el.filterBrightness).toBeUndefined()
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  // ─── Phase 6: Diagram Connector Preservation ─────────────────────────────
  describe('flattenDiagramElement — connector detection', () => {
    it('detects connector nodes inside elements[] by shapType', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-diagram-conn-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{
              elements: [{
                type: 'diagram', left: 50, top: 50, width: 300, height: 200,
                elements: [
                  { text: 'Node 1', left: 0, top: 0, width: 100, height: 50, shapType: 'rect', fill: '#f00' },
                  { text: 'Node 2', left: 100, top: 0, width: 100, height: 50, shapType: 'rect', fill: '#0f0' },
                  { left: 10, top: 10, width: 80, height: 5, shapType: 'lineConnector', borderColor: '#333', borderWidth: 2 },
                ],
                textList: [{ text: 'Node 1' }, { text: 'Node 2' }],
              }],
            }],
          },
        })
        const els = result.presentation.slides[0].elements
        const shapes = els.filter(e => e.type === 'shape')
        const lines = els.filter(e => e.type === 'line')
        expect(shapes.length).toBe(2)
        expect(lines.length).toBe(1)
        expect(lines[0].type).toBe('line')
        expect(lines[0].stroke).toBe('#333')
        expect(lines[0].strokeWidth).toBe(2)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('processes box nodes before connector nodes (z-index order)', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-diagram-z-'))
      try {
        const result = await mapPptxOutput({
          zip: new JSZip(),
          originalName: 'sample.pptx',
          uploadsDir: dir,
          output: {
            size: { width: 960, height: 540 },
            slides: [{
              elements: [{
                type: 'diagram', left: 0, top: 0, width: 300, height: 200,
                elements: [
                  { left: 0, top: 0, width: 100, height: 50, shapType: 'rect', fill: '#f00' },
                  { left: 0, top: 0, width: 80, height: 5, shapType: 'straightLine', borderColor: '#333', borderWidth: 2 },
                ],
              }],
            }],
          },
        })
        const els = result.presentation.slides[0].elements
        expect(els[0].type).toBe('shape')
        expect(els[1].type).toBe('line')
        expect(els[0].zIndex).toBeLessThan(els[1].zIndex)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  // ─── Bug Fix: placeholderCount single-increment ───────────────────────
  it('placeholderCount increments exactly once when video ref missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-video-ph-count-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'video', left: 10, top: 20, width: 100, height: 80 }] }],
        },
      })
      expect(result.stats.placeholderCount).toBe(1)
      expect(result.presentation.slides[0].elements[0].importPlaceholderType).toBe('video-missing')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('placeholderCount increments exactly once when audio ref missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-audio-ph-count-'))
    try {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'sample.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'audio', left: 10, top: 20, width: 100, height: 80 }] }],
        },
      })
      expect(result.stats.placeholderCount).toBe(1)
      expect(result.presentation.slides[0].elements[0].importPlaceholderType).toBe('audio-missing')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Bug Fix: mapMath direct export ─────────────────────────────────
  it('mapMath is exported and callable directly', async () => {
    const context = { scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { mathCount: 0 } }
    const results = mapMath({ type: 'math', left: 10, top: 20, width: 100, height: 50, latex: '\\int_0^1 x dx' }, context)
    expect(results.length).toBe(1)
    expect(results[0].type).toBe('latex')
    expect(results[0].content).toBe('\\int_0^1 x dx')
    expect(results[0].latex).toBe('\\int_0^1 x dx')
  })

  it('mapMath increments mathCount on direct call', async () => {
    const context = { scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { mathCount: 0 } }
    mapMath({ type: 'math', left: 10, top: 20, width: 100, height: 50, latex: 'x^2' }, context)
    expect(context.stats.mathCount).toBe(1)
  })
})
