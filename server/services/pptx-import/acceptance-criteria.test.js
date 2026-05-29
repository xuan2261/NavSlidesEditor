import { describe, expect, it } from 'vitest'
import acceptance from './acceptance-criteria.js'

const {
  assertFiniteLengthFields,
  assertNoRawUnits,
  assertPresentationAcceptance,
  assertResolutionInvariant,
  assertSourceFontSizesWithinTolerance,
  assertTextFontSizeWithinTolerance,
} = acceptance

describe('pptx import acceptance criteria', () => {
  it('fails when imported presentation resolution is not canvas size', () => {
    expect(() => assertResolutionInvariant({ resolution: { width: 720, height: 540 } }))
      .toThrow(/resolution/i)
  })

  it('catches raw CSS units and dangerous CSS tokens in rich HTML', () => {
    expect(() => assertNoRawUnits({
      slides: [{ elements: [{ content: '<span style="font-size:24pt">Title</span>' }] }],
    })).toThrow(/raw CSS length/i)

    expect(() => assertNoRawUnits({
      slides: [{ elements: [{ textHtml: '<span style="background:url(javascript:bad)">Title</span>' }] }],
    })).toThrow(/dangerous CSS/i)
  })

  it('does not treat visible prose units as raw CSS units', () => {
    expect(() => assertNoRawUnits({
      slides: [{ elements: [{ content: '<p>Measure 5 mm and read url(...) aloud.</p>' }] }],
    })).not.toThrow()
  })

  it('catches dangerous URL attributes in rich HTML', () => {
    expect(() => assertNoRawUnits({
      slides: [{ elements: [{ content: '<a href="javascript:alert(1)">bad</a>' }] }],
    })).toThrow(/dangerous URL/i)
  })

  it('requires length-bearing fields to be finite numbers when present', () => {
    expect(() => assertFiniteLengthFields({
      slides: [{ elements: [{ type: 'shape', strokeWidth: Infinity }] }],
    })).toThrow(/not finite/i)

    expect(() => assertFiniteLengthFields({
      slides: [{ elements: [{ type: 'table', colWidths: [80, 'bad'] }] }],
    })).toThrow(/not finite/i)
  })

  it('accepts text font size at the scale-based target and rejects 96-DPI inflation', () => {
    // Correct fix on a standard deck (scale.y = 1): 24pt → 24px.
    expect(() => assertTextFontSizeWithinTolerance({ fontSize: 24 }, 24)).not.toThrow()
    // Old-bug inflated value (24 × 96/72 = 32) must now FAIL the gate.
    expect(() => assertTextFontSizeWithinTolerance({ fontSize: 32 }, 24)).toThrow(/fontSize/i)
    // Non-uniform deck: target follows scale.y. 24pt × 0.75 = 18px.
    expect(() => assertTextFontSizeWithinTolerance({ fontSize: 18 }, 24, 0.75)).not.toThrow()
    expect(() => assertTextFontSizeWithinTolerance({ fontSize: 24 }, 24, 0.75)).toThrow(/fontSize/i)
  })

  it('checks source-to-import font size tolerance when source output is available', () => {
    const source = {
      slides: [{ elements: [{ type: 'text', fontSz: 24, content: '<span>Title</span>' }] }],
    }
    const imported = {
      slides: [{ elements: [{ type: 'text', fontSize: 24 }] }],
    }
    // Standard deck (no originalSize → scale.y defaults to 1): 24pt → 24px passes.
    expect(() => assertSourceFontSizesWithinTolerance(source, imported)).not.toThrow()
    // The old inflated value (32) is now a regression the gate catches.
    expect(() => assertSourceFontSizesWithinTolerance(source, {
      slides: [{ elements: [{ type: 'text', fontSize: 32 }] }],
    })).toThrow(/fontSize/i)
  })

  it('derives the font scale from a non-uniform imported deck resolution', () => {
    const source = {
      slides: [{ elements: [{ type: 'text', fontSz: 24, content: '<span>Title</span>' }] }],
    }
    // 540 canvas / 720 source height → scale.y = 0.75 → 24pt expects 18px.
    const imported = {
      resolution: { width: 960, height: 540 },
      _pptxMeta: { originalSize: { width: 960, height: 720 } },
      slides: [{ elements: [{ type: 'text', fontSize: 18 }] }],
    }
    expect(() => assertSourceFontSizesWithinTolerance(source, imported)).not.toThrow()
  })

  it('passes a normalized imported presentation', () => {
    expect(() => assertPresentationAcceptance({
      resolution: { width: 960, height: 540 },
      slides: [{
        notes: '<p>Safe</p>',
        elements: [{
          type: 'text',
          x: 1,
          y: 2,
          width: 100,
          height: 40,
          fontSize: 18,
          content: '<span style="font-size:24px;color:#111">Safe</span>',
          _pptxImportMeta: { textInsets: { left: 9.6, right: 9.6, top: 4.8, bottom: 4.8 }, textInsetsUnit: 'px' },
        }],
      }],
    }, undefined, {
      slides: [{ elements: [{ type: 'text', fontSz: 18 }] }],
    })).not.toThrow()
  })
})
