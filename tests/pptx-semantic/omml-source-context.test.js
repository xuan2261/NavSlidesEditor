import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { options as renderOptions } from './omml-rendering-fixtures'
import { ommlSourceFixture, slide, layout, drawingRun } from './omml-source-context-fixture'
import { expandedTextContextDocument } from './text-context-fixture-utils'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { familyCompatibilityElement } = require('../../shared/src/pptx-family-operations')
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const { resolveOmmlSourceStyle } = require('../../shared/src/pptx-omml-source-style')
const { expandTextContext } = require('../../shared/src/pptx-semantic-text-context-codec')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  readSemanticTextStyleContext,
} = require('../../server/services/pptx-import/ooxml-semantic-text-context')
const { materializeOmmlFrame } = require('../../shared/src/pptx-omml-source-style')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const {
  canonicalEditableSnapshot,
} = require('../../server/services/pptx-import/canonical-snapshot')
const { prepareSemanticOutputPaint } = require('../../shared/src/pptx-semantic-output-paint')
const { renderOmmlDocument } = require('../../shared/src/pptx-omml-renderer')
const {
  contextSource,
} = require('../../server/services/pptx-import/ooxml-semantic-text-context-source')
const {
  placeholder,
} = require('../../server/services/pptx-import/ooxml-semantic-text-context-layers')
const clone = (v) => JSON.parse(JSON.stringify(v))
async function imported(options, sourceZip) {
  const zip = sourceZip ?? (await ommlSourceFixture(options))
  const bytes = await zip.file(slide).async('string')
  const result = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] },
  })
  const semantic = result.presentation.pptxSemantic
  const definition = Object.values(semantic.definitions).find((d) => d.kind === 'equation')
  const instance = Object.values(semantic.instances).find((i) => i.definitionId === definition.id)
  const element = familyCompatibilityElement(semantic, { pptxInstanceId: instance.id })
  expect(await zip.file(slide).async('string')).toBe(bytes)
  return { semantic, definition, instance, element, presentation: result.presentation }
}

it('links an inherited-only equation to the actual source paragraph and presentation/theme', async () => {
  const { semantic, definition, instance, element } = await imported()
  expect(instance.textSourceBinding).toBeDefined()
  expect(definition.content.textDocument).toBeUndefined()
  const record = semantic.styles[instance.textSourceBinding.contextId]
  expect(record.payload.schemaVersion).toBe(3)
  const context = expandTextContext(record.payload, { styles: semantic.styles })
  expect(context.paragraphs).toHaveLength(1)
  expect(context.paragraphs[0].runs).toEqual([])
  expect(resolveOmmlSourceStyle({ mathFrame: element.mathFrame })).toMatchObject({
    fontFamily: 'Cambria Math',
    fontSize: 44 / 3,
    color: '#123456',
    bold: false,
    italic: false,
  })
  const fonts = collectSemanticFontRequests(semantic)
  const equationFaces = fonts.faces.filter((f) =>
    fonts.locations[f.faceId].some((l) => l.instanceId === instance.id)
  )
  expect(equationFaces).toEqual([
    expect.objectContaining({ typeface: 'Cambria Math', bold: false, italic: false }),
  ])
  expect(fonts.issues.filter((i) => i.instanceId === instance.id)).toEqual([])
  expect(clone(normalizePptxSemanticDocument(clone(semantic)))).toEqual(clone(semantic))
})

it('honors containing paragraph defaults above shape lists and placeholder declarations', async () => {
  const { element, instance, semantic } = await imported({
    placeholder: true,
    list: '<a:lvl1pPr><a:defRPr sz="2200" b="1"/></a:lvl1pPr>',
    direct:
      '<a:pPr><a:defRPr sz="1400" b="0"><a:latin typeface="Direct Frame"/></a:defRPr></a:pPr>',
  })
  expect(resolveOmmlSourceStyle({ mathFrame: element.mathFrame })).toMatchObject({
    fontFamily: 'Direct Frame',
    fontSize: 56 / 3,
    bold: false,
    italic: false,
  })
  const context = expandTextContext(semantic.styles[instance.textSourceBinding.contextId].payload, {
    styles: semantic.styles,
  })
  expect(context.bindings.layoutDefinitionId).toBe(`${layout}#shape:8`)
})

it('retains authored equation placeholder attributes and rejects invalid application children', async () => {
  const zip = await ommlSourceFixture({ placeholder: true })
  const original = await zip.file(slide).async('string')
  zip.file(
    slide,
    original.replace(
      '<p:ph type="obj" idx="7"/>',
      '<p:ph type="obj" idx="7" orient="horz" sz="half" hasCustomPrompt="0"/>'
    )
  )
  const { definition } = await imported(undefined, zip)
  expect(definition.content.frameProperties.placeholder).toEqual({
    type: 'obj',
    idx: '7',
    orient: 'horz',
    sz: 'half',
    hasCustomPrompt: '0',
  })
  for (const replacement of [
    '<p:ph type="invalid" idx="7"/>',
    '<p:ph type="obj" idx="-1"/>',
    '<p:ph type="obj" hasCustomPrompt="invalid"/>',
    '<p:ph type="obj" sz="not-a-size"/>',
    '<p:ph type="obj"/><p:ph type="obj"/>',
    '<p:ph type="obj"><p:extLst/></p:ph>',
    '<p:extLst/>',
  ]) {
    zip.file(slide, original.replace('<p:ph type="obj" idx="7"/>', replacement))
    await expect(imported(undefined, zip)).rejects.toThrow()
  }
})

it('rejects unsupported inherited paint only where an effective glyph or operator consumes it', async () => {
  const direct =
    '<a:pPr><a:defRPr><a:solidFill><a:srgbClr val="123456"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:defRPr></a:pPr>'
  const paint = (element) =>
    renderOmmlDocument(element.ommlDocument, {
      ...renderOptions,
      color: undefined,
      ...resolveOmmlSourceStyle({ mathFrame: element.mathFrame, deferPaint: true }),
      sourceStyle: true,
      theme: element.mathFrame.textContext.theme,
    })
  const explicit =
    '<a:rPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></a:rPr>'
  const shadowed = await imported({
    direct,
    equation: `<m:oMath><m:r>${explicit}<m:t>x</m:t></m:r></m:oMath>`,
  })
  expect(paint(shadowed.element).svg).toContain('fill="#ABCDEF"')
  const inherited = await imported({ direct })
  expect(() => paint(inherited.element)).toThrow(/RGB color/)
  const fraction = await imported({
    direct,
    equation: '<m:oMath><m:f><m:num/><m:den/></m:f></m:oMath>',
  })
  try {
    paint(fraction.element)
    throw new Error('Unsupported fraction paint was accepted')
  } catch (error) {
    expect(error.code).toBe('PPTX_OMML_RENDER_UNSUPPORTED')
    expect(error.componentId).toBe(
      fraction.definition.content.ommlDocument.root.children[0].componentId
    )
    expect(error.path).toEqual([0])
  }
  const control = await imported({
    direct,
    equation: `<m:oMath><m:f><m:fPr><m:ctrlPr>${explicit}</m:ctrlPr></m:fPr><m:num/><m:den/></m:f></m:oMath>`,
  })
  expect(paint(control.element).svg).toContain('stroke="#ABCDEF"')
})

it('rejects invalid equation placeholder size without depending on geometry-context admission', async () => {
  const zip = await ommlSourceFixture({ placeholder: true })
  zip.file(
    slide,
    (await zip.file(slide).async('string')).replace(
      '<p:ph type="obj" idx="7"/>',
      '<p:ph type="obj" idx="7" sz="not-a-size"/>'
    )
  )
  const inventory = await buildSemanticInventory(zip)
  const source = await contextSource(zip, inventory).part(slide)
  const definition = source.definitions.find((d) => d.kind === 'shape' && d.nativeId === '2')
  expect(() => placeholder(source, source.nodes.get(definition.id))).toThrow(/placeholder size/)
})

it('paints generated equation output with the occurrence inherited source font and color', async () => {
  const { semantic, instance } = await imported({
    list: '<a:lvl1pPr><a:defRPr sz="1800" b="0" i="0"><a:latin typeface="KaTeX Main"/><a:solidFill><a:srgbClr val="345678"/></a:solidFill></a:defRPr></a:lvl1pPr>',
  })
  const raw = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
  const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  const alias = 'omml_source_context_output'
  const registered = GlobalFonts.register(raw, alias)
  try {
    const node = {
      getAttribute: (name) =>
        ({
          'data-pptx-semantic-mount': instance.id,
          'data-pptx-semantic-slide': instance.slideId,
        })[name],
    }
    const document = {
      querySelectorAll: () => [node],
      createElement: () => createCanvas(8, 8),
    }
    const fontRuntime = {
      fontProfile: { faces: [{ id: 'regular', typeface: 'KaTeX Main' }] },
      rendererProfile: {},
      measurement: { validate: () => null },
      fontFamilies: { regular: alias },
      getFontAsset: () => ({ bytes }),
    }
    const before = clone(semantic)
    const painted = prepareSemanticOutputPaint(
      document,
      semantic,
      [{ instanceId: instance.id, slideId: instance.slideId }],
      fontRuntime
    )
    expect(painted).toHaveLength(1)
    expect(painted[0].svg).toContain(`font-family="${alias}"`)
    expect(painted[0].svg).toContain('font-size="24"')
    expect(painted[0].svg).toContain('fill="#345678"')
    expect(clone(semantic)).toEqual(before)
  } finally {
    GlobalFonts.remove(registered)
  }
})

it('keeps direct equation run fonts above inherited frame requests', async () => {
  const { semantic, instance } = await imported({
    equation: `<m:oMath>${drawingRun('x', 'b="1" i="0"', 'Direct Math')}</m:oMath>`,
  })
  const fonts = collectSemanticFontRequests(semantic)
  expect(
    fonts.faces.filter((f) => fonts.locations[f.faceId].some((l) => l.instanceId === instance.id))
  ).toEqual([expect.objectContaining({ typeface: 'Direct Math', bold: true, italic: false })])
})

it('requests operator controls and math runs from their own declarations above frame defaults', async () => {
  const { semantic, instance } = await imported({
    equation:
      '<m:oMath><m:f><m:fPr><m:ctrlPr><a:rPr b="1" i="0"><a:latin typeface="Control"/></a:rPr></m:ctrlPr></m:fPr>' +
      `<m:num>${drawingRun('x', 'b="0" i="1"', 'Run')}</m:num><m:den><m:r><m:t>y</m:t></m:r></m:den></m:f></m:oMath>`,
  })
  const fonts = collectSemanticFontRequests(semantic)
  expect(fonts.issues.filter((i) => i.instanceId === instance.id)).toEqual([])
  const faces = fonts.faces.filter((f) =>
    fonts.locations[f.faceId].some((l) => l.instanceId === instance.id)
  )
  expect(faces).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ typeface: 'Control', bold: true, italic: false }),
      expect.objectContaining({ typeface: 'Run', bold: false, italic: true }),
      expect.objectContaining({ typeface: 'Cambria Math', bold: false, italic: false }),
    ])
  )
  expect(faces).toHaveLength(3)
})

it('resolves shape list defaults per property and preserves the winning source receipts', async () => {
  const { element, definition } = await imported({
    list: '<a:defPPr><a:defRPr sz="2200" b="1"/></a:defPPr><a:lvl1pPr><a:defRPr sz="1800"><a:latin typeface="+mn-lt" charset="0" pitchFamily="34" panose="02040503050406030204"/></a:defRPr></a:lvl1pPr>',
    direct: '<a:pPr><a:defRPr b="0"/></a:pPr>',
  })
  const style = resolveOmmlSourceStyle({ mathFrame: element.mathFrame })
  expect(style).toMatchObject({ fontFamily: 'Minor', fontSize: 24, bold: false, italic: false })
  expect(style.sourceProperties.fontSizePt.source.kind).toBe('shapeList')
  expect(style.sourceProperties.bold.source.kind).toBe('paragraph')
  expect(style.sourceProperties.fontLatin.authored).toEqual({
    typeface: '+mn-lt',
    charset: 0,
    pitchFamily: 34,
    panose: '02040503050406030204',
  })
  expect(style.sourceProperties.fontLatin.dependencyIds).toContain(
    element.mathFrame.textContext.theme.id
  )
  expect(definition.content.mathFrame.textContext).toBeUndefined()
})

it('preserves paragraph-mark proofing and never uses its font or size as a default', async () => {
  const zip = await ommlSourceFixture()
  zip.file(
    slide,
    (await zip.file(slide).async('string')).replace(
      '<a:endParaRPr ',
      '<a:endParaRPr dirty="0" smtClean="1" '
    )
  )
  const { definition, element } = await imported(undefined, zip)
  expect(definition.content.mathFrame.endParagraphProofing).toEqual({
    dirty: false,
    smtClean: true,
  })
  expect(definition.content.mathFrame.endParagraphProperties).toMatchObject({
    fontSizePt: 99,
    fontLatin: { typeface: 'Never paragraph defaults' },
  })
  expect(resolveOmmlSourceStyle({ mathFrame: element.mathFrame })).toMatchObject({
    fontSize: 44 / 3,
    fontFamily: 'Cambria Math',
  })
})

it('binds the containing shape font reference without replacing it with a generic face', async () => {
  const zip = await ommlSourceFixture()
  zip.file(
    slide,
    (await zip.file(slide).async('string')).replace(
      '</p:spPr>',
      '</p:spPr><p:style><a:fontRef idx="minor"><a:srgbClr val="345678"/></a:fontRef></p:style>'
    )
  )
  const { element } = await imported(undefined, zip)
  expect(resolveOmmlSourceStyle({ mathFrame: element.mathFrame })).toMatchObject({
    fontFamily: 'Minor',
    color: '#345678',
    fontSize: 44 / 3,
    sourceProperties: { fontLatin: { source: { kind: 'fontReference', part: slide } } },
  })
})

it('keeps canonical source metadata immutable through occurrence math edits and rejects derived context persistence', async () => {
  const { semantic, definition, instance } = await imported()
  const before = clone(semantic)
  const sibling = { ...clone(instance), id: 'sibling', paintIndex: instance.paintIndex + 1 }
  const changed = clone(semantic)
  changed.instances.sibling = sibling
  const root = definition.content.ommlDocument.root
  const textId = root.children[0].children[0].componentId
  changed.instances[instance.id].overrides.components = {
    [root.componentId]: {
      familyOperations: {
        family: 'omml',
        commands: [{ type: 'setText', componentId: textId, text: 'changed' }],
      },
    },
  }
  const normalized = normalizePptxSemanticDocument(changed)
  const effective = familyCompatibilityElement(normalized, { pptxInstanceId: instance.id })
  const untouched = familyCompatibilityElement(normalized, { pptxInstanceId: 'sibling' })
  expect(effective.ommlDocument.root.children[0].children[0].text).toBe('changed')
  expect(untouched.ommlDocument.root.children[0].children[0].text).toBe('x')
  expect(clone(normalized.definitions)).toEqual(before.definitions)
  expect(clone(normalized.styles)).toEqual(before.styles)
  expect(Object.isFrozen(semantic.styles[instance.textSourceBinding.contextId].payload)).toBe(true)
  const forged = clone(semantic)
  forged.definitions[definition.id].content.mathFrame.textContext = effective.mathFrame.textContext
  expect(() => normalizePptxSemanticDocument(forged)).toThrow(/derived equation context/)
})

it('expands compact contexts without changing the physical font request identity', async () => {
  const { semantic } = await imported()
  const expanded = expandedTextContextDocument(semantic)
  expect(collectSemanticFontRequests(expanded)).toEqual(collectSemanticFontRequests(semantic))
})

it('retains trusted equation source metadata through canonical save and rejects source rewriting', async () => {
  const { presentation, instance } = await imported()
  const saved = canonicalEditableSnapshot(presentation)
  expect(() => assertSemanticBaseline(presentation, clone(saved))).not.toThrow()
  const forged = clone(saved)
  forged.pptxSemantic = expandedTextContextDocument(forged.pptxSemantic)
  const record = forged.pptxSemantic.styles[instance.textSourceBinding.contextId]
  record.payload.paragraphs[0].run.entries[0].properties.bold = true
  expect(() => assertSemanticBaseline(presentation, forged)).toThrow(/immutable/)
})

it('reads exact placeholder layout/master defaults without applying presentation defaults or paragraph marks', async () => {
  const zip = await ommlSourceFixture({ placeholder: true })
  const inventory = await buildSemanticInventory(zip)
  const occurrence = inventory.occurrences.find((o) => o.definitionId === `${slide}#shape:2`)
  const context = await readSemanticTextStyleContext({
    zip,
    inventory,
    occurrenceId: occurrence.id,
  })
  const style = resolveOmmlSourceStyle({ mathFrame: materializeOmmlFrame({}, context) })
  expect(style).toMatchObject({ fontFamily: 'Minor', fontSize: 24, bold: false, italic: false })
  expect(style.sourceProperties.fontLatin.source).toMatchObject({
    kind: 'layoutList',
    part: layout,
  })
  expect(style.sourceProperties.italic.source.kind).toBe('masterTextStyle')
  expect(style.sourceProperties.color.source.kind).toBe('masterList')
  expect(style.color).not.toBe('#123456')
})

it('isolates actual slide occurrence contexts and rejects cross-slide rebinding', async () => {
  const zip = await ommlSourceFixture()
  const second = 'ppt/slides/second.xml'
  zip.file(
    second,
    (await zip.file(slide).async('string')).replace(
      '<a14:m ',
      '<a:pPr><a:defRPr sz="2000"><a:latin typeface="Second"/></a:defRPr></a:pPr><a14:m '
    )
  )
  zip.file(
    'ppt/slides/_rels/second.xml.rels',
    await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string')
  )
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
      '<Relationship Id="second" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/second.xml"/></Relationships>'
    )
  )
  const result = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: {
      id: 'deck',
      slides: [
        { id: 'slide', elements: [] },
        { id: 'second', elements: [] },
      ],
    },
  })
  const semantic = result.presentation.pptxSemantic
  const instances = Object.values(semantic.instances).filter(
    (i) => semantic.definitions[i.definitionId].kind === 'equation'
  )
  const frames = instances.map(
    (i) => familyCompatibilityElement(semantic, { pptxInstanceId: i.id }).mathFrame
  )
  expect(frames.map((mathFrame) => resolveOmmlSourceStyle({ mathFrame }).fontFamily)).toEqual([
    'Cambria Math',
    'Second',
  ])
  expect(frames.map((f) => f.textContext.hostSlidePartUri)).toEqual([slide, second])
  const forged = clone(semantic)
  forged.instances[instances[0].id].textSourceBinding = clone(instances[1].textSourceBinding)
  expect(() => normalizePptxSemanticDocument(forged)).toThrow()
})

it.each(['paragraph', 'run', 'host', 'relationship', 'receipt', 'binding', 'foreign-default'])(
  'rejects forged equation context %s lineage',
  async (kind) => {
    const { semantic, instance } = await imported()
    expect(instance.textSourceBinding).toBeDefined()
    const changed = expandedTextContextDocument(semantic)
    const record = changed.styles[instance.textSourceBinding.contextId]
    const context = record.payload
    if (kind === 'paragraph') context.paragraphs[0].source.path += '.0'
    if (kind === 'run')
      context.paragraphs[0].runs.push({
        source: context.paragraphs[0].source,
        layers: context.paragraphs[0].run,
      })
    if (kind === 'host') context.hostSlidePartUri = layout
    if (kind === 'relationship') context.relationships[1].relationshipId = 'forged'
    if (kind === 'receipt') context.provenance[0].preconditionHash = '0'.repeat(64)
    if (kind === 'binding') delete changed.instances[instance.id].textSourceBinding
    if (kind === 'foreign-default') {
      const layer = context.paragraphs[0].run.entries.find((e) => e.kind === 'paragraph')
      layer.source = { part: slide, path: '0' }
    }
    expect(() => normalizePptxSemanticDocument(changed)).toThrow()
    expect(clone(normalizePptxSemanticDocument(clone(semantic)))).toEqual(clone(semantic))
  }
)

it('admits valid bwMode on OMML shape properties and rejects invalid attributes or values', async () => {
  const zipValid = await ommlSourceFixture()
  const xmlValid = (await zipValid.file(slide).async('string')).replace('<p:spPr>', '<p:spPr bwMode="auto">')
  zipValid.file(slide, xmlValid)
  const { definition } = await imported({}, zipValid)
  expect(definition.kind).toBe('equation')

  const zipInvalidVal = await ommlSourceFixture()
  const xmlInvalidVal = (await zipInvalidVal.file(slide).async('string')).replace('<p:spPr>', '<p:spPr bwMode="invalidValue">')
  zipInvalidVal.file(slide, xmlInvalidVal)
  await expect(imported({}, zipInvalidVal)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    message: expect.stringContaining('invalid bwMode'),
  })

  const zipUnknownAttr = await ommlSourceFixture()
  const xmlUnknownAttr = (await zipUnknownAttr.file(slide).async('string')).replace('<p:spPr>', '<p:spPr unknownAttr="test">')
  zipUnknownAttr.file(slide, xmlUnknownAttr)
  await expect(imported({}, zipUnknownAttr)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    message: expect.stringContaining('Unsupported geometry style source'),
  })
})

it('admits transparent noFill and noFill-ln on OMML shape properties, and rejects non-noFill borders or fills', async () => {
  const zipValid = await ommlSourceFixture()
  const xmlValid = (await zipValid.file(slide).async('string')).replace(
    '</p:spPr>',
    '<a:noFill/><a:ln w="9525"><a:noFill/><a:miter lim="800000"/><a:headEnd/><a:tailEnd/></a:ln></p:spPr>'
  )
  zipValid.file(slide, xmlValid)
  const { definition } = await imported({}, zipValid)
  expect(definition.kind).toBe('equation')

  const zipSolidFill = await ommlSourceFixture()
  const xmlSolidFill = (await zipSolidFill.file(slide).async('string')).replace(
    '</p:spPr>',
    '<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr>'
  )
  zipSolidFill.file(slide, xmlSolidFill)
  await expect(imported({}, zipSolidFill)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
  })

  const zipSolidLn = await ommlSourceFixture()
  const xmlSolidLn = (await zipSolidLn.file(slide).async('string')).replace(
    '</p:spPr>',
    '<a:noFill/><a:ln w="9525"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln></p:spPr>'
  )
  zipSolidLn.file(slide, xmlSolidLn)
  await expect(imported({}, zipSolidLn)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
  })
})
