import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
import { expandedTextContextDocument } from './text-context-fixture-utils'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { materializeTextDocument } = require('../../shared/src/pptx-text-materialization')
let semantic, instanceId

beforeAll(async () => {
  const zip = await fixture()
  for (const part of [slide, layout, master])
    zip.file(
      part,
      (await zip.file(part).async('string')).replaceAll(
        '<p:spPr/>',
        '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
      )
    )
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:presentation>',
      '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
    )
  )
  const { presentation } = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] },
  })
  semantic = presentation.pptxSemantic
  instanceId = Object.values(semantic.instances).find(
    instance => instance.textSourceBinding && instance.slideId === presentation.slides[0].id
  ).id
})

describe('document-local occurrence text caching', () => {
  it.each([true, false])('reads a changed definition with a shared instance (text context: %s)', withContext => {
    const source = structuredClone(semantic)
    const instance = source.instances[instanceId]
    if (!withContext) delete instance.textSourceBinding
    const original = materializeTextDocument(source, instanceId)
    const definition = structuredClone(source.definitions[instance.definitionId])
    definition.content.textDocument.paragraphs[0].runs[0].text = 'Changed source text'
    const changed = {
      ...source,
      definitions: { ...source.definitions, [instance.definitionId]: definition },
    }

    expect(changed.instances[instanceId]).toBe(instance)
    const result = materializeTextDocument(changed, instanceId)
    expect(result.paragraphs[0].runs[0].text).toBe('Changed source text')
    expect(original.paragraphs[0].runs[0].text).toBe('Text')
    expect(materializeTextDocument(source, instanceId)).toBe(original)
    expect(materializeTextDocument(changed, instanceId)).toBe(result)
  })

  it.each(['declarations', 'theme'])('reads changed text-context %s with a shared instance', change => {
    const source = expandedTextContextDocument(semantic)
    const instance = source.instances[instanceId]
    const contextId = instance.textSourceBinding.contextId
    const original = materializeTextDocument(source, instanceId)
    const context = structuredClone(source.styles[contextId])
    if (change === 'theme') context.payload.theme.fonts.minor.latin = 'Changed Minor'
    else {
      for (const paragraph of context.payload.paragraphs) {
        for (const layers of [paragraph.run, ...paragraph.runs.map(run => run.layers)]) {
          for (const entry of layers.entries)
            if (entry.properties.fontSizePt === 18) entry.properties.fontSizePt = 30
        }
      }
    }
    const changed = { ...source, styles: { ...source.styles, [contextId]: context } }

    expect(changed.instances[instanceId]).toBe(instance)
    expect(changed.definitions).toBe(source.definitions)
    const result = materializeTextDocument(changed, instanceId)
    expect(result.paragraphs[0].runs[0].properties).toMatchObject({
      fontSizePt: change === 'declarations' ? 30 : 18,
      fontLatin: { typeface: change === 'theme' ? 'Changed Minor' : 'Minor' },
    })
    expect(original.paragraphs[0].runs[0].properties).toMatchObject({
      fontSizePt: 18, fontLatin: { typeface: 'Minor' },
    })
    expect(materializeTextDocument(source, instanceId)).toBe(original)
    expect(materializeTextDocument(changed, instanceId)).toBe(result)
  })

  it('reads changed inheritance styles with a shared instance and unchanged text context', () => {
    const source = structuredClone(semantic)
    const instance = source.instances[instanceId]
    const original = materializeTextDocument(source, instanceId)
    const changed = {
      ...source,
      styles: {
        ...source.styles,
        projectText: {
          kind: 'inheritance-override',
          origin: 'project',
          baseDefinitionId: instance.definitionId,
          values: { label: 'Inherited edit', textStyle: { bold: true } },
        },
      },
    }

    expect(changed.instances[instanceId]).toBe(instance)
    expect(changed.styles[instance.textSourceBinding.contextId])
      .toBe(source.styles[instance.textSourceBinding.contextId])
    const result = materializeTextDocument(changed, instanceId)
    expect(result.paragraphs[0].runs[0]).toMatchObject({
      text: 'Inherited edit', properties: { bold: true },
    })
    expect(original.paragraphs[0].runs[0]).toMatchObject({
      text: 'Text', properties: { bold: false },
    })
    expect(materializeTextDocument(source, instanceId)).toBe(original)
    expect(materializeTextDocument(changed, instanceId)).toBe(result)
  })
})
