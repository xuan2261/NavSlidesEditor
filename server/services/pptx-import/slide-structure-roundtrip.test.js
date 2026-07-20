import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import structureModule from './presentation-structure.js'
import mutationModule from './slide-structure-mutation.js'
import journalModule from './slide-structure-journal.js'

const { inspectPresentationStructure } = structureModule
const { mutateSlideStructure } = mutationModule
const { createSlideStructureOperation } = journalModule
const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships'
const docRelNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

async function fixture() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`)
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="p" xmlns:r="${docRelNs}"><p:customShowLst><p:custShow name="Only second"><p:sldLst><p:sld r:id="rId2"/></p:sldLst></p:custShow></p:customShowLst><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:extLst><x:unknown xmlns:x="x">keep</x:unknown></p:extLst></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`)
  zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p" show="0"><p:cSld><p:spTree/></p:cSld><p:transition advTm="10"/><p:timing><p:unknown/></p:timing></p:sld>')
  zip.file('ppt/slides/slide2.xml', '<p:sld xmlns:p="p"><p:cSld><p:spTree/></p:cSld><x:unknown xmlns:x="x">opaque</x:unknown></p:sld>')
  zip.file('ppt/slides/_rels/slide1.xml.rels', `<Relationships xmlns="${relNs}"><Relationship Id="rId9" Type="${docRelNs}/hyperlink" Target="../slides/slide2.xml"/></Relationships>`)
  zip.file('ppt/notesSlides/notesSlide1.xml', '<p:notes xmlns:p="p"><p:rich>unchanged</p:rich></p:notes>')
  zip.file('ppt/comments/comment1.xml', '<p:cmLst xmlns:p="p"><p:cm authorId="0"/></p:cmLst>')
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('native slide structure mutation', () => {
  it('reorders repeatedly without changing stable identities or preserve-only bytes', async () => {
    const source = await fixture()
    const sourceZip = await JSZip.loadAsync(source)
    const notes = await sourceZip.file('ppt/notesSlides/notesSlide1.xml').async('nodebuffer')
    const unknown = await sourceZip.file('ppt/slides/slide2.xml').async('nodebuffer')
    const before = await inspectPresentationStructure(source)
    const first = await mutateSlideStructure(source, { kind: 'slide-reorder', slidePartUris: [
      'ppt/slides/slide2.xml', 'ppt/slides/slide1.xml',
    ] })
    const second = await mutateSlideStructure(first.bytes, { kind: 'slide-reorder', slidePartUris: [
      'ppt/slides/slide2.xml', 'ppt/slides/slide1.xml',
    ] })
    expect((await inspectPresentationStructure(second.bytes)).slides).toEqual([
      before.slides[1], before.slides[0],
    ])
    expect(second.changedParts).toEqual([])
    expect(second.preservedParts).toContain('ppt/notesSlides/notesSlide1.xml')
    const outputZip = await JSZip.loadAsync(second.bytes)
    expect(await outputZip.file('ppt/notesSlides/notesSlide1.xml').async('nodebuffer')).toEqual(notes)
    expect(await outputZip.file('ppt/slides/slide2.xml').async('nodebuffer')).toEqual(unknown)
  })

  it('adds a slide and creates deterministic structural journal entries', async () => {
    const operation = createSlideStructureOperation({ kind: 'slide-add', index: 1 })
    expect(createSlideStructureOperation({ kind: 'slide-add', index: 1 })).toEqual(operation)
    expect(operation.impactClosure).toContain('ppt/presentation.xml')
    const result = await mutateSlideStructure(await fixture(), operation)
    expect((await inspectPresentationStructure(result.bytes)).slides.map((slide) => slide.partUri))
      .toEqual(['ppt/slides/slide1.xml', 'ppt/slides/slide3.xml', 'ppt/slides/slide2.xml'])
  })

  it('duplicates with collision-free part, relationship, and native slide IDs', async () => {
    const result = await mutateSlideStructure(await fixture(), {
      kind: 'slide-duplicate', slidePartUri: 'ppt/slides/slide1.xml',
    })
    const model = await inspectPresentationStructure(result.bytes)
    expect(model.slides.map((slide) => slide.partUri)).toEqual([
      'ppt/slides/slide1.xml', 'ppt/slides/slide3.xml', 'ppt/slides/slide2.xml',
    ])
    expect(new Set(model.slides.map((slide) => slide.nativeId)).size).toBe(3)
    expect(new Set(model.slides.map((slide) => slide.relationshipId)).size).toBe(3)
    expect(result.changedParts).toContain('ppt/slides/slide3.xml')
  })

  it('blocks deletion with internal references and rolls back input atomically', async () => {
    const source = await fixture()
    await expect(mutateSlideStructure(source, {
      kind: 'slide-delete', slidePartUri: 'ppt/slides/slide2.xml', referencePolicy: 'block',
    })).rejects.toThrow(/referenced/i)
    expect((await inspectPresentationStructure(source)).slides).toHaveLength(2)
  })

  it('repairs internal hyperlinks and custom shows when deletion policy is repair', async () => {
    const result = await mutateSlideStructure(await fixture(), {
      kind: 'slide-delete', slidePartUri: 'ppt/slides/slide2.xml', referencePolicy: 'repair',
    })
    const zip = await JSZip.loadAsync(result.bytes)
    expect(await zip.file('ppt/_rels/presentation.xml.rels').async('text')).not.toContain('rId2')
    expect(await zip.file('ppt/presentation.xml').async('text')).not.toContain('r:id="rId2"')
    expect(await zip.file('ppt/slides/_rels/slide1.xml.rels').async('text')).not.toContain('rId9')
  })
})
