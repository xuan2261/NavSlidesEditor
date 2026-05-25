import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import mapper from './mapper'

const { mapPptxOutput } = mapper

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value

  const result = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'id') continue
    if (key === '_pptxSharpen') continue
    if (typeof entry === 'string') {
      result[key] = entry
        .replace(/\/uploads\/[0-9a-f-]+\.[a-z0-9]+/gi, '/uploads/<asset>')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      continue
    }
    result[key] = stable(entry)
  }
  return result
}

async function mapOne(element) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-golden-'))
  try {
    const result = await mapPptxOutput({
      zip: new JSZip(),
      originalName: 'golden.pptx',
      uploadsDir: dir,
      output: { size: { width: 960, height: 540 }, slides: [{ elements: [element] }] },
    })
    return stable(result.presentation.slides[0].elements)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

describe('pptx mapper golden masters', () => {
  const cases = [
    ['text', { type: 'text', left: 10, top: 12, width: 180, height: 40, content: '<p>Hello <b>world</b></p>' }],
    ['image', { type: 'image', left: 20, top: 30, width: 90, height: 70, base64: PNG_DATA_URL, alt: 'Logo' }],
    ['shape', { type: 'shape', shapType: 'roundRect', left: 30, top: 40, width: 120, height: 80, fill: '#ff0000' }],
    ['line', { type: 'shape', shapType: 'line', left: 40, top: 50, width: 100, height: 1, borderColor: '#111111' }],
    ['table', { type: 'table', left: 50, top: 60, width: 220, height: 90, data: [[{ text: 'A' }, { text: 'B' }]] }],
    ['math', { type: 'math', left: 60, top: 70, width: 160, height: 60, latex: '\\frac{a}{b}' }],
    ['group', { type: 'group', left: 70, top: 80, width: 120, height: 90, elements: [{ type: 'shape', shapType: 'ellipse', left: 5, top: 5, width: 40, height: 30 }] }],
    ['diagram', { type: 'diagram', left: 80, top: 90, width: 180, height: 100, elements: [{ text: 'Node', left: 0, top: 0, width: 80, height: 40, shapType: 'rect' }] }],
  ]

  it.each(cases)('maps %s deterministically', async (_, element) => {
    await expect(mapOne(element)).resolves.toMatchSnapshot()
  })
})
