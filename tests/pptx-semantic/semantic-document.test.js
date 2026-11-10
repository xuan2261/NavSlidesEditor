import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-document.js'

const hash = 'a'.repeat(64)
const source = () => ({
  partUri: 'ppt/slideMasters/slideMaster1.xml',
  nativeId: '7',
  preconditionHash: hash,
})
const document = () => ({
  schemaVersion: 1,
  definitions: {
    'master:7': {
      id: 'master:7',
      kind: 'text',
      source: source(),
      components: [{ id: 'run:1', kind: 'run', locator: { path: [0, 0], preconditionHash: hash } }],
      content: { paragraphs: [{ runs: [{ id: 'run:1', text: ' Shared ', fontSizePt: 12 }] }] },
    },
  },
  instances: {
    'slide1:7': {
      id: 'slide1:7',
      slideId: 'slide1',
      definitionId: 'master:7',
      parentInstanceId: null,
      localTransform: [1, 0, 0, 1, -12.5, 10.25],
      paintIndex: 0,
      overrides: { components: { 'run:1': { text: 'Local first' } } },
    },
    'slide2:7': {
      id: 'slide2:7',
      slideId: 'slide2',
      definitionId: 'master:7',
      parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 20, 30],
      paintIndex: 0,
      overrides: {},
    },
  },
  styles: {},
  fonts: {},
})

describe('semantic definitions and render instances', () => {
  it.each(['nonboolean', 'leaf', 'tombstone'])(
    'rejects invalid retained paint-scope state: %s',
    (failure) => {
      const input = document()
      const instance = input.instances['slide1:7']
      if (failure !== 'leaf') {
        input.definitions.scope = {
          id: 'scope',
          origin: 'project',
          kind: 'group',
          source: null,
          components: [],
          content: {},
        }
        instance.definitionId = 'scope'
        instance.overrides = {}
      }
      instance.lineage = { paintOnly: failure === 'nonboolean' ? 'true' : true }
      if (failure === 'tombstone') instance.lineage.tombstone = true
      expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/paint/i)
    }
  )
  it('accepts an explicitly project-authored group without inventing a native source', () => {
    const input = document()
    input.definitions.localGroup = {
      id: 'localGroup',
      origin: 'project',
      kind: 'group',
      source: null,
      components: [],
      content: {},
    }
    input.instances.localGroup = {
      id: 'localGroup',
      slideId: 'slide1',
      definitionId: 'localGroup',
      parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 10, 20],
      paintIndex: 0,
      overrides: {},
    }
    input.instances['slide1:7'].parentInstanceId = 'localGroup'
    const result = semantic.normalizePptxSemanticDocument(input)
    expect(result.definitions.localGroup.source).toBeNull()
    expect(result.definitions['master:7'].source).toEqual(source())
    expect(result.instances['slide2:7'].parentInstanceId).toBeNull()
  })
  it.each(['source', 'component', 'kind', 'origin'])(
    'rejects project group source impersonation or unsupported origin contract: %s',
    (failure) => {
      const input = document()
      input.definitions.localGroup = {
        id: 'localGroup',
        origin: 'project',
        kind: 'group',
        source: null,
        components: [],
        content: {},
      }
      const group = input.definitions.localGroup
      if (failure === 'source') group.source = source()
      if (failure === 'component') group.components = input.definitions['master:7'].components
      if (failure === 'kind') group.kind = 'text'
      if (failure === 'origin') group.origin = 'unknown'
      expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow()
    }
  )
  it('retains one source definition and distinct instance overrides without changing source text', () => {
    const input = document()
    const result = semantic.normalizePptxSemanticDocument(input)
    expect(result.definitions['master:7'].content.paragraphs[0].runs[0].text).toBe(' Shared ')
    expect(result.instances['slide1:7'].overrides.components['run:1'].text).toBe('Local first')
    expect(result.instances['slide2:7'].overrides).toEqual({})
    expect(result.instances['slide1:7'].localTransform).toEqual([1, 0, 0, 1, -12.5, 10.25])
    expect(Object.isFrozen(result.definitions['master:7'].content)).toBe(true)
    input.definitions['master:7'].content.paragraphs[0].runs[0].text = 'changed externally'
    expect(result.definitions['master:7'].content.paragraphs[0].runs[0].text).toBe(' Shared ')
  })
  it.each([{ maxBytes: 128 }, { maxInstances: 1 }, { maxComponents: 1 }, { maxDepth: 1 }])(
    'rechecks a previously normalized document under a different stricter budget %j', (limits) => {
      const normalized = semantic.normalizePptxSemanticDocument(document())
      expect(() => semantic.normalizePptxSemanticDocument(normalized, limits)).toThrow(/budget/i)
    }
  )
  it('does not trust a mutable prior input or an externally frozen lookalike after a source identity changes', () => {
    const input = document()
    const normalized = semantic.normalizePptxSemanticDocument(input)
    input.definitions['master:7'].source.preconditionHash = 'b'.repeat(64)
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/locator/i)
    const forged = structuredClone(normalized)
    forged.instances['slide1:7'].overrides.components['missing-run'] = { text: 'foreign component' }
    Object.freeze(forged)
    expect(() => semantic.normalizePptxSemanticDocument(forged)).toThrow(/component/i)
  })

  it.each([0, 2, undefined])(
    'refuses unsupported schema %s without guessing a migration',
    (version) => {
      const input = document()
      input.schemaVersion = version
      expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/schema/)
    }
  )

  it('rejects duplicate instance identity under a different dictionary key', () => {
    const input = document()
    input.instances.alias = structuredClone(input.instances['slide1:7'])
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/instance identity/)
  })

  it('rejects source fragments used as structural locators without a hash-bound precondition', () => {
    const input = document()
    delete input.definitions['master:7'].components[0].locator.preconditionHash
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/locator/)
  })

  it('rejects duplicate component IDs and overrides to a missing source component', () => {
    const input = document()
    input.definitions['master:7'].components.push(
      structuredClone(input.definitions['master:7'].components[0])
    )
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/component/)
    input.definitions['master:7'].components.pop()
    input.instances['slide1:7'].overrides.components['missing-run'] = { text: 'wrong target' }
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/component/)
  })

  it('rejects a parent cycle or hierarchy crossing slide identities', () => {
    const input = document()
    input.instances['slide1:7'].parentInstanceId = 'slide2:7'
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/parent/)
    input.instances['slide1:7'].parentInstanceId = 'slide1:7'
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/cycle/)
  })

  it('rejects nonfinite and singular transforms rather than hiding them with fitted bounds', () => {
    const input = document()
    input.instances['slide1:7'].localTransform[0] = Infinity
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/transform/)
    input.instances['slide1:7'].localTransform = [1, 2, 2, 4, 0, 0]
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/transform/)
  })

  it('retains invertible tiny transforms whose raw determinant underflows', () => {
    const input = document()
    input.instances['slide1:7'].localTransform = [1e-200, 0, 0, 1e-200, 0, 0]
    expect(
      semantic.normalizePptxSemanticDocument(input).instances['slide1:7'].localTransform
    ).toEqual(input.instances['slide1:7'].localTransform)
  })

  it('rejects forged native-package authority inside otherwise valid semantic data', () => {
    const input = document()
    input.instances['slide1:7'].overrides.sourceAuthority = { transactionEligible: true }
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/authority/)
  })

  it('rejects getters without invoking them and detects reference cycles in JSON content', () => {
    const input = document()
    let calls = 0
    Object.defineProperty(input.definitions['master:7'].content, 'unsafe', {
      enumerable: true,
      get() {
        calls += 1
        return 'executed'
      },
    })
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/data property/)
    expect(calls).toBe(0)
    const cyclic = document()
    cyclic.definitions['master:7'].content.loop = cyclic.definitions['master:7'].content
    expect(() => semantic.normalizePptxSemanticDocument(cyclic)).toThrow(/cycle/)
  })

  it('enforces explicit budgets atomically without truncating definitions', () => {
    expect(() => semantic.normalizePptxSemanticDocument(document(), { maxInstances: 1 })).toThrow(
      /budget/
    )
  })

  it('rejects sparse arrays instead of silently turning missing source components into empty arrays', () => {
    const input = document()
    input.definitions['master:7'].content.points = new Array(2)
    expect(() => semantic.normalizePptxSemanticDocument(input)).toThrow(/sparse/)
  })
})
