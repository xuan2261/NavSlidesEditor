import { describe, expect, it } from 'vitest'
import { classifyImageClipping, classifyOutOfCanvas, classifyTextOverflow, sanitizeDiagnosticText } from '../e2e/pages/pptx-import-audit-helper.js'
import { assertStrictAuditSummary, summarizeDecks } from '../e2e/pages/pptx-import-audit-report-helper.js'

const baseEntry = {
  deck: 'deck.pptx',
  slide: 1,
  id: 'shape-1',
  type: 'shape',
  width: 1100,
  height: 6,
  canvasWidth: 1280,
  canvasHeight: 720,
  hasPointerInteraction: false,
}

describe('pptx import real browser audit helper', () => {
  it('marks thin noninteractive decorative strips as candidate-only bleed', () => {
    expect(classifyOutOfCanvas(baseEntry)).toEqual({
      bucket: 'acceptedBleedCandidate',
      reason: 'thin-decorative-strip-needs-source-evidence',
    })
  })

  it('keeps text outside the canvas as unexpected', () => {
    expect(classifyOutOfCanvas({ ...baseEntry, type: 'text' })).toEqual({
      bucket: 'unexpected',
      reason: 'text-or-image-cannot-be-bleed',
    })
  })

  it('requires explicit allowlist evidence before accepted bleed passes strict counts', () => {
    const accepted = classifyOutOfCanvas(baseEntry, [
      { deck: 'deck.pptx', slide: 1, id: 'shape-1', reason: 'source geometry extends beyond slide' },
    ])
    expect(accepted).toEqual({ bucket: 'acceptedBleed', reason: 'source geometry extends beyond slide' })
  })

  it('accepts only explicit deck/slide decorative bleed patterns', () => {
    const entry = {
      deck: 'Bai3_HinhChieuVuongGoc.pptx',
      slide: 29,
      id: 'shape',
      type: 'shape',
      x: -7,
      y: 66,
      width: 1154,
      height: 6,
      canvasWidth: 1136,
      canvasHeight: 639,
      hasPointerInteraction: false,
    }
    const accepted = classifyOutOfCanvas(entry)
    expect(accepted.bucket).toBe('acceptedBleed')
    expect(accepted.reason).toContain('explicit-allowlist')

    expect(classifyOutOfCanvas({ ...entry, deck: 'other.pptx', type: 'text' }).bucket).toBe('unexpected')
  })

  it('does not allow interactive elements through decorative bleed patterns', () => {
    const entry = {
      deck: 'Bai3_HinhChieuVuongGoc.pptx',
      slide: 29,
      id: 'shape',
      type: 'shape',
      x: -7,
      y: 66,
      width: 1154,
      height: 6,
      canvasWidth: 1136,
      canvasHeight: 639,
      hasPointerInteraction: true,
    }
    expect(classifyOutOfCanvas(entry)).toEqual({
      bucket: 'unexpected',
      reason: 'interactive-element-cannot-be-bleed',
    })
  })

  it('accepts image clipping only when source crop metadata is present', () => {
    expect(classifyImageClipping({ reason: 'image-outside-wrapper', hasSourceCrop: true, cropDataPresent: true })).toEqual({
      bucket: 'intentionalImageCrop',
      reason: 'source-crop',
    })
    expect(classifyImageClipping({ reason: 'image-outside-wrapper', hasSourceCrop: true, cropDataPresent: false })).toEqual({
      bucket: 'unexpectedImageClipping',
      reason: 'image-outside-wrapper',
    })
    expect(classifyImageClipping({ reason: 'image-outside-wrapper', hasSourceCrop: false })).toEqual({
      bucket: 'unexpectedImageClipping',
      reason: 'image-outside-wrapper',
    })
  })

  it('redacts long diagnostic text before artifact writing', () => {
    const value = sanitizeDiagnosticText('secret slide title at C:/Work/NavSlidesEditor/file.pptx\n'.repeat(10), 80)
    expect(value.length).toBeLessThanOrEqual(80)
    expect(value).not.toContain('secret slide title')
    expect(value).toContain('[redacted')
  })

  it('counts candidate bleed as a strict failure', () => {
    const summary = summarizeDecks([
      {
        deck: 'deck.pptx',
        slideCount: 1,
        consoleErrors: [],
        slides: [
          {
            status: 'fail',
            textOverflow: [],
            imageClipping: [],
            rawOutOfCanvas: [baseEntry],
            acceptedBleedCandidates: [baseEntry],
            acceptedBleed: [],
            unexpectedOutOfCanvas: [],
            zeroSized: [],
          },
        ],
      },
    ])
    expect(summary.strictFailures).toBe(1)
    expect(() => assertStrictAuditSummary(summary)).toThrow(/strict failures/i)
  })

  it('accepts a zero-count strict summary', () => {
    expect(assertStrictAuditSummary({
      text: 0,
      image: 0,
      acceptedBleedCandidates: 0,
      unexpectedOutOfCanvas: 0,
      zero: 0,
      consoleErrors: 0,
      importErrors: 0,
      strictFailures: 0,
    })).toBe(true)
  })

  it('classifies common text overflow root causes from computed style diagnostics', () => {
    expect(
      classifyTextOverflow({
        elementType: 'text',
        overflowX: 120,
        overflowY: 0,
        width: 200,
        height: 40,
        whiteSpace: 'normal',
        wordBreak: 'normal',
        overflowWrap: 'normal',
        fontSizePx: 18,
        lineHeightPx: 21,
      })
    ).toBe('nowrap-or-unbreakable')

    expect(
      classifyTextOverflow({
        elementType: 'shape',
        overflowX: 0,
        overflowY: 5,
        width: 100,
        height: 40,
      })
    ).toBe('shape-text-foreign-object')
  })
})
