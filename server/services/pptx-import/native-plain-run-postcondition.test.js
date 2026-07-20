import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import postconditionModule from './native-plain-run-postcondition.js'

const { verifyNativePlainRunPostcondition } = postconditionModule

async function fixture(text) {
  const zip = new JSZip()
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:sp><p:nvSpPr><p:cNvPr id="4"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

function journal(after) {
  return { operations: [{
    rowId: 'primitive.text.run.plain-replacement', objectKind: 'text-run', after,
    sourceRef: { partUri: 'ppt/slides/slide1.xml', nativeId: '4' },
  }] }
}

describe('native plain-run semantic postcondition', () => {
  it('accepts the exact successor OOXML text', async () => {
    await expect(verifyNativePlainRunPostcondition({ afterBytes: await fixture('After'), journal: journal('After') }))
      .resolves.toBe(true)
  })

  it('blocks structurally valid successor OOXML with the wrong text', async () => {
    await expect(verifyNativePlainRunPostcondition({ afterBytes: await fixture('Wrong'), journal: journal('After') }))
      .rejects.toMatchObject({ code: 'NATIVE_SEMANTIC_POSTCONDITION_FAILED' })
  })
})
