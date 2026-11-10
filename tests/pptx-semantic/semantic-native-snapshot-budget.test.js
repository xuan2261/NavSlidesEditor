// @vitest-environment node
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { expandedTextContextDocument } from './text-context-fixture-utils'

const require = createRequire(import.meta.url)
const { importPptxFile } = require('../../server/services/pptx-import/importer')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const {
  assertSnapshotBudget,
  canonicalEditableSnapshot,
} = require('../../server/services/pptx-import/canonical-snapshot')
const source = path.resolve('server/data/test-corpus/non-default-4x3-resolution.pptx')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
let root, transaction, presentation, sourceHash

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'navslides-native-snapshot-'))
  transaction = createMediaTransaction({ hashScope: {} })
  sourceHash = hash(await readFile(source))
  const result = await importPptxFile(source, {
    originalName: path.basename(source),
    semanticImport: true,
    geometryInheritance: true,
    uploadsDir: root,
    mediaTransaction: transaction,
  })
  presentation = result.presentation
})
afterAll(async () => {
  await transaction?.rollback()
  if (root) await rm(root, { recursive: true, force: true })
})

const nested = (depth) => {
  let value = 'leaf'
  for (let index = 0; index < depth; index++) value = { child: value }
  return value
}

describe('native semantic snapshot publication budgets', () => {
  it('publishes repeated native theme contexts without duplicating immutable source records', async () => {
    const JSZip = require('jszip')
    const bytes = await readFile(source)
    const zip = await JSZip.loadAsync(bytes)
    let slide = await zip.file('ppt/slides/slide1.xml').async('string')
    const slideRelations = await zip.file('ppt/slides/_rels/slide1.xml.rels').async('string')
    const seed = slide.match(/<p:sp>[\s\S]*?<\/p:sp>/)?.[0]
    expect(seed).toBeTypeOf('string')
    const copies = Array.from({ length: 7 }, (_, index) =>
      seed.replace(
        /(<p:cNvPr\b[^>]*\bid=")\d+(")/,
        (_, start, end) => `${start}${9000 + index}${end}`
      )
    ).join('')
    slide = slide.replace('</p:spTree>', `${copies}</p:spTree>`)
    zip.file('ppt/slides/slide1.xml', slide)
    const scripts =
      'Jpan Hang Hans Hant Arab Hebr Thai Ethi Beng Gujr Khmr Knda Guru Cans Cher Yiii Tibt Thaa Deva Telu Taml Syrc Orya Mlym Laoo Sinh Mong Viet Uigh Geor Armn Bugi Bopo Java Lisu Mymr Nkoo Olck Osma Phag Syrn Syrj Syre Sora Tale Talu Tfng'.split(
        ' '
      )
    const theme = await zip.file('ppt/theme/theme1.xml').async('string')
    zip.file(
      'ppt/theme/theme1.xml',
      theme.replace(
        /<a:(majorFont|minorFont)>([\s\S]*?)<\/a:\1>/g,
        (_, kind, body) =>
          `<a:${kind}>${body}${scripts
            .filter((script) => !body.includes(`script="${script}"`))
            .map((script) => `<a:font script="${script}" typeface="Arial"/>`)
            .join('')}</a:${kind}>`
      )
    )
    let main = await zip.file('ppt/presentation.xml').async('string')
    let relations = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
    let types = await zip.file('[Content_Types].xml').async('string')
    for (let index = 2; index <= 7; index++) {
      zip.file(`ppt/slides/slide${index}.xml`, slide)
      zip.file(`ppt/slides/_rels/slide${index}.xml.rels`, slideRelations)
      main = main.replace(
        '</p:sldIdLst>',
        `<p:sldId id="${900 + index}" r:id="rIdRepeated${index}"/></p:sldIdLst>`
      )
      relations = relations.replace(
        '</Relationships>',
        `<Relationship Id="rIdRepeated${index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index}.xml"/></Relationships>`
      )
      types = types.replace(
        '</Types>',
        `<Override PartName="/ppt/slides/slide${index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
      )
    }
    zip.file('ppt/presentation.xml', main)
    zip.file('ppt/_rels/presentation.xml.rels', relations)
    zip.file('[Content_Types].xml', types)
    const fixture = path.join(root, 'repeated-native-contexts.pptx')
    await writeFile(fixture, await zip.generateAsync({ type: 'nodebuffer' }))
    const { presentation: repeated, semanticAdmission } = await importPptxFile(fixture, {
      originalName: 'repeated-native-contexts.pptx',
      semanticImport: true,
      geometryInheritance: true,
      uploadsDir: root,
      mediaTransaction: transaction,
    })
    expect(repeated.slides).toHaveLength(7)
    const before = JSON.stringify(repeated)
    expect(() => assertSnapshotBudget(repeated)).not.toThrow()
    const { expandTextContext } = require('../../shared/src/pptx-semantic-text-context-codec')
    const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
    for (const context of Object.values(semanticAdmission.textStyleContexts))
      expect(
        expandTextContext(
          repeated.pptxSemantic.styles[`text-context:${context.occurrenceId}`].payload,
          { styles: repeated.pptxSemantic.styles }
        )
      ).toEqual(context)
    expect(collectSemanticFontRequests(repeated.pptxSemantic)).toEqual(
      collectSemanticFontRequests(expandedTextContextDocument(repeated.pptxSemantic))
    )
    const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
    const amplified = structuredClone(repeated.pptxSemantic)
    Object.values(amplified.styles)
      .filter((style) => style.kind === 'text-context')
      .at(-1).payload.unknown = true
    const maxBytes = Buffer.byteLength(JSON.stringify(amplified)) + 1
    expect(() => normalizePptxSemanticDocument(amplified, { maxBytes })).toThrow(
      /expanded semantic byte budget/
    )
    const snapshot = canonicalEditableSnapshot(repeated)
    expect(JSON.stringify(canonicalEditableSnapshot(JSON.parse(JSON.stringify(snapshot))))).toBe(
      JSON.stringify(snapshot)
    )
    expect(JSON.stringify(repeated)).toBe(before)
    expect(hash(await readFile(source))).toBe(sourceHash)
  }, 60000)

  it.each([
    'missing-pool',
    'pool-kind',
    'missing-record',
    'record-kind',
    'unused',
    'forged-source',
    'foreign-owner',
    'unknown-field',
  ])('rejects malformed shared context resources before publication: %s', (kind) => {
    const input = structuredClone(presentation)
    const styles = input.pptxSemantic.styles
    const context = Object.values(styles).find((style) => style.kind === 'text-context').payload
    const pool = styles[context.resourcesId]
    const fontId = context.fontRequests[0]
    expect(() => canonicalEditableSnapshot(input)).not.toThrow()
    if (kind === 'missing-pool') delete styles[context.resourcesId]
    if (kind === 'pool-kind') pool.kind = 'theme'
    if (kind === 'missing-record') delete pool.payload.records[fontId]
    if (kind === 'record-kind') pool.payload.records[fontId].kind = 'theme'
    if (kind === 'unused')
      pool.payload.records['record-99999'] = structuredClone(pool.payload.records[fontId])
    if (kind === 'forged-source') pool.payload.records[fontId].value.source.path += '.999'
    if (kind === 'foreign-owner') pool.source.partUri = 'ppt/foreign.xml'
    if (kind === 'unknown-field') pool.payload.records[fontId].value.unknown = true
    expect(() => canonicalEditableSnapshot(input)).toThrow()
  })

  it('requires schema two for shared text resources', () => {
    const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
    const [id, pool] = Object.entries(presentation.pptxSemantic.styles).find(
      ([, style]) => style.kind === 'text-context-resources'
    )
    const legacy = {
      schemaVersion: 1,
      definitions: {},
      instances: {},
      styles: { [id]: pool },
      fonts: {},
    }
    expect(() => normalizePptxSemanticDocument(legacy)).toThrow(
      /linked contexts require schema two/
    )
  })

  it('bounds shared resource amplification before constructing effective contexts', () => {
    const { expandTextContext } = require('../../shared/src/pptx-semantic-text-context-codec')
    const styles = structuredClone(presentation.pptxSemantic.styles)
    const context = Object.values(styles).find((style) => style.kind === 'text-context').payload
    const font = context.fontRequests[0]
    styles[context.resourcesId].payload.records[font].value.typeface = 'A'.repeat(1024)
    context.fontRequests = Array(9000).fill(font)
    expect(() => expandTextContext(context, { styles })).toThrow(/expanded context byte budget/)
  })

  it('interns repeated source declarations losslessly without changing physical font requests', () => {
    const {
      compactTextContext,
      expandTextContext,
    } = require('../../shared/src/pptx-semantic-text-context-codec')
    const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
    const legacyInput = structuredClone(presentation)
    legacyInput.pptxSemantic = expandedTextContextDocument(presentation.pptxSemantic)
    const input = structuredClone(legacyInput)
    const before = JSON.stringify(presentation)
    let savedKeys = 0
    const keys = (value) =>
      value && typeof value === 'object'
        ? Object.keys(value).length +
          Object.values(value).reduce((sum, child) => sum + keys(child), 0)
        : 0
    for (const record of Object.values(input.pptxSemantic.styles)) {
      if (record.kind !== 'text-context') continue
      expect(record.payload.schemaVersion).toBe(1)
      const legacy = expandTextContext(record.payload)
      legacyInput.pptxSemantic.styles[`text-context:${legacy.occurrenceId}`].payload = legacy
      const original = JSON.stringify(legacy)
      const compact = compactTextContext(legacy)
      expect(compact.schemaVersion).toBe(2)
      expect(expandTextContext(JSON.parse(JSON.stringify(compact)))).toEqual(legacy)
      expect(JSON.stringify(legacy)).toBe(original)
      savedKeys += keys(legacy) - keys(compact)
      record.payload = compact
    }
    expect(savedKeys).toBeGreaterThan(0)
    expect(collectSemanticFontRequests(input.pptxSemantic)).toEqual(
      collectSemanticFontRequests(legacyInput.pptxSemantic)
    )
    expect(canonicalEditableSnapshot(input).pptxSemantic).toEqual(input.pptxSemantic)
    expect(JSON.stringify(presentation)).toBe(before)
  })

  it.each(['missing', 'unused', 'forged-source', 'unknown-field'])(
    'rejects malformed compact declaration references before publication: %s',
    (kind) => {
      const { compactTextContext } = require('../../shared/src/pptx-semantic-text-context-codec')
      const input = structuredClone(presentation)
      input.pptxSemantic = expandedTextContextDocument(input.pptxSemantic)
      for (const style of Object.values(input.pptxSemantic.styles))
        if (style.kind === 'text-context') style.payload = compactTextContext(style.payload)
      const record = Object.values(input.pptxSemantic.styles).find(
        (style) => style.kind === 'text-context'
      )
      expect(() => canonicalEditableSnapshot(input)).not.toThrow()
      const context = record.payload
      if (kind === 'missing') context.body.entries[0] = 'layer-missing'
      if (kind === 'unused')
        context.declarations['layer-99999'] = structuredClone(
          Object.values(context.declarations)[0]
        )
      if (kind === 'forged-source') Object.values(context.declarations)[0].source.path = '0.999'
      if (kind === 'unknown-field') context.unknown = true
      expect(() => canonicalEditableSnapshot(input)).toThrow()
    }
  )

  it('bounds decoded declaration amplification before constructing the effective layer arrays', () => {
    const {
      compactTextContext,
      expandTextContext,
    } = require('../../shared/src/pptx-semantic-text-context-codec')
    const record = Object.values(presentation.pptxSemantic.styles).find(
      (style) => style.kind === 'text-context'
    )
    const context = structuredClone(
      compactTextContext(
        expandTextContext(record.payload, { styles: presentation.pptxSemantic.styles })
      )
    )
    const id = context.paragraphs[0].run.entries[0]
    context.declarations[id].properties.fontLatin = { typeface: 'A'.repeat(1024) }
    context.paragraphs[0].run.entries = Array(9000).fill(id)
    expect(() => expandTextContext(context)).toThrow(/expanded context byte budget/)
  })

  it('counts decoded contexts together against the existing whole semantic byte budget', () => {
    const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
    const legacy = expandedTextContextDocument(presentation.pptxSemantic)
    const compactBytes = Buffer.byteLength(JSON.stringify(presentation.pptxSemantic))
    const legacyBytes = Buffer.byteLength(JSON.stringify(legacy))
    expect(legacyBytes).toBeGreaterThan(compactBytes)
    const maxBytes = Math.floor((compactBytes + legacyBytes) / 2)
    expect(() => normalizePptxSemanticDocument(presentation.pptxSemantic, { maxBytes })).toThrow(
      /expanded semantic byte budget/
    )
  })

  it('publishes and reopens the unchanged native4x3 canonical document without a legacy depth waiver', async () => {
    const original = JSON.stringify(presentation)
    const snapshot = canonicalEditableSnapshot(presentation)
    expect(snapshot.pptxSemantic).toEqual(presentation.pptxSemantic)
    expect(JSON.stringify(canonicalEditableSnapshot(JSON.parse(JSON.stringify(snapshot))))).toBe(
      JSON.stringify(snapshot)
    )
    expect(JSON.stringify(presentation)).toBe(original)
    expect(hash(await readFile(source))).toBe(sourceHash)
    expect(sourceHash).toBe('4b29747595b94191b82328fba01ad092f9d69727df461d130532fe565d6a916e')
  })

  it('retains the legacy nesting limit even beside a valid typed envelope', () => {
    const input = structuredClone(presentation)
    input.untrusted = nested(17)
    expect(() => assertSnapshotBudget(input)).toThrow(/Snapshot budget exceeded: nesting/)
    expect(() => assertSnapshotBudget({ slides: [], untrusted: nested(17) })).toThrow(/nesting/)
  })

  it('preserves an explicitly undefined legacy envelope as absent semantic data', () => {
    const legacy = { slides: [], pptxSemantic: undefined }
    expect(() => assertSnapshotBudget(legacy)).not.toThrow()
    expect(canonicalEditableSnapshot(legacy)).toEqual(legacy)
  })

  it.each([
    ['maxObjectKeys', 10],
    ['maxStringBytes', 10],
    ['maxSnapshotBytes', 10],
    ['maxSlides', 0],
    ['maxElements', 0],
  ])('counts typed content against the unchanged aggregate %s budget', (key, value) => {
    expect(() => assertSnapshotBudget(presentation, { [key]: value })).toThrow(
      /Snapshot budget exceeded/
    )
  })

  it.each(['unknown', 'cycle', 'deep', 'accessor'])(
    'validates typed authority before exempting legacy depth: %s',
    (kind) => {
      const input = structuredClone(presentation)
      let called = false
      if (kind === 'unknown') input.pptxSemantic.unknown = nested(17)
      if (kind === 'cycle') input.pptxSemantic.unknown = input.pptxSemantic
      if (kind === 'deep') input.pptxSemantic.unknown = nested(257)
      if (kind === 'accessor')
        Object.defineProperty(input.pptxSemantic, 'unknown', {
          enumerable: true,
          get() {
            called = true
            return nested(17)
          },
        })
      expect(() => assertSnapshotBudget(input)).toThrow()
      expect(called).toBe(false)
    }
  )

  it('does not treat nested arbitrary pptxSemantic properties as the root typed envelope', () => {
    expect(() =>
      assertSnapshotBudget({
        slides: [],
        extension: { pptxSemantic: presentation.pptxSemantic },
      })
    ).toThrow(/nesting/)
  })
})
