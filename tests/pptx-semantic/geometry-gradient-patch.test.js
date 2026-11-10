import { describe, expect, it } from 'vitest'
import operations from '../../shared/src/pptx-projection-operation.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import schemas from '../../server/services/pptx-import/package-store/schemas.js'
import journal from '../../server/services/pptx-import/mutation-journal.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
import { styleLocation } from './geometry-style-fixture.js'
import {
  createSemanticClipboard,
  pasteSemanticClipboard,
} from '../../client/src/utils/pptx-semantic-clipboard.js'
function fixture() {
  const presentation = geometryGroupFillFixture()
  const source = presentation.pptxSemantic.styles.groupProvider.payload.properties.fill.source
  const wrap = (value) => ({ source: structuredClone(source), value })
  presentation.pptxSemantic.styles.groupProvider.payload.properties.fill = wrap({
    gradient: wrap({
      kind: 'linear',
      angle: wrap(2700000),
      scaled: wrap(true),
      rotWithShape: wrap(true),
      stops: [0, 50000, 100000].map((pos) =>
        wrap({
          pos: wrap(pos),
          color: wrap({
            kind: 'scheme',
            value: 'accent1',
            transforms: [
              wrap({ kind: 'tint', value: 10000 }),
              wrap({ kind: 'alpha', value: 70000 }),
            ],
          }),
        })
      ),
    }),
  })
  return semantic.normalizeSemanticPresentation(presentation)
}
const apply = (presentation, patch, instanceId = 'g1') => {
  const document = presentation.pptxSemantic
  const definition = document.definitions[document.instances[instanceId].definitionId]
  return operations.applyPresentationProjectionOperation(presentation, {
    type: definition.kind === 'group' ? 'group.fill.edit' : 'geometry.edit',
    instanceId,
    componentId:
      definition.kind === 'group'
        ? document.styles[definition.content.geometrySource.styleId].payload.paintComponentId
        : 'geometry',
    command: { type: 'fill-gradient-patch', patch },
  })
}
function stopPatch(presentation, entries, id = 'g1') {
  const state = styles.resolveGeometryStyle(presentation.pptxSemantic, id).gradientEdit
  expect(state).toBeDefined()
  return { stops: { provider: state.provider, entries } }
}
function retheme(presentation) {
  const next = JSON.parse(JSON.stringify(presentation))
  next.pptxSemantic.styles.projectTheme = {
    kind: 'theme-override',
    origin: 'project',
    baseStyleId: 'theme',
    values: { colors: { accent2: { kind: 'srgb', value: 'ABCDEF' } } },
  }
  return semantic.normalizeSemanticPresentation(next)
}
describe('source-preserving gradient edit intent', () => {
  it.each(['g1', 'i1'])(
    'retains keyed gradient authority after canonical storage sorting: %s',
    (instanceId) => {
      const before = fixture()
      const edited = apply(
        before,
        stopPatch(before, [{ from: 0, pos: 10000 }, { from: 1 }, { from: 2 }], instanceId),
        instanceId
      )
      const persisted = JSON.parse(schemas.canonicalJson(edited))
      const persistedBefore = JSON.parse(schemas.canonicalJson(before))
      expect(() => semantic.normalizeSemanticPresentation(persisted)).not.toThrow()
      expect(styles.materializeGeometry(persisted.pptxSemantic, 'i1')).toEqual(
        styles.materializeGeometry(edited.pptxSemantic, 'i1')
      )
      expect(persisted.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
      expect(persisted.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(journal.deriveMutationJournal(persistedBefore, persisted)).toEqual(
        journal.deriveMutationJournal(before, edited)
      )
    }
  )
  it('rejects a nested provider reorder of distinct inserted stops with equal positions and topology', () => {
    const before = structuredClone(fixture()),
      document = before.pptxSemantic
    for (const [index, id, parent] of [
      [1, 'inner', 'g1'],
      [2, 'nested', 'inner'],
    ]) {
      const declaration = structuredClone(document.styles.groupProvider)
      const relocate = (value) => {
        if (!value || typeof value !== 'object') return
        if (value.source?.componentLocator) value.source.componentLocator.path[0] = index
        for (const child of Object.values(value)) relocate(child)
      }
      relocate(declaration)
      declaration.source.componentLocator.path = [index]
      declaration.payload.definitionId = id
      declaration.payload.paintComponentId = id + ':group-properties'
      declaration.payload.properties = {
        fill: {
          source: styleLocation(declaration.source.partUri, [index, 1]),
          value: { group: true },
        },
      }
      const definition = structuredClone(document.definitions.group)
      definition.id = id
      definition.source.nativeId = String(10 + index)
      definition.source.componentLocator = structuredClone(declaration.source.componentLocator)
      definition.components = [
        {
          id: id + ':group-properties',
          kind: 'property',
          locator: { path: [index, 1], preconditionHash: definition.source.preconditionHash },
        },
      ]
      definition.content.geometrySource = { styleId: id + 'Provider' }
      document.definitions[id] = definition
      document.styles[id + 'Provider'] = declaration
      document.styles[id + 'Context'] = {
        ...structuredClone(document.styles.groupContext1),
        source: structuredClone(declaration.source),
        payload: {
          ...structuredClone(document.styles.groupContext1.payload),
          definitionId: id,
          declarationIds: [id + 'Provider'],
        },
      }
      document.instances[id] = {
        ...structuredClone(document.instances.g1),
        id,
        definitionId: id,
        parentInstanceId: parent,
        sourceBinding: { contextId: id + 'Context' },
      }
    }
    document.instances.i1.parentInstanceId = 'nested'
    const normalized = semantic.normalizeSemanticPresentation(before)
    const outer = apply(
      normalized,
      stopPatch(normalized, [
        { from: 0 },
        { key: 'inserted', pos: 25000, color: { kind: 'srgb', value: '111111' } },
        { from: 1 },
        { from: 2 },
      ])
    )
    const inner = apply(
      outer,
      stopPatch(
        outer,
        [
          { from: 0 },
          { key: 'inserted', pos: 25000, color: { kind: 'srgb', value: '222222' } },
          { from: 1 },
          { from: 2 },
          { from: 3 },
        ],
        'inner'
      ),
      'inner'
    )
    const leaf = apply(
      inner,
      stopPatch(
        inner,
        [{ from: 0 }, { from: 1, pos: 20000 }, { from: 2 }, { from: 3 }, { from: 4 }],
        'i1'
      ),
      'i1'
    )
    const snapshot = structuredClone(leaf)
    expect(() =>
      apply(
        leaf,
        stopPatch(
          leaf,
          [{ from: 0 }, { from: 2 }, { from: 1 }, { from: 3 }, { from: 4 }],
          'nested'
        ),
        'nested'
      )
    ).toThrow()
    expect(leaf).toEqual(snapshot)
    const deck = { ...leaf, id: 'nested-gradient-copy' }
    const copied = pasteSemanticClipboard({
      presentation: deck,
      slideId: 's2',
      clipboard: createSemanticClipboard({
        presentation: deck,
        slide: deck.slides[0],
        selectedElementIds: ['g1'],
      }),
    })
    const root = copied.selectedIds[0],
      model = copied.presentation.pptxSemantic
    const descendants = new Set([root])
    for (let level = 0; level < 3; level++)
      for (const instance of Object.values(model.instances))
        if (descendants.has(instance.parentInstanceId)) descendants.add(instance.id)
    const copiedLeaf = Object.values(model.instances).find(
      (instance) =>
        descendants.has(instance.id) && model.definitions[instance.definitionId].kind === 'shape'
    )
    expect(
      styles.materializeGeometry(model, copiedLeaf.id).style.fill.gradient.stops[1].color.value
    ).toBe('222222')
    expect(styles.materializeGeometry(model, copiedLeaf.id).style.fill.gradient.stops[1].pos).toBe(
      20000
    )
  })
  it('rejects an accessor patch on the leaf command envelope before evaluating it', () => {
    const before = fixture()
    let reads = 0
    const command = { type: 'fill-gradient-patch' }
    Object.defineProperty(command, 'patch', {
      enumerable: true,
      get() {
        reads++
        return { angle: 5400000 }
      },
    })
    expect(() =>
      operations.applyPresentationProjectionOperation(before, {
        type: 'geometry.edit',
        instanceId: 'i1',
        componentId: 'geometry',
        command,
      })
    ).toThrow()
    expect(reads).toBe(0)
  })
  it('rejects ambiguous inserted-stop or duplicate-reference identities before they can alias a descendant edit', () => {
    const before = fixture()
    for (const entries of [
      [{ from: 0 }, { from: 0, pos: 10000 }, { from: 2 }],
      [{ from: 0 }, { pos: 25000, color: { kind: 'srgb', value: '111111' } }, { from: 2 }],
      [
        {
          from: 0,
          transforms: [
            { from: 1, value: 50000 },
            { from: 1, value: 70000 },
          ],
        },
        { from: 2 },
      ],
    ])
      expect(() => apply(before, stopPatch(before, entries))).toThrow()
  })
  it('rejects reordering independently keyed literals underneath an established leaf reference', () => {
    const before = fixture()
    const first = { key: 'first', pos: 25000, color: { kind: 'srgb', value: '111111' } }
    const second = { key: 'second', pos: 25000, color: { kind: 'srgb', value: '222222' } }
    const owner = apply(before, stopPatch(before, [{ from: 0 }, first, second, { from: 2 }]))
    const leaf = apply(
      owner,
      stopPatch(owner, [{ from: 0 }, { from: 1, pos: 20000 }, { from: 2 }, { from: 3 }], 'i1'),
      'i1'
    )
    expect(() =>
      apply(leaf, stopPatch(before, [{ from: 0 }, second, first, { from: 2 }]))
    ).toThrow()
    const edited = apply(
      leaf,
      stopPatch(before, [
        { from: 0 },
        { ...first, color: { kind: 'srgb', value: '334455' } },
        second,
        { from: 2 },
      ])
    )
    expect(
      styles.materializeGeometry(edited.pptxSemantic, 'i1').style.fill.gradient.stops[1].color.value
    ).toBe('334455')
  })
  it.each(['angle', 'stops', 'entry', 'transform', 'provider', 'unknown'])(
    'rejects %s accessors or non-enumerable unknown fields without invoking them',
    (kind) => {
      const before = fixture(),
        patch =
          kind === 'angle' || kind === 'unknown'
            ? {}
            : stopPatch(before, [
                { from: 0, transforms: [{ from: 0 }, { from: 1 }] },
                { from: 1 },
                { from: 2 },
              ])
      let reads = 0
      const target = {
        angle: [patch, 'angle', 5400000],
        stops: [patch, 'stops', patch.stops],
        entry: [patch.stops?.entries[0], 'pos', 0],
        transform: [patch.stops?.entries[0].transforms[0], 'value', 20000],
        provider: [patch.stops?.provider, 'declarationKey', patch.stops?.provider.declarationKey],
      }[kind]
      if (kind === 'unknown') Object.defineProperty(patch, 'unrecognized', { value: true })
      else
        Object.defineProperty(target[0], target[1], {
          enumerable: true,
          get() {
            reads++
            return target[2]
          },
        })
      expect(() => apply(before, patch)).toThrow()
      expect(reads).toBe(0)
    }
  )
  it('retains provider phClr context and edits declaration transforms separately from upstream transforms', () => {
    const before = structuredClone(fixture()),
      document = before.pptxSemantic
    const wrapped = document.styles.groupProvider.payload.properties.fill
    const source = wrapped.source,
      wrap = (value) => ({ source: structuredClone(source), value })
    const gradient = wrapped.value.gradient.value
    gradient.stops[0].value.color.value.value = 'phClr'
    const themeSource = styleLocation(document.styles.theme.source.partUri, [0, 0, 0])
    const rebase = (value) => {
      if (Array.isArray(value)) return value.map(rebase)
      if (!value || typeof value !== 'object') return value
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          key === 'source' ? structuredClone(themeSource) : rebase(entry),
        ])
      )
    }
    document.styles.theme.payload.fillStyles = [rebase(wrap({ gradient: wrap(gradient) }))]
    const leafWrap = (value) => ({
      source: structuredClone(document.styles.provider.payload.properties.fill.source),
      value,
    })
    document.styles.provider.payload.styleRefs.fillRef = leafWrap({
      index: 1,
      color: leafWrap({
        kind: 'scheme',
        value: 'accent1',
        transforms: [leafWrap({ kind: 'alpha', value: 90000 })],
      }),
    })
    delete document.styles.provider.payload.properties.fill
    for (const id of ['context1', 'context2'])
      document.styles[id].payload.matrixBindings.fillRef = {
        declarationId: 'provider',
        index: 1,
        themeId: 'theme',
        list: 'fillStyles',
        entryIndex: 0,
        source: structuredClone(themeSource),
      }
    const normalized = semantic.normalizeSemanticPresentation(before)
    const next = apply(
      normalized,
      stopPatch(
        normalized,
        [
          { from: 0, transforms: [{ from: 0 }, { from: 1, value: 50000 }] },
          { from: 1 },
          { from: 2 },
        ],
        'i1'
      ),
      'i1'
    )
    const color = styles.materializeGeometry(retheme(next).pptxSemantic, 'i1').style.fill.gradient
      .stops[0].color
    expect(color.value).toBe('ABCDEF')
    expect(color.transforms).toEqual([
      { kind: 'alpha', value: 90000 },
      { kind: 'tint', value: 10000 },
      { kind: 'alpha', value: 50000 },
    ])
  })
  it('keeps full replacement semantics and permits sparse follow-up without installing source paint', () => {
    const before = fixture()
    const replacement = styles.materializeGeometry(before.pptxSemantic, 'i1').style.fill.gradient
    const replaced = operations.applyPresentationProjectionOperation(before, {
      type: 'group.fill.edit',
      instanceId: 'g1',
      componentId: 'group:group-properties',
      command: { type: 'fill-gradient', gradient: replacement },
    })
    const patched = apply(replaced, { angle: 5400000 })
    expect(
      styles.materializeGeometry(retheme(patched).pptxSemantic, 'i1').style.fill.gradient.stops[0]
        .color.value
    ).toBe('FF0000')
    expect(
      patched.pptxSemantic.instances.g1.overrides.components['group:group-properties'].geometryStyle
        .fill
    ).toEqual({
      gradient: replacement,
      gradientPatch: { angle: 5400000 },
    })
    const again = operations.applyPresentationProjectionOperation(patched, {
      type: 'group.fill.edit',
      instanceId: 'g1',
      componentId: 'group:group-properties',
      command: { type: 'fill-gradient', gradient: replacement },
    })
    expect(
      again.pptxSemantic.instances.g1.overrides.components['group:group-properties'].geometryStyle
        .fill
    ).toEqual({ gradient: replacement })
  })
  it('copies a source group with referenced gradient topology as an independent provider occurrence', () => {
    const before = { ...fixture(), id: 'gradient-deck' }
    const patched = apply(
      before,
      stopPatch(before, [{ from: 0 }, { from: 0, key: 'copied', pos: 10000 }, { from: 2 }])
    )
    const copied = pasteSemanticClipboard({
      presentation: patched,
      slideId: 's1',
      clipboard: createSemanticClipboard({
        presentation: patched,
        slide: patched.slides[0],
        selectedElementIds: ['g1'],
      }),
    })
    const root = copied.selectedIds[0],
      model = copied.presentation.pptxSemantic
    const leaf = Object.values(model.instances).find(
      (instance) => instance.parentInstanceId === root
    )
    expect(
      styles.materializeGeometry(model, leaf.id).style.fill.gradient.stops.map((stop) => stop.pos)
    ).toEqual([0, 10000, 100000])
    const stored =
      model.instances[root].overrides.components['group:group-properties'].geometryStyle.fill
        .gradientPatch
    expect(stored.stops.provider.instanceId).toBe(root)
    expect(model.styles).toEqual(before.pptxSemantic.styles)
  })
  it('keeps referenced leaf edits independent when copying their complete source owner closure', () => {
    const before = { ...fixture(), id: 'gradient-copy-leaf' }
    const patched = apply(
      before,
      stopPatch(before, [{ from: 0 }, { from: 1, pos: 60000 }, { from: 2 }], 'i1'),
      'i1'
    )
    const copied = pasteSemanticClipboard({
      presentation: patched,
      slideId: 's2',
      clipboard: createSemanticClipboard({
        presentation: patched,
        slide: patched.slides[0],
        selectedElementIds: ['g1'],
      }),
    })
    const model = copied.presentation.pptxSemantic,
      root = copied.selectedIds[0]
    const leaf = Object.values(model.instances).find(
      (instance) => instance.parentInstanceId === root
    )
    expect(
      leaf.overrides.components.geometry.geometryStyle.fill.gradientPatch.stops.provider.instanceId
    ).toBe(root)
    expect(styles.materializeGeometry(model, leaf.id).style.fill.gradient.stops[1].pos).toBe(60000)
    expect(styles.materializeGeometry(model, 'i2').style.fill.gradient.stops[0].color.value).toBe(
      '00FF00'
    )
  })
  it('supports an independent added stop, duplicate transform kinds and hard-transition order', () => {
    const before = fixture()
    const next = apply(
      before,
      stopPatch(before, [
        { from: 0 },
        {
          key: 'authored',
          pos: 50000,
          color: { kind: 'srgb', value: '445566' },
          transforms: [
            { key: 'first-alpha', kind: 'alpha', value: 50000 },
            { key: 'second-alpha', kind: 'alpha', value: 70000 },
          ],
        },
        { from: 1 },
        { from: 2 },
      ])
    )
    const gradient = styles.materializeGeometry(retheme(next).pptxSemantic, 'i1').style.fill
      .gradient
    expect(gradient.stops.map((stop) => stop.pos)).toEqual([0, 50000, 50000, 100000])
    expect(gradient.stops[1].color).toEqual({
      kind: 'srgb',
      value: '445566',
      transforms: [
        { kind: 'alpha', value: 50000 },
        { kind: 'alpha', value: 70000 },
      ],
    })
    expect(gradient.stops[2].color.value).toBe('ABCDEF')
  })
  it('rejects referenced stop and transform budget violations without publishing a partial patch', () => {
    const before = fixture(),
      snapshot = structuredClone(before)
    for (const entries of [
      [{ from: 0 }],
      Array.from({ length: 257 }, () => ({ from: 0 })),
      [{ from: 0, transforms: Array.from({ length: 33 }, () => ({ from: 0 })) }, { from: 2 }],
      [{ from: 0, transforms: [{ from: 1, value: -1 }] }, { from: 2 }],
      [{ from: 0, color: { kind: 'scheme', value: 'phClr' } }, { from: 2 }],
      [{ from: 0, color: { kind: 'srgb', value: '123456', source: {} } }, { from: 2 }],
    ])
      expect(() => apply(before, stopPatch(before, entries))).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('stores only angle/scaled intent and follows source theme after JSON reopen', () => {
    const before = fixture()
    const next = apply(apply(before, { angle: 5400000 }), { scaled: false })
    expect(next.pptxSemantic.instances.g1.overrides).toEqual({
      components: {
        'group:group-properties': {
          geometryStyle: { fill: { gradientPatch: { angle: 5400000, scaled: false } } },
        },
      },
    })
    const gradient = styles.materializeGeometry(retheme(next).pptxSemantic, 'i1').style.fill
      .gradient
    expect(gradient).toMatchObject({ angle: 5400000, scaled: false })
    expect(gradient.stops.every((stop) => stop.color.value === 'ABCDEF')).toBe(true)
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.instances.i1).toEqual(before.pptxSemantic.instances.i1)
    expect(next.pptxSemantic.instances.g2).toEqual(before.pptxSemantic.instances.g2)
  })
  it('copies/removes referenced stops and edits position without freezing any source color', () => {
    const before = fixture()
    const patch = stopPatch(before, [
      { from: 0 },
      { from: 0, key: 'copied', pos: 10000 },
      { from: 2 },
    ])
    const next = apply(before, patch)
    const state = styles.resolveGeometryStyle(retheme(next).pptxSemantic, 'g1')
    expect(state.style.fill.gradient.stops.map((stop) => stop.pos)).toEqual([0, 10000, 100000])
    expect(state.style.fill.gradient.stops.every((stop) => stop.color.value === 'ABCDEF')).toBe(
      true
    )
    expect(JSON.stringify(next.pptxSemantic.instances.g1.overrides)).not.toContain('FF0000')
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  })
  it('edits a declaration transform value without freezing its symbolic base or other ordered transforms', () => {
    const before = fixture()
    const next = apply(
      before,
      stopPatch(before, [
        { from: 0, transforms: [{ from: 0 }, { from: 1, value: 50000 }] },
        { from: 1 },
        { from: 2 },
      ])
    )
    const gradient = styles.materializeGeometry(retheme(next).pptxSemantic, 'i1').style.fill
      .gradient
    expect(gradient.stops[0].color).toEqual({
      kind: 'srgb',
      value: 'ABCDEF',
      transforms: [
        { kind: 'tint', value: 10000 },
        { kind: 'alpha', value: 50000 },
      ],
    })
    expect(gradient.stops[1].color.transforms[1].value).toBe(70000)
  })
  it('replaces only one base color while retaining its declared transform references', () => {
    const before = fixture()
    const next = apply(
      before,
      stopPatch(before, [
        { from: 0, color: { kind: 'srgb', value: '445566' } },
        { from: 1 },
        { from: 2 },
      ])
    )
    const gradient = styles.materializeGeometry(retheme(next).pptxSemantic, 'i1').style.fill
      .gradient
    expect(gradient.stops[0].color.value).toBe('445566')
    expect(gradient.stops[0].color.transforms).toEqual(gradient.stops[1].color.transforms)
    expect(gradient.stops[1].color.value).toBe('ABCDEF')
  })
  it('composes a leaf patch with owner scalars but atomically rejects an incompatible owner topology', () => {
    const before = fixture()
    const leaf = apply(
      before,
      stopPatch(before, [{ from: 0 }, { from: 1, pos: 60000 }, { from: 2 }], 'i1'),
      'i1'
    )
    const owner = apply(leaf, { angle: 5400000 })
    expect(styles.materializeGeometry(owner.pptxSemantic, 'i1').style.fill.gradient.angle).toBe(
      5400000
    )
    expect(
      styles.materializeGeometry(owner.pptxSemantic, 'i1').style.fill.gradient.stops[1].pos
    ).toBe(60000)
    const snapshot = structuredClone(owner)
    expect(() => apply(owner, stopPatch(owner, [{ from: 0 }, { from: 2 }]))).toThrow()
    expect(owner).toEqual(snapshot)
    expect(styles.geometryFillFrame(owner.pptxSemantic, 'i1').ownerInstanceId).toBe('g1')
  })
  it.each([
    { angle: -1 },
    { angle: 21600000 },
    { scaled: 'false' },
    { unknown: 1 },
    { stops: { provider: {}, entries: [{ from: 0 }, { from: 1 }] } },
  ])('rejects malformed patch %j atomically', (patch) => {
    const before = fixture(),
      snapshot = structuredClone(before)
    expect(() => apply(before, patch)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects forged provider and stale stop/transform references on edits and JSON reopen', () => {
    const before = fixture()
    const patch = stopPatch(before, [{ from: 0 }, { from: 1 }, { from: 2 }])
    for (const mutate of [
      (p) => {
        p.stops.provider.instanceId = 'g2'
      },
      (p) => {
        p.stops.provider.declarationKey += 'forged'
      },
      (p) => {
        p.stops.provider.topology[0] = []
      },
      (p) => {
        p.stops.entries[0].from = 9
      },
      (p) => {
        p.stops.entries[0].transforms = [{ from: 7 }]
      },
      (p) => {
        p.stops.entries[0].pos = 90000
      },
    ]) {
      const candidate = structuredClone(patch)
      mutate(candidate)
      expect(() => apply(before, candidate)).toThrow()
      const stored = structuredClone(before)
      stored.pptxSemantic.instances.g1.overrides.components = {
        'group:group-properties': { geometryStyle: { fill: { gradientPatch: candidate } } },
      }
      expect(() =>
        semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(stored)))
      ).toThrow()
    }
  })
})
