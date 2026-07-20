import crypto from 'node:crypto'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import adapterModule from './text-ooxml-adapter.js'

const { createNativeTextAdapter } = adapterModule
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

function shape(text = 'Before', options = {}) {
  const textNode = options.selfClosingText ? '<d:t/>' : `<d:t>${text}</d:t>`
  const paragraph = options.selfClosingParagraph ? '<d:p/>' : `<d:p><d:r>${textNode}</d:r></d:p>`
  return `<q:sp><q:nvSpPr><q:cNvPr id="${options.nativeId || '4'}" name="Title"/></q:nvSpPr>` +
    `<q:txBody>${paragraph}</q:txBody></q:sp>`
}

async function bytes(shapeXml) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/slides/slide1.xml',
    `<q:sld xmlns:q="${P}" xmlns:d="${A}"><q:cSld><q:spTree>${shapeXml}</q:spTree></q:cSld></q:sld>`)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

function operation(shapeXml, overrides = {}) {
  return {
    rowId: 'primitive.text.run.plain-replacement',
    objectKind: 'text-run',
    before: 'Before',
    after: 'After',
    normalizedText: 'After',
    sourceRef: {
      status: 'authoritative', kind: 'text-run', nativeId: '4',
      partUri: 'ppt/slides/slide1.xml',
      sourceHash: crypto.createHash('sha256').update(shapeXml).digest('hex'),
    },
    ...overrides,
  }
}

async function slideText(result) {
  const zip = await JSZip.loadAsync(result.bytes)
  return zip.file('ppt/slides/slide1.xml').async('string')
}

describe('native OOXML plain-run text adapter safety', () => {
  it('patches legal namespace aliases and binds source before to normalized after', async () => {
    const source = shape()
    const result = await createNativeTextAdapter().applyTextPatch(await bytes(source), operation(source))
    expect(await slideText(result)).toContain('<d:t>After</d:t>')
  })

  it('reads CDATA without corrupting it and rejects before/after binding mismatches', async () => {
    const source = shape('<![CDATA[Before]]>')
    const adapter = createNativeTextAdapter()
    const result = await adapter.applyTextPatch(await bytes(source), operation(source))
    expect(await slideText(result)).toContain('<d:t>After</d:t>')
    await expect(adapter.applyTextPatch(await bytes(source), operation(source, { before: 'Other' })))
      .rejects.toMatchObject({ code: 'TEXT_BEFORE_MISMATCH' })
    await expect(adapter.applyTextPatch(await bytes(source), operation(source, { after: 'Other' })))
      .rejects.toMatchObject({ code: 'TEXT_AFTER_MISMATCH' })
  })

  it.each([
    ['self-closing paragraph', shape('Before', { selfClosingParagraph: true }), 'TEXT_SOURCE_RUN_COUNT_INVALID'],
    ['non-canonical native id', shape('Before', { nativeId: '04' }), 'TEXT_NATIVE_ID_INVALID'],
    ['invalid XML 1.0 control', shape(), 'TEXT_XML_CHARACTER_INVALID', ''],
    ['noncharacter', shape(), 'TEXT_XML_CHARACTER_INVALID', '﷐'],
    ['unpaired surrogate', shape(), 'TEXT_XML_CHARACTER_INVALID', '\uD800'],
  ])('fails closed for %s', async (label, source, code, normalizedText) => {
    const textOverrides = normalizedText ? { after: normalizedText, normalizedText } : {}
    const overrides = label === 'non-canonical native id'
      ? { ...textOverrides, sourceRef: { ...operation(source).sourceRef, nativeId: '04' } }
      : textOverrides
    await expect(createNativeTextAdapter().applyTextPatch(await bytes(source), operation(source, overrides)))
      .rejects.toMatchObject({ code })
  })

  it('rejects inherited or accessor operation and source reference data without invoking getters', async () => {
    const source = shape()
    const adapter = createNativeTextAdapter()
    const inheritedOperation = Object.create(operation(source))
    await expect(adapter.applyTextPatch(await bytes(source), inheritedOperation))
      .rejects.toMatchObject({ code: 'TEXT_OPERATION_NOT_SEED' })

    const operationGetter = vi.fn(() => { throw new Error('operation getter') })
    const accessorOperation = operation(source)
    Object.defineProperty(accessorOperation, 'rowId', { get: operationGetter })
    await expect(adapter.applyTextPatch(await bytes(source), accessorOperation))
      .rejects.toMatchObject({ code: 'TEXT_OPERATION_NOT_SEED' })
    expect(operationGetter).not.toHaveBeenCalled()

    const inheritedSource = operation(source, { sourceRef: Object.create(operation(source).sourceRef) })
    await expect(adapter.applyTextPatch(await bytes(source), inheritedSource))
      .rejects.toMatchObject({ code: 'TEXT_SOURCE_KIND_MISMATCH' })

    const nativeIdGetter = vi.fn(() => { throw new Error('source getter') })
    const accessorSource = operation(source)
    Object.defineProperty(accessorSource.sourceRef, 'nativeId', { get: nativeIdGetter })
    await expect(adapter.applyTextPatch(await bytes(source), accessorSource))
      .rejects.toMatchObject({ code: 'TEXT_SOURCE_REFERENCE_INVALID' })
    expect(nativeIdGetter).not.toHaveBeenCalled()
  })

  it('uses paired empty text and xml:space only for significant edge whitespace', async () => {
    const adapter = createNativeTextAdapter()
    const empty = shape('Before')
    const emptyResult = await adapter.applyTextPatch(await bytes(empty), operation(empty, {
      after: '', normalizedText: '',
    }))
    expect(await slideText(emptyResult)).toContain('<d:t></d:t>')

    const spaced = shape('Before')
    const spacedResult = await adapter.applyTextPatch(await bytes(spaced), operation(spaced, {
      after: ' After ', normalizedText: ' After ',
    }))
    expect(await slideText(spacedResult)).toContain('<d:t xml:space="preserve"> After </d:t>')

    const previouslySpaced = shape('Before').replace('<d:t>', '<d:t xml:space="preserve">')
    const unspaced = await adapter.applyTextPatch(await bytes(previouslySpaced), operation(previouslySpaced))
    expect(await slideText(unspaced)).toContain('<d:t>After</d:t>')
    expect(await slideText(unspaced)).not.toContain('xml:space="preserve"')
  })
})
