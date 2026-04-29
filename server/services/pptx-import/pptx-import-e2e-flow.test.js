/**
 * pptx-import-e2e-flow.test.js — Phase 7
 * Integration test: full PPTX import → NavSlides pipeline.
 * Uses the mapper directly with synthetic pptxtojson output to test the
 * pipeline end-to-end without requiring a real PPTX file or pptxtojson.
 */

import { describe, expect, it } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import JSZip from 'jszip'
import { mapPptxOutput } from './mapper.js'

const CORPUS_DIR = path.join(__dirname, '..', '..', 'data', 'test-corpus')

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

function validatePresentationSchema(presentation) {
  const errors = []
  if (!presentation || typeof presentation !== 'object') {
    errors.push('presentation must be an object'); return errors
  }
  if (typeof presentation.title !== 'string') {
    errors.push('presentation.title must be a string')
  }
  if (!Array.isArray(presentation.slides)) {
    errors.push('presentation.slides must be an array'); return errors
  }
  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i]
    if (!slide || typeof slide !== 'object') {
      errors.push(`slides[${i}] must be an object`); continue
    }
    if (!Array.isArray(slide.elements)) {
      errors.push(`slides[${i}].elements must be an array`)
    }
    for (let j = 0; j < (slide.elements || []).length; j++) {
      const el = slide.elements[j]
      if (!el || typeof el !== 'object') {
        errors.push(`slides[${i}].elements[${j}] must be an object`); continue
      }
      if (el.x == null || typeof el.x !== 'number') {
        errors.push(`slides[${i}].elements[${j}].x must be a number`)
      }
      if (el.y == null || typeof el.y !== 'number') {
        errors.push(`slides[${i}].elements[${j}].y must be a number`)
      }
      if (el.width == null || typeof el.width !== 'number') {
        errors.push(`slides[${i}].elements[${j}].width must be a number`)
      }
      if (el.height == null || typeof el.height !== 'number') {
        errors.push(`slides[${i}].elements[${j}].height must be a number`)
      }
    }
  }
  return errors
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PPTX import e2e flow', () => {
  it('synthetic pptxtojson output imports with valid schema', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-e2e-schema-'))
    try {
      // Synthetic pptxtojson output (what pptxtojson would produce for a minimal slide)
      const syntheticOutput = {
        size: { width: 960, height: 540 },
        usedFonts: ['Arial'],
        themeColors: ['#ffffff', '#000000'],
        slides: [{
          elements: [
            { type: 'text', content: '<p>Hello World</p>', left: 100, top: 100, width: 400, height: 60 },
            { type: 'shape', shapType: 'rect', left: 200, top: 200, width: 100, height: 100, fill: { type: 'color', value: '#ff0000' }, borderColor: { type: 'none' } },
          ],
        }],
      }

      const result = await mapPptxOutput({
        output: syntheticOutput,
        zip: new JSZip(),
        originalName: 'synthetic.pptx',
        uploadsDir: dir,
      })

      expect(result.presentation).toBeDefined()
      expect(result.presentation.slides).toHaveLength(1)

      const schemaErrors = validatePresentationSchema(result.presentation)
      expect(schemaErrors).toHaveLength(0)

      const slide = result.presentation.slides[0]
      expect(slide.elements).toHaveLength(2)
      expect(slide.elements[0].type).toBe('text')
      expect(slide.elements[0].content).toBe('<p>Hello World</p>')
      expect(slide.elements[1].type).toBe('shape')
      expect(slide.elements[1].shape).toBe('rect')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('import stats include all element type counts', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-e2e-stats-'))
    try {
      const syntheticOutput = {
        size: { width: 960, height: 540 },
        slides: [{
          elements: [
            { type: 'text', content: '<p>Test</p>', left: 100, top: 100, width: 400, height: 60 },
            { type: 'shape', shapType: 'rect', left: 300, top: 300, width: 80, height: 80, fill: { type: 'color', value: '#0000ff' }, borderColor: { type: 'none' } },
            { type: 'table', data: [['A', 'B'], ['1', '2']], left: 50, top: 50, width: 400, height: 200 },
          ],
        }],
      }

      const result = await mapPptxOutput({
        output: syntheticOutput,
        zip: new JSZip(),
        originalName: 'synthetic.pptx',
        uploadsDir: dir,
      })

      expect(result.stats).toHaveProperty('slideCount')
      expect(result.stats).toHaveProperty('textCount')
      expect(result.stats).toHaveProperty('shapeCount')
      expect(result.stats).toHaveProperty('tableCount')
      expect(result.stats).toHaveProperty('chartCount')
      expect(result.stats.textCount).toBeGreaterThan(0)
      expect(result.stats.shapeCount).toBeGreaterThan(0)
      expect(result.stats.tableCount).toBeGreaterThan(0)
      expect(result.stats.slideCount).toBe(1)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('import with speaker notes preserves notes field', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-e2e-notes-'))
    try {
      const syntheticOutput = {
        size: { width: 960, height: 540 },
        slides: [{
          elements: [{ type: 'text', content: '<p>Slide content</p>', left: 100, top: 100, width: 400, height: 60 }],
          note: '<p>Speaker notes here</p>',
        }],
      }

      const result = await mapPptxOutput({
        output: syntheticOutput,
        zip: new JSZip(),
        originalName: 'notes.pptx',
        uploadsDir: dir,
      })

      const slide = result.presentation.slides[0]
      expect(slide.notes).toBeTruthy()
      expect(slide.notes.length).toBeGreaterThan(0)
      expect(slide.notes).toContain('Speaker notes')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('import with chart element includes chartType and chartData', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-e2e-chart-'))
    try {
      const syntheticOutput = {
        size: { width: 960, height: 540 },
        slides: [{
          elements: [{
            type: 'chart',
            chartType: 'barChart',
            left: 100, top: 100, width: 400, height: 300,
            data: [{
              key: 'Series 1',
              values: [{ x: 'A', y: 10 }, { x: 'B', y: 20 }],
            }],
            colors: ['#6366f1'],
          }],
        }],
      }

      const result = await mapPptxOutput({
        output: syntheticOutput,
        zip: new JSZip(),
        originalName: 'chart.pptx',
        uploadsDir: dir,
      })

      const chartEl = result.presentation.slides[0].elements[0]
      expect(chartEl.type).toBe('chart')
      expect(chartEl.chartType).toBeTruthy()
      expect(chartEl.chartData).toBeTruthy()
      expect(chartEl.chartData.datasets).toBeTruthy()
      expect(chartEl.chartData.datasets.length).toBeGreaterThan(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('corpus directory is accessible', async () => {
    const corpusExists = await fs.access(CORPUS_DIR).then(() => true).catch(() => false)
    expect(corpusExists).toBe(true)

    const files = await fs.readdir(CORPUS_DIR)
    const pptxFiles = files.filter((f) => f.toLowerCase().endsWith('.pptx'))
    expect(Array.isArray(pptxFiles)).toBe(true)
  })
})
