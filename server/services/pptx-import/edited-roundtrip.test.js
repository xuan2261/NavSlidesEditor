import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import validatorModule from './transactional-export-validators.js'

const { runLayeredValidators } = validatorModule

async function fixture() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml',
    '<Types><Default Extension="xml" ContentType="application/xml"/></Types>')
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="p"/>')
  zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p"/>')
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

describe('edited roundtrip validation', () => {
  it('accepts an exact package through every required local layer', async () => {
    const bytes = await fixture()
    const nativeReimport = vi.fn(async ({ expectedProjection }) =>
      expectedProjection.id === 'deck')
    const result = await runLayeredValidators({
      beforeBytes: bytes,
      afterBytes: bytes,
      touchedParts: [],
      expectedProjection: { id: 'deck' },
      requireOfficeCli: false,
    }, { nativeReimport })
    expect(result.map((item) => item.layer)).toEqual([
      'zip-opc', 'impact', 'security', 'native-reimport',
    ])
    expect(nativeReimport).toHaveBeenCalledOnce()
  })
})
