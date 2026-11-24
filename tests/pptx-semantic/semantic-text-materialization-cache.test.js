import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
import { expandedTextContextDocument } from './text-context-fixture-utils'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { materializeTextDocument, materializeTextTheme } = require('../../shared/src/pptx-text-materialization')
const {
  replaceSemanticRecords, certifyImmutableSemanticDocument, semanticInstance, semanticDefinition,
} = require('../../shared/src/pptx-semantic-records')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
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
    expect(materializeTextDocument(source, instanceId)).toEqual(original)
    expect(materializeTextDocument(changed, instanceId)).toEqual(result)
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
    expect(materializeTextDocument(source, instanceId)).toEqual(original)
    expect(materializeTextDocument(changed, instanceId)).toEqual(result)
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
    expect(materializeTextDocument(source, instanceId)).toEqual(original)
    expect(materializeTextDocument(changed, instanceId)).toEqual(result)
  })
})

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

describe('certified occurrence materialization reuse', () => {
  it.each([false, true])('isolates native text edits from the retained source (compact: %s)', compact => {
    const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
    const source = normalizePptxSemanticDocument(compact ? compactSemanticGraph(semantic) : semantic)
    const original = materializeTextDocument(source, instanceId)

    const instance = semanticInstance(source, instanceId)
    const definition = semanticDefinition(source, instance.definitionId)
    const edited = structuredClone(definition.content.textDocument)
    edited.paragraphs[0].runs[0].text = 'Native input'
    const ownEdit = replaceSemanticRecords(source, {
      instances: { [instanceId]: { ...instance, overrides: {
        ...instance.overrides, components: { [edited.componentId]: { textDocument: edited } },
      } } },
    })
    expect(materializeTextDocument(ownEdit, instanceId).paragraphs[0].runs[0].text).toBe('Native input')
    expect(original.paragraphs[0].runs[0].text).toBe('Text')
  })

  it.each(['definition', 'declaration', 'theme', 'inheritance'])('invalidates certified %s edits', change => {
    const source = certifyImmutableSemanticDocument(freeze(expandedTextContextDocument(semantic)))
    const instance = source.instances[instanceId]
    const original = materializeTextDocument(source, instanceId)
    const theme = materializeTextTheme(source, instanceId)
    let patch
    if (change === 'definition') {
      const definition = structuredClone(source.definitions[instance.definitionId])
      definition.content.textDocument.paragraphs[0].runs[0].text = 'Changed source'
      patch = { definitions: { [instance.definitionId]: definition } }
    } else if (change === 'inheritance') {
      patch = { styles: { projectText: { kind: 'inheritance-override', origin: 'project',
        baseDefinitionId: instance.definitionId, values: { label: 'Changed source', textStyle: { bold: true } } } } }
    } else {
      const context = structuredClone(source.styles[instance.textSourceBinding.contextId])
      if (change === 'theme') {
        context.payload.theme.fonts.minor.latin = 'Changed Minor'
        context.payload.theme.colors.dk1 = 'FF0000'
      } else for (const paragraph of context.payload.paragraphs)
        for (const layers of [paragraph.run, ...paragraph.runs.map(run => run.layers)])
          for (const entry of layers.entries)
            if (entry.properties.fontSizePt === 18) entry.properties.fontSizePt = 30
      patch = { styles: { [instance.textSourceBinding.contextId]: context } }
    }
    const changed = replaceSemanticRecords(source, patch)
    const result = materializeTextDocument(changed, instanceId)
    expect(result).not.toBe(original)
    if (change === 'definition' || change === 'inheritance')
      expect(result.paragraphs[0].runs[0].text).toBe('Changed source')
    if (change === 'inheritance') expect(result.paragraphs[0].runs[0].properties.bold).toBe(true)
    if (change === 'declaration') expect(result.paragraphs[0].runs[0].properties.fontSizePt).toBe(30)
    if (change === 'theme') {
      expect(result.paragraphs[0].runs[0].properties.fontLatin.typeface).toBe('Changed Minor')
      expect(result.paragraphs[0].runs[0].properties.color)
        .not.toEqual(original.paragraphs[0].runs[0].properties.color)
      expect(materializeTextTheme(changed, instanceId).colors.dk1).toBe('FF0000')
      expect(materializeTextTheme(changed, instanceId).fonts.minor.latin).toBe('Changed Minor')
      expect(theme.fonts.minor.latin).toBe('Minor')
    }
  })

  it('does not reuse text or theme for a raw mutable document identity', () => {
    const source = expandedTextContextDocument(semantic)
    const instance = source.instances[instanceId]
    const original = materializeTextDocument(source, instanceId)
    expect(materializeTextTheme(source, instanceId).fonts.minor.latin).toBe('Minor')
    source.definitions[instance.definitionId].content.textDocument.paragraphs[0].runs[0].text = 'Mutated'
    source.styles[instance.textSourceBinding.contextId].payload.theme.fonts.minor.latin = 'Mutated Font'
    expect(materializeTextDocument(source, instanceId).paragraphs[0].runs[0]).toMatchObject({
      text: 'Mutated', properties: { fontLatin: { typeface: 'Mutated Font' } },
    })
    expect(materializeTextTheme(source, instanceId).fonts.minor.latin).toBe('Mutated Font')
    expect(original.paragraphs[0].runs[0].text).toBe('Text')
  })
})
