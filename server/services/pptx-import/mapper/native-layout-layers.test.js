import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import layers from './native-layout-layers.js'
import mapper from './map-presentation.js'
import dedup from '../media-dedup.js'

const { mergeNativeLayoutLayers } = layers
const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const rel = (id, kind, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}" Target="${target}"/>`
const xfrm = (x = 12, y = 15, width = 100, height = 45) => `<a:xfrm><a:off x="${x * 12700}" y="${y * 12700}"/><a:ext cx="${width * 12700}" cy="${height * 12700}"/></a:xfrm>`
const shape = (id, name, { hidden = false, geometry = xfrm(), fill = '123456' } = {}) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"${hidden ? ' hidden="1"' : ''}/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${geometry}<a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></p:spPr></p:sp>`
const rawShape = (name, order, fill = '#123456') => ({ type: 'shape', shapType: 'rect', name, order, left: 12, top: 15, width: 100, height: 45, fill: { type: 'color', value: fill } })

function packageZip({ slideFlags = '', layoutFlags = '', layout = shape(2, 'Layout'), master = shape(3, 'Master'), slidePath = 'ppt/slides/slide9.xml' } = {}) {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation ${ns}><p:sldIdLst><p:sldId id="256" r:id="rId9"/></p:sldIdLst></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships>${rel('rId2', 'slide', 'slides/slide2.xml')}${rel('rId9', 'slide', slidePath.slice(4))}</Relationships>`)
  zip.file(slidePath, `<p:sld ${ns} ${slideFlags}><p:cSld><p:spTree/></p:cSld></p:sld>`)
  zip.file(slidePath.replace('/slide9.xml', '/_rels/slide9.xml.rels'), `<Relationships>${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout4.xml')}</Relationships>`)
  zip.file('ppt/slideLayouts/slideLayout4.xml', `<p:sldLayout ${ns} ${layoutFlags}><p:cSld><p:spTree>${layout}</p:spTree></p:cSld></p:sldLayout>`)
  zip.file('ppt/slideLayouts/_rels/slideLayout4.xml.rels', `<Relationships>${rel('rId1', 'slideMaster', '../slideMasters/slideMaster2.xml')}</Relationships>`)
  zip.file('ppt/slideMasters/slideMaster2.xml', `<p:sldMaster ${ns}><p:cSld><p:spTree>${master}</p:spTree></p:cSld></p:sldMaster>`)
  return zip
}

async function map(slide, zip, options = {}) {
  return mapper.mapPptxOutput({ output: { size: { width: 960, height: 540 }, slides: [slide] }, zip, originalName: 'Layers.pptx', uploadsDir: os.tmpdir(), ...options })
}

const slideWithLayers = () => ({ layoutElements: [rawShape('Master', 40, '#654321'), rawShape('Layout', 20)], elements: [{ type: 'text', name: 'Title', order: -100, left: 0, top: 100, width: 200, height: 50, content: '<p>Foreground</p>' }] })

describe('native parser master and layout layers', () => {
  it.each(['showMasterSp="0"', 'showMasterSp="false"'])('suppresses source master only for slide %s', async (slideFlags) => {
    const result = await mergeNativeLayoutLayers({ slide: slideWithLayers(), zip: packageZip({ slideFlags }), slideIndex: 0 })
    expect(result.slide.elements.map((element) => element.name)).toEqual(['Layout', 'Title'])
    expect(result.slide.elements[0]._pptxNativePartUri).toBe('ppt/slideLayouts/slideLayout4.xml')
    expect(result.slidePath).toBe('ppt/slides/slide9.xml')
  })

  it('honors layout master suppression and native shape hidden flags without hiding layout decoration', async () => {
    const slide = { ...slideWithLayers(), layoutElements: [...slideWithLayers().layoutElements, rawShape('Hidden', 25)] }
    const zip = packageZip({ layoutFlags: 'showMasterSp="false"', layout: shape(2, 'Layout') + shape(4, 'Hidden', { hidden: true }) })
    const result = await mergeNativeLayoutLayers({ slide, zip, slideIndex: 0 })
    expect(result.slide.elements.map((element) => element.name)).toEqual(['Layout', 'Title'])
    const mapped = await map(slide, zip)
    expect(mapped.presentation.slides[0].elements.map((element) => element.name)).toEqual(['Layout', 'Title'])
  })

  it('maps master behind layout behind foreground despite colliding parser orders and geometry', async () => {
    const slide = slideWithLayers()
    slide.layoutElements.forEach((element) => { element.order = -100 })
    const result = await map(slide, packageZip())
    const elements = result.presentation.slides[0].elements
    expect(elements.map((element) => [element.name, element.zIndex])).toEqual([['Master', 1], ['Layout', 2], ['Title', 3]])
    expect(elements.filter((element) => element.type === 'shape')).toHaveLength(2)
    expect(new Set(elements.map((element) => element.id)).size).toBe(3)
    expect(JSON.stringify(elements)).not.toContain('_pptxNativePartUri')
    expect(JSON.stringify(elements)).not.toContain('_pptxNativeLayer')
    expect(JSON.stringify(elements)).not.toContain('_pptxNativeSource')
    expect(result.stats.layoutDecorationInjected).toBe(0)
    expect(elements[0]._pptxSource).toMatchObject({ nodeId: 'master:ppt/slideMasters/slideMaster2.xml:3', authoritative: false })
    expect(elements[1]._pptxSource).toMatchObject({ nodeId: 'layout:ppt/slideLayouts/slideLayout4.xml:2', authoritative: false })
  })

  it('distinguishes identical names and geometry by native relationship layer and raw source order', async () => {
    const layout = rawShape('Same & name', 20, '#112233')
    const master = rawShape('Same & name', 40, '#445566')
    const result = await mergeNativeLayoutLayers({ slide: { layoutElements: [master, layout], elements: [] }, zip: packageZip({ slideFlags: 'showMasterSp="0"', layout: shape(2, 'Same &amp; name'), master: shape(3, 'Same &amp; name') }), slideIndex: 0 })
    expect(result.slide.elements).toHaveLength(1)
    expect(result.slide.elements[0].fill.value).toBe('#112233')
    expect(result.nativeDecorationNodeIds).toEqual(new Set(['2']))
    expect(master).not.toHaveProperty('_pptxNativePartUri')
  })

  it('retains original parser geometry and normal source-size normalization', async () => {
    const native = { ...rawShape('Master', 40), id: 'raw-id', left: 13.125, top: 15.5 }
    const zip = packageZip({ layout: '', master: shape(3, 'Master', { geometry: xfrm(13.125, 15.5) }) })
    const merged = await mergeNativeLayoutLayers({ slide: { layoutElements: [native], elements: [] }, zip, slideIndex: 0 })
    expect(merged.slide.elements[0]).toMatchObject(native)
    const result = await map({ layoutElements: [native], elements: [] }, zip, { output: { size: { width: 720, height: 540 }, slides: [{ layoutElements: [native], elements: [] }] } })
    expect(result.presentation.slides[0].elements[0]).toMatchObject({ x: 13, y: 16, width: 100, height: 45 })
    expect(result.presentation.resolution).toEqual({ width: 720, height: 540 })
  })

  it('does not duplicate an existing same-source fallback or discard separate overlapping layers', async () => {
    const slide = slideWithLayers()
    slide.elements.unshift({ ...rawShape('Fallback', 0), _pptxSource: { fromLayoutDecoration: true, nodeId: 'layout:ppt/slideLayouts/slideLayout4.xml:2' } })
    const merged = await mergeNativeLayoutLayers({ slide, zip: packageZip(), slideIndex: 0 })
    expect(merged.slide.elements.map((element) => element.name)).toEqual(['Layout', 'Master', 'Title'])
  })

  it('places OOXML-only layout fallback above native master and below slide foreground', async () => {
    const slide = slideWithLayers()
    slide.layoutElements = [slide.layoutElements[0]]
    const result = await map(slide, packageZip())
    const elements = result.presentation.slides[0].elements
    expect(elements.map((element) => element.zIndex)).toEqual([1, 2, 3])
    expect(elements[0].name).toBe('Master')
    expect(elements[1]._pptxSource).toMatchObject({ fromLayoutDecoration: true })
    expect(elements[2].name).toBe('Title')
  })

  it('keeps partial native layout and OOXML fallback in original source node order', async () => {
    const slide = slideWithLayers()
    const zip = packageZip({ layout: shape(2, 'Layout') + shape(4, 'Later', { geometry: xfrm(200, 15) }) })
    const result = await map(slide, zip)
    const elements = result.presentation.slides[0].elements
    expect(elements.map((element) => element.name || element._pptxSource?.nodeId)).toEqual([
      'Master', 'Layout', 'layout:ppt/slideLayouts/slideLayout4.xml:4', 'Title',
    ])
    expect(elements.map((element) => element.zIndex)).toEqual([1, 2, 3, 4])
  })

  it.each([false, true])('does not let native footer text suppress existing placeholders (graph=%s)', async (useGraph) => {
    const footer = { ...rawShape('Master', 40), content: '<p>Native footer</p>' }
    const placeholder = shape(2, 'Title placeholder').replace('<p:nvPr/>', '<p:nvPr><p:ph type="title"/></p:nvPr>')
    const zip = packageZip({ layout: placeholder })
    const sceneGraph = useGraph ? { slides: [{ index: 0, nodes: [{ id: '2', kind: 'shape', ph: { type: 'title' }, xfrm: { x: 12, y: 15, cx: 100, cy: 45 } }] }] } : null
    const result = await map({ layoutElements: [footer], elements: [] }, zip, { sceneGraph })
    expect(result.stats.layoutPlaceholderInjected).toBe(1)
    expect(result.presentation.slides[0].elements[0].name).toBe('Master')
    expect(result.presentation.slides[0].elements[1].content).toBe('<p>Click to edit title</p>')
    expect(result.presentation.slides[0].elements.map((element) => element.zIndex)).toEqual([1, 2])
  })

  it('preserves unmapped parser payloads when exact source identity is unavailable', async () => {
    const slide = { layoutElements: [rawShape('Unknown', 1)], elements: [] }
    const result = await mergeNativeLayoutLayers({ slide, zip: packageZip({ slideFlags: 'showMasterSp="0"' }), slideIndex: 0 })
    expect(result.slide.elements[0].name).toBe('Unknown')
    expect(result.slide.elements[0]).not.toHaveProperty('_pptxNativePartUri')
  })

  it.each(['master', 'layout'])('maps native %s grouped picture fills through the existing media transaction and rollback', async (nativeLayer) => {
    const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'native-layers-media-'))
    const mediaTransaction = dedup.createMediaTransaction({ hashScope: {} })
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAOxAAADsQBlSsOGwAAACBJREFUGFdjvHv3LgM2wPj//3+sEkxYRYGCOCUY6WAHAOOrCzUpUPznAAAAAElFTkSuQmCC', 'base64')
    const child = { ...rawShape('Picture fill', 1), left: 2, top: 3, width: 20, height: 10, fill: { type: 'image', value: { ref: 'ppt/media/picture.png' } } }
    const group = { type: 'group', order: 40, left: 12, top: 15, width: 100, height: 45, elements: [child] }
    const sourceGroup = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="3" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm()}</p:grpSpPr>${shape(4, 'Picture fill')}</p:grpSp>`
    const zip = packageZip({ layout: '', master: '', [nativeLayer]: sourceGroup })
    zip.file('ppt/media/picture.png', png)
    try {
      const result = await map({ layoutElements: [group], elements: [] }, zip, { uploadsDir, mediaTransaction })
      const image = result.presentation.slides[0].elements[0]
      expect(image).toMatchObject({ type: 'image', x: 14, y: 18, width: 20, height: 10, objectFit: 'fill', src: expect.stringMatching(/^\/uploads\/.+\.png$/) })
      expect(await fs.readFile(path.join(uploadsDir, path.basename(image.src)))).toEqual(png)
      expect(result.stats.imageCount).toBe(1)
      expect(JSON.stringify(image)).not.toContain('_pptxNativePartUri')
      expect(image._pptxSource.nodeId).toMatch(new RegExp(`^${nativeLayer}:ppt/slide`))
      expect(image._pptxSource).toMatchObject({ nodeId: `${nativeLayer}:ppt/slide${nativeLayer === 'master' ? 'Masters/slideMaster2' : 'Layouts/slideLayout4'}.xml:4`, kind: 'shape', authoritative: false })
      expect(result.stats.layoutDecorationInjected).toBe(0)
      await mediaTransaction.rollback()
      expect(await fs.readdir(uploadsDir)).toEqual([])
    } finally {
      await mediaTransaction.rollback()
      await fs.rm(uploadsDir, { recursive: true, force: true })
    }
  })

  it('keeps native image admission fail-closed under the existing media budget', async () => {
    const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'native-layers-denied-'))
    const mediaTransaction = dedup.createMediaTransaction({ hashScope: {} })
    const image = { ...rawShape('Layout', 20), fill: { type: 'image', value: { base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' } } }
    try {
      const result = await map({ layoutElements: [image], elements: [] }, packageZip(), { uploadsDir, mediaTransaction, mediaBudget: { tryReserve: () => false } })
      expect(result.presentation.slides[0].elements[0]).toMatchObject({ importPlaceholderType: 'media-missing' })
      expect(result.presentation.slides[0].elements[0]).not.toHaveProperty('src')
      expect(await fs.readdir(uploadsDir)).toEqual([])
    } finally {
      await mediaTransaction.rollback()
      await fs.rm(uploadsDir, { recursive: true, force: true })
    }
  })
})
