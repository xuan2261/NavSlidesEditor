// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildFeatureFixture } from './feature-fixtures.js'
import { fieldPart } from './field-fixtures.js'
import { hyperlinkContext, hyperlinkFixture, projectHyperlinks } from './hyperlink-source-fixture.js'
const require = createRequire(import.meta.url)
const { readSemanticTextAdmission } = require('../../server/services/pptx-import/ooxml-semantic-text-admission')
const { normalizeTextDocument, normalizeTextProperties } = require('../../shared/src/pptx-text-document')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { materializeTextDocument } = require('../../shared/src/pptx-text-materialization')
const { readSemanticTextStyleContext } = require('../../server/services/pptx-import/ooxml-semantic-text-context')
const read = (context) => readSemanticTextAdmission(context, (_, detail) => { throw new Error(detail) })
const linkedRun = (document) => document.paragraphs.flatMap((p) => p.runs).find((r) => r.hyperlinks)

describe('source-bound run hyperlinks', () => {
  it('admits the unchanged mixed-object builder hyperlink body without dropping its internal jump', async () => {
    const { buffer } = await buildFeatureFixture()
    const zip = await JSZip.loadAsync(buffer)
    const { context, link } = await hyperlinkContext(zip, 'ppt/slides/slide1.xml')
    const before = context.xml, result = read(context)
    const links = result.textDocument.paragraphs.flatMap((p) => p.runs).map((r) => r.hyperlinks?.click).filter(Boolean)
    expect(links[0]).toMatchObject({ componentId: link.id, relationshipId: 'rIdLink',
      action: { kind: 'url', url: 'https://example.org/source' } })
    expect(links[1]).toMatchObject({ relationshipId: 'rIdJump', targetPartUri: 'ppt/slides/slide2.xml',
      declarations: { action: 'ppaction://hlinksldjump' } })
    expect(result.mappedDefinitionIds).toContain(link.id)
    expect(await zip.file(context.source.partUri).async('string')).toBe(before)
  })
  it('resolves linked run style context using inventoried owner IDs rather than numeric XML paths', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    const { inventory, context } = await hyperlinkContext(zip, 'ppt/slides/slide1.xml')
    const occurrenceId = inventory.occurrences.find((o) => o.definitionId === context.source.id).id
    const before = structuredClone(inventory), xml = context.xml
    const result = await readSemanticTextStyleContext({ zip, inventory, occurrenceId })
    expect(result.paragraphs[0].runs.map((run) => run.layers.entries[0].properties))
      .toEqual([{ fontSizePt: 12 }, { fontSizePt: 12 }])
    expect(result.paragraphs[0].runs.map((run) => run.source.path))
      .toEqual(['0.0.0.3.2.2.0', '0.0.0.3.2.2.1'])
    expect(inventory).toEqual(before)
    expect(await zip.file(context.source.partUri).async('string')).toBe(xml)
  })
  it('rejects ambiguous inventoried run owners instead of selecting the first matching node', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    const { inventory, context, link } = await hyperlinkContext(zip, 'ppt/slides/slide1.xml')
    const occurrenceId = inventory.occurrences.find((o) => o.definitionId === context.source.id).id
    const run = inventory.definitions.find((d) => d.id === link.parentDefinitionId)
    inventory.definitions.push({ ...structuredClone(run), id: `${run.id}-duplicate` })
    const before = structuredClone(inventory)
    await expect(readSemanticTextStyleContext({ zip, inventory, occurrenceId }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        sourceLocation: { partUri: context.source.partUri, path: run.componentLocators[0].path } })
    expect(inventory).toEqual(before)
    expect(await zip.file(context.source.partUri).async('string')).toBe(context.xml)
  })
  it.each([false, true])('preserves genuine click/hover declarations and reopens canonical data (table=%s)', async (table) => {
    const { presentation, zip, original } = await projectHyperlinks({ table })
    const definition = Object.values(presentation.pptxSemantic.definitions).find((d) => d.source.partUri === fieldPart)
    const text = table ? definition.content.tableDocument.rows[0].cells[0].textDocument : definition.content.textDocument
    const run = linkedRun(text)
    expect(run.hyperlinks.click).toMatchObject({ relationshipId: 'website',
      action: { kind: 'url', url: 'https://example.test/source?x=1&y=2' },
      declarations: { tooltip: 'Source & docs', history: false, highlightClick: false, endSnd: false } })
    expect(run.hyperlinks.hover).toMatchObject({ relationshipId: 'jump', targetPartUri: 'ppt/slides/slide3.xml' })
    expect(run.properties).not.toHaveProperty('hyperlinks')
    const persisted = JSON.parse(JSON.stringify(presentation))
    expect(normalizeSemanticPresentation(persisted)).toEqual(persisted)
    expect(await zip.file(fieldPart).async('string')).toBe(original)
  })
  it.each([
    { url: 'javascript:alert(1)' },
    { url: 'data:text/html,unsafe' },
    { relationType: 'image' },
    { links: '<a:hlinkClick r:id="website" action="ppaction://program"/>' },
  ])('rejects unsupported/unsafe relationships or executable semantics at the hyperlink: %j', async (options) => {
    await expect(projectHyperlinks(options)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: fieldPart, localName: 'hlinkClick', path: expect.any(Array) } })
  })
  it.each([
    [{ external: false, url: '../media/picture.png' }, 'Missing required semantic source part: ppt/media/picture.png'],
    [{ links: '<a:hlinkClick r:id="missing"/>' }, `Unresolved source relationship identity: ${fieldPart}`],
    [{ links: '<a:hlinkClick r:id="website"><a:snd r:embed="sound"/></a:hlinkClick>' },
      `Unresolved source relationship identity: ${fieldPart}`],
  ])('retains the existing source inventory rejection before admission: %j', async (options, message) => {
    await expect(projectHyperlinks(options)).rejects.toThrow(message)
  })
  it.each(['owner', 'hash', 'locator', 'kind'])('rejects foreign inventoried hyperlink %s', async (mutation) => {
    const { context, link } = await hyperlinkContext(await hyperlinkFixture())
    if (mutation === 'owner') link.parentDefinitionId = 'foreign-run'
    if (mutation === 'hash') link.preconditionHash = 'f'.repeat(64)
    if (mutation === 'locator') link.componentLocators[0].path = [0]
    if (mutation === 'kind') link.kind = 'text-run'
    expect(() => read(context)).toThrow(/source component|source association|hyperlink/)
  })
  it('keeps public run properties strict and rejects noncanonical action records', async () => {
    const { presentation } = await projectHyperlinks()
    const definition = Object.values(presentation.pptxSemantic.definitions).find((d) => d.source.partUri === fieldPart)
    const text = structuredClone(definition.content.textDocument)
    expect(() => normalizeTextProperties({ hyperlinks: linkedRun(text).hyperlinks }, 'run')).toThrow()
    for (const patch of [{ kind: 'url', url: 'javascript:bad()' }, { kind: 'url', url: ' https://example.test ' },
      { kind: 'url', url: 'https://example.test', arbitrary: true }]) {
      linkedRun(text).hyperlinks.click.action = patch
      expect(() => normalizeTextDocument(text)).toThrow()
    }
  })
  it.each(['relationshipId', 'tooltip'])('rejects C0 and DEL in hyperlink %s at the public text-document boundary', async (field) => {
    const { presentation } = await projectHyperlinks()
    const definition = Object.values(presentation.pptxSemantic.definitions).find((d) => d.source.partUri === fieldPart)
    const text = structuredClone(definition.content.textDocument)
    expect(normalizeTextDocument(text)).toEqual(text)
    const link = linkedRun(text).hyperlinks.click
    const target = field === 'relationshipId' ? link : link.declarations
    for (const code of [...Array.from({ length: 32 }, (_, index) => index), 0x7f]) {
      target[field] = `Source${String.fromCharCode(code)}docs`
      expect(() => normalizeTextDocument(text), `${field} must reject character ${code}`).toThrow()
    }
  })
  it('preserves ordinary Unicode and astral hyperlink text at the public text-document boundary', async () => {
    const { presentation } = await projectHyperlinks()
    const definition = Object.values(presentation.pptxSemantic.definitions).find((d) => d.source.partUri === fieldPart)
    const text = structuredClone(definition.content.textDocument)
    const link = linkedRun(text).hyperlinks.click
    link.relationshipId = 'rId-Đường-dẫn-東京-🚀'
    link.declarations.tooltip = 'Tài liệu 東京 🚀'
    expect(normalizeTextDocument(text)).toEqual(text)
  })
  it('edits exactly one occurrence, retains declarations/source and rejects foreign linkage on save', async () => {
    const { presentation } = await projectHyperlinks(), before = structuredClone(presentation)
    const element = presentation.slides[0].elements.find((e) => e.pptxInstanceId.includes('#shape:2'))
    const instance = presentation.pptxSemantic.instances[element.pptxInstanceId]
    const definition = presentation.pptxSemantic.definitions[instance.definitionId]
    const text = structuredClone(definition.content.textDocument)
    linkedRun(text).hyperlinks.click.action = { kind: 'url', url: 'https://edited.test/details', target: 'new' }
    const next = structuredClone(presentation)
    next.pptxSemantic.instances[instance.id].overrides.components = {
      ...instance.overrides.components, [text.componentId]: { textDocument: text },
    }
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
    expect(linkedRun(materializeTextDocument(reopened.pptxSemantic, instance.id)).hyperlinks.click.action.url).toBe('https://edited.test/details')
    expect(() => assertSemanticBaseline(presentation, reopened)).not.toThrow()
    expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    for (const [id, other] of Object.entries(before.pptxSemantic.instances)) {
      if (id === instance.id) continue
      expect(next.pptxSemantic.instances[id]).toEqual(other)
      expect(reopened.pptxSemantic.instances[id]).toEqual(JSON.parse(JSON.stringify(other)))
    }
    const bad = structuredClone(reopened)
    linkedRun(bad.pptxSemantic.instances[instance.id].overrides.components[text.componentId].textDocument)
      .hyperlinks.click.componentId = 'foreign-hyperlink'
    expect(() => normalizeSemanticPresentation(bad)).toThrow(/hyperlink|source/i)
    expect(presentation).toEqual(before)
  })
})
