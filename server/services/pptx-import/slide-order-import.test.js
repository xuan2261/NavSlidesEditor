import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import { afterEach, describe, expect, it } from 'vitest'
import worker from './parse-worker.js'
import importer from './importer.js'
import nonnumeric from './nonnumeric-fixture.js'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

async function fixture(secondPart = 2) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-slide-order-'))
  roots.push(root)
  const deck = new PptxGenJS()
  for (const text of ['FIRST', 'SECOND']) {
    const slide = deck.addSlide()
    slide.addText(text, { x: 1, y: 1, w: 3, h: 1, fontFace: 'Arial', fontSize: 24 })
    slide.addNotes(`Notes ${text}`)
  }
  const zip = await JSZip.loadAsync(await deck.write({ outputType: 'nodebuffer' }))
  const presentation = await zip.file('ppt/presentation.xml').async('string')
  const ids = presentation.match(/<p:sldId\b[^>]*\/>/g)
  zip.file('ppt/presentation.xml', presentation.replace(ids.join(''), [...ids].reverse().join('')))
  for (let number = 1; number <= 2; number += 1) {
    const part = `ppt/slides/slide${number}.xml`
    const xml = await zip.file(part).async('string')
    zip.file(
      part,
      xml.replace(
        '</p:sld>',
        `<p:timing><p:animEffect filter="${number === 1 ? 'fade' : 'wipe'}"/></p:timing></p:sld>`
      )
    )
  }
  if (secondPart !== 2) {
    zip.file(
      `ppt/slides/slide${secondPart}.xml`,
      await zip.file('ppt/slides/slide2.xml').async('string')
    )
    zip.remove('ppt/slides/slide2.xml')
    zip.file(
      `ppt/slides/_rels/slide${secondPart}.xml.rels`,
      await zip.file('ppt/slides/_rels/slide2.xml.rels').async('string')
    )
    zip.remove('ppt/slides/_rels/slide2.xml.rels')
    for (const part of ['[Content_Types].xml', 'ppt/_rels/presentation.xml.rels']) {
      zip.file(
        part,
        (await zip.file(part).async('string')).replaceAll('slide2.xml', `slide${secondPart}.xml`)
      )
    }
  }
  const file = path.join(root, 'reordered.pptx')
  await fs.writeFile(file, await zip.generateAsync({ type: 'nodebuffer' }))
  return { root, file }
}

function slideText(slide) {
  return slide.elements.map((element) => element.content || element.text || '').join('').replaceAll('&nbsp;', ' ')
}

describe('presentation relationship slide order', () => {
  it('retains nonnumeric parts, source nodes, notes, timing and inherited markers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nonnumeric-import-'))
    roots.push(root)
    const data = await nonnumeric.createNonnumericFixture(root)
    const result = await importer.importPptxFile(data.file, { uploadsDir: path.join(root, 'uploads') })
    for (const [index, label] of ['SECOND', 'FIRST'].entries()) {
      const slide = result.presentation.slides[index]
      expect(slideText(slide)).toContain(label)
      expect(slideText(slide)).toContain(`LAYOUT ${label}`)
      expect(slideText(slide)).toContain('MASTER FOUNDATION')
      expect(slide.notes.replaceAll('&nbsp;', ' ')).toContain(`Notes ${label}`)
      expect(slide._pptxAnimations.fragmentHints).toContain(index === 0 ? 'slide' : 'fade')
      const element = slide.elements.find((entry) => (entry.content || entry.text || '').includes(label) && !(entry.content || entry.text || '').includes('LAYOUT'))
      const source = result.sourceMap.entries[`${slide.id}:${element.id}`]
      expect(source.partUri).toBe(data.parts[index])
      expect(source.nativeId).toBeDefined()
      expect(data.identities[index].shapeIds).toContain(String(source.nativeId))
    }
    expect(await fs.readFile(data.file)).toEqual(data.bytes)
  })
  it('returns parser slides and notes in the authored presentation order', async () => {
    const { file } = await fixture()
    const parsed = await worker.parseFile(file, 'reordered.pptx')
    expect(parsed.output.slides.map(slideText)).toEqual([
      expect.stringContaining('SECOND'),
      expect.stringContaining('FIRST'),
    ])
    expect(parsed.output.slides[0].note).toContain('Notes SECOND')
  })

  it.each([2, 9])(
    'keeps identities and timing bound to reordered slide1/slide%s parts',
    async (secondPart) => {
      const { root, file } = await fixture(secondPart)
      const result = await importer.importPptxFile(file, { uploadsDir: path.join(root, 'uploads') })
      expect(result.presentation.slides.map(slideText)).toEqual([
        expect.stringContaining('SECOND'),
        expect.stringContaining('FIRST'),
      ])
      expect(result.presentation.slides[0]._pptxAnimations.fragmentHints).toContain('slide')
      expect(result.presentation.slides[1]._pptxAnimations.fragmentHints).toContain('fade')
      for (const [index, slide] of result.presentation.slides.entries()) {
        const element = slide.elements.find((entry) =>
          (entry.content || entry.text || '').includes(index === 0 ? 'SECOND' : 'FIRST')
        )
        expect(result.sourceMap.entries[`${slide.id}:${element.id}`].partUri).toBe(
          `ppt/slides/slide${index === 0 ? secondPart : 1}.xml`
        )
      }
    }
  )
})
