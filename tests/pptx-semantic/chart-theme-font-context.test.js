import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { ommlSourceFixture, slide, layout, master } from './omml-source-context-fixture'
import { A, P, R } from './semantic-text-style-context-fixture'
import { expandedTextContextDocument } from './text-context-fixture-utils'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const { familyCompatibilityElement } = require('../../shared/src/pptx-family-operations')
const { projectChartRender } = require('../../shared/src/pptx-chart-render')
const { prepareSemanticOutputPaint } = require('../../shared/src/pptx-semantic-output-paint')
const {
  normalizePptxSemanticDocument,
  PptxSemanticValidationError,
} = require('../../shared/src/pptx-semantic-document')
const { expandTextContext } = require('../../shared/src/pptx-semantic-text-context-codec')
const { resolvedChartTextStyle } = require('../../shared/src/pptx-chart-visual-contract')
const {
  assertSnapshotBudget,
  canonicalEditableSnapshot,
} = require('../../server/services/pptx-import/canonical-snapshot')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { canonicalJson } = require('../../server/services/pptx-import/package-store/schemas')
const { safeSnapshot } = require('../../server/services/pptx-import/generic-journal-safety')
const {
  deriveMutationJournal,
  replayJournal,
} = require('../../server/services/pptx-import/mutation-journal')
const {
  collectTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  readSemanticTextStyleContext,
} = require('../../server/services/pptx-import/ooxml-semantic-text-context')
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const part = 'ppt/charts/authored.xml'
const theme = 'ppt/theme/not-indexed.xml'
const clone = (value) => JSON.parse(JSON.stringify(value))
const rels = (kind, target, id) =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${id}" Type="${R}/${kind}" Target="${target}"/></Relationships>`
const style = (face) =>
  `<a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="0" i="0"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:latin typeface="${face}"/></a:defRPr></a:pPr><a:r><a:t>Title</a:t></a:r></a:p>`

async function fixture(face = '+mn-lt') {
  const zip = await ommlSourceFixture()
  const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="3810000" cy="2857500"/></p:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" r:id="chart"/></a:graphicData></a:graphic></p:graphicFrame>`
  for (const p of [slide, layout, master])
    zip.file(
      p,
      (await zip.file(p).async('string')).replace(
        /<p:sp>[\s\S]*?<\/p:sp>/g,
        p === slide ? frame : ''
      )
    )
  zip.file(
    'ppt/slides/_rels/slide9.xml.rels',
    (await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string')).replace(
      '</Relationships>',
      `<Relationship Id="chart" Type="${R}/chart" Target="../charts/authored.xml"/></Relationships>`
    )
  )
  zip.file(
    part,
    `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}"><c:chart><c:title><c:tx><c:rich>${style(face)}</c:rich></c:tx></c:title><c:plotArea><c:pieChart><c:ser><c:idx val="0"/><c:order val="0"/><c:spPr><a:solidFill><a:srgbClr val="AA0000"/></a:solidFill></c:spPr><c:val><c:numLit><c:ptCount val="1"/><c:pt idx="0"><c:v>1</c:v></c:pt></c:numLit></c:val></c:ser></c:pieChart></c:plotArea></c:chart><c:txPr>${style('+mn-lt').replace('<a:r><a:t>Title</a:t></a:r>', '')}</c:txPr></c:chartSpace>`
  )
  // An unlinked indexed theme must never win over the actual owner relationship.
  zip.file(
    'ppt/theme/theme1.xml',
    (await zip.file(theme).async('string')).replace('typeface="Minor"', 'typeface="Decoy"')
  )
  return zip
}
async function imported(zip) {
  const result = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: {
      id: 'deck',
      slides: [
        { id: 'slide', elements: [] },
        ...(zip.file('ppt/slides/second.xml') ? [{ id: 'second', elements: [] }] : []),
      ],
    },
  })
  const semantic = result.presentation.pptxSemantic
  const instances = Object.values(semantic.instances).filter(
    (i) => semantic.definitions[i.definitionId].kind === 'chart'
  )
  return { semantic, instances, presentation: result.presentation }
}
function runtime(family = 'Minor') {
  const measured = []
  return {
    measured,
    fontProfile: { faces: [{ id: 'physical', typeface: family, bold: false, italic: false }] },
    rendererProfile: {},
    fontFamilies: { physical: 'destination_physical' },
    measurement: {
      validate: () => null,
      measureLine: (input) => {
        measured.push(input.items[0])
        return { width: 40, height: 16, baseline: 12, issues: [] }
      },
    },
  }
}

it.each([
  [
    'source locator',
    (_model, entry) => {
      entry.source.componentLocator.path = [0]
    },
  ],
  [
    'source hash',
    (_model, entry) => {
      entry.source.preconditionHash = 'b'.repeat(64)
    },
  ],
  [
    'shape inheritance',
    (_model, entry) => {
      entry.payload.body.entries.push({})
    },
  ],
  [
    'placeholder target',
    (_model, entry) => {
      entry.payload.body.target.placeholder = { type: 'chart' }
    },
  ],
  [
    'paragraph inventory',
    (_model, entry) => {
      entry.payload.paragraphs.push({})
    },
  ],
  [
    'provider binding',
    (_model, entry, instance) => {
      entry.payload.bindings.layoutDefinitionId = instance.definitionId
    },
  ],
  [
    'theme outside graph',
    (_model, entry) => {
      entry.payload.theme.source.part = 'ppt/theme/theme1.xml'
    },
  ],
  [
    'edge order',
    (_model, entry) => {
      entry.payload.relationships.reverse()
    },
  ],
  [
    'missing root receipt',
    (_model, entry) => {
      entry.payload.provenance = entry.payload.provenance.filter(
        (r) => r.source.part !== slide || r.source.path !== '0'
      )
    },
  ],
  [
    'duplicate receipt',
    (_model, entry) => {
      entry.payload.provenance.push(clone(entry.payload.provenance[0]))
    },
  ],
  [
    'missing binding',
    (model, _entry, instance) => {
      delete model.instances[instance.id].textSourceBinding
    },
  ],
  [
    'unbound context',
    (model, _entry, instance) => {
      delete model.instances[instance.id]
    },
  ],
  [
    'missing frame anchor',
    (model, entry, instance) => {
      delete model.definitions[instance.definitionId].source.componentLocator
      delete entry.source.componentLocator
    },
  ],
])('rejects a chart context with %s', async (name, change) => {
  const {
    semantic,
    instances: [instance],
  } = await imported(await fixture())
  const model = expandedTextContextDocument(semantic)
  const entry = model.styles[instance.textSourceBinding.contextId]
  change(model, entry, instance)
  expect(() => normalizePptxSemanticDocument(model), name).toThrow()
})

it('requires a substantive linked record for chart-only schema two', async () => {
  const {
    semantic,
    instances: [instance],
  } = await imported(await fixture())
  expect(semantic.schemaVersion).toBe(2)
  expect(Object.values(semantic.definitions).some((d) => d.content.geometrySource)).toBe(false)
  const model = clone(semantic)
  delete model.styles[instance.textSourceBinding.contextId]
  delete model.instances[instance.id].textSourceBinding
  expect(() => normalizePptxSemanticDocument(model)).toThrow()
})

it('keeps coordinated graph-receipt changes structurally distinct from server authority', async () => {
  const {
    semantic,
    instances: [instance],
    presentation,
  } = await imported(await fixture())
  const model = expandedTextContextDocument(semantic)
  const entry = model.styles[instance.textSourceBinding.contextId]
  entry.payload.relationships[0].preconditionHash = 'b'.repeat(64)
  expect(() => normalizePptxSemanticDocument(model)).not.toThrow()
  const changed = { ...presentation, pptxSemantic: model }
  expect(() => assertSemanticBaseline(presentation, changed)).toThrow()
  expect(collectSemanticFontRequests(model).faces).toEqual(
    collectSemanticFontRequests(semantic).faces
  )
  expect(collectSemanticFontRequests(model).identity).not.toBe(
    collectSemanticFontRequests(semantic).identity
  )
  expect(collectTrustedImportMetadata(changed, 'original').projection.immutableSourceHash).not.toBe(
    collectTrustedImportMetadata(presentation, 'original').projection.immutableSourceHash
  )
})

it('retains compact source ownership and authored aliases across canonical save snapshots', async () => {
  const { presentation, semantic } = await imported(await fixture())
  const original = JSON.stringify(presentation)
  const saved = canonicalEditableSnapshot(presentation)
  expect(saved.pptxSemantic).toEqual(semantic)
  const reopened = canonicalEditableSnapshot(clone(saved))
  expect(JSON.stringify(reopened)).toBe(JSON.stringify(saved))
  expect(JSON.stringify(presentation)).toBe(original)
  expect(() => assertSemanticBaseline(presentation, saved)).not.toThrow()
  const expanded = expandedTextContextDocument(semantic)
  expect(collectSemanticFontRequests(expanded).identity).toBe(
    collectSemanticFontRequests(semantic).identity
  )
})

it.each(['compact', 'expanded'])(
  'retains %s chart context ownership through canonical package-state encoding',
  async (encoding) => {
    const { presentation } = await imported(await fixture())
    const input = clone(presentation)
    if (encoding === 'expanded')
      input.pptxSemantic = expandedTextContextDocument(input.pptxSemantic)
    const saved = canonicalEditableSnapshot(input)
    const hydrated = JSON.parse(canonicalJson(saved))
    expect(() => normalizePptxSemanticDocument(hydrated.pptxSemantic)).not.toThrow()
    expect(canonicalJson(canonicalEditableSnapshot(hydrated))).toBe(canonicalJson(saved))
    expect(() => assertSemanticBaseline(saved, hydrated)).not.toThrow()
    expect(collectSemanticFontRequests(hydrated.pptxSemantic).identity).toBe(
      collectSemanticFontRequests(saved.pptxSemantic).identity
    )
    const tampered = clone(hydrated)
    const context = Object.values(tampered.pptxSemantic.styles).find(
      (record) => record.kind === 'text-context'
    )
    context.source.componentLocator.path[0] += 1
    expect(() => normalizePptxSemanticDocument(tampered.pptxSemantic)).toThrow(
      PptxSemanticValidationError
    )
  }
)

it('retains typed chart ownership through journal safe snapshots and replay', async () => {
  const { presentation } = await imported(await fixture())
  const saved = canonicalEditableSnapshot(presentation)
  expect(canonicalJson(safeSnapshot(saved))).toBe(canonicalJson(saved))
  const journal = deriveMutationJournal(saved, saved)
  expect(journal.operations).toEqual([])
  expect(canonicalJson(replayJournal(saved, journal))).toBe(canonicalJson(saved))
  const changed = clone(saved)
  changed.title = 'Changed chart presentation'
  const changedJournal = deriveMutationJournal(saved, changed)
  expect(changedJournal.operations).toHaveLength(1)
  expect(changedJournal.operations[0]).toMatchObject({
    kind: 'property-change',
    targetKind: 'presentation',
    targetId: saved.id,
    property: 'title',
    before: saved.title,
    after: changed.title,
  })
  const replayed = replayJournal(saved, changedJournal)
  expect(canonicalJson(replayed)).toBe(canonicalJson(changed))
  expect(canonicalJson(replayJournal(replayed, changedJournal))).toBe(canonicalJson(replayed))
  expect(replayed.pptxSemantic).toEqual(saved.pptxSemantic)
  expect(replayed.slides[0].elements[0].chartDocument.source).toEqual(
    saved.slides[0].elements[0].chartDocument.source
  )
  const foreign = clone(saved)
  foreign.slides[0].elements[0].chartDocument.source.preconditionHash = 'b'.repeat(64)
  expect(() => safeSnapshot(foreign)).toThrow(TypeError)
})

it.each(['element metadata', 'unlinked chart', 'nested chart', 'nested semantic'])(
  'retains legacy depth enforcement for %s beside a typed chart',
  async (kind) => {
    const { presentation } = await imported(await fixture())
    const input = clone(presentation)
    const element = input.slides[0].elements[0]
    let deep = 'leaf'
    for (let index = 0; index < 17; index++) deep = { child: deep }
    if (kind === 'element metadata') element.untrusted = deep
    if (kind === 'unlinked chart') delete element.pptxInstanceId
    if (kind === 'nested chart')
      input.untrusted = {
        nested: { nested: { nested: { chartDocument: clone(element.chartDocument) } } },
      }
    if (kind === 'nested semantic') input.untrusted = { pptxSemantic: deep }
    expect(() => assertSnapshotBudget(input)).toThrow(/Snapshot budget exceeded: nesting/)
  }
)

it('rejects a typed chart occurrence attached to a foreign slide', async () => {
  const { presentation } = await imported(await fixture())
  const input = clone(presentation)
  input.slides[0].id = 'foreign'
  expect(() => assertSnapshotBudget(input)).toThrow(TypeError)
})

it('validates the typed chart copy before granting structural depth treatment', async () => {
  const { presentation } = await imported(await fixture())
  const input = clone(presentation)
  input.slides[0].elements[0].chartDocument.unknown = true
  expect(() => assertSnapshotBudget(input)).toThrow(/Invalid PPTX chart contract/)
})

it('does not grant a foreign source chart copy the owner depth treatment', async () => {
  const { presentation } = await imported(await fixture())
  const input = clone(presentation)
  input.slides[0].elements[0].chartDocument.source.preconditionHash = 'b'.repeat(64)
  expect(() => assertSnapshotBudget(input)).toThrow()
})

it('counts the raw chart copy in aggregate bytes without using its stale values as authority', async () => {
  const { presentation } = await imported(await fixture())
  const input = clone(presentation)
  input.slides[0].elements[0].chartDocument.textStyle.color = 'FFFFFF'
  expect(JSON.stringify(canonicalEditableSnapshot(input))).toBe(
    JSON.stringify(canonicalEditableSnapshot(presentation))
  )
  expect(() =>
    assertSnapshotBudget(input, {
      maxSnapshotBytes: Buffer.byteLength(JSON.stringify(input)) - 1,
    })
  ).toThrow(/Snapshot budget exceeded: aggregate bytes/)
})

it('counts raw compatibility chart keys beside a validated schema three graph', async () => {
  const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
  const { presentation } = await imported(await fixture())
  const input = clone(presentation)
  input.pptxSemantic = compactSemanticGraph(input.pptxSemantic)
  const keys = value => value && typeof value === 'object'
    ? Object.keys(value).length + Object.values(value).reduce((n, child) => n + keys(child), 0) : 0
  const limit = keys({ ...input, pptxSemantic: undefined })
  expect(assertSnapshotBudget(input, { maxObjectKeys: limit })).toBe(Buffer.byteLength(JSON.stringify(input)))
  expect(() => assertSnapshotBudget(input, { maxObjectKeys: limit - 1 })).toThrow(/passthrough properties/)
  input.slides[0].elements[0].chartDocument.source.preconditionHash = 'b'.repeat(64)
  expect(() => assertSnapshotBudget(input)).toThrow()
})

it('handles typed chart projection depth on a nested slide without changing its canonical snapshot', async () => {
  const { presentation } = await imported(await fixture())
  const input = {
    ...presentation,
    slides: [{ id: 'parent', elements: [], children: presentation.slides }],
  }
  const saved = canonicalEditableSnapshot(input)
  expect(JSON.stringify(canonicalEditableSnapshot(clone(saved)))).toBe(JSON.stringify(saved))
  expect(saved.pptxSemantic).toEqual(presentation.pptxSemantic)
})

it.each([
  ['+mn-lt', { minor: { latin: 'Minor' } }, 'Minor', null],
  ['+mj-lt', { major: { latin: 'Major' } }, 'Major', null],
  ['+mn-lt', undefined, null, 'missing-theme-font'],
  ['+mn-lt', { minor: {} }, null, 'missing-theme-font'],
  ['+mn-lt', { minor: { latin: '' } }, null, 'missing-theme-font'],
  ['+mn-lt', { minor: { latin: '+mj-lt' } }, null, 'missing-theme-font'],
  ['+mn-unknown', { minor: { latin: 'Minor' } }, null, 'unsupported-theme-font-token'],
  ['Direct', undefined, 'Direct', null],
])('resolves chart font token %s without a browser fallback', (token, fonts, family, reason) => {
  const document = { textStyle: { fontFamily: token, bold: true, italic: true } }
  const before = clone(document)
  expect(resolvedChartTextStyle(document, fonts ? { fonts } : undefined)).toEqual({
    style: { fontFamily: family, bold: true, italic: true },
    reason,
  })
  expect(document).toEqual(before)
  expect(
    resolvedChartTextStyle(document, fonts ? { fonts } : undefined, {
      fontFamily: 'Direct',
      bold: false,
      italic: false,
    })
  ).toEqual({ style: { fontFamily: 'Direct', bold: false, italic: false }, reason: null })
})

it('rejects chart-local alternate theme authority rather than using the host theme', async () => {
  const zip = await fixture()
  zip.file(
    'ppt/charts/_rels/authored.xml.rels',
    rels('themeOverride', '../theme/theme1.xml', 'override')
  )
  await expect(imported(zip)).rejects.toThrow()
})

it('resolves an imported chart alias through its actual linked theme for requests, canvas and generated output', async () => {
  const zip = await fixture(),
    bytes = await zip.file(part).async('string')
  const {
    semantic,
    instances: [instance],
  } = await imported(zip)
  expect(instance.textSourceBinding).toBeDefined()
  const context = expandTextContext(semantic.styles[instance.textSourceBinding.contextId].payload, {
    styles: semantic.styles,
  })
  expect(context.theme.source.part).toBe(theme)
  const before = clone(semantic)
  const element = familyCompatibilityElement(semantic, { pptxInstanceId: instance.id })
  expect(element.chartDocument.title.textStyle.fontFamily).toBe('+mn-lt')
  const fonts = collectSemanticFontRequests(semantic)
  expect(fonts.issues).toEqual([])
  expect(fonts.faces.map((f) => f.typeface)).toEqual(['Minor'])
  const fontRuntime = runtime()
  const canvas = projectChartRender(element.chartDocument, {
    width: 400,
    height: 300,
    theme: element.pptxTextContext.theme,
    fontRuntime,
  })
  expect(canvas.supported).toBe(true)
  expect(canvas.svg).toContain('font-family="destination_physical"')
  const node = {
    getAttribute: (name) =>
      ({ 'data-pptx-semantic-mount': instance.id, 'data-pptx-semantic-slide': instance.slideId })[
        name
      ],
  }
  const output = prepareSemanticOutputPaint(
    { querySelectorAll: () => [node] },
    semantic,
    [{ instanceId: instance.id, slideId: instance.slideId }],
    fontRuntime
  )
  expect(output[0].svg).toBe(canvas.svg)
  expect(fontRuntime.measured.map((item) => item.properties.fontFamily)).toEqual(['Minor', 'Minor'])
  expect(clone(semantic)).toEqual(before)
  expect(await zip.file(part).async('string')).toBe(bytes)
})

it('keeps direct literal title families above chart aliases', async () => {
  const {
    semantic,
    instances: [instance],
  } = await imported(await fixture('Direct'))
  const element = familyCompatibilityElement(semantic, { pptxInstanceId: instance.id })
  expect(collectSemanticFontRequests(semantic).faces.map((f) => f.typeface)).toEqual([
    'Direct',
    'Minor',
  ])
  const fontRuntime = runtime('Direct')
  expect(
    projectChartRender(element.chartDocument, {
      width: 400,
      height: 300,
      theme: element.pptxTextContext?.theme,
      fontRuntime,
    }).supported
  ).toBe(true)
  expect(fontRuntime.measured[0].properties.fontFamily).toBe('Direct')
})

it('fails closed for missing runtime theme and stale source theme bytes', async () => {
  const zip = await fixture()
  const {
    semantic,
    instances: [instance],
  } = await imported(zip)
  const element = familyCompatibilityElement(semantic, { pptxInstanceId: instance.id })
  expect(
    projectChartRender(element.chartDocument, { width: 400, height: 300, fontRuntime: runtime() })
  ).toMatchObject({ supported: false, issues: [{ code: 'missing-theme-font' }] })
  const forged = clone(semantic)
  delete forged.styles[instance.textSourceBinding.contextId]
  expect(() => normalizePptxSemanticDocument(forged)).toThrow()
  const inventory = await buildSemanticInventory(zip)
  zip.file(theme, (await zip.file(theme).async('string')).replace('Minor', 'Stale'))
  await expect(
    readSemanticTextStyleContext({ zip, inventory, occurrenceId: instance.id })
  ).rejects.toThrow(/stale part/)
})

it('isolates chart occurrences with different owner-linked themes and rejects cross-binding', async () => {
  const zip = await fixture()
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:sldIdLst>',
      '<p:sldId id="257" r:id="second"/></p:sldIdLst>'
    )
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    (await zip.file('ppt/_rels/presentation.xml.rels').async('string')).replace(
      '</Relationships>',
      `<Relationship Id="second" Type="${R}/slide" Target="slides/second.xml"/></Relationships>`
    )
  )
  zip.file('ppt/slides/second.xml', await zip.file(slide).async('string'))
  zip.file(
    'ppt/slides/_rels/second.xml.rels',
    (await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string'))
      .replace('../slideLayouts/unrelated-name.xml', '../slideLayouts/second.xml')
      .replace('../charts/authored.xml', '../charts/second.xml')
  )
  zip.file('ppt/charts/second.xml', await zip.file(part).async('string'))
  zip.file(
    'ppt/slideLayouts/second.xml',
    `<p:sldLayout xmlns:p="${P}"><p:cSld><p:spTree/></p:cSld></p:sldLayout>`
  )
  zip.file(
    'ppt/slideLayouts/_rels/second.xml.rels',
    rels('slideMaster', '../slideMasters/second.xml', 'secondMaster')
  )
  zip.file('ppt/slideMasters/second.xml', await zip.file(master).async('string'))
  zip.file(
    'ppt/slideMasters/_rels/second.xml.rels',
    rels('theme', '../theme/second.xml', 'secondTheme')
  )
  zip.file(
    'ppt/theme/second.xml',
    (await zip.file(theme).async('string')).replace('typeface="Minor"', 'typeface="Second"')
  )
  const { semantic, instances } = await imported(zip),
    before = clone(semantic)
  expect(instances).toHaveLength(2)
  for (const [index, instance] of instances.entries()) {
    const element = familyCompatibilityElement(semantic, { pptxInstanceId: instance.id })
    const family = ['Minor', 'Second'][index],
      fontRuntime = runtime(family)
    expect(
      projectChartRender(element.chartDocument, {
        width: 400,
        height: 300,
        theme: element.pptxTextContext?.theme,
        fontRuntime,
      }).supported
    ).toBe(true)
    expect(fontRuntime.measured[0].properties.fontFamily).toBe(family)
  }
  expect(collectSemanticFontRequests(semantic).faces.map((f) => f.typeface)).toEqual([
    'Minor',
    'Second',
  ])
  expect(clone(semantic)).toEqual(before)
  const forged = clone(semantic)
  forged.instances[instances[0].id].textSourceBinding = clone(instances[1].textSourceBinding)
  expect(() => normalizePptxSemanticDocument(forged)).toThrow()
})
