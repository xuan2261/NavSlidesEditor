import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master, shape } from './semantic-text-style-context-fixture'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { previewInheritanceEdit } = require('../../shared/src/pptx-inheritance-operations')
const { materializeTextDocument } = require('../../shared/src/pptx-text-materialization')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { geometryThemeCategories, validateGeometryStyleRecords } = require('../../shared/src/pptx-geometry-style-records')
const clone = (value) => JSON.parse(JSON.stringify(value))

async function imported({ masterDecoration = false } = {}) {
  const zip = await fixture()
  if (masterDecoration) zip.file(master, (await zip.file(master).async('string'))
    .replace('</p:spTree>', `${shape(70, null, 0)}</p:spTree>`))
  for (const part of [slide, layout, master]) zip.file(part,
    (await zip.file(part).async('string')).replaceAll('<p:spPr/>',
      '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></p:spPr>'))
  zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string'))
    .replace('</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'))
  const result = await projectSemanticImport({ zip, geometryInheritance: true,
    presentation: { id: 'inheritance-deck', slides: [{ id: 'first', title: 'First', elements: [] }] } })
  const presentation = clone(result.presentation)
  const model = presentation.pptxSemantic
  // A legitimate same-source duplicated slide preserves original context lineage.
  const second = clone(presentation.slides[0]); second.id = 'second'; second.title = 'Second'
  for (const element of second.elements) {
    const original = model.instances[element.pptxInstanceId]
    const id = `copy:${original.id}`
    model.instances[id] = { ...clone(original), id, slideId: 'second' }
    element.id = id; element.pptxInstanceId = id
  }
  presentation.slides.push(second)
  return { zip, presentation: normalizeSemanticPresentation(presentation) }
}
const label = (p, id) => materializeTextDocument(p.pptxSemantic, id).paragraphs[0].runs[0].text
const operation = (instanceId, command, extra = {}) => ({ type: 'inheritance.edit', instanceId, command, ...extra })

describe('Task14 linked inheritance editing', () => {
  it('edits a repeated authored master label and color on the selected slide only', async () => {
    const { presentation } = await imported({ masterDecoration: true })
    const model = presentation.pptxSemantic
    const instance = Object.values(model.instances).find((entry) => entry.slideId === 'first' &&
      model.definitions[entry.definitionId].source.partUri === master)
    const before = clone(presentation)
    const sibling = `copy:${instance.id}`
    const labelled = applyPresentationProjectionOperation(presentation, operation(instance.id, { type: 'label', value: 'Local master label' }))
    const edited = applyPresentationProjectionOperation(labelled, operation(instance.id,
      { type: 'text-style', properties: { color: { kind: 'srgb', value: 'CC2244' } } }))
    const reopened = normalizeSemanticPresentation(clone(canonicalEditableSnapshot(edited)))
    expect(label(reopened, instance.id)).toBe('Local master label')
    expect(materializeTextDocument(reopened.pptxSemantic, instance.id).paragraphs[0].runs[0].properties.color.value).toBe('CC2244')
    expect(materializeTextDocument(reopened.pptxSemantic, sibling)).toEqual(materializeTextDocument(model, sibling))
    expect(reopened.pptxSemantic.instances[sibling]).toEqual(model.instances[sibling])
    expect(reopened.pptxSemantic.definitions).toEqual(model.definitions)
    expect(presentation).toEqual(before)
  })
  it('rejects an edit-all theme that is not linked to the selected occurrence without partial mutation', async () => {
    const { zip } = await imported()
    const aliases = [[slide, 'ppt/slides/other.xml'], [layout, 'ppt/slideLayouts/other.xml'],
      [master, 'ppt/slideMasters/other.xml'], ['ppt/theme/not-indexed.xml', 'ppt/theme/other.xml']]
    for (const [source, target] of aliases) zip.file(target, await zip.file(source).async('string'))
    for (const [source, target, oldTarget, newTarget] of [
      ['ppt/slides/_rels/slide9.xml.rels', 'ppt/slides/_rels/other.xml.rels', 'unrelated-name.xml', 'other.xml'],
      ['ppt/slideLayouts/_rels/unrelated-name.xml.rels', 'ppt/slideLayouts/_rels/other.xml.rels', 'arbitrary.xml', 'other.xml'],
      ['ppt/slideMasters/_rels/arbitrary.xml.rels', 'ppt/slideMasters/_rels/other.xml.rels', 'not-indexed.xml', 'other.xml'],
    ]) zip.file(target, (await zip.file(source).async('string')).replace(oldTarget, newTarget))
    zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string'))
      .replace('</p:sldIdLst>', '<p:sldId id="257" r:id="otherSlide"/></p:sldIdLst>'))
    zip.file('ppt/_rels/presentation.xml.rels', (await zip.file('ppt/_rels/presentation.xml.rels').async('string'))
      .replace('</Relationships>', '<Relationship Id="otherSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/other.xml"/></Relationships>'))
    const { presentation } = await projectSemanticImport({ zip, geometryInheritance: true,
      presentation: { id: 'two-themes', slides: [{ id: 'first', elements: [] }, { id: 'second', elements: [] }] } })
    const instanceId = Object.values(presentation.pptxSemantic.instances).find((entry) => entry.slideId === 'first').id
    const baseStyleId = Object.keys(presentation.pptxSemantic.styles).find((id) => {
      const style = presentation.pptxSemantic.styles[id]
      return style.kind === 'theme' && style.source.partUri === 'ppt/theme/other.xml'
    })
    const intent = operation(instanceId, { type: 'theme-colors', baseStyleId, colors: { dk1: { kind: 'srgb', value: 'FF0000' } } }, { scope: 'all' })
    const before = structuredClone(presentation)
    expect(() => previewInheritanceEdit(presentation, intent)).toThrow(/selected.*theme|theme.*selected/i)
    expect(() => applyPresentationProjectionOperation(presentation, intent)).toThrow(/selected.*theme|theme.*selected/i)
    expect(presentation).toEqual(before)
  })
  it('defaults label and color edits to one occurrence, preserving siblings and source through save/reopen', async () => {
    const { presentation } = await imported()
    const instance = Object.values(presentation.pptxSemantic.instances)[0]
    const sibling = `copy:${instance.id}`
    const before = clone(presentation)
    let edited = applyPresentationProjectionOperation(presentation, operation(instance.id, { type: 'label', value: 'Only this slide' }))
    edited = applyPresentationProjectionOperation(edited, operation(instance.id, { type: 'text-style', properties: { color: { kind: 'srgb', value: 'FF1122' } } }))
    const reopened = normalizeSemanticPresentation(clone(canonicalEditableSnapshot(edited)))
    expect(label(reopened, instance.id)).toBe('Only this slide')
    expect(label(reopened, sibling)).toBe(label(before, sibling))
    expect(reopened.pptxSemantic.instances[sibling]).toEqual(before.pptxSemantic.instances[sibling])
    expect(materializeTextDocument(reopened.pptxSemantic, instance.id).paragraphs[0].runs[0].properties.color.value).toBe('FF1122')
    expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(reopened.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(() => assertSemanticBaseline(before, reopened)).not.toThrow()
    expect(presentation).toEqual(before)
  })

  it('projects edited occurrence text onto canvas render tree while preserving siblings and rich text document edits', async () => {
    const { presentation } = await imported()
    const instance = Object.values(presentation.pptxSemantic.instances)[0]
    const sibling = `copy:${instance.id}`
    const originalTextDoc = materializeTextDocument(presentation.pptxSemantic, instance.id)
    const richDoc = clone(originalTextDoc)
    richDoc.paragraphs[0].runs = [
      { componentId: `${richDoc.componentId}:r1`, kind: 'text', text: 'Rich ', properties: { bold: true } },
      { componentId: `${richDoc.componentId}:r2`, kind: 'text', text: 'Paragraph', properties: { italic: true } },
    ]
    const edited = applyPresentationProjectionOperation(presentation, operation(instance.id, {
      type: 'text-document',
      document: richDoc,
    }))
    const slide1Tree = semanticRenderTree(edited.pptxSemantic, edited.slides[0])
    const slide2Tree = semanticRenderTree(edited.pptxSemantic, edited.slides[1])
    const el1 = slide1Tree.find((n) => n.instanceId === instance.id)?.element
    const el2 = slide2Tree.find((n) => n.instanceId === sibling)?.element
    expect(el1.pptxTextDocument.paragraphs[0].runs).toHaveLength(2)
    expect(el1.pptxTextDocument.paragraphs[0].runs[0].text).toBe('Rich ')
    expect(el1.pptxTextDocument.paragraphs[0].runs[0].properties.bold).toBe(true)
    expect(el2.pptxTextDocument.paragraphs[0].runs[0].text).toBe(label(presentation, sibling))
  })

  it('preserves field previews (slide number, title, date) on materialized text without losing field declarations', async () => {
    const { presentation } = await imported()
    const instance = Object.values(presentation.pptxSemantic.instances)[0]
    const baseDoc = clone(materializeTextDocument(presentation.pptxSemantic, instance.id))
    baseDoc.paragraphs[0].runs.push({
      componentId: `${baseDoc.componentId}:field1`,
      kind: 'field',
      text: '1',
      field: { id: `${baseDoc.componentId}:field1`, type: 'slidenum' },
      properties: {},
    })
    baseDoc.paragraphs[0].runs.push({
      componentId: `${baseDoc.componentId}:field2`,
      kind: 'field',
      text: 'Draft Title',
      field: { id: `${baseDoc.componentId}:field2`, type: 'title' },
      properties: {},
    })
    baseDoc.paragraphs[0].runs.push({
      componentId: `${baseDoc.componentId}:field3`,
      kind: 'field',
      text: '2026-01-01',
      field: { id: `${baseDoc.componentId}:field3`, type: 'datetime1' },
      properties: {},
    })
    const withField = applyPresentationProjectionOperation(presentation, operation(instance.id, {
      type: 'text-document',
      document: baseDoc,
    }))
    const rendered = semanticRenderTree(withField.pptxSemantic, withField.slides[0], {
      slideNumber: 42,
      slideTitle: 'Actual Slide Title',
      date: new Date('2026-10-21T12:00:00Z'),
      locale: 'en-GB', timeZone: 'UTC',
    })
    const el = rendered.find((n) => n.instanceId === instance.id)?.element
    const runs = el.pptxTextDocument.paragraphs[0].runs
    expect(runs[1].text).toBe('42')
    expect(runs[1].field).toEqual({ id: `${baseDoc.componentId}:field1`, type: 'slidenum' })
    expect(runs[2].text).toBe('Actual Slide Title')
    expect(runs[2].field).toEqual({ id: `${baseDoc.componentId}:field2`, type: 'title' })
    expect(runs[3].field).toEqual({ id: `${baseDoc.componentId}:field3`, type: 'datetime1' })
    expect(runs[3].text).toBe('21/10/2026')
    expect(materializeTextDocument(withField.pptxSemantic, instance.id).paragraphs[0].runs[3].text).toBe('2026-01-01')
    expect(withField.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
  })

  it('preserves hidden flags, effects, and color transforms across edits', async () => {
    const { presentation } = await imported()
    const instance = Object.values(presentation.pptxSemantic.instances)[0]
    const hiddenEdited = applyPresentationProjectionOperation(presentation, operation(instance.id, {
      type: 'hidden',
      value: true,
    }))
    expect(hiddenEdited.pptxSemantic.instances[instance.id].overrides.hidden).toBe(true)
    expect(hiddenEdited.pptxSemantic.instances[`copy:${instance.id}`].overrides.hidden).toBeUndefined()
    const styleEdited = applyPresentationProjectionOperation(presentation, operation(instance.id, {
      type: 'geometry-style',
      style: {
        fill: {
          color: { kind: 'srgb', value: '00AAFF', transforms: [{ kind: 'alpha', value: 50000 }] },
        },
      },
    }))
    const geom = materializeGeometry(styleEdited.pptxSemantic, instance.id)
    expect(geom.style.fill.color.value).toBe('00AAFF')
    expect(geom.style.fill.color.transforms).toEqual([{ kind: 'alpha', value: 50000 }])
  })

  it('requires an exact impact preview for explicit all-occurrence editing and rejects stale/locked targets atomically', async () => {
    const { presentation } = await imported()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const intent = operation(instanceId, { type: 'label', value: 'Shared label' }, { scope: 'all' })
    expect(() => applyPresentationProjectionOperation(presentation, intent)).toThrow(/preview/i)
    const preview = previewInheritanceEdit(presentation, intent)
    expect(preview.occurrences).toHaveLength(2)
    const edited = applyPresentationProjectionOperation(presentation, { ...intent, preview })
    expect(label(edited, instanceId)).toBe('Shared label')
    expect(label(edited, `copy:${instanceId}`)).toBe('Shared label')
    const locked = clone(presentation); locked.slides[1].locked = true
    const before = clone(locked)
    expect(() => applyPresentationProjectionOperation(locked, { ...intent, preview })).toThrow(/stale|locked/i)
    expect(locked).toEqual(before)
    expect(() => applyPresentationProjectionOperation(edited, { ...intent, preview })).toThrow(/stale/i)
  })

  it('recomputes theme-dependent text and geometry only, retaining explicit occurrence overrides', async () => {
    const { presentation } = await imported()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const theme = Object.entries(presentation.pptxSemantic.styles).find(([, style]) => style.kind === 'theme')
    let edited = applyPresentationProjectionOperation(presentation, operation(instanceId,
      { type: 'text-style', properties: { color: { kind: 'srgb', value: 'ABCDEF' } } }))
    const themeIntent = operation(instanceId,
      { type: 'theme-colors', baseStyleId: theme[0], colors: { dk1: { kind: 'srgb', value: 'FF0000' } } },
      { scope: 'all' })
    edited = applyPresentationProjectionOperation(edited, {
      ...themeIntent, preview: previewInheritanceEdit(edited, themeIntent),
    })
    expect(materializeTextDocument(edited.pptxSemantic, instanceId).paragraphs[0].runs[0].properties.color.value).toBe('ABCDEF')
    expect(materializeTextDocument(edited.pptxSemantic, `copy:${instanceId}`).paragraphs[0].runs[0].properties.color.value)
      .not.toBe(materializeTextDocument(presentation.pptxSemantic, `copy:${instanceId}`).paragraphs[0].runs[0].properties.color.value)
    expect(materializeGeometry(edited.pptxSemantic, instanceId).style.fill.color.value).toBe('FF0000')
    expect(edited.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
  })

  it('preserves authored slide metadata and notes with immutable source provenance through occurrence edits and reopen', async () => {
    const { zip } = await imported()
    const notes = 'ppt/notesSlides/authored.xml'
    const background = '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="dk1"><a:tint val="25000"/></a:schemeClr></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
    zip.file(master, (await zip.file(master).async('string')).replace('<p:cSld>', `<p:cSld>${background}`)
      .replace('</p:sldMaster>', '<p:hf hdr="0" ftr="1" dt="0" sldNum="1"/></p:sldMaster>'))
    zip.file(slide, (await zip.file(slide).async('string')).replace('<p:sld ', '<p:sld show="0" showMasterSp="false" '))
    zip.file('ppt/slides/_rels/slide9.xml.rels', (await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string'))
      .replace('</Relationships>', `<Relationship Id="authoredNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/authored.xml"/></Relationships>`))
    zip.file(notes, `<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${shape(20, 'body', 1, '', '<a:pPr/><a:r><a:rPr/><a:t>Speaker &amp; notes</a:t></a:r><a:br/><a:r><a:t xml:space="preserve">  detail\tend</a:t></a:r>')}</p:spTree></p:cSld></p:notes>`)
    const incoming = { id: 'authored', slides: [{ id: 'first', title: 'Existing title', notes: 'Existing notes', background: '#123456', elements: [] }] }
    const before = clone(incoming)
    const { presentation } = await projectSemanticImport({ zip, geometryInheritance: true, presentation: incoming })
    const sourceIds = presentation.slides[0].pptxSlideSource.definitionIds
    const records = sourceIds.map((id) => presentation.pptxSemantic.definitions[id])
    const masterRecord = records.find((record) => record.source.partUri === master)
    const slideRecord = records.find((record) => record.source.partUri === slide)
    const notesRecord = records.find((record) => record.source.partUri === notes)
    expect(masterRecord.content.slideMetadata.background.xml).toBe(background)
    expect(masterRecord.content.slideMetadata.headerFooter.attributes).toEqual({ hdr: '0', ftr: '1', dt: '0', sldNum: '1' })
    expect(slideRecord.content.slideMetadata.flags).toMatchObject({ show: '0', showMasterSp: 'false' })
    expect(slideRecord.content.slideMetadata.dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ relationshipId: 'authoredNotes', definitionId: notesRecord.id }),
    ]))
    expect(notesRecord.content.slideMetadata.notesText).toBe('Speaker & notes\n  detail\tend')
    expect(notesRecord.source.preconditionHash).toMatch(/^[a-f0-9]{64}$/)
    expect(notesRecord.content.slideMetadata.notes.xml).toContain('Speaker &amp; notes')
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const edited = applyPresentationProjectionOperation(presentation, operation(instanceId, { type: 'label', value: 'Local' }))
    const reopened = normalizeSemanticPresentation(clone(canonicalEditableSnapshot(edited)))
    expect(reopened.slides[0]).toMatchObject({ title: 'Existing title', notes: 'Existing notes', background: '#123456', pptxSlideSource: presentation.slides[0].pptxSlideSource })
    expect(reopened.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
    expect(() => assertSemanticBaseline(presentation, reopened)).not.toThrow()
    expect(incoming).toEqual(before)
    const withoutNotes = clone(incoming)
    delete withoutNotes.slides[0].notes
    const projectedNotes = await projectSemanticImport({ zip, geometryInheritance: true, presentation: withoutNotes })
    expect(projectedNotes.presentation.slides[0].notes).toBe('Speaker & notes\n  detail\tend')
  })

  it.each(['duplicate-background', 'duplicate-notes', 'metadata-cycle'])('rejects %s without mutating incoming slide metadata', async (failure) => {
    const { zip } = await imported()
    if (failure === 'duplicate-background') zip.file(slide, (await zip.file(slide).async('string'))
      .replace('<p:cSld>', '<p:cSld><p:bg><p:bgPr/></p:bg><p:bg><p:bgPr/></p:bg>'))
    else if (failure === 'duplicate-notes') {
      zip.file('ppt/notesSlides/one.xml', '<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree/></p:cSld></p:notes>')
      zip.file('ppt/slides/_rels/slide9.xml.rels', (await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string'))
        .replace('</Relationships>', ['one', 'two'].map((id) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/one.xml"/>`).join('') + '</Relationships>'))
    } else zip.file('ppt/slideMasters/_rels/arbitrary.xml.rels', (await zip.file('ppt/slideMasters/_rels/arbitrary.xml.rels').async('string'))
      .replace('</Relationships>', '<Relationship Id="cycle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../slides/slide9.xml"/></Relationships>'))
    const incoming = { id: 'untouched', slides: [{ id: 'first', notes: 'Keep me', elements: [] }] }
    const before = clone(incoming)
    await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation: incoming }))
      .rejects.toThrow(failure === 'metadata-cycle' ? /cycle/i : /ambiguous/i)
    expect(incoming).toEqual(before)
  })

  it.each(['ambiguous', 'cycle'])('fails %s source dependencies explicitly without publishing partial output', async (failure) => {
    const { zip } = await imported()
    if (failure === 'ambiguous') zip.file(layout, (await zip.file(layout).async('string')).replace('</p:spTree>', `${shape(99, 'body', 7)}</p:spTree>`))
    else zip.file('ppt/slideLayouts/_rels/unrelated-name.xml.rels', (await zip.file('ppt/slideLayouts/_rels/unrelated-name.xml.rels').async('string')).replace('../slideMasters/arbitrary.xml', '../slides/slide9.xml'))
    const input = { id: 'unchanged', slides: [{ id: 'first', elements: [] }] }
    const before = clone(input)
    await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation: input })).rejects.toThrow(failure === 'ambiguous' ? /ambiguous.*placeholder|placeholder.*ambiguous/i : /cycle/i)
    expect(input).toEqual(before)
  })

  it('preserves each dependent occurrence explicit overrides during edit-all without materializing unrelated fields', async () => {
    const { presentation } = await imported()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const siblingId = `copy:${instanceId}`
    // Give sibling an explicit override for color and italic
    const siblingStyled = applyPresentationProjectionOperation(presentation, operation(siblingId, {
      type: 'text-style',
      properties: { color: { kind: 'srgb', value: '118833' }, italic: true },
    }))
    expect(materializeTextDocument(siblingStyled.pptxSemantic, siblingId).paragraphs[0].runs[0].properties.color.value).toBe('118833')
    expect(materializeTextDocument(siblingStyled.pptxSemantic, siblingId).paragraphs[0].runs[0].properties.italic).toBe(true)

    // Selected instance edits text via text-document in edit-all
    const selectedDoc = clone(materializeTextDocument(siblingStyled.pptxSemantic, instanceId))
    selectedDoc.paragraphs[0].runs[0].text = 'All instances updated'
    const intent = operation(instanceId, { type: 'text-document', document: selectedDoc }, { scope: 'all' })
    const preview = previewInheritanceEdit(siblingStyled, intent)
    expect(preview.occurrences).toHaveLength(2)
    const allEdited = applyPresentationProjectionOperation(siblingStyled, { ...intent, preview })

    // Selected instance text changed
    expect(label(allEdited, instanceId)).toBe('All instances updated')
    // Sibling instance text also updated
    expect(label(allEdited, siblingId)).toBe('All instances updated')
    // Sibling explicit overrides (color, italic) strictly preserved
    const siblingMat = materializeTextDocument(allEdited.pptxSemantic, siblingId)
    expect(siblingMat.paragraphs[0].runs[0].properties.color.value).toBe('118833')
    expect(siblingMat.paragraphs[0].runs[0].properties.italic).toBe(true)
    // Source definitions immutable
    expect(allEdited.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
  })

  it('supports schema 3 semantic graph inheritance editing and theme recomputation', async () => {
    const { presentation } = await imported()
    const schema3Pres = clone(presentation)
    schema3Pres.pptxSemantic = compactSemanticGraph(presentation.pptxSemantic)
    expect(schema3Pres.pptxSemantic.schemaVersion).toBe(3)

    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const intent = operation(instanceId, { type: 'label', value: 'Schema 3 label' }, { scope: 'all' })
    const preview = previewInheritanceEdit(schema3Pres, intent)
    expect(preview.occurrences).toHaveLength(2)
    const edited = applyPresentationProjectionOperation(schema3Pres, { ...intent, preview })
    expect(label(edited, instanceId)).toBe('Schema 3 label')
    expect(label(edited, `copy:${instanceId}`)).toBe('Schema 3 label')

    // Test theme categories lookup with schema 3
    const themeId = Object.entries(presentation.pptxSemantic.styles).find(([, s]) => s.kind === 'theme')[0]
    const categories = geometryThemeCategories(edited.pptxSemantic, { themeId })
    expect(categories.colors.styleId).toBe(themeId)
    expect(categories.colors.value).toBeDefined()
  })

  it('rejects cyclic definition parentage and foreign source definitions explicitly', async () => {
    const { presentation } = await imported()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const instance = presentation.pptxSemantic.instances[instanceId]
    const defId = instance.definitionId

    // Foreign definition rejection
    const foreignIntent = operation(instanceId, { type: 'label', value: 'Foreign' }, {
      sourceDefinitionId: 'nonexistent-definition',
    })
    expect(() => previewInheritanceEdit(presentation, foreignIntent)).toThrow(/foreign/i)

    // Cycle in definition parentDefinitionId
    const cyclicPres = clone(presentation)
    const masterDef = Object.values(cyclicPres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === master && d.kind === 'shape'
    )
    cyclicPres.pptxSemantic.definitions[defId].parentDefinitionId = defId
    const cyclicIntent = operation(instanceId, { type: 'label', value: 'Cycle' }, {
      scope: 'all',
      sourceDefinitionId: masterDef.id,
    })
    expect(() => previewInheritanceEdit(cyclicPres, cyclicIntent)).toThrow(/cycle/i)
  })

  it('enforces strict inheritance-override record validation in validateGeometryStyleRecords', async () => {
    const { presentation } = await imported()
    const doc = clone(presentation.pptxSemantic)
    const instanceId = Object.keys(doc.instances)[0]
    const baseDefId = doc.instances[instanceId].definitionId

    // Valid sparse inheritance-override
    doc.styles['override-1'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: baseDefId,
      values: {
        label: 'Owner updated text',
        textStyle: { italic: true },
        geometryStyle: { fill: { color: { kind: 'srgb', value: '445566' } } },
      },
    }
    expect(() => validateGeometryStyleRecords(doc)).not.toThrow()

    // Duplicate inheritance override for same baseDefinitionId violates 1:1 constraint
    const dupDoc = clone(doc)
    dupDoc.styles['override-2'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: baseDefId,
      values: { label: 'Second' },
    }
    expect(() => validateGeometryStyleRecords(dupDoc)).toThrow(/duplicate inheritance override/i)

    // Non-source or missing baseDefinitionId
    const missingDefDoc = clone(doc)
    missingDefDoc.styles['override-1'].baseDefinitionId = 'missing-def-id'
    expect(() => validateGeometryStyleRecords(missingDefDoc)).toThrow(/invalid inheritance override/i)

    // Disallowed target definition kinds unconditionally tested (presentation-properties, guide-list, source-part-identity, transition)
    for (const [forbiddenId, forbiddenDef] of [
      ['forbidden-guide', { id: 'forbidden-guide', kind: 'source-guide-list', origin: 'source', content: {} }],
      ['forbidden-pres', { id: 'forbidden-pres', kind: 'presentation-properties', origin: 'source', content: {} }],
      ['forbidden-part', { id: 'forbidden-part', kind: 'source-part-identity', origin: 'source', content: {} }],
      ['forbidden-trans', { id: 'forbidden-trans', kind: 'slide', origin: 'source', content: { transitionDocument: {} } }],
    ]) {
      const disallowedDoc = clone(doc)
      disallowedDoc.definitions[forbiddenId] = forbiddenDef
      disallowedDoc.styles['override-1'].baseDefinitionId = forbiddenId
      expect(() => validateGeometryStyleRecords(disallowedDoc)).toThrow(/invalid inheritance override/i)
    }

    // Reject non-sparse / full-tree payload or invalid fields in values
    const invalidValuesDoc = clone(doc)
    invalidValuesDoc.styles['override-1'].values = {
      label: 'Valid',
      components: [{ id: 'bad-component' }],
    }
    expect(() => validateGeometryStyleRecords(invalidValuesDoc)).toThrow(/project inheritance override/i)

    // Reject unknown properties in textStyle
    const unknownTextPropDoc = clone(doc)
    unknownTextPropDoc.styles['override-1'].values = {
      textStyle: { unexpected: { textDocument: {} } },
    }
    expect(() => validateGeometryStyleRecords(unknownTextPropDoc)).toThrow(/project inheritance override/i)

    // Reject oversized label
    const oversizedLabelDoc = clone(doc)
    oversizedLabelDoc.styles['override-1'].values = {
      label: 'x'.repeat(10001),
    }
    expect(() => validateGeometryStyleRecords(oversizedLabelDoc)).toThrow(/project inheritance override/i)
  })

  it('respects materialization precedence: Occurrence Local direct override > Owner Inheritance Override > Source Baseline / Theme', async () => {
    const { presentation } = await imported()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const siblingId = `copy:${instanceId}`
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    // Give siblingId an explicit local override for text color and geometry fill
    const localStyled = applyPresentationProjectionOperation(presentation, operation(siblingId, {
      type: 'text-style',
      properties: { color: { kind: 'srgb', value: '118833' } },
    }))
    const localWithGeom = applyPresentationProjectionOperation(localStyled, operation(siblingId, {
      type: 'geometry-style',
      style: { fill: { color: { kind: 'srgb', value: '229944' } } },
    }))

    // Apply owner inheritance override on the shared definition
    const ownerIntent = operation(instanceId, {
      type: 'owner-override',
      baseDefinitionId: baseDefId,
      values: {
        label: 'Owner Label',
        textStyle: { color: { kind: 'srgb', value: 'FF0000' }, italic: true },
        geometryStyle: {
          fill: { color: { kind: 'srgb', value: 'FFAA00' } },
          stroke: { width: 30000, color: { kind: 'srgb', value: '0000FF' } },
        },
      },
    }, { scope: 'all' })

    const preview = previewInheritanceEdit(localWithGeom, ownerIntent)
    expect(preview.occurrences).toHaveLength(2)
    const ownerApplied = applyPresentationProjectionOperation(localWithGeom, { ...ownerIntent, preview })

    // 1. instanceId had NO local direct overrides:
    // - gets Owner Inheritance Override for label, italic, text color, geometry fill, and stroke
    expect(label(ownerApplied, instanceId)).toBe('Owner Label')
    const instText = materializeTextDocument(ownerApplied.pptxSemantic, instanceId)
    expect(instText.paragraphs[0].runs[0].properties.color.value).toBe('FF0000')
    expect(instText.paragraphs[0].runs[0].properties.italic).toBe(true)
    const instGeom = materializeGeometry(ownerApplied.pptxSemantic, instanceId)
    expect(instGeom.style.fill.color.value).toBe('FFAA00')
    expect(instGeom.style.stroke.color.value).toBe('0000FF')

    // 2. siblingId HAD local direct override for text color ('118833') and geometry fill ('229944'):
    // - Local direct override takes precedence: text color is '118833', geometry fill is '229944'
    // - Owner Inheritance Override takes precedence over Source Baseline for properties not locally overridden: italic is true, stroke color is '0000FF'
    const sibText = materializeTextDocument(ownerApplied.pptxSemantic, siblingId)
    expect(sibText.paragraphs[0].runs[0].properties.color.value).toBe('118833')
    expect(sibText.paragraphs[0].runs[0].properties.italic).toBe(true)
    const sibGeom = materializeGeometry(ownerApplied.pptxSemantic, siblingId)
    expect(sibGeom.style.fill.color.value).toBe('229944')
    expect(sibGeom.style.stroke.color.value).toBe('0000FF')
  })
  it('enforces schema 3 admission validation of inheritance-override records', async () => {
    const { presentation } = await imported()
    const schema3Pres = clone(presentation)
    schema3Pres.pptxSemantic = compactSemanticGraph(presentation.pptxSemantic)
    const baseDefId = Object.keys(presentation.pptxSemantic.instances)[0]
    const defId = presentation.pptxSemantic.instances[baseDefId].definitionId

    // Valid inheritance-override admitted in schema 3
    schema3Pres.pptxSemantic.styles['project-inheritance:valid'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: defId,
      values: { label: 'Schema 3 valid label' },
    }
    expect(() => normalizeSemanticPresentation(schema3Pres)).not.toThrow()

    // Invalid inheritance-override (unknown textStyle property) rejected at admission
    const badSchema3 = clone(schema3Pres)
    badSchema3.pptxSemantic.styles['project-inheritance:valid'].values = {
      textStyle: { unknownProperty: true },
    }
    expect(() => normalizeSemanticPresentation(badSchema3)).toThrow(/project inheritance override/i)
  })

  it('merges owner-override values per-property without replacing entire categories', async () => {
    const { presentation } = await imported()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const firstIntent = operation(instanceId, {
      type: 'owner-override',
      baseDefinitionId: baseDefId,
      values: {
        textStyle: { color: { kind: 'srgb', value: 'AA1122' } },
        geometryStyle: { fill: { color: { kind: 'srgb', value: '334455' } } },
      },
    }, { scope: 'all' })
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const firstApplied = applyPresentationProjectionOperation(presentation, { ...firstIntent, preview: preview1 })

    const secondIntent = operation(instanceId, {
      type: 'owner-override',
      baseDefinitionId: baseDefId,
      values: {
        textStyle: { italic: true },
        geometryStyle: { stroke: { width: 25400, color: { kind: 'srgb', value: '778899' } } },
      },
    }, { scope: 'all' })
    const preview2 = previewInheritanceEdit(firstApplied, secondIntent)
    const secondApplied = applyPresentationProjectionOperation(firstApplied, { ...secondIntent, preview: preview2 })

    const text = materializeTextDocument(secondApplied.pptxSemantic, instanceId)
    expect(text.paragraphs[0].runs[0].properties.color.value).toBe('AA1122')
    expect(text.paragraphs[0].runs[0].properties.italic).toBe(true)

    const geom = materializeGeometry(secondApplied.pptxSemantic, instanceId)
    expect(geom.style.fill.color.value).toBe('334455')
    expect(geom.style.stroke.color.value).toBe('778899')
  })

  it('cascades sparse owner overrides across master and layout definition hierarchy', async () => {
    const { presentation } = await imported()
    const pres = clone(presentation)
    const instanceId = Object.keys(pres.pptxSemantic.instances)[0]
    const inst = pres.pptxSemantic.instances[instanceId]
    const layoutDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === layout && d.kind === 'shape'
    )
    const masterDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === master && d.kind === 'shape'
    )
    const slideDef = pres.pptxSemantic.definitions[inst.definitionId]
    slideDef.parentDefinitionId = layoutDef.id
    layoutDef.parentDefinitionId = masterDef.id
    const layoutDefId = layoutDef.id
    const masterDefId = masterDef.id
    expect(masterDefId).toBeDefined()

    // Master defines color and bold
    pres.pptxSemantic.styles['project-inheritance:master'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: masterDefId,
      values: {
        textStyle: { color: { kind: 'srgb', value: '112233' }, bold: true },
        geometryStyle: { fill: { color: { kind: 'srgb', value: '001122' } } },
      },
    }

    // Layout defines italic and overrides bold to false
    pres.pptxSemantic.styles['project-inheritance:layout'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: layoutDefId,
      values: {
        textStyle: { italic: true, bold: false },
        geometryStyle: { stroke: { width: 12700, color: { kind: 'srgb', value: '334455' } } },
      },
    }

    const text = materializeTextDocument(pres.pptxSemantic, instanceId)
    expect(text.paragraphs[0].runs[0].properties.color.value).toBe('112233')
    // Inherits italic from layout
    expect(text.paragraphs[0].runs[0].properties.italic).toBe(true)
    // Layout bold (false) overrides master bold (true)
    expect(text.paragraphs[0].runs[0].properties.bold).toBe(false)

    const geom = materializeGeometry(pres.pptxSemantic, instanceId)
    expect(geom.style.fill.color.value).toBe('001122')
    // Stroke from layout
    expect(geom.style.stroke.color.value).toBe('334455')
  })

  it('allows owner labels to pass through to occurrences with only local text-style edits', async () => {
    const { presentation } = await imported()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const siblingId = `copy:${instanceId}`
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    // Sibling gets only a local color edit (text label unchanged)
    const siblingStyled = applyPresentationProjectionOperation(presentation, operation(siblingId, {
      type: 'text-style',
      properties: { color: { kind: 'srgb', value: '990022' } },
    }))

    // Apply owner override with label
    const ownerIntent = operation(instanceId, {
      type: 'owner-override',
      baseDefinitionId: baseDefId,
      values: { label: 'New Owner Label' },
    }, { scope: 'all' })
    const preview = previewInheritanceEdit(siblingStyled, ownerIntent)
    const ownerApplied = applyPresentationProjectionOperation(siblingStyled, { ...ownerIntent, preview })

    // Sibling receives owner label because its label was not locally edited
    expect(label(ownerApplied, siblingId)).toBe('New Owner Label')
    // Sibling preserves its local color override
    expect(materializeTextDocument(ownerApplied.pptxSemantic, siblingId).paragraphs[0].runs[0].properties.color.value).toBe('990022')
  })
})
