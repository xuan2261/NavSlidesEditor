import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createCanvas } from '@napi-rs/canvas'
import { doc, options, run } from './omml-rendering-fixtures.js'

const require = createRequire(import.meta.url)
const api = () => require('../../shared/src/pptx-omml-runtime-math.js')
// Deterministic binary MATH table contract, not a fabricated glyph measurer.
function font() {
  const bytes = new ArrayBuffer(512), v = new DataView(bytes)
  v.setUint32(0, 0x00010000)
  v.setUint16(4, 2)
  v.setUint32(12, 0x68656164); v.setUint32(20, 64); v.setUint32(24, 54)
  v.setUint16(82, 1000)
  v.setUint32(28, 0x4d415448); v.setUint32(36, 128); v.setUint32(40, 256)
  v.setUint16(128, 1); v.setUint16(132, 10)
  v.setInt16(138, 70); v.setInt16(140, 50)
  v.setUint16(142, 1300); v.setUint16(144, 1500)
  for (let i = 0; i < 51; i++) v.setInt16(146 + i * 4, 10 + i)
  v.setUint16(350, 60)
  return bytes
}
it('reads signed native MATH constants and scales font units without guessed defaults', () => {
  const result = api().readOmmlMathConstants(font())
  expect(result.unitsPerEm).toBe(1000)
  expect(result.scriptPercentScaleDown).toBe(70)
  expect(result.axisHeight).toBe(11)
  expect(result.fractionRuleThickness).toBe(44)
  expect(result.radicalDegreeBottomRaisePercent).toBe(60)
  const metrics = api().createOmmlMathMetrics(font(), {
    delimiterGap: 2, columnGap: 3, rowGap: 4, accentGap: 5, radicalDegreeRaise: 6,
  })({ fontSize: 20 })
  expect(metrics.axisHeight).toBe(0.22)
  expect(metrics.ruleThickness).toBe(0.88)
  expect(metrics.scriptScale).toBe(0.7)
  expect(metrics.delimiterGap).toBe(2)
})
it('rejects absent MATH, truncated constants, device adjustments and missing spacing policy', () => {
  const { readOmmlMathConstants, createOmmlMathMetrics } = api()
  const absent = font()
  new DataView(absent).setUint32(28, 0x6e616d65)
  expect(() => readOmmlMathConstants(absent)).toThrow(/MATH/)
  const device = font()
  new DataView(device).setUint16(148, 220)
  expect(() => readOmmlMathConstants(device)).toThrow(/device/i)
  expect(() => readOmmlMathConstants(font().slice(0, 200))).toThrow()
  expect(() => createOmmlMathMetrics(font(), {})).toThrow(/spacing/i)
})

it('paints through the resolved physical face alias used by glyph measurement', () => {
  const { renderOmmlDocument } = require('../../shared/src/pptx-omml-renderer.js')
  const result = renderOmmlDocument(doc(run('x')), {
    ...options, resolveFontFamily: () => 'verified_font_alias',
  })
  expect(result.svg).toContain('font-family="verified_font_alias"')
})

it('does not require MATH tables on unrelated loaded faces, but never substitutes missing math constants', async () => {
  const { createOmmlRuntime } = require('../../shared/src/pptx-omml-runtime.js')
  const raw = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
  const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  let stale = null
  const runtime = createOmmlRuntime({
    document: { createElement: () => createCanvas(8, 8) },
    fontRuntime: {
      fontProfile: { faces: [{ id: 'regular', typeface: 'KaTeX Main' }] },
      rendererProfile: {},
      measurement: { validate: () => stale },
      fontFamilies: { regular: 'verified_alias' },
      getFontAsset: () => ({ bytes }),
    },
    fontFamily: 'KaTeX Main', fontSize: 24, color: '#000000',
    spacing: { delimiterGap: 1, columnGap: 1, rowGap: 1, accentGap: 1, radicalDegreeRaise: 1 },
  })
  expect(runtime.resolveFontFamily({ fontFamily: 'KaTeX Main', fontSize: 24 })).toBe('verified_alias')
  expect(() => runtime.getMathMetrics({ fontFamily: 'KaTeX Main', fontSize: 24 })).toThrow(/MATH/)
  stale = 'stale-table-output-fonts'
  expect(() => runtime.measureText('x', { fontFamily: 'KaTeX Main', fontSize: 24 })).toThrow(/stale/)
})
