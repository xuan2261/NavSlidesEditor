import crypto from 'node:crypto'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import sourceMapModule from './source-map.js'

const {
  SOURCE_MAP_VERSION, assertPatchableSource, buildImportSourceMap, createSourceMap, createSourceRef,
  rebindSourceMap,
} =
  sourceMapModule

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')

describe('server-only source map', () => {
  it('retains stable native identity and group ancestry', () => {
    const ref = createSourceRef({
      packageGeneration: 1,
      revisionId: 'r0',
      partUri: 'ppt/slides/slide1.xml',
      kind: 'shape',
      nativeId: '7',
      relationshipChain: ['rId2'],
      groupAncestry: ['3', '5'],
      occurrencePath: [0],
      sourceHash: hash('<a:t>Before</a:t>'),
      status: 'authoritative',
      matchMethod: 'native-id',
      confidence: 1,
    })
    expect(ref).toMatchObject({ schemaVersion: SOURCE_MAP_VERSION, nativeId: '7' })
    expect(createSourceMap({ presentationId: 'p1', revisionId: 'r0', entries: { e1: ref } }))
      .toMatchObject({ schemaVersion: SOURCE_MAP_VERSION })
  })

  it('retains an explicit package generation for empty source maps', async () => {
    const map = createSourceMap({
      presentationId: 'empty-deck', revisionId: 'r0', packageGeneration: 7, entries: {},
    })
    expect(map.packageGeneration).toBe(7)

    const built = await buildImportSourceMap({
      id: 'empty-deck', slides: [{ id: 's1', elements: [] }],
    }, null, null, { packageGeneration: 7, revisionId: 'r0' })
    expect(built).toMatchObject({ packageGeneration: 7, entries: {} })

    const rebound = rebindSourceMap({ entries: {} }, {
      presentationId: 'empty-deck', revisionId: 'r1', packageGeneration: 8,
    })
    expect(rebound).toMatchObject({
      presentationId: 'empty-deck', revisionId: 'r1', packageGeneration: 8, entries: {},
    })
  })

  it('rejects duplicate authoritative native aliases before and after rebind', () => {
    const ref = {
      packageGeneration: 1, revisionId: 'r0', partUri: 'ppt/slides/slide1.xml', kind: 'text-run', nativeId: '7',
      relationshipChain: ['_rels/.rels'], groupAncestry: [], occurrencePath: [0], sourceHash: hash('source'),
      status: 'authoritative', matchMethod: 'native-id', confidence: 1,
    }
    expect(() => createSourceMap({ presentationId: 'deck', revisionId: 'r0', entries: { 's1:e1': ref, 's2:e2': { ...ref, occurrencePath: [1] } } }))
      .toThrow(/duplicate authoritative source identity/i)
    const map = createSourceMap({ presentationId: 'deck', revisionId: 'r0', entries: { 's1:e1': ref } })
    const rebound = rebindSourceMap(map, { presentationId: 'deck', revisionId: 'r1', packageGeneration: 2 })
    expect(rebound.entries['s1:e1']).toMatchObject({ revisionId: 'r1', packageGeneration: 2, nativeId: '7' })
  })

  it('rejects an empty relationship-chain member [cap:import.pptx]', () => {
    expect(() => createSourceRef({
      packageGeneration: 1, revisionId: 'r0', partUri: 'ppt/slides/slide1.xml', kind: 'text-run', nativeId: '7',
      relationshipChain: [''], groupAncestry: [], occurrencePath: [0], sourceHash: hash('source'),
      status: 'authoritative', matchMethod: 'native-id', confidence: 1,
    })).toThrow(/source path/i)
  })

  it('rejects relationship array holes and accessors without getter execution [cap:import.pptx]', () => {
    const chain = ['ppt/_rels/presentation.xml.rels']
    Object.defineProperty(chain, '0', { get() { throw new Error('getter executed') } })
    expect(() => createSourceRef({ packageGeneration: 1, revisionId: 'r0', partUri: 'ppt/slides/slide1.xml', kind: 'text-run', nativeId: '7', relationshipChain: chain, groupAncestry: [], occurrencePath: [0], sourceHash: hash('source'), status: 'authoritative', matchMethod: 'native-id', confidence: 1 })).toThrow(/source path/i)
  })

  it.each(['diagnostic', 'ambiguous', 'missing'])('blocks %s identity from patching', (status) => {
    expect(() => assertPatchableSource({ status })).toThrow(/not authoritative/i)
  })

  it('blocks source hash drift and accepts exact source bytes', () => {
    const ref = { status: 'authoritative', sourceHash: hash('before') }
    expect(() => assertPatchableSource(ref, Buffer.from('after'))).toThrow(/hash/i)
    expect(assertPatchableSource(ref, Buffer.from('before'))).toBe(ref)
  })

  it('rebinds imported references without promoting non-authoritative sources', () => {
    const sourceMap = rebindSourceMap({
      entries: {
        authoritative: {
          packageGeneration: 9,
          revisionId: 'parser-revision',
          partUri: 'ppt/slides/slide1.xml',
          kind: 'shape',
          nativeId: '7',
          relationshipChain: ['_rels/.rels', 'ppt/_rels/presentation.xml.rels'],
          groupAncestry: [],
          occurrencePath: [0],
          sourceHash: hash('authoritative'),
          status: 'authoritative',
          matchMethod: 'native-id',
          confidence: 1,
        },
        ambiguous: {
          packageGeneration: 9,
          revisionId: 'parser-revision',
          partUri: 'ppt/slides/slide1.xml',
          kind: 'shape',
          relationshipChain: ['_rels/.rels', 'ppt/_rels/presentation.xml.rels'],
          groupAncestry: [],
          occurrencePath: [1],
          sourceHash: hash('ambiguous'),
          status: 'ambiguous',
        },
      },
    }, {
      presentationId: 'p1',
      revisionId: 'r0-committed',
      packageGeneration: 1,
    })

    expect(sourceMap).toMatchObject({
      presentationId: 'p1',
      revisionId: 'r0-committed',
      entries: {
        authoritative: {
          status: 'authoritative', packageGeneration: 1, revisionId: 'r0-committed',
        },
        ambiguous: {
          status: 'ambiguous', packageGeneration: 1, revisionId: 'r0-committed',
        },
      },
    })
    expect(() => assertPatchableSource(sourceMap.entries.ambiguous)).toThrow(/not authoritative/i)
  })

  it('rejects duplicate vertical slide and composite element identities [cap:import.pptx]', async () => {
    await expect(buildImportSourceMap({ id: 'deck', slides: [{ id: 's1', elements: [], children: [{ id: 's1', elements: [] }] }] }, null, null)).rejects.toThrow(/slide identity/i)
    await expect(buildImportSourceMap({ id: 'deck', slides: [{ id: 's1', elements: [{ id: 'e1' }, { id: 'e1' }] }] }, null, null)).rejects.toThrow(/element identity/i)
  })

  it('derives server-only source identity from mapped elements and the OOXML scene graph', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p"/>')
    const map = await buildImportSourceMap({
      id: 'deck',
      slides: [{
        id: 'slide-1',
        elements: [{
          id: 'shape-1',
          type: 'shape',
          _pptxSource: { nodeId: '7', kind: 'shape', slideIndex: 0, authoritative: true },
        }, {
          id: 'fallback',
          type: 'shape',
        }],
      }],
    }, {
      slides: [{
        index: 0,
        path: 'ppt/slides/slide1.xml',
        nodes: [{ id: '7', kind: 'shape', parentId: null, sourceXml: '<p:sp id="7"/>' }],
      }],
    }, zip)

    expect(map.entries['slide-1:shape-1']).toMatchObject({
      status: 'missing', partUri: 'ppt/slides/slide1.xml',
    })
    expect(map.entries['slide-1:fallback']).toMatchObject({ status: 'missing' })
  })

  it('creates an authoritative ordinary-shape ref only from exact native OOXML and relationships', async () => {
    const zip = new JSZip()
    const shape = '<p:sp><p:nvSpPr><p:cNvPr id="8" name="Box"/></p:nvSpPr><p:spPr><a:solidFill><a:srgbClr val="112233"/></a:solidFill></p:spPr></p:sp>'
    zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="p" xmlns:a="a">${shape}</p:sld>`)
    zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
    zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
    const map = await buildImportSourceMap({ id: 'deck', slides: [{ id: 's1', elements: [{ id: 'shape-1', type: 'shape', _pptxSource: { nodeId: '8', matchedBy: 'sourceId' } }] }] }, { slides: [{ index: 0, path: 'ppt/slides/slide1.xml', nodes: [{ id: '8', kind: 'shape', sourceXml: shape }] }] }, zip)
    expect(map.entries['s1:shape-1']).toMatchObject({ status: 'authoritative', kind: 'shape', nativeId: '8', sourceHash: hash(shape) })
  })

  it('creates an authoritative text-run ref only from actual OOXML and actual relationship parts', async () => {
    const zip = new JSZip()
    const shape = '<p:sp><p:nvSpPr><p:cNvPr id="7" name="Title"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/><a:t>Before</a:t></a:r></a:p></p:txBody></p:sp>'
    zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${shape}</p:sld>`)
    zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
    zip.file('ppt/_rels/presentation.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
    const map = await buildImportSourceMap({ id: 'deck', slides: [{ id: 'slide-1', elements: [{
      id: 'text-1', type: 'text', content: '<p>Before</p>', _pptxSource: { nodeId: '7', matchedBy: 'sourceId' },
    }] }] }, { slides: [{ index: 0, path: 'ppt/slides/slide1.xml', nodes: [{ id: '7', kind: 'shape', sourceXml: shape }] }] }, zip, {
      packageGeneration: 3, revisionId: 'r0',
    })

    expect(map.entries['slide-1:text-1']).toMatchObject({
      status: 'authoritative', kind: 'text-run', nativeId: '7', packageGeneration: 3,
      revisionId: 'r0', partUri: 'ppt/slides/slide1.xml', sourceHash: hash(shape),
      matchMethod: 'native-id', confidence: 1,
      relationshipChain: ['_rels/.rels', 'ppt/_rels/presentation.xml.rels'],
    })
    expect(Object.isFrozen(map.entries['slide-1:text-1'].relationshipChain)).toBe(true)
  })

  it.each(['<p><strong>Before</strong></p>', '<p>Before</p><p>Again</p>', '<p>Before<br></p>', 'Before'])(
    'fails closed when the imported TipTap content is not one plain run', async (content) => {
      const zip = new JSZip()
      const shape = '<p:sp><p:nvSpPr><p:cNvPr id="7"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Before</a:t></a:r></a:p></p:txBody></p:sp>'
      zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${shape}</p:sld>`)
      zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
      zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
      const map = await buildImportSourceMap({ id: 'deck', slides: [{ id: 's1', elements: [{
        id: 'e1', type: 'text', content, _pptxSource: { nodeId: '7', matchedBy: 'sourceId' },
      }] }] }, { slides: [{ index: 0, path: 'ppt/slides/slide1.xml', nodes: [{ id: '7', kind: 'shape', sourceXml: shape }] }] }, zip)
      expect(map.entries['s1:e1'].status).not.toBe('authoritative')
    }
  )

  it('rejects heuristic provenance and external OPC links [cap:import.pptx]', async () => {
    const zip = new JSZip()
    const shape = '<p:sp><p:nvSpPr><p:cNvPr id="7"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Before</a:t></a:r></a:p></p:txBody></p:sp>'
    zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${shape}</p:sld>`)
    zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml" TargetMode="External"/></Relationships>')
    zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
    const map = await buildImportSourceMap({ id: 'deck', slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: 'Before', _pptxSource: { nodeId: '7', matchedBy: 'order' } }] }] }, { slides: [{ index: 0, path: 'ppt/slides/slide1.xml', nodes: [{ id: '7', kind: 'shape', sourceXml: shape }] }] }, zip)
    expect(map.entries['s1:e1'].status).not.toBe('authoritative')
  })

  it.each([
    ['missing relationship', null],
    ['multi-run', '<a:r><a:t>Before</a:t></a:r><a:r><a:t>Again</a:t></a:r>'],
  ])('fails closed for text source with %s', async (_label, runOverride) => {
    const zip = new JSZip()
    const run = runOverride || '<a:r><a:t>Before</a:t></a:r>'
    const shape = `<p:sp><p:nvSpPr><p:cNvPr id="7"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${run}</a:p></p:txBody></p:sp>`
    zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${shape}</p:sld>`)
    if (runOverride) zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Target="slides/slide1.xml"/></Relationships>')
    const map = await buildImportSourceMap({ id: 'deck', slides: [{ id: 'slide-1', elements: [{
      id: 'text-1', type: 'text', content: 'Before', _pptxSource: { nodeId: '7', textRunIndex: 0, authoritative: true },
    }] }] }, { slides: [{ index: 0, path: 'ppt/slides/slide1.xml', nodes: [{ id: '7', kind: 'shape', sourceXml: shape }] }] }, zip)
    expect(map.entries['slide-1:text-1'].status).not.toBe('authoritative')
  })

  it('keeps unsupported native node kinds diagnostic', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p"/>')
    const map = await buildImportSourceMap({
      id: 'deck',
      slides: [{
        id: 'slide-1',
        elements: [{
          id: 'chart-1',
          type: 'chart',
          _pptxSource: {
            nodeId: '8',
            kind: 'graphicFrame',
            slideIndex: 0,
            authoritative: true,
          },
        }],
      }],
    }, {
      slides: [{
        index: 0,
        path: 'ppt/slides/slide1.xml',
        nodes: [{ id: '8', kind: 'graphicFrame', sourceXml: '<p:graphicFrame id="8"/>' }],
      }],
    }, zip)

    expect(map.entries['slide-1:chart-1']).toMatchObject({ status: 'missing' })
  })

  it('preserves picture media targets and keeps text diagnostic without run identity', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p"/>')
    const map = await buildImportSourceMap({
      id: 'deck',
      slides: [{
        id: 'slide-1',
        elements: [{
          id: 'image-1',
          type: 'image',
          _pptxSource: { nodeId: '9', kind: 'pic', slideIndex: 0, authoritative: true },
        }, {
          id: 'text-1',
          type: 'text',
          _pptxSource: { nodeId: '7', kind: 'shape', slideIndex: 0, authoritative: true },
        }],
      }],
    }, {
      slides: [{
        index: 0,
        path: 'ppt/slides/slide1.xml',
        nodes: [
          { id: '9', kind: 'pic', sourceXml: '<p:pic id="9"/>', rels: { blipTarget: 'ppt/media/image1.png' } },
          { id: '7', kind: 'shape', sourceXml: '<p:sp id="7"/>' },
        ],
      }],
    }, zip)

    expect(map.entries['slide-1:image-1']).toMatchObject({ status: 'missing' })
    expect(map.entries['slide-1:text-1']).toMatchObject({ status: 'missing' })
  })
})
