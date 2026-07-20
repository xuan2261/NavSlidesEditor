import crypto from 'node:crypto'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import adaptersModule from './primitive-ooxml-adapters.js'

const { createPrimitiveAdapters } = adaptersModule
const shape = '<p:sp><p:nvSpPr><p:cNvPr id="4"/></p:nvSpPr><p:spPr><a:xfrm rot="60000" flipH="0"><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="445566"/></a:solidFill><a:tailEnd type="triangle"/></a:ln><a:effectLst><a:glow rad="9"/></a:effectLst></p:spPr></p:sp>'
const pic = '<p:pic><p:nvPicPr><p:cNvPr id="7"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:srcRect l="1" t="2" r="3" b="4"/></p:blipFill><p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr></p:pic>'
const slide = `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree>${shape}${pic}</p:spTree></p:cSld></p:sld>`

async function fixture() {
  const zip = new JSZip()
  zip.file('ppt/slides/slide1.xml', slide)
  zip.file('ppt/media/image1.png', Buffer.from('old-image'))
  zip.file('docProps/core.xml', '<core>same</core>')
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

function ref(nativeId, xml, extra = {}) {
  return {
    status: 'authoritative', nativeId, partUri: 'ppt/slides/slide1.xml',
    sourceHash: crypto.createHash('sha256').update(xml).digest('hex'), ...extra,
  }
}

describe('blocking primitive OOXML adapters', () => {
  it('patches transform precisely and preserves adjacent unknown XML', async () => {
    const adapter = createPrimitiveAdapters()
    const result = await adapter.applyPatch(await fixture(), {
      property: 'x', after: 12.5, sourceRef: ref('4', shape, { emuPerUnit: 2 }),
    })
    const xml = await (await JSZip.loadAsync(result.bytes)).file('ppt/slides/slide1.xml').async('string')
    expect(xml).toContain('<a:off x="25" y="2"/>')
    expect(xml).toContain('<a:effectLst><a:glow rad="9"/></a:effectLst>')
    expect(xml).toContain(pic)
  })

  it('patches solid fill and stroke without replacing line children', async () => {
    const adapter = createPrimitiveAdapters()
    let output = await adapter.applyPatch(await fixture(), {
      property: 'fill', after: '#ABCDEF', sourceRef: ref('4', shape),
    })
    const updatedShape = shape.replace('112233', 'ABCDEF')
    output = await adapter.applyPatch(output.bytes, {
      property: 'stroke', after: '#010203', sourceRef: ref('4', updatedShape),
    })
    const xml = await (await JSZip.loadAsync(output.bytes)).file('ppt/slides/slide1.xml').async('string')
    expect(xml).toContain('val="ABCDEF"')
    expect(xml).toContain('val="010203"')
    expect(xml).toContain('<a:tailEnd type="triangle"/>')
  })

  it('replaces image bytes and crop with exact impact closure', async () => {
    const adapter = createPrimitiveAdapters()
    const replacement = Buffer.from('new-image')
    const result = await adapter.applyPatch(await fixture(), {
      property: 'src', after: replacement, sourceRef: ref('7', pic, {
        mediaPartUri: 'ppt/media/image1.png',
      }),
    })
    expect(result.impactClosure).toEqual([
      'ppt/slides/slide1.xml', 'ppt/media/image1.png',
    ])
    const zip = await JSZip.loadAsync(result.bytes)
    expect((await zip.file('ppt/media/image1.png').async('nodebuffer')).equals(replacement)).toBe(true)
    expect(await zip.file('docProps/core.xml').async('string')).toBe('<core>same</core>')
  })

  it('rejects stale source hashes on repeated edits', async () => {
    const adapter = createPrimitiveAdapters()
    const first = await adapter.applyPatch(await fixture(), {
      property: 'rotation', after: 2, sourceRef: ref('4', shape),
    })
    await expect(adapter.applyPatch(first.bytes, {
      property: 'rotation', after: 3, sourceRef: ref('4', shape),
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_MISMATCH' })
  })

  it('does not accumulate geometry precision drift across edits', async () => {
    const adapter = createPrimitiveAdapters()
    let bytes = await fixture()
    let sourceHash = ref('4', shape).sourceHash
    for (const value of [12.345, 67.891, 12.345]) {
      const result = await adapter.applyPatch(bytes, {
        property: 'x', after: value,
        sourceRef: { ...ref('4', shape), sourceHash },
      })
      bytes = result.bytes
      sourceHash = result.sourceHash
    }
    const xml = await (await JSZip.loadAsync(bytes)).file('ppt/slides/slide1.xml').async('string')
    expect(xml).toContain('<a:off x="117586" y="2"/>')
    expect(xml).toContain('<a:effectLst><a:glow rad="9"/></a:effectLst>')
  })
})
