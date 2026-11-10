import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { doc, node, options, run, val } from './omml-rendering-fixtures'

const require = createRequire(import.meta.url)
const { renderOmmlDocument } = require('../../shared/src/pptx-omml-renderer')

describe('OMML rendering boundary regressions', () => {
  it('does not paint a full-width accent over an empty source argument', () => {
    const result = renderOmmlDocument(doc(node('acc', [node('e')])), options)
    const accent = result.layout.children[0]
    expect(accent.width).toBe(0)
    expect(accent.primitives[0].scaleX).toBe(0)
    expect(result.svg).toContain('scale(0 1)')
  })

  it.each(['x\ny', 'x\ry', 'x\ty'])(
    'does not silently flatten source control whitespace %j',
    (text) => {
      const input = doc(run(text))
      expect(() => renderOmmlDocument(input, options)).toThrow(
        expect.objectContaining({
          code: 'PPTX_OMML_RENDER_UNSUPPORTED',
          componentId: input.root.children[0].children[0].componentId,
          path: [0, 0],
        })
      )
    }
  )

  it('locates thrown measurement failures and missing math constants', () => {
    const input = doc(run('x'))
    expect(() =>
      renderOmmlDocument(input, {
        ...options,
        measureText: () => {
          throw new Error('font missing')
        },
      })
    ).toThrow(
      expect.objectContaining({
        code: 'PPTX_OMML_MEASUREMENT_FAILED',
        path: [0, 0],
      })
    )
    expect(() =>
      renderOmmlDocument(input, {
        ...options,
        getMathMetrics: () => ({ scriptScale: 0.7 }),
      })
    ).toThrow(
      expect.objectContaining({
        code: 'PPTX_OMML_MEASUREMENT_FAILED',
        path: [],
      })
    )
  })

  it('returns paragraph justification for external placement rather than inventing a frame', () => {
    const source = {
      schemaVersion: 1,
      root: node('oMathPara', [
        node('oMathParaPr', [val('jc', 'right')]),
        node('oMath', [run('x')]),
      ]),
    }
    const { layout } = renderOmmlDocument(source, options)
    expect(layout.justification).toBe('right')
    expect(layout.width).toBe(layout.children[0].width)
  })

  it('does not reserve script or limit shifts for genuinely empty argument slots', () => {
    for (const [type, slots] of [
      ['sSubSup', ['sub', 'sup']],
      ['sPre', ['sub', 'sup']],
      ['limLow', ['lim']],
      ['limUpp', ['lim']],
    ]) {
      const base = node('e', [run('.')])
      const children = slots.map((name) => node(name))
      if (type === 'sPre') children.push(base)
      else children.unshift(base)
      const result = renderOmmlDocument(doc(node(type, children)), options).layout.children[0]
      const baseLayout = result.children.find((b) => b.componentId === base.componentId)
      expect(result.width).toBe(baseLayout.width)
      expect(result.ascent).toBe(baseLayout.ascent)
      expect(result.descent).toBe(baseLayout.descent)
    }
  })
})
