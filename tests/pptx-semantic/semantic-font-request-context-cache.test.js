import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
import { expandedTextContextDocument } from './text-context-fixture-utils'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const { compactTextContexts } = require('../../shared/src/pptx-semantic-text-context-codec')
let semantic, instanceId

beforeAll(async () => {
  const zip = await fixture()
  for (const part of [slide, layout, master])
    zip.file(part, (await zip.file(part).async('string')).replaceAll(
      '<p:spPr/>',
      '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
    ))
  zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string'))
    .replace('</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'))
  const { presentation } = await projectSemanticImport({
    zip, geometryInheritance: true,
    presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] },
  })
  semantic = expandedTextContextDocument(presentation.pptxSemantic)
  instanceId = Object.values(semantic.instances).find(instance =>
    instance.textSourceBinding && instance.slideId === presentation.slides[0].id).id
})

const faceNames = result => result.faces.map(face => face.typeface)

function changeDeclarations(context) {
  for (const paragraph of context.paragraphs)
    for (const layers of [paragraph.run, ...paragraph.runs.map(run => run.layers)])
      for (const entry of layers.entries)
        if (entry.properties.fontLatin?.typeface === '+mn-lt')
          entry.properties.fontLatin.typeface = 'Changed Declaration'
}

function sharedResourceDocument() {
  const raw = structuredClone(semantic)
  const entries = Object.entries(raw.styles).filter(([, style]) => style.kind === 'text-context')
  const resourcesId = 'text-context-resources:font-cache-regression'
  const { contexts, records, fontDescriptors } = compactTextContexts(
    entries.map(([, style]) => style.payload), resourcesId
  )
  entries.forEach(([id, style], index) => { raw.styles[id] = { ...style, payload: contexts[index] } })
  raw.styles[resourcesId] = {
    kind: 'text-context-resources', origin: 'source', source: entries[0][1].source,
    payload: { schemaVersion: 1, records, fontDescriptors },
  }
  return { source: normalizePptxSemanticDocument(raw), resourcesId }
}

describe('document-local font context expansion', () => {
  it.each(['theme', 'declarations'])('reads changed context %s with a shared instance and definition', change => {
    const source = normalizePptxSemanticDocument(semantic)
    const contextId = source.instances[instanceId].textSourceBinding.contextId
    const initial = collectSemanticFontRequests(source)
    const contextStyle = structuredClone(source.styles[contextId])
    if (change === 'theme') contextStyle.payload.theme.fonts.minor.latin = 'Changed Minor'
    else changeDeclarations(contextStyle.payload)
    const changed = normalizePptxSemanticDocument({ ...source,
      styles: { ...source.styles, [contextId]: contextStyle },
    })
    expect(changed.instances[instanceId]).toBe(source.instances[instanceId])
    expect(changed.definitions).toBe(source.definitions)
    const result = collectSemanticFontRequests(changed)
    expect(faceNames(initial)).toContain('Minor')
    expect(faceNames(result)).toContain(change === 'theme' ? 'Changed Minor' : 'Changed Declaration')
    expect(result.identity).not.toBe(initial.identity)
    expect(collectSemanticFontRequests(source)).toBe(initial)
  })

  it.each(['theme', 'declaration'])('resolves changed shared %s resources with an unchanged context payload', change => {
    const { source, resourcesId } = sharedResourceDocument()
    const contextId = source.instances[instanceId].textSourceBinding.contextId
    const initial = collectSemanticFontRequests(source)
    const pool = structuredClone(source.styles[resourcesId])
    for (const record of Object.values(pool.payload.records)) {
      if (change === 'theme' && record.kind === 'theme')
        record.value.fonts.minor.latin = 'Changed Minor'
      if (change === 'declaration' && record.kind === 'declaration' &&
          record.value.properties.fontLatin?.typeface === '+mn-lt')
        record.value.properties.fontLatin.typeface = 'Changed Declaration'
    }
    const changed = normalizePptxSemanticDocument({ ...source,
      styles: { ...source.styles, [resourcesId]: pool },
    })
    expect(changed.instances[instanceId]).toBe(source.instances[instanceId])
    expect(changed.definitions).toBe(source.definitions)
    expect(changed.styles[contextId]).toBe(source.styles[contextId])
    const result = collectSemanticFontRequests(changed)
    expect(faceNames(initial)).toContain('Minor')
    expect(faceNames(result)).toContain(change === 'theme' ? 'Changed Minor' : 'Changed Declaration')
    expect(result.identity).not.toBe(initial.identity)
    expect(collectSemanticFontRequests(source)).toBe(initial)
  })
})
