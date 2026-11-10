import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import os from 'node:os'
import mapper from './map-presentation.js'
import acceptance from '../acceptance-criteria.js'
import layers from './native-layout-layers.js'

const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const xfrm = '<a:xfrm><a:off x="152400" y="190500"/><a:ext cx="1270000" cy="571500"/></a:xfrm>'
const shape = (id, name, hidden = false) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"${hidden ? ' hidden="1"' : ''}/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm}<a:prstGeom prst="rect"/></p:spPr></p:sp>`
const raw = (name) => ({ type: 'shape', shapType: 'rect', name, left: 12, top: 15, width: 100, height: 45 })
function fixture(master = '') {
  const zip = new JSZip()
  zip.file('ppt/slides/slide1.xml', `<p:sld ${ns}><p:cSld><p:spTree/></p:cSld></p:sld>`)
  zip.file('ppt/slides/_rels/slide1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>')
  zip.file('ppt/slideLayouts/slideLayout1.xml', `<p:sldLayout ${ns}><p:cSld><p:spTree/></p:cSld></p:sldLayout>`)
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>')
  zip.file('ppt/slideMasters/slideMaster1.xml', `<p:sldMaster ${ns}><p:cSld><p:spTree>${master}</p:spTree></p:cSld></p:sldMaster>`)
  return zip
}
async function map(slide, zip) {
  return mapper.mapPptxOutput({ output: { size: { width: 960, height: 540 }, slides: [slide] }, zip, originalName: 'native-review.pptx', uploadsDir: os.tmpdir() })
}

describe('native inherited group and diagram isolation', () => {
  it('does not display a hidden child of a visible source master group', async () => {
    const groupXml = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="3" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm}</p:grpSpPr>${shape(4, 'Visible')}${shape(5, 'Hidden', true)}</p:grpSp>`
    const group = { ...raw('Group'), type: 'group', elements: [raw('Visible'), raw('Hidden')] }
    const result = await map({ layoutElements: [group], elements: [] }, fixture(groupXml))
    expect(result.presentation.slides[0].elements.map((element) => element.name)).toEqual(['Visible'])
  })

  it('keeps pre-stamped inherited SmartArt out of foreground font validation', async () => {
    const diagram = { ...raw('Native diagram'), type: 'diagram', elements: [{ ...raw('Box'), content: '<p><span style="font-size:11pt">Footer</span></p>' }] }
    const foreground = { type: 'text', name: 'Title', fontSz: 24, left: 0, top: 100, width: 200, height: 50, content: '<p><span style="font-size:24pt">Foreground</span></p>' }
    const result = await map({ layoutElements: [diagram], elements: [foreground] }, fixture())
    const [background, title] = result.presentation.slides[0].elements
    expect(background._pptxSource).toMatchObject({ nodeId: expect.stringMatching(/^layout:/), authoritative: false })
    expect(title).toMatchObject({ name: 'Title', fontSize: 24 })
    expect(() => acceptance.assertSourceFontSizesWithinTolerance({ slides: [{ elements: [foreground] }] }, result.presentation)).not.toThrow()
  })
})

const groupSource = (id, name, children, hidden = false) => `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"${hidden ? ' hidden="1"' : ''}/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm}</p:grpSpPr>${children}</p:grpSp>`
const rawGroup = (name, elements) => ({ ...raw(name), type: 'group', elements })
const decoration = (id, name, hidden = false) => shape(id, name, hidden).replace('</p:spPr>', '<a:solidFill><a:srgbClr val="123456"/></a:solidFill></p:spPr>')

describe('exact native descendant identity and mapper provenance', () => {
  it('resolves nested children only within their actual source group', async () => {
    const xml = groupSource(3, 'Outer', groupSource(4, 'Visible group', shape(5, 'Same &amp; name')) +
      groupSource(6, 'Other group', shape(7, 'Same &amp; name', true)))
    const group = rawGroup('Outer', [rawGroup('Visible group', [raw('Same & name')]), rawGroup('Other group', [raw('Same & name')])])
    const result = await map({ layoutElements: [group], elements: [] }, fixture(xml))
    expect(result.presentation.slides[0].elements).toHaveLength(1)
    expect(result.presentation.slides[0].elements[0]).toMatchObject({
      name: 'Same & name', x: 36, y: 45, width: 100, height: 45,
      _pptxSource: { nodeId: 'master:ppt/slideMasters/slideMaster1.xml:5', kind: 'shape', slideIndex: 0, authoritative: false },
    })
    expect(group.elements[1].elements).toHaveLength(1)
  })

  it('suppresses an exactly hidden nested group without suppressing its visible sibling', async () => {
    const xml = groupSource(3, 'Outer', shape(4, 'Visible') + groupSource(5, 'Hidden group', shape(6, 'Hidden descendant'), true))
    const group = rawGroup('Outer', [raw('Visible'), rawGroup('Hidden group', [raw('Hidden descendant')])])
    const result = await map({ layoutElements: [group], elements: [] }, fixture(xml))
    expect(result.presentation.slides[0].elements.map((element) => element.name)).toEqual(['Visible'])
    expect(result.presentation.slides[0].elements[0]._pptxSource.nodeId).toBe('master:ppt/slideMasters/slideMaster1.xml:4')
  })

  it.each([false, true])('does not guess hidden identity among ambiguous same-name siblings (duplicateSource=%s)', async (duplicateSource) => {
    const xml = groupSource(3, 'Group', (duplicateSource ? shape(4, 'Ambiguous') : '') + shape(5, 'Ambiguous', true))
    const group = rawGroup('Group', [raw('Ambiguous'), raw('Ambiguous')])
    const result = await map({ layoutElements: [group], elements: [] }, fixture(xml))
    const elements = result.presentation.slides[0].elements
    expect(elements.map((element) => element.name)).toEqual(['Ambiguous', 'Ambiguous'])
    expect(elements.map((element) => element._pptxSource.nodeId)).toEqual([
      'master:ppt/slideMasters/slideMaster1.xml:3/unmatched-0',
      'master:ppt/slideMasters/slideMaster1.xml:3/unmatched-1',
    ])
  })

  it.each([false, true])('keeps an ambiguous hidden-name sibling after an explicit ID match (reversed=%s)', async (reversed) => {
    const xml = groupSource(3, 'Group', shape(4, 'Shared') + shape(5, 'Shared', true))
    const children = [{ ...raw('Explicit'), sourceId: '4', content: '<p>Known</p>' },
      { ...raw('Shared'), content: '<p>Keep</p>' }]
    if (reversed) children.reverse()
    const result = await map({ layoutElements: [rawGroup('Group', children)], elements: [] }, fixture(xml))
    const elements = result.presentation.slides[0].elements
    expect(elements.map((element) => element.text)).toEqual(reversed ? ['Keep', 'Known'] : ['Known', 'Keep'])
    expect(elements.find((element) => element.text === 'Keep')._pptxSource.nodeId).toBe(
      `master:ppt/slideMasters/slideMaster1.xml:3/unmatched-${reversed ? 0 : 1}`)
  })

  it('keeps matched and ambiguous native group children together below later layout paints', async () => {
    const zip = fixture()
    const xml = groupSource(3, 'Group', shape(4, 'Known') + shape(5, 'Shared') + shape(6, 'Shared')) +
      shape(7, 'Later') + decoration(8, 'XML only')
    zip.file('ppt/slideLayouts/slideLayout1.xml', `<p:sldLayout ${ns}><p:cSld><p:spTree>${xml}</p:spTree></p:cSld></p:sldLayout>`)
    const group = rawGroup('Group', [{ ...raw('Known'), sourceId: '4' }, raw('Shared'), raw('Shared')])
    const result = await map({ layoutElements: [group, raw('Later')], elements: [] }, zip)
    expect(result.presentation.slides[0].elements.map((element) => element._pptxSource.nodeId)).toEqual(
      ['4', '3/unmatched-1', '3/unmatched-2', '7', '8'].map((id) => `layout:ppt/slideLayouts/slideLayout1.xml:${id}`))
    expect(result.presentation.slides[0].elements.map((element) => element.zIndex)).toEqual([1, 2, 3, 4, 5])
  })

  it('uses explicit child IDs before ambiguous names or group-local geometry', async () => {
    const xml = groupSource(3, 'Group', shape(4, 'Same') + shape(5, 'Same', true))
    const group = rawGroup('Group', [{ ...raw('Same'), sourceId: '5', left: 1 }, { ...raw('Same'), sourceId: '4', left: 2 }])
    const result = await map({ layoutElements: [group], elements: [] }, fixture(xml))
    expect(result.presentation.slides[0].elements).toHaveLength(1)
    expect(result.presentation.slides[0].elements[0]).toMatchObject({ x: 14,
      _pptxSource: { nodeId: 'master:ppt/slideMasters/slideMaster1.xml:4' } })
  })

  it('preserves unmatched parser children, source provenance and styles without name fallback for a conflicting ID', async () => {
    const xml = groupSource(3, 'Group', shape(4, 'Hidden', true))
    const child = { ...raw('Hidden'), content: '<p style="font-family:Verdana">Keep</p>', fontFace: 'Verdana',
      _pptxSource: { nodeId: 'unresolved', kind: 'shape', matchedBy: 'parser', authoritative: false } }
    const group = rawGroup('Group', [child])
    const merged = await layers.mergeNativeLayoutLayers({ slide: { layoutElements: [group], elements: [] }, zip: fixture(xml), slideIndex: 0 })
    expect(merged.slide.elements[0].elements[0]).toMatchObject(child)
    expect(merged.slide.elements[0].elements[0]._pptxNativeSource.nodeId).toBe('3/unmatched-0')
    expect(child).not.toHaveProperty('_pptxNativeSource')
  })

  it.each([false, true])('does not let XML fallback reinsert hidden layout descendants (ancestorHidden=%s)', async (ancestorHidden) => {
    const zip = fixture()
    const xml = groupSource(3, 'Group', decoration(4, 'Hidden', true) + decoration(5, 'Child'), ancestorHidden)
    zip.file('ppt/slideLayouts/slideLayout1.xml', `<p:sldLayout ${ns}><p:cSld><p:spTree>${xml}</p:spTree></p:cSld></p:sldLayout>`)
    const result = await map({ layoutElements: [], elements: [] }, zip)
    expect(result.presentation.slides[0].elements.map((element) => element._pptxSource.nodeId)).toEqual(
      ancestorHidden ? [] : ['layout:ppt/slideLayouts/slideLayout1.xml:5'])
  })

  it('preserves diagram mapper metadata while native identity cannot consume foreground scene IDs', async () => {
    const diagram = { ...raw('Native diagram'), type: 'diagram', sourceId: '5',
      elements: [{ ...raw('Box'), content: '<p><span style="font-size:11pt">Footer</span></p>' }] }
    const foreground = { type: 'text', name: 'Title', fontSz: 24, left: 0, top: 100, width: 200, height: 50,
      content: '<p><span style="font-size:24pt">Foreground</span></p>' }
    const result = await mapper.mapPptxOutput({ output: { size: { width: 960, height: 540 }, slides: [{ layoutElements: [diagram], elements: [foreground] }] },
      zip: fixture(), originalName: 'native-review.pptx', uploadsDir: os.tmpdir(),
      sceneGraph: { slides: [{ index: 0, nodes: [{ id: '5', kind: 'shape', name: 'Title', xfrm: { x: 0, y: 100, cx: 200, cy: 50 } }] }] } })
    const [background, title] = result.presentation.slides[0].elements
    expect(background).toMatchObject({ x: 24, y: 30, width: 100, height: 45, text: 'Footer', fontSize: 11,
      _pptxSource: { nodeId: 'layout:unknown:unmatched-0', kind: 'diagram', slideIndex: 0, authoritative: false,
        graphicKind: 'diagram', matchedBy: 'parser-fallback',
        mapperSource: { nodeId: '5', kind: 'graphicFrame', graphicKind: 'diagram', slideIndex: 0, matchedBy: 'parser-fallback', authoritative: false } },
      _pptxDiagram: { source: 'parser-flatten', graphicNodeId: '5', nodes: [{ text: 'Footer' }] } })
    expect(title._pptxSource).toMatchObject({ nodeId: '5', authoritative: true })
    expect(() => acceptance.assertSourceFontSizesWithinTolerance({ slides: [{ elements: [foreground] }] }, result.presentation)).not.toThrow()
  })

  it.each([false, true])('isolates an inherited diagram model ID from foreground diagram injection (strict=%s)', async (strict) => {
    const zip = fixture()
    zip.file('ppt/diagrams/foreground.xml', '<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst><dgm:pt modelId="foreground" type="node"><dgm:t><a:p><a:r><a:t>Foreground diagram</a:t></a:r></a:p></dgm:t></dgm:pt></dgm:ptLst></dgm:dataModel>')
    const diagram = { ...raw('Inherited diagram'), type: 'diagram', sourceId: '5', elements: [{ ...raw('Box'), content: '<p>Inherited footer</p>' }] }
    const mapping = mapper.mapPptxOutput({ output: { size: { width: 960, height: 540 }, slides: [{ layoutElements: [diagram], elements: [] }] },
      zip, originalName: 'native-collision.pptx', uploadsDir: os.tmpdir(), strict,
      sceneGraph: { slides: [{ index: 0, nodes: [{ id: '5', kind: 'graphicFrame', graphicKind: 'diagram',
        xfrm: { x: 0, y: 100, cx: 200, cy: 50 }, rels: { diagramTarget: 'ppt/diagrams/foreground.xml' } }] }] } })
    if (strict) {
      await expect(mapping).rejects.toMatchObject({ code: 'smartart-layout-unsupported-strict', details: { nodeId: '5' } })
      return
    }
    const result = await mapping
    const [background, foreground] = result.presentation.slides[0].elements
    expect(background).toMatchObject({ text: 'Inherited footer',
      _pptxSource: { nodeId: 'layout:unknown:unmatched-0', authoritative: false },
      _pptxDiagram: { graphicNodeId: '5', source: 'parser-flatten' } })
    expect(foreground).toMatchObject({ text: 'Foreground diagram', zIndex: 2,
      _pptxSource: { nodeId: '5', graphicKind: 'diagram', authoritative: true } })
  })

  it('does not let an inherited chart sharing a data target claim the foreground frame', async () => {
    const zip = fixture()
    const chartPath = 'ppt/charts/shared.xml'
    zip.file(chartPath, '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:tx><c:v>Shared</c:v></c:tx><c:cat><c:strCache><c:pt idx="0"><c:v>A</c:v></c:pt></c:strCache></c:cat><c:val><c:numCache><c:pt idx="0"><c:v>1</c:v></c:pt></c:numCache></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>')
    const chart = { ...raw('Inherited chart'), type: 'chart', chartType: 'barChart',
      data: [{ key: 'Shared', values: [{ x: 'A', y: 1 }] }], _pptxChartMeta: { chartPath } }
    const result = await mapper.mapPptxOutput({ output: { size: { width: 960, height: 540 }, slides: [{ layoutElements: [chart], elements: [] }] },
      zip, originalName: 'native-chart-collision.pptx', uploadsDir: os.tmpdir(),
      sceneGraph: { slides: [{ index: 0, nodes: [{ id: '5', kind: 'graphicFrame', graphicKind: 'chart',
        xfrm: { x: 0, y: 100, cx: 200, cy: 50 }, rels: { chartTarget: chartPath } }] }] } })
    const [background, foreground] = result.presentation.slides[0].elements
    expect(result.presentation.slides[0].elements).toHaveLength(2)
    expect(background).toMatchObject({ name: 'Inherited chart', zIndex: 1,
      _pptxSource: { nodeId: 'layout:unknown:unmatched-0', authoritative: false }, _pptxChartMeta: { chartPath } })
    expect(foreground).toMatchObject({ zIndex: 2, _pptxSource: { nodeId: '5', graphicKind: 'chart', authoritative: true },
      chartData: { labels: ['A'], datasets: [{ data: [1] }] } })
  })
})
