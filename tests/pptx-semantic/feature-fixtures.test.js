import path from 'node:path'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { buildFeatureFixture, inspectFeatureFixture } from './feature-fixtures.js'

const namespaces = {
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  dgm: 'http://schemas.openxmlformats.org/drawingml/2006/diagram',
  m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
  s: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
}
const nodes = (doc, ns, tag) => Array.from(doc.getElementsByTagNameNS(namespaces[ns], tag))
async function xml(zip, name) {
  const errors = []
  const doc = new DOMParser({
    onError: (level, message) => errors.push(`${level}: ${message}`),
  }).parseFromString(await zip.file(name).async('string'), 'application/xml')
  expect(errors, name).toEqual([])
  return doc
}

describe('source-authored semantic PPTX feature fixtures', () => {
  it('builds repeatable ZIP bytes with a source-derived catalogue and no support claims', async () => {
    const first = await buildFeatureFixture()
    const second = await buildFeatureFixture()
    expect(Buffer.isBuffer(first.buffer)).toBe(true)
    expect(first.buffer.equals(second.buffer)).toBe(true)
    expect(first.catalogue).toEqual(await inspectFeatureFixture(first.buffer))
    expect(first.catalogue.sha256).toBe(createHash('sha256').update(first.buffer).digest('hex'))
    expect(first.catalogue.features.map((feature) => feature.id)).toEqual([
      'geometry', 'mixed-text', 'nested-group', 'rich-merged-table', 'chart-workbook',
      'diagram-51', 'omml', 'media-timing-links', 'excluded-metadata',
    ])
    expect(first.catalogue.features.every((feature) => feature.qualification === 'unverified')).toBe(true)
  })

  it('has resolvable internal OPC relationships, valid XML, and fixed ZIP dates', async () => {
    const { buffer } = await buildFeatureFixture()
    const zip = await JSZip.loadAsync(buffer)
    for (const entry of Object.values(zip.files).filter((entry) => !entry.dir)) {
      expect(entry.date.toISOString()).toBe('2000-01-01T00:00:00.000Z')
      if (entry.name.endsWith('.xml') || entry.name.endsWith('.rels')) await xml(zip, entry.name)
      if (!entry.name.endsWith('.rels')) continue
      const document = await xml(zip, entry.name)
      const owner = entry.name === '_rels/.rels' ? '' : entry.name.replace('/_rels/', '/').replace(/\.rels$/, '')
      for (const rel of nodes(document, 'rel', 'Relationship')) {
        if (rel.getAttribute('TargetMode') === 'External') continue
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(owner), rel.getAttribute('Target')))
        expect(zip.file(target), `${entry.name} -> ${target}`).not.toBeNull()
      }
    }
  })

  it('retains fractional negative coordinates, custom aspect, mixed sizes, and nested transforms', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    const presentation = await xml(zip, 'ppt/presentation.xml')
    expect(nodes(presentation, 'p', 'sldSz')[0].getAttribute('cx')).toBe('10972800')
    expect(nodes(presentation, 'p', 'sldSz')[0].getAttribute('cy')).toBe('6400800')
    const slide = await xml(zip, 'ppt/slides/slide1.xml')
    expect(nodes(slide, 'a', 'off').some((node) => node.getAttribute('x') === '-114300')).toBe(true)
    expect(nodes(slide, 'a', 'rPr').map((node) => node.getAttribute('sz'))).toEqual(expect.arrayContaining(['1200', '2400']))
    const groups = nodes(slide, 'p', 'grpSp')
    expect(groups).toHaveLength(2)
    expect(nodes(groups[0], 'a', 'xfrm')[0].getAttribute('rot')).toBe('1800000')
    expect(nodes(groups[1], 'a', 'xfrm')[0].getAttribute('flipH')).toBe('1')
    expect(nodes(groups[0], 'a', 'ext')[0].getAttribute('cx')).not.toBe(nodes(groups[0], 'a', 'chExt')[0].getAttribute('cx'))
  })

  it('contains a merged rich table and a native chart backed by literal worksheet cells', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    const slide = await xml(zip, 'ppt/slides/slide1.xml')
    const cells = nodes(slide, 'a', 'tc')
    expect(cells.some((cell) => cell.getAttribute('gridSpan') === '2')).toBe(true)
    expect(cells.some((cell) => cell.getAttribute('hMerge') === '1')).toBe(true)
    expect(nodes(cells[0], 'a', 'r')).toHaveLength(2)
    const workbook = await JSZip.loadAsync(await zip.file('ppt/embeddings/feature-data.xlsx').async('nodebuffer'))
    const sheet = await xml(workbook, 'xl/worksheets/sheet1.xml')
    expect(nodes(sheet, 's', 'c').map((cell) => [cell.getAttribute('r'), cell.textContent])).toEqual([
      ['A1', 'Category'], ['B1', 'Series'], ['A2', 'Alpha'], ['B2', '7'], ['A3', 'Beta'], ['B3', '11'],
    ])
    expect(nodes(sheet, 's', 'f')).toHaveLength(0)
    const chart = await xml(zip, 'ppt/charts/chart1.xml')
    expect(chart.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/chart', 'barChart').length).toBe(1)
    expect(chart.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/chart', 'externalData').length).toBe(1)
  })

  it('contains 51 connected diagram nodes plus layout, style, and color definitions', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    const data = await xml(zip, 'ppt/diagrams/data1.xml')
    const points = nodes(data, 'dgm', 'pt').filter((point) => point.getAttribute('type') === 'node')
    expect(points).toHaveLength(51)
    expect(new Set(points.map((point) => point.getAttribute('modelId'))).size).toBe(51)
    expect(nodes(data, 'dgm', 'cxn')).toHaveLength(51)
    expect(nodes(points[50], 'a', 't')[0].textContent).toBe('Node 51')
    expect(nodes(await xml(zip, 'ppt/diagrams/layout1.xml'), 'dgm', 'alg')[0].getAttribute('type')).toBe('lin')
    expect(nodes(await xml(zip, 'ppt/diagrams/quickStyle1.xml'), 'dgm', 'styleLbl').length).toBeGreaterThan(0)
    expect(nodes(await xml(zip, 'ppt/diagrams/colors1.xml'), 'dgm', 'styleLbl').length).toBeGreaterThan(0)
  })

  it('retains native OMML, timing targets, typed links, and excluded metadata without executable payloads', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    const slide = await xml(zip, 'ppt/slides/slide1.xml')
    expect(nodes(slide, 'm', 'f')).toHaveLength(1)
    expect(nodes(slide, 'm', 'mr')).toHaveLength(2)
    expect(nodes(slide, 'p', 'spTgt')[0].getAttribute('spid')).toBe('2')
    const rels = nodes(await xml(zip, 'ppt/slides/_rels/slide1.xml.rels'), 'rel', 'Relationship')
    expect(rels.find((rel) => rel.getAttribute('Id') === 'rIdLink').getAttribute('Type')).toMatch(/\/hyperlink$/)
    expect(rels.find((rel) => rel.getAttribute('Id') === 'rIdJump').getAttribute('Type')).toMatch(/\/slide$/)
    expect(rels.find((rel) => rel.getAttribute('Id') === 'rIdBlocked').getAttribute('TargetMode')).toBe('External')
    expect(nodes(slide, 'a', 'videoFile')[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'link')).toBe('rIdBlocked')
    const wav = await zip.file('ppt/media/feature.wav').async('nodebuffer')
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.readUInt32LE(40)).toBe(2)
    expect(nodes(slide, 'p', 'oleObj')[0].getAttribute('progId')).toBe('Excel.Sheet.12')
    expect(Object.keys(zip.files).some((name) => /vbaProject|oleObject.*\.bin/.test(name))).toBe(false)
    expect((await inspectFeatureFixture((await buildFeatureFixture()).buffer)).excluded).toEqual(['ole', '3d'])
  })

  it('rejects missing source parts rather than inventing feature coverage', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    zip.remove('ppt/diagrams/data1.xml')
    await expect(inspectFeatureFixture(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow('Missing source part: ppt/diagrams/data1.xml')
    await expect(inspectFeatureFixture(Buffer.from('not a ZIP'))).rejects.toThrow()
    const unknown = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    unknown.file('ppt/slides/slide1.xml', (await unknown.file('ppt/slides/slide1.xml').async('string')).replaceAll('m:f>', 'm:unknown>'))
    await expect(inspectFeatureFixture(await unknown.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow('Missing source feature: omml')
  })
})
