import JSZip from 'jszip'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import order from './slide-order.js'
import layers from './mapper/native-layout-layers.js'
import names from './parser-part-names.js'

const p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function fixture(extension = '') {
  const zip = new JSZip()
  zip.file(
    'ppt/presentation.xml',
    `<deck:presentation xmlns:deck="${p}" xmlns:rel="${r}" xmlns:x="urn:foreign">
    ${extension}<deck:sldIdLst><deck:sldId id="9" rel:id="r9"/><deck:sldId id="1" rel:id="r1"/></deck:sldIdLst>
  </deck:presentation>`
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships>
    <Relationship Id="r1" Type="${r}/slide" Target="slides/slide1.xml"/>
    <Relationship Id="r9" Type="${r}/slide" Target="slides/slide9.xml"/>
  </Relationships>`
  )
  zip.file('ppt/slides/slide1.xml', '<p:sld/>')
  zip.file('ppt/slides/slide9.xml', '<p:sld/>')
  return zip
}

describe('slide part identity', () => {
  it('uses a total exact stable numeric-first enumeration', () => {
    const huge = '9'.repeat(400)
    const input = ['summary.xml', `slide${huge}.xml`, 'slide02.xml', 'agenda.xml', 'slide2.XML', 'slide1.xml', `slide1${huge}.xml`, 'Z.xml', 'a.xml']
    expect([...input].sort(names.compareParserParts)).toEqual([
      'slide1.xml', 'slide02.xml', 'slide2.XML', `slide${huge}.xml`, `slide1${huge}.xml`,
      'Z.xml', 'a.xml', 'agenda.xml', 'summary.xml',
    ])
    for (const a of input) for (const b of input) {
      const result = names.compareParserParts(a, b)
      expect([-1, 0, 1]).toContain(result)
      expect(result === 0 ? 0 : result).toBe(-names.compareParserParts(b, a) || 0)
    }
    expect(names.relationshipPart('ppt/slides/agenda.xml')).toBe('ppt/slides/_rels/agenda.xml.rels')
    const require = createRequire(import.meta.url)
    expect(require('./slide-order.js').relationshipPart).toBe(require('./parser-part-names.js').relationshipPart)
  })
  it('associates parser inventory before applying authored relationships', async () => {
    const zip = fixture()
    zip.file('ppt/slides/agenda.xml', '<p:sld/>')
    zip.file('ppt/slides/summary.xml', '<p:sld/>')
    zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${p}" xmlns:r="${r}"><p:sldIdLst><p:sldId id="1" r:id="r1"/><p:sldId id="9" r:id="r9"/><p:sldId id="3" r:id="r3"/></p:sldIdLst></p:presentation>`)
    zip.file('ppt/_rels/presentation.xml.rels', `<Relationships><Relationship Id="r1" Type="${r}/slide" Target="slides/summary.xml"/><Relationship Id="r9" Type="${r}/slide" Target="slides/slide9.xml"/><Relationship Id="r3" Type="${r}/slide" Target="slides/agenda.xml"/></Relationships>`)
    zip.file('[Content_Types].xml', `<Types>${['summary', 'agenda', 'slide9'].map((name) => `<Override PartName="/ppt/slides/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`)
    const output = { slides: [{ id: 'numeric' }, { id: 'agenda' }, { id: 'summary' }] }
    await order.orderParserSlides(output, zip)
    expect(output.slides.map((slide) => slide.id)).toEqual(['summary', 'numeric', 'agenda'])
  })
  it('ignores foreign extension lists and accepts relationship namespace aliases', async () => {
    const zip = fixture('<x:sldIdLst><x:sldId rel:id="r1"/></x:sldIdLst>')
    expect(await order.readSlideOrder(zip)).toEqual([
      'ppt/slides/slide9.xml',
      'ppt/slides/slide1.xml',
    ])
  })

  it('uses the same relationship identity for native layer lookup', async () => {
    expect(await layers.resolveNativeParts(fixture(), 0)).toMatchObject({
      slidePath: 'ppt/slides/slide9.xml',
    })
  })

  it.each(['cardinality', 'unavailable', 'duplicate', 'missing identity'])('rejects %s instead of guessing an identity', async (failure) => {
    const zip = fixture()
    zip.file('[Content_Types].xml', `<Types>${[1, failure === 'missing identity' ? 8 : 9].map((n) => `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`)
    if (failure === 'unavailable') zip.remove('ppt/slides/slide9.xml')
    if (failure === 'duplicate') {
      const xml = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
      zip.file('ppt/_rels/presentation.xml.rels', xml.replace('slide9.xml', 'slide1.xml'))
    }
    await expect(order.orderParserSlides({ slides: failure === 'cardinality' ? [{}] : [{}, {}] }, zip)).rejects.toThrow(/identities|unavailable|duplicate|missing/)
  })
})
