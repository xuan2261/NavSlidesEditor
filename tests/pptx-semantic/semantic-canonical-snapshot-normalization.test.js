// @vitest-environment node
import { createRequire } from 'node:module'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const semantic = require('../../shared/src/pptx-semantic-document')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const modulePaths = [
  require.resolve('../../shared/src/pptx-semantic-presentation'),
  require.resolve('../../server/services/pptx-import/canonical-snapshot'),
]
let normalization, canonicalEditableSnapshot, assertSnapshotBudget, canonicalEditableSnapshotWithOutputBudget
const cached = modulePaths.map((file) => require.cache[file])

beforeAll(() => {
  // A call-through spy counts real descriptor/schema/source validation, not a stub.
  normalization = vi.spyOn(semantic, 'normalizePptxSemanticDocument')
  for (const file of modulePaths) delete require.cache[file]
  ;({ canonicalEditableSnapshot, assertSnapshotBudget, canonicalEditableSnapshotWithOutputBudget } = require(modulePaths[1]))
})
beforeEach(() => {
  normalization.mockClear()
})
afterAll(() => {
  normalization.mockRestore()
  modulePaths.forEach((file, index) => {
    if (cached[index]) require.cache[file] = cached[index]
    else delete require.cache[file]
  })
})

const fixture = () => ({
  id: 'deck',
  createdAt: 'removed',
  packageRevisionId: 'removed',
  slides: [{ id: 'slide1', elements: [{ id: 'e1', type: 'text', pptxInstanceId: 'i1' }] }],
  pptxSemantic: {
    schemaVersion: 1,
    definitions: {
      d1: {
        id: 'd1',
        kind: 'text',
        source: {
          partUri: 'ppt/slides/slide1.xml',
          nativeId: '7',
          preconditionHash: 'a'.repeat(64),
        },
        components: [],
        content: {},
      },
    },
    instances: {
      i1: {
        id: 'i1',
        slideId: 'slide1',
        definitionId: 'd1',
        parentInstanceId: null,
        localTransform: [1, 0, 0, 1, 0, 0],
        paintIndex: 0,
        overrides: {},
      },
    },
    styles: {},
    fonts: {},
  },
})

describe('canonical snapshot operation-scoped normalization', () => {
  it('retains a non-enumerable typed envelope and its occurrence validation', () => {
    const input = fixture()
    Object.defineProperty(input, 'pptxSemantic', { enumerable: false })
    expect(canonicalEditableSnapshot(input).pptxSemantic).toEqual(input.pptxSemantic)
    expect(normalization).toHaveBeenCalledTimes(1)
    input.slides[0].elements[0].pptxInstanceId = 'missing'
    expect(() => canonicalEditableSnapshot(input)).toThrow(/semantic element occurrence/)
  })

  it('rejects a malformed non-enumerable typed envelope', () => {
    const input = { slides: [] }
    Object.defineProperty(input, 'pptxSemantic', { value: { schemaVersion: 7 } })
    expect(() => canonicalEditableSnapshot(input)).toThrow(/semantic schema/)
  })

  it.each([1, 3])('charges a retained non-enumerable schema %i envelope exactly once', (schemaVersion) => {
    const input = fixture()
    if (schemaVersion === 3) input.pptxSemantic = compactSemanticGraph(input.pptxSemantic)
    input.packageRevisionId = 'x'.repeat(1024)
    const countKeys = value => value && typeof value === 'object'
      ? Object.keys(value).length + Object.values(value).reduce((n, child) => n + countKeys(child), 0) : 0
    const countStrings = value => typeof value === 'string' ? Buffer.byteLength(value)
      : value && typeof value === 'object' ? Object.values(value).reduce((n, child) => n + countStrings(child), 0) : 0
    const before = JSON.stringify(input)
    const limits = {
      maxObjectKeys: countKeys(schemaVersion === 3 ? { ...input, pptxSemantic: undefined } : input),
      maxStringBytes: countStrings(input),
      maxSnapshotBytes: Buffer.byteLength(before),
    }
    Object.defineProperty(input, 'pptxSemantic', { enumerable: false })
    const descriptor = Object.getOwnPropertyDescriptor(input, 'pptxSemantic')
    expect(assertSnapshotBudget(input, limits)).toBe(limits.maxSnapshotBytes)
    expect(canonicalEditableSnapshot(input, limits).pptxSemantic).toEqual(input.pptxSemantic)
    for (const boundary of [assertSnapshotBudget, canonicalEditableSnapshot]) {
      for (const [key, error] of [['maxObjectKeys', /passthrough properties/], ['maxStringBytes', /strings/], ['maxSnapshotBytes', /aggregate bytes/]]) {
        expect(() => boundary(input, { ...limits, [key]: limits[key] - 1 })).toThrow(error)
      }
    }
    expect(Object.getOwnPropertyDescriptor(input, 'pptxSemantic')).toEqual(descriptor)
    expect(JSON.stringify({ ...input, pptxSemantic: input.pptxSemantic })).toBe(before)
  })

  it.each([
    [1, true],
    [1, false],
    [3, true],
    [3, false],
  ])(
    'charges retained non-enumerable slides (schema %i, pptxSemantic enumerable=%s)',
    (schemaVersion, semanticEnumerable) => {
      const input = fixture()
      if (schemaVersion === 3) input.pptxSemantic = compactSemanticGraph(input.pptxSemantic)
      input.packageRevisionId = 'x'.repeat(1024)
      const countElements = value => (value?.slides || []).reduce(
        (n, slide) => n + (Array.isArray(slide.elements) ? slide.elements.length : 0),
        0
      )
      const countKeys = value => value && typeof value === 'object'
        ? Object.keys(value).length + Object.values(value).reduce((n, child) => n + countKeys(child), 0) : 0
      const countStrings = value => typeof value === 'string' ? Buffer.byteLength(value)
        : value && typeof value === 'object' ? Object.values(value).reduce((n, child) => n + countStrings(child), 0) : 0
      const before = JSON.stringify(input)
      const limits = {
        maxSlides: input.slides.length,
        maxElements: countElements(input),
        maxObjectKeys: countKeys(schemaVersion === 3 ? { ...input, pptxSemantic: undefined } : input),
        maxStringBytes: countStrings(input),
        maxSnapshotBytes: Buffer.byteLength(before),
      }
      Object.defineProperty(input, 'slides', { enumerable: false })
      if (!semanticEnumerable) {
        Object.defineProperty(input, 'pptxSemantic', { enumerable: false })
      }
      const slidesDescriptor = Object.getOwnPropertyDescriptor(input, 'slides')
      const semanticDescriptor = Object.getOwnPropertyDescriptor(input, 'pptxSemantic')

      expect(assertSnapshotBudget(input, limits)).toBe(limits.maxSnapshotBytes)
      const published = canonicalEditableSnapshot(input, limits)
      expect(published.slides).toBeDefined()
      expect(published.slides.length).toBe(input.slides.length)
      expect(published.pptxSemantic).toEqual(input.pptxSemantic)

      for (const boundary of [assertSnapshotBudget, canonicalEditableSnapshot]) {
        for (const [key, error] of [
          ['maxElements', /elements/],
          ['maxStringBytes', /strings/],
          ['maxSnapshotBytes', /aggregate bytes/],
        ]) {
          expect(() => boundary(input, { ...limits, [key]: limits[key] - 1 })).toThrow(error)
        }
      }

      expect(Object.getOwnPropertyDescriptor(input, 'slides')).toEqual(slidesDescriptor)
      expect(Object.getOwnPropertyDescriptor(input, 'pptxSemantic')).toEqual(semanticDescriptor)
      expect(
        JSON.parse(
          JSON.stringify({
            ...input,
            slides: input.slides,
            pptxSemantic: input.pptxSemantic,
          })
        )
      ).toEqual(JSON.parse(before))
    }
  )

  it('rejects non-enumerable slides exceeding maxElements: 0 rather than publishing them', () => {
    const input = fixture()
    Object.defineProperty(input, 'slides', { enumerable: false })
    expect(() => assertSnapshotBudget(input, { maxElements: 0 })).toThrow(
      /Snapshot budget exceeded: elements/
    )
    expect(() => canonicalEditableSnapshot(input, { maxElements: 0 })).toThrow(
      /Snapshot budget exceeded: elements/
    )
  })

  it('charges non-enumerable slides on a legacy envelope without semantic data', () => {
    const input = {
      slides: [{ id: 'slide1', elements: [{ id: 'e1', type: 'text' }] }],
      pptxSemantic: undefined,
    }
    Object.defineProperty(input, 'slides', { enumerable: false })
    expect(() => assertSnapshotBudget(input, { maxElements: 0 })).toThrow(
      /Snapshot budget exceeded: elements/
    )
  })

  it('normalizes exactly once per canonicalization, without caching mutable inputs', () => {
    const input = fixture()
    const before = structuredClone(input)
    const output = canonicalEditableSnapshot(input)
    expect(normalization).toHaveBeenCalledTimes(1)
    expect(input).toEqual(before)
    expect(output).not.toHaveProperty('createdAt')
    expect(output).not.toHaveProperty('packageRevisionId')
    expect(output.pptxSemantic).toEqual(input.pptxSemantic)
    output.pptxSemantic.instances.i1.localTransform[4] = 12
    expect(input.pptxSemantic.instances.i1.localTransform[4]).toBe(0)
    expect(canonicalEditableSnapshot(input).pptxSemantic.instances.i1.localTransform[4]).toBe(0)
    expect(normalization).toHaveBeenCalledTimes(2)
    input.pptxSemantic.definitions.d1.source.partUri = '../forged.xml'
    expect(() => canonicalEditableSnapshot(input)).toThrow()
    expect(normalization).toHaveBeenCalledTimes(3)
  })

  it('keeps the public budget return value and validates independently on every call', () => {
    const input = fixture()
    expect(assertSnapshotBudget(input)).toBe(Buffer.byteLength(JSON.stringify(input)))
    expect(normalization).toHaveBeenCalledTimes(1)
    expect(assertSnapshotBudget(input)).toBe(Buffer.byteLength(JSON.stringify(input)))
    expect(normalization).toHaveBeenCalledTimes(2)
  })

  it('charges output bytes while returning an isolated mutable snapshot', () => {
    const input = fixture()
    delete input.createdAt
    delete input.packageRevisionId
    const output = canonicalEditableSnapshotWithOutputBudget(input)
    const outputBytes = Buffer.byteLength(JSON.stringify(output))
    expect(() => canonicalEditableSnapshotWithOutputBudget(input, {
      maxSnapshotBytes: outputBytes - 1,
    })).toThrow(/aggregate bytes/)
    output.pptxSemantic.instances.i1.localTransform[4] = 12
    expect(input.pptxSemantic.instances.i1.localTransform[4]).toBe(0)
    expect(canonicalEditableSnapshotWithOutputBudget(input).pptxSemantic.instances.i1.localTransform[4]).toBe(0)
    input.pptxSemantic.definitions.d1.source.partUri = '../forged.xml'
    expect(() => canonicalEditableSnapshotWithOutputBudget(input)).toThrow()
  })

  it.each(['accessor', 'nonplain', 'cycle', 'deep', 'source'])(
    'rejects adversarial typed content through both public boundaries: %s',
    (kind) => {
      const input = fixture()
      let accessed = false
      if (kind === 'accessor')
        Object.defineProperty(input.pptxSemantic.definitions.d1.content, 'bad', {
          enumerable: true,
          get() {
            accessed = true
            return 'bad'
          },
        })
      if (kind === 'nonplain') input.pptxSemantic.definitions.d1.content = new Date()
      if (kind === 'cycle') input.pptxSemantic.definitions.d1.content.bad = input.pptxSemantic
      if (kind === 'deep') {
        let value = {}
        for (let index = 0; index < 258; index++) value = { child: value }
        input.pptxSemantic.definitions.d1.content.bad = value
      }
      if (kind === 'source') input.pptxSemantic.definitions.d1.source.preconditionHash = 'forged'
      expect(() => assertSnapshotBudget(input)).toThrow()
      expect(() => canonicalEditableSnapshot(input)).toThrow()
      expect(accessed).toBe(false)
    }
  )

  it.each([
    ['maxSlides', 0],
    ['maxElements', 0],
    ['maxObjectKeys', 10],
    ['maxStringBytes', 10],
    ['maxSnapshotBytes', 10],
    ['maxDepth', 1],
  ])('enforces aggregate and legacy %s limits during canonicalization', (key, value) => {
    expect(() => canonicalEditableSnapshot(fixture(), { [key]: value })).toThrow(
      /Snapshot budget exceeded/
    )
  })

  it('budgets raw bytes including metadata that canonicalization removes', () => {
    const input = fixture()
    input.packageRevisionId = 'x'.repeat(1024)
    const maxSnapshotBytes = Buffer.byteLength(JSON.stringify(input)) - 1
    expect(() => canonicalEditableSnapshot(input, { maxSnapshotBytes })).toThrow(/aggregate bytes/)
  })

  it('retains presentation occurrence validation after typed validation', () => {
    const input = fixture()
    input.slides[0].elements[0].pptxInstanceId = 'missing'
    expect(() => assertSnapshotBudget(input)).not.toThrow()
    expect(() => canonicalEditableSnapshot(input)).toThrow(/semantic element occurrence/)
  })

  it('does not normalize a legacy snapshot with an undefined typed envelope', () => {
    const input = { slides: [], pptxSemantic: undefined }
    expect(canonicalEditableSnapshot(input)).toEqual(input)
    expect(normalization).not.toHaveBeenCalled()
  })
})
