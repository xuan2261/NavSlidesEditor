import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPresentation } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { semanticDefinition } = require('../../shared/src/pptx-semantic-records')
const { validateSourceGuideList } = require('../../shared/src/pptx-source-guides')

const N = 'http://schemas.microsoft.com/office/powerpoint/2012/main'
const extension = (local, guid, children = '', attrs = '') =>
  `<p:extLst><p:ext uri="${guid}"><g:${local} xmlns:g="${N}" ${attrs}>${children}</g:${local}></p:ext></p:extLst>`

const guide = (attrs = 'id="1" orient="horz" pos="2160"', color = '<a:srgbClr val="A4A3A4"/>', after = '') =>
  `<g:guide ${attrs}><g:clr>${color}</g:clr>${after}</g:guide>`

async function project(children = '', { part = 'ppt/presentation.xml', root = 'presentation', local = 'sldGuideLst', guid = '{EFAFB233-063F-42B5-8137-9DF3F51BA10A}' } = {}) {
  const zip = fieldFixture()
  const xml = await zip.file(part).async('string')
  zip.file(part, xml.replace(`</p:${root}>`, `${extension(local, guid, children)}</p:${root}>`))
  const before = await stableZip(zip)
  const result = await projectSemanticImport({ zip, presentation: fieldPresentation() })
  expect(await stableZip(zip)).toEqual(before)
  return result
}

const owner = (deck) => Object.values(deck.pptxSemantic.definitions).find((d) => d.kind === 'source-guide-list')

describe('semantic source guide compact graph decoding and normalization', () => {
  it('preserves native numeric guide ids and validates after compactSemanticGraph and JSON roundtrip', async () => {
    const children = guide('id="1" orient="horz" pos="2160"') + guide('id="2" pos="3840"')
    const { presentation } = await project(children)
    const definition = owner(presentation)
    expect(definition).toBeDefined()
    expect(definition.content.sourceGuideList.guides[0].value.id).toBe(1)
    expect(definition.content.sourceGuideList.guides[1].value.id).toBe(2)

    // Compact graph to schemaVersion 3
    const compacted = compactSemanticGraph(presentation.pptxSemantic)
    expect(compacted.schemaVersion).toBe(3)

    // Decoded record must retain native integer guide IDs
    const decodedDef = semanticDefinition(compacted, definition.id)
    expect(decodedDef).toBeDefined()
    expect(typeof decodedDef.content.sourceGuideList.guides[0].value.id).toBe('number')
    expect(decodedDef.content.sourceGuideList.guides[0].value.id).toBe(1)
    expect(typeof decodedDef.content.sourceGuideList.guides[1].value.id).toBe('number')
    expect(decodedDef.content.sourceGuideList.guides[1].value.id).toBe(2)

    // validateSourceGuideList on decodedDef must not throw
    expect(() => validateSourceGuideList(decodedDef)).not.toThrow()

    // normalizePptxSemanticDocument on compacted document must not throw
    const normalized = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(compacted)))
    expect(normalized).toBeDefined()
  })
})
