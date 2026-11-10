import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryStyleFixture, styleLocation } from './geometry-style-fixture.js'

const layout = 'ppt/slideLayouts/slideLayout1.xml'
const slots = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
]
const wrapped = (partUri, value, path = [0, 0, 0]) => ({
  source: styleLocation(partUri, path),
  value,
})
function nativeRecord(partUri, colors) {
  return {
    kind: 'native-theme-override',
    origin: 'source',
    source: styleLocation(partUri, [0]),
    payload: {
      colorScheme: wrapped(
        partUri,
        {
          colors: Object.fromEntries(
            slots.map((slot, index) => [
              slot,
              wrapped(partUri, { kind: 'srgb', value: colors[slot] ?? '112233' }, [0, 0, index, 0]),
            ])
          ),
        },
        [0, 0]
      ),
    },
  }
}
const binding = (styleId, fromPartUri, toPartUri) => ({
  styleId,
  edge: {
    fromPartUri,
    toPartUri,
    relationshipId: 'nativeOverride',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/themeOverride',
    source: styleLocation(fromPartUri.replace(/([^/]+)$/, '_rels/$1.rels'), [0, 2]),
  },
})
function fixture() {
  const document = geometryStyleFixture()
  const layoutPart = 'ppt/theme/nativeLayout.xml'
  const slidePart = 'ppt/theme/nativeSlide.xml'
  document.styles.nativeLayout = nativeRecord(layoutPart, { accent2: '118811', accent3: '445566' })
  document.styles.nativeSlide = nativeRecord(slidePart, { accent2: 'ABCDEF', accent3: '778899' })
  const layoutBinding = binding('nativeLayout', layout, layoutPart)
  document.styles.context1.payload.themeOverrideBindings = [
    binding('nativeSlide', 'ppt/slides/slide1.xml', slidePart),
    structuredClone(layoutBinding),
  ]
  document.styles.context2.payload.themeOverrideBindings = [structuredClone(layoutBinding)]
  return document
}
const normalize = (value) => semantic.normalizePptxSemanticDocument(value)

function matrixFixture() {
  const document = fixture()
  const part = document.styles.nativeLayout.source.partUri
  delete document.styles.nativeLayout.payload.colorScheme
  document.styles.nativeLayout.payload.formatScheme = wrapped(
    part,
    {
      fillStyles: [
        wrapped(
          part,
          {
            color: wrapped(
              part,
              {
                kind: 'scheme',
                value: 'phClr',
                transforms: [wrapped(part, { kind: 'shade', value: 50000 }, [0, 1, 0, 0, 0, 0])],
              },
              [0, 1, 0, 0, 0]
            ),
          },
          [0, 1, 0, 0]
        ),
      ],
      backgroundFillStyles: [],
      lineStyles: [],
      effectStyles: [],
    },
    [0, 1]
  )
  delete document.styles.provider.payload.properties.fill
  document.styles.provider.payload.styleRefs.fillRef = wrapped(layout, {
    index: 1,
    color: wrapped(layout, { kind: 'scheme', value: 'accent1' }),
  })
  for (const name of ['context1', 'context2'])
    document.styles[name].payload.matrixBindings.fillRef = {
      declarationId: 'provider',
      index: 1,
      themeId: 'theme',
      list: 'fillStyles',
      entryIndex: 0,
      overrideStyleId: 'nativeLayout',
      source: structuredClone(
        document.styles.nativeLayout.payload.formatScheme.value.fillStyles[0].source
      ),
    }
  return document
}

describe('authenticated native theme override categories', () => {
  it.each([
    ['identical', false],
    ['contradictory', false],
    ['contradictory', true],
  ])(
    'rejects %s duplicate source-part identities with uninstantiated=%s',
    (kind, uninstantiated) => {
      const document = fixture()
      delete document.styles.nativeSlide
      document.styles.nativeDuplicate = structuredClone(document.styles.nativeLayout)
      if (kind === 'contradictory')
        document.styles.nativeDuplicate.payload.colorScheme.value.colors.accent3.value.value =
          'BADA55'
      document.styles.context1.payload.themeOverrideBindings = [
        binding('nativeLayout', 'ppt/slides/slide1.xml', 'ppt/theme/nativeLayout.xml'),
      ]
      document.styles.context2.payload.themeOverrideBindings = [
        binding('nativeDuplicate', 'ppt/slides/slide2.xml', 'ppt/theme/nativeLayout.xml'),
      ]
      if (uninstantiated) document.instances = {}
      const before = structuredClone(document)
      expect(() => normalize(document)).toThrow(/duplicate native override source part/)
      expect(document).toEqual(before)
    }
  )
  it('preserves a font-only category source identity without inventing geometry paint or font semantics', () => {
    const document = fixture()
    delete document.styles.nativeSlide.payload.colorScheme
    const part = document.styles.nativeSlide.source.partUri
    document.styles.nativeSlide.payload.fontScheme = wrapped(part, { kind: 'preserved' }, [0, 0])
    const model = normalize(document)
    expect(model.styles.nativeSlide.payload.fontScheme).toEqual(
      document.styles.nativeSlide.payload.fontScheme
    )
    expect(resolution.materializeGeometry(model, 'i1').style.fill.color.value).toBe('118811')
    expect(model.styles.nativeSlide.payload.fontScheme.value).not.toHaveProperty('fonts')
  })
  it.each([
    [
      'removed provider',
      (d) => {
        delete d.styles.context1.payload.matrixBindings.fillRef.overrideStyleId
      },
    ],
    [
      'unrelated provider',
      (d) => {
        d.styles.context1.payload.matrixBindings.fillRef.overrideStyleId = 'nativeSlide'
      },
    ],
    [
      'base entry source',
      (d) => {
        d.styles.context1.payload.matrixBindings.fillRef.source =
          styleLocation('ppt/theme/theme1.xml')
      },
    ],
    [
      'selected unsupported entry',
      (d) => {
        d.styles.nativeLayout.payload.formatScheme.value.fillStyles[0].value = {
          kind: 'unsupported',
          reason: 'Unimplemented source family',
        }
      },
    ],
  ])('rejects %s even in an uninstantiated retained source context', (_, mutate) => {
    const document = matrixFixture()
    delete document.instances.i1
    mutate(document)
    const before = structuredClone(document)
    expect(() => normalize(document)).toThrow()
    expect(document).toEqual(before)
  })
  it('preserves sentinel references without binding a native or base matrix entry', () => {
    const document = matrixFixture()
    document.styles.provider.payload.styleRefs.fillRef.value.index = 0
    for (const name of ['context1', 'context2'])
      document.styles[name].payload.matrixBindings.fillRef = {
        declarationId: 'provider',
        index: 0,
        themeId: 'theme',
        list: 'fillStyles',
        entryIndex: null,
      }
    const model = normalize(document)
    expect(resolution.materializeGeometry(model, 'i1').style.fill.color).toEqual({ kind: 'none' })
    expect(model.styles.context1.payload.matrixBindings.fillRef).not.toHaveProperty(
      'overrideStyleId'
    )
  })
  it('selects color and format categories independently and preserves phClr transforms', () => {
    const model = normalize(matrixFixture())
    expect(resolution.materializeGeometry(model, 'i1').style.fill.color).toEqual({
      kind: 'srgb',
      value: 'ABCDEF',
      transforms: [{ kind: 'shade', value: 50000 }],
    })
    expect(resolution.materializeGeometry(model, 'i2').style.fill.color).toEqual({
      kind: 'srgb',
      value: '00FF00',
      transforms: [{ kind: 'shade', value: 50000 }],
    })
    expect(resolution.resolveGeometryStyle(model, 'i1').properties.fill.source).toEqual(
      model.styles.nativeLayout.payload.formatScheme.value.fillStyles[0].source
    )
  })
  it('keeps base project palette edits effective for a native format with no native palette', () => {
    const document = matrixFixture()
    delete document.styles.nativeSlide.payload.colorScheme
    document.styles.project = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: '778899' } } },
    }
    const model = normalize(document)
    expect(resolution.materializeGeometry(model, 'i1').style.fill.color.value).toBe('778899')
    expect(resolution.resolveGeometryStyle(model, 'i1').properties.fill.dependencyIds).toContain(
      'project:colors.accent2'
    )
  })
  it('rejects an absent selected native matrix entry instead of borrowing a valid base entry', () => {
    const document = matrixFixture()
    document.styles.theme.payload.fillStyles = structuredClone(
      document.styles.nativeLayout.payload.formatScheme.value.fillStyles
    ).map(() => ({
      source: styleLocation('ppt/theme/theme1.xml', [0, 0, 0]),
      value: { color: wrapped('ppt/theme/theme1.xml', { kind: 'srgb', value: '123456' }) },
    }))
    document.styles.nativeLayout.payload.formatScheme.value.fillStyles = []
    expect(() => normalize(document)).toThrow()
  })
  it('retains distinct native identities and derives each host palette after JSON reload', () => {
    const document = fixture(),
      before = structuredClone(document)
    const normalized = normalize(document)
    expect(resolution.materializeGeometry(normalized, 'i1').style.fill.color.value).toBe('ABCDEF')
    expect(resolution.materializeGeometry(normalized, 'i2').style.fill.color.value).toBe('445566')
    expect(normalize(JSON.parse(JSON.stringify(normalized)))).toEqual(normalized)
    expect(document).toEqual(before)
    expect(normalized.styles.context1.payload.themeId).toBe('theme')
    expect(normalized.definitions.definition).toEqual(before.definitions.definition)
  })
  it('masks base project palette changes without losing an explicit occurrence paint', () => {
    const document = fixture()
    document.styles.project = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: 'FF0000' } } },
    }
    let model = normalize(document)
    expect(resolution.materializeGeometry(model, 'i1').style.fill.color.value).toBe('ABCDEF')
    expect(
      resolution.resolveGeometryStyle(model, 'i1').properties.fill.dependencyIds
    ).not.toContain('project:colors.accent2')
    document.instances.i1.overrides.components = {
      geometry: { geometryStyle: { fill: { color: { kind: 'srgb', value: 'BADA55' } } } },
    }
    model = normalize(document)
    expect(resolution.materializeGeometry(model, 'i1').style.fill.color.value).toBe('BADA55')
    expect(resolution.materializeGeometry(model, 'i2').style.fill.color.value).toBe('445566')
  })
  it('allows the same immutable override target through distinct slide and layout owner edges', () => {
    const document = fixture()
    delete document.styles.nativeSlide
    document.styles.context1.payload.themeOverrideBindings[0] = binding(
      'nativeLayout',
      'ppt/slides/slide1.xml',
      'ppt/theme/nativeLayout.xml'
    )
    expect(resolution.materializeGeometry(normalize(document), 'i1').style.fill.color.value).toBe(
      '118811'
    )
  })
  it.each([
    [
      'missing native color slot',
      (d) => {
        delete d.styles.nativeSlide.payload.colorScheme.value.colors.accent6
      },
    ],
    [
      'foreign category wrapper',
      (d) => {
        d.styles.nativeSlide.payload.colorScheme.source.partUri = 'ppt/theme/foreign.xml'
      },
    ],
    [
      'reversed owner order',
      (d) => {
        d.styles.context1.payload.themeOverrideBindings.reverse()
      },
    ],
    [
      'duplicate owner',
      (d) => {
        d.styles.context1.payload.themeOverrideBindings.push(
          structuredClone(d.styles.context1.payload.themeOverrideBindings[0])
        )
      },
    ],
    [
      'unsupported master owner',
      (d) => {
        d.styles.context1.payload.themeOverrideBindings[0] = binding(
          'nativeSlide',
          'ppt/slideMasters/slideMaster1.xml',
          'ppt/theme/nativeSlide.xml'
        )
      },
    ],
    [
      'wrong target kind',
      (d) => {
        d.styles.context1.payload.themeOverrideBindings[0].styleId = 'theme'
      },
    ],
    [
      'wrong edge target',
      (d) => {
        d.styles.context1.payload.themeOverrideBindings[0].edge.toPartUri =
          'ppt/theme/nativeLayout.xml'
      },
    ],
    [
      'wrong edge source',
      (d) => {
        d.styles.context1.payload.themeOverrideBindings[0].edge.source.partUri =
          'ppt/slides/_rels/slide2.xml.rels'
      },
    ],
    [
      'wrong exact relationship type',
      (d) => {
        d.styles.context1.payload.themeOverrideBindings[0].edge.type += '-unknown'
      },
    ],
    [
      'selectively omitted shared layout edge',
      (d) => {
        d.styles.context2.payload.themeOverrideBindings = []
      },
    ],
    [
      'contradictory shared layout target',
      (d) => {
        d.styles.context2.payload.themeOverrideBindings[0] = binding(
          'nativeSlide',
          layout,
          'ppt/theme/nativeSlide.xml'
        )
      },
    ],
  ])('rejects %s on reload despite a complete visible paint override', (_, mutate) => {
    const document = fixture()
    document.instances.i1.overrides.components = {
      geometry: { geometryStyle: { fill: { color: { kind: 'srgb', value: 'BADA55' } } } },
    }
    mutate(document)
    const before = structuredClone(document)
    expect(() => normalize(document)).toThrow()
    expect(document).toEqual(before)
  })
})
