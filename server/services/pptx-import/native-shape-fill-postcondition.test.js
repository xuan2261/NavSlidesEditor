import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import postconditionModule from './native-shape-fill-postcondition.js'

const { verifyNativeShapeFillPostcondition } = postconditionModule

const partUri = 'ppt/slides/slide1.xml'

async function fixture(fill = '<a:solidFill><a:srgbClr val="AABBCC"/></a:solidFill>') {
  const zip = new JSZip()
  zip.file(partUri, `<p:sld xmlns:p="p" xmlns:a="a"><p:sp><p:nvSpPr><p:cNvPr id="8"/></p:nvSpPr><p:spPr>${fill}</p:spPr></p:sp></p:sld>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

function journal(after = '#AABBCC') {
  return { operations: [{
    rowId: 'primitive.shape.solid-fill', objectKind: 'shape',
    propertyId: 'solid-fill', operationId: 'set-style', after,
    sourceRef: { partUri, nativeId: '8', kind: 'shape', status: 'authoritative' },
  }] }
}

describe('native shape-fill semantic postcondition', () => {
  it('accepts the exact successor solid RGB fill on the authoritative shape', async () => {
    await expect(verifyNativeShapeFillPostcondition({
      afterBytes: await fixture(), journal: journal(),
    })).resolves.toBe(true)
  })

  it.each([
    ['different RGB', '<a:solidFill><a:srgbClr val="112233"/></a:solidFill>'],
    ['scheme color', '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>'],
    ['gradient fill', '<a:gradFill/>'],
  ])('blocks %s output', async (_label, fill) => {
    await expect(verifyNativeShapeFillPostcondition({
      afterBytes: await fixture(fill), journal: journal(),
    })).rejects.toMatchObject({ code: 'NATIVE_SEMANTIC_POSTCONDITION_FAILED' })
  })
})
