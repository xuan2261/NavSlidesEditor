import { describe, expect, it } from 'vitest'
import {
  normalizeTextDocument, normalizeTextProperties, evaluateFontProfile, TEXT_DOCUMENT_LIMITS,
} from '../../shared/src/pptx-text-document'

function document() {
  return {
    schemaVersion: 1, componentId: 'text:1',
    body: {
      insetLeftEmu: 0, insetTopEmu: 91440, verticalAlign: 'ctr', verticalText: 'eaVert',
      rotation: 0, wrap: false, autofit: { mode: 'normal', fontScale: 75000, lineSpaceReduction: 0 },
    },
    paragraphs: [{
      componentId: 'p:1',
      properties: {
        level: 0, direction: 'rtl', alignment: 'r', indentEmu: -12700,
        bullet: { kind: 'character', character: '\u2022' },
        tabs: [{ positionEmu: 914400, alignment: 'dec' }],
        spaceBefore: { unit: 'points', value: 0 }, lineSpacing: { unit: 'percent', value: 100000 },
      },
      defaultRunProperties: { fontLatin: { typeface: '+mn-lt' } },
      endRunProperties: { fontSizePt: 6 },
      runs: [
        { componentId: 'r:1', kind: 'text', text: ' \u00a0e\u0301\t\u0645\u0631\u062d\u0628\u0627 ', properties: { fontSizePt: 12, language: 'ar-SA', bold: false, fontComplexScript: { typeface: '+mn-cs', script: 'Arab' } } },
        { componentId: 'r:2', kind: 'text', text: '\u6f22\u5b57\u3000\ud83d\ude00', properties: { fontSizePt: 24, language: 'ja-JP', fontEastAsian: { typeface: '+mj-ea', script: 'Jpan' } } },
        { componentId: 'r:3', kind: 'break' },
        { componentId: 'r:4', kind: 'field', text: '1', field: { id: '{native-field}', type: 'slidenum' } },
      ],
    }],
  }
}

describe('canonical text document', () => {
  it('roundtrips local proofing separately from inheritable visual style', () => {
    const input = document()
    input.paragraphs[0].runs[3].proofing = { smtClean: false }
    const output = normalizeTextDocument(JSON.parse(JSON.stringify(input)))
    expect(output).toEqual(input)
    expect(output.paragraphs[0].runs[0]).not.toHaveProperty('proofing')
    output.paragraphs[0].runs[3].proofing.smtClean = true
    expect(input.paragraphs[0].runs[3].proofing.smtClean).toBe(false)
    expect(() => normalizeTextProperties({ smtClean: false }, 'run')).toThrow(TypeError)
    expect(() => normalizeTextProperties({ proofing: { smtClean: false } }, 'run')).toThrow(TypeError)
  })

  it.each([{ smtClean: 0 }, { smtClean: 'false' }, { dirty: 0 }, {}, null])(
    'rejects untyped or unsupported proofing %j', (proofing) => {
      const input = document()
      input.paragraphs[0].runs[3].proofing = proofing
      expect(() => normalizeTextDocument(input)).toThrow(TypeError)
    }
  )

  it('clones exact mixed native sizes, Unicode, whitespace, fields, and layout without fitting', () => {
    const input = document()
    const output = normalizeTextDocument(input)
    expect(output).toEqual(input)
    expect(JSON.parse(JSON.stringify(output))).toEqual(input)
    output.paragraphs[0].runs[0].properties.fontSizePt = 1
    output.body.autofit.fontScale = 0
    expect(input.paragraphs[0].runs[0].properties.fontSizePt).toBe(12)
    expect(input.body.autofit.fontScale).toBe(75000)
    expect(output.paragraphs[0].runs[1].properties).not.toHaveProperty('bold')
    expect(output.paragraphs[0].runs[0].properties.bold).toBe(false)
  })
  it('admits and clones exact text run outline properties', () => {
    const input = document()
    input.paragraphs[0].runs[0].properties.outline = {
      fill: 'none',
      color: { kind: 'none' },
    }
    input.paragraphs[0].runs[1].properties.outline = {
      fill: 'solid',
      color: { kind: 'scheme', value: 'bg1' },
      width: 12700,
      dash: { kind: 'preset', value: 'dash' },
      cap: 'rnd',
      compound: 'sng',
      alignment: 'ctr',
      join: { kind: 'miter', limit: 80000 },
    }
    const output = normalizeTextDocument(input)
    expect(output.paragraphs[0].runs[0].properties.outline).toEqual({
      fill: 'none',
      color: { kind: 'none' },
    })
    expect(output.paragraphs[0].runs[1].properties.outline).toEqual(
      input.paragraphs[0].runs[1].properties.outline
    )
    output.paragraphs[0].runs[0].properties.outline.fill = 'solid'
    expect(input.paragraphs[0].runs[0].properties.outline.fill).toBe('none')
  })

  it.each([
    (d) => { d.schemaVersion = 2 },
    (d) => { d.paragraphs[0].runs[1].componentId = 'p:1' },
    (d) => { d.paragraphs[0].properties.direction = 'auto' },
    (d) => { d.paragraphs[0].runs[0].properties.fontSizePt = Infinity },
    (d) => { d.body.autofit.mode = 'browser-fit' },
    (d) => { d.paragraphs[0].properties.tabs = Array(257).fill({ positionEmu: 0 }) },
    (d) => { d.paragraphs[0].runs[0].text = 'x'.repeat(TEXT_DOCUMENT_LIMITS.maxTextLength + 1) },
    (d) => { d.paragraphs[0].properties.bullet = { kind: 'number', startAt: 0, scheme: 'arabicPeriod' } },
    (d) => { d.paragraphs[0].runs[0].properties = { color: { kind: 'srgb', value: 'ABCDEF', transforms: [{ kind: 'unknown', value: 0 }] } } },
    (d) => { d.paragraphs[0].runs[0].properties.bold = undefined },
    (d) => { d.paragraphs[0].runs[0].properties.toString = 'not a property' },
    (d) => { d.paragraphs[0].runs[0].properties.color = { kind: 'scheme', value: 'toString' } },
    (d) => { d.paragraphs[0].runs[0].properties.outline = 'not-an-object' },
    (d) => { d.paragraphs[0].runs[0].properties.outline = { unknownField: 1 } },
    (d) => { d.paragraphs[0].runs[0].properties.outline = { width: -10 } },
    (d) => { d.paragraphs[0].runs[0].properties.outline = { width: 1.5 } },
    (d) => { d.paragraphs[0].runs[0].properties.outline = { color: { kind: 'invalid' } } },
    (d) => { d.paragraphs[0].runs[0].properties.outline = { cap: 'triangle' } },
    (d) => { d.paragraphs[0].runs[0].properties.outline = { join: { kind: 'invalid' } } },
  ])('rejects unsupported, duplicate, and over-budget input atomically', (mutate) => {
    const input = document()
    mutate(input)
    expect(() => normalizeTextDocument(input)).toThrow(TypeError)
  })

  it('rejects accessors without executing them, cycles, polluted keys, and sparse arrays', () => {
    let reads = 0
    const input = document()
    Object.defineProperty(input, 'body', { enumerable: true, get() { reads++; return {} } })
    expect(() => normalizeTextDocument(input)).toThrow(TypeError)
    expect(reads).toBe(0)
    const cyclic = document()
    cyclic.body = cyclic
    expect(() => normalizeTextDocument(cyclic)).toThrow(TypeError)
    expect(() => normalizeTextDocument(JSON.parse('{"__proto__":{}}'))).toThrow(TypeError)
    const sparse = document()
    delete sparse.paragraphs[0].runs[0]
    expect(() => normalizeTextDocument(sparse)).toThrow(TypeError)
  })
})

const source = { part: 'ppt/slides/slide1.xml', path: '/sp[1]/txBody/p[1]/r[1]' }
const hash = 'a'.repeat(64)
const request = { typeface: 'Example Sans', source }
const evaluate = (faces, requests = [request]) =>
  evaluateFontProfile({ profile: { schemaVersion: 1, faces }, requests })

describe('font evidence profile', () => {
  it('qualifies exact face evidence, not a family name or substitute metrics', () => {
    expect(evaluate([{ id: 'asset', typeface: request.typeface, assetHash: hash }])).toMatchObject({
      qualified: true, results: [{ status: 'available', metricsQualified: true, faceId: 'asset' }],
    })
    const evidence = { platform: 'Windows', postscriptName: 'ExampleSans', version: '1.0', evidenceId: 'probe:1' }
    expect(evaluate([{ id: 'installed', typeface: request.typeface, installedFaceEvidence: evidence }]).qualified).toBe(true)
    expect(evaluate([{ id: 'name-only', typeface: request.typeface }])).toMatchObject({
      qualified: false, results: [{ status: 'missing', source }],
    })
    expect(evaluate([{ id: 'fallback', typeface: 'Other Sans', substituteFor: request.typeface, assetHash: hash }])).toMatchObject({
      qualified: false, results: [{ status: 'substituted', metricsQualified: false, source }],
    })
    expect(evaluate([{ id: 'regular', typeface: request.typeface, assetHash: hash }], [{ ...request, bold: true }]).qualified).toBe(false)
  })

  it('requires matching editable embedding rights and preserves all source evidence', () => {
    const face = { id: 'embedded', typeface: request.typeface, assetHash: hash,
      embedded: { fsType: 8, rights: 'editable', extractionAllowed: true, subset: false } }
    const result = evaluate([face])
    expect(result).toMatchObject({ qualified: true, results: [{ extractionAllowed: true, evidence: face }] })
    result.results[0].evidence.embedded.fsType = 0
    expect(face.embedded.fsType).toBe(8)
    expect(evaluate([{ ...face, embedded: { fsType: 4, rights: 'previewPrint', extractionAllowed: true, subset: false } }]))
      .toMatchObject({ qualified: false, results: [{ status: 'blocked', extractionAllowed: false }] })
    expect(evaluate([{ ...face, embedded: { ...face.embedded, extractionAllowed: false } }]).qualified).toBe(false)
  })

  it.each([1, 6, 12, 65536, -1])('rejects malformed font embedding flags %s', (fsType) => {
    expect(() => evaluate([{ id: 'bad', typeface: request.typeface, assetHash: hash,
      embedded: { fsType, rights: 'editable', extractionAllowed: true, subset: false } }])).toThrow(TypeError)
  })

  it('blocks restricted, bitmap-only, and forbidden subset extraction and rejects duplicate IDs', () => {
    for (const embedded of [
      { fsType: 2, rights: 'restricted', extractionAllowed: true, subset: false },
      { fsType: 0x208, rights: 'editable', extractionAllowed: true, subset: false },
      { fsType: 0x108, rights: 'editable', extractionAllowed: true, subset: true },
    ]) expect(evaluate([{ id: 'f', typeface: request.typeface, assetHash: hash, embedded }]).qualified).toBe(false)
    const face = { id: 'f', typeface: request.typeface, assetHash: hash }
    expect(() => evaluate([face, face])).toThrow(TypeError)
    expect(() => evaluate([{ ...face, embedded: { fsType: 8, rights: 'installable', extractionAllowed: true, subset: false } }])).toThrow(TypeError)
    expect(() => evaluateFontProfile({ profile: { schemaVersion: 1, faces: [face] }, requests: [request], qualified: true })).toThrow(TypeError)
  })
})
