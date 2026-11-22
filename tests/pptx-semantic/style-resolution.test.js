import { describe, expect, it, vi } from 'vitest'
import { resolveProperty, resolveProperties } from '../../shared/src/pptx-style-resolution'
import { TEXT_DOCUMENT_LIMITS, TEXT_PROPERTY_SCOPES, normalizeTextProperties, normalizeTextDocument, cloneOwnedTextData, validateOwnedTextProperties } from '../../shared/src/pptx-text-document'

const source = (part) => ({ part, path: '/sp[1]/txBody/p[1]' })
const layer = (id, kind, properties, extra = {}) => ({
  id, kind, source: source(`ppt/${id}.xml`), properties, ...extra,
})
const target = { level: 0, placeholder: { index: 0, type: 'body' } }
const resolve = (property, entries, theme, context = target) =>
  resolveProperty({ property, layers: { target: context, entries }, ...(theme ? { theme } : {}) })
const theme = {
  id: 'theme:1', source: source('ppt/theme/theme1.xml'), colorMap: { tx1: 'dk1' },
  colors: { dk1: '204060', accent1: 'FF0000' },
  fonts: {
    minor: { latin: 'Example Sans', eastAsian: '', complexScript: '', scripts: { Arab: 'Arabic Face', Jpan: 'CJK Face' } },
    major: { latin: 'Example Display', eastAsian: '', complexScript: '' },
  },
}

describe('property-specific source style resolution', () => {
  it('copies shallow-frozen nested mutables freshly and never skips public validation', () => {
    const input = Object.freeze({ fontLatin: { typeface: 'Before' } })
    const first = normalizeTextProperties(input, 'run')
    const second = normalizeTextProperties(input, 'run')
    expect(second).not.toBe(first)
    expect(second.fontLatin).not.toBe(input.fontLatin)
    first.fontLatin.typeface = 'Detached'
    input.fontLatin.typeface = 'After'
    expect(normalizeTextProperties(input, 'run').fontLatin.typeface).toBe('After')
    input.fontLatin.typeface = 17
    expect(() => normalizeTextProperties(input, 'run')).toThrow(TypeError)
    second.fontLatin.typeface = 17
    expect(() => normalizeTextProperties(second, 'run')).toThrow(TypeError)
    const doc = Object.freeze({ schemaVersion: 1, componentId: 'text', paragraphs: [], body: { autofit: { mode: 'normal', fontScale: 100000 } } })
    const output = normalizeTextDocument(doc)
    expect(normalizeTextDocument(output)).not.toBe(output)
    doc.body.autofit.fontScale = -1
    expect(() => normalizeTextDocument(doc)).toThrow(TypeError)
  })

  it('reuses owned property proofs only for the exact successfully validated scope', () => {
    const owned = cloneOwnedTextData({ bold: true, fontLatin: { typeface: 'Owned' } })
    expect(validateOwnedTextProperties(owned, 'run')).toBe(owned)
    expect(validateOwnedTextProperties(owned, 'run')).toBe(owned)
    expect(cloneOwnedTextData(owned)).toBe(owned)
    expect(() => validateOwnedTextProperties(owned, 'body')).toThrow(TypeError)
    expect(() => validateOwnedTextProperties(owned, 'unknown')).toThrow(TypeError)
    const detached = normalizeTextProperties(owned, 'run')
    expect(detached.fontLatin).not.toBe(owned.fontLatin)
    detached.fontLatin.typeface = 'Changed'
    expect(owned.fontLatin.typeface).toBe('Owned')
  })

  it('isolates owned composition results by complete scope and theme and detaches each output', () => {
    const layers = cloneOwnedTextData({ target, entries: [layer('p', 'paragraph', { direction: 'rtl', fontLatin: { typeface: '+mn-lt' } })] })
    const ownedTheme = cloneOwnedTextData(theme)
    const input = { scope: 'run', layers, theme: ownedTheme }
    const first = resolveProperties(input)
    first.fontLatin.source.path = 'mutated'
    first.fontLatin.dependencyIds.push('mutated')
    first.fontLatin.authored.typeface = 'mutated'
    const again = resolveProperties(input)
    expect(again.fontLatin.resolved).toBe('Example Sans')
    expect(again.fontLatin.authored.typeface).toBe('+mn-lt')
    expect(again.fontLatin.source.path).not.toBe('mutated')
    expect(again.fontLatin.dependencyIds).toEqual(['p', 'theme:1'])
    expect(resolveProperties({ scope: 'paragraph', layers }).direction.resolved).toBe('rtl')
    expect(resolveProperties({ scope: 'run', layers }).fontLatin.unsupportedReason).toBe('missing-theme-font')
    const changed = cloneOwnedTextData({ ...theme, fonts: { minor: { latin: 'Other' } } })
    expect(resolveProperties({ ...input, theme: changed }).fontLatin.resolved).toBe('Other')
  })

  it('never caches composition by shallow-frozen raw layer identity', () => {
    const properties = { fontLatin: { typeface: 'Before' } }
    const layers = Object.freeze({ target, entries: [layer('r', 'run', properties)] })
    const input = { scope: 'run', layers }
    expect(resolveProperties(input).fontLatin.resolved).toBe('Before')
    properties.fontLatin.typeface = 'After'
    expect(resolveProperties(input).fontLatin.resolved).toBe('After')
    properties.fontLatin.typeface = 42
    expect(() => resolveProperties(input)).toThrow(TypeError)
  })

  it('charges reused owned subtrees against aggregate node and depth budgets', () => {
    const leaf = cloneOwnedTextData({ value: 'x' })
    let deep = leaf
    for (let i = 0; i < TEXT_DOCUMENT_LIMITS.maxDepth; i++) deep = { child: deep }
    expect(() => cloneOwnedTextData(deep)).toThrow(/budget/)
    const many = Array(60000).fill(leaf)
    const owned = cloneOwnedTextData(many)
    expect(() => cloneOwnedTextData([owned, owned, owned])).toThrow(/budget/)
    const bytes = cloneOwnedTextData({ text: 'x'.repeat(1000000) })
    expect(() => cloneOwnedTextData(Array(5).fill(bytes))).toThrow(/bytes/)
  })

  it('retains an explicit false or zero and records the exact winning source', () => {
    const direct = layer('direct', 'run', { bold: false })
    const parent = layer('paragraph', 'paragraph', { bold: true })
    expect(resolve('bold', [parent, direct])).toEqual({
      property: 'bold', authored: false, resolved: false,
      source: { layerId: 'direct', kind: 'run', ...direct.source },
      dependencyIds: ['direct'], unsupportedReason: null,
    })
    expect(resolve('spaceBefore', [layer('p', 'paragraph', { spaceBefore: { unit: 'points', value: 0 } })]).resolved)
      .toEqual({ unit: 'points', value: 0 })
    expect(resolve('bold', [layer('p', 'paragraph', {})]).unsupportedReason).toBe('property-not-defined')
  })

  it('uses matching layout idx, master type, and list level rather than array order', () => {
    const entries = [
      layer('master', 'masterList', { fontSizePt: 30 }, { placeholder: { type: 'body' }, level: 0 }),
      layer('wrong-layout', 'layoutList', { fontSizePt: 99 }, { placeholder: { index: 8 }, level: 0 }),
      layer('layout-default', 'layoutList', { fontSizePt: 22 }, { placeholder: { index: 0 } }),
      layer('layout-level', 'layoutList', { fontSizePt: 24 }, { placeholder: { index: 0 }, level: 0 }),
      layer('shape-list', 'shapeList', { fontSizePt: 12 }, { level: 0 }),
    ]
    expect(resolve('fontSizePt', entries).resolved).toBe(12)
    expect(resolve('fontSizePt', entries.slice(0, 4)).source.layerId).toBe('layout-level')
    expect(resolve('fontSizePt', entries.slice(0, 3)).resolved).toBe(22)
    expect(resolve('fontSizePt', entries.slice(0, 2)).resolved).toBe(30)
    expect(resolve('fontSizePt', entries.slice(0, 2), null, { level: 0 }).resolved).toBeNull()
  })

  it('inherits bullets and tabs atomically, but body insets do not inherit paragraph styles', () => {
    const tabs = [{ positionEmu: 0, alignment: 'l' }, { positionEmu: 914400, alignment: 'dec' }]
    const entries = [
      layer('layout', 'layoutList', { tabs, bullet: { kind: 'character', character: '\u2022' } }, { placeholder: { index: 0 }, level: 0 }),
      layer('direct', 'paragraph', { insetLeftEmu: 99 }),
      layer('body', 'layoutBody', { insetLeftEmu: 0 }, { placeholder: { index: 0 } }),
    ]
    expect(resolve('tabs', entries).resolved).toEqual(tabs)
    expect(resolve('bullet', entries).resolved).toEqual({ kind: 'character', character: '\u2022' })
    expect(resolve('insetLeftEmu', entries).resolved).toBe(0)
    const clear = layer('p', 'paragraph', { tabs: [], bullet: { kind: 'none' } })
    expect(resolve('tabs', [clear, ...entries]).resolved).toEqual([])
    expect(resolve('bullet', [clear, ...entries]).resolved).toEqual({ kind: 'none' })
  })

  it('preserves bullet follow-text declarations without pretending to know first-run metrics', () => {
    for (const property of ['bulletFont', 'bulletColor', 'bulletSize']) {
      expect(resolve(property, [layer('p', 'paragraph', { [property]: 'text' })])).toMatchObject({
        authored: 'text', resolved: null, unsupportedReason: 'requires-bullet-run-style',
      })
    }
  })

  it('tracks inspected declarations and resolves only applicable theme defaults last', () => {
    const empty = layer('r', 'run', {})
    const defaults = layer('defaults', 'theme', { fontLatin: { typeface: '+mn-lt' }, bold: true })
    expect(resolve('fontLatin', [defaults, empty], theme)).toMatchObject({
      resolved: 'Example Sans', source: { layerId: 'defaults' }, dependencyIds: ['r', 'defaults', 'theme:1'],
    })
    expect(resolve('bold', [defaults, empty], theme).unsupportedReason).toBe('property-not-defined')
  })

  it('reports ambiguous precedence instead of taking whichever source came first', () => {
    const entries = ['a', 'b'].map(id => layer(id, 'layoutList', { bold: true }, { placeholder: { index: 0 }, level: 0 }))
    expect(resolve('bold', entries)).toMatchObject({
      authored: null, resolved: null, source: null, dependencyIds: ['a', 'b'], unsupportedReason: 'ambiguous-style-source',
    })
  })

  it('follows the matched layout placeholder type to the master, including default slide type', () => {
    const entries = [
      layer('layout', 'layoutList', {}, { placeholder: { index: 0, type: 'title' } }),
      layer('title', 'masterList', { fontSizePt: 24 }, { placeholder: { type: 'title' } }),
      layer('body', 'masterList', { fontSizePt: 12 }, { placeholder: { type: 'body' } }),
    ]
    expect(resolve('fontSizePt', entries, null, { placeholder: { index: 0 } })).toMatchObject({
      resolved: 24, source: { layerId: 'title' }, dependencyIds: ['layout', 'title'],
    })
  })

  it('requires scope for overlapping direction and applies paragraph defaults independently', () => {
    const layers = { target, entries: [layer('defaults', 'presentationDefault', { direction: 'rtl' })] }
    expect(() => resolveProperty({ property: 'direction', layers })).toThrow(TypeError)
    expect(resolveProperty({ property: 'direction', scope: 'paragraph', layers }).resolved).toBe('rtl')
    expect(resolveProperty({ property: 'direction', scope: 'run', layers }).resolved).toBeNull()
    expect(() => resolveProperty({ property: 'fontSizePt', scope: 'body', layers })).toThrow(TypeError)
  })

  it('uses theme script faces and records theme dependencies without inventing a fallback', () => {
    const font = { typeface: '+mn-cs', script: 'Arab' }
    const entries = [layer('p', 'paragraph', { fontComplexScript: font })]
    expect(resolve('fontComplexScript', entries, theme)).toMatchObject({
      authored: font, resolved: 'Arabic Face', dependencyIds: ['p', 'theme:1'],
    })
    expect(resolve('fontLatin', [layer('p', 'paragraph', { fontLatin: { typeface: '+mj-lt' } })], theme).resolved).toBe('Example Display')
    expect(resolve('fontEastAsian', [layer('p', 'paragraph', { fontEastAsian: { typeface: '+mn-ea', script: 'Jpan' } })], theme).resolved).toBe('CJK Face')
    expect(resolve('fontComplexScript', entries).unsupportedReason).toBe('missing-theme-font')
    expect(resolve('fontComplexScript', [layer('p', 'paragraph', { fontComplexScript: { typeface: '+mn-cs' } })], theme).unsupportedReason).toBe('missing-theme-font')
    const scriptTheme = structuredClone(theme)
    scriptTheme.fonts.minor.scripts.Cyrl = 'Cyrillic Face'
    expect(resolve('fontLatin', [layer('p', 'paragraph', { fontLatin: { typeface: '+mn-lt', script: 'Cyrl' } })], scriptTheme).resolved).toBe('Cyrillic Face')
  })

  it('resolves mapped scheme colors and ordered tint/shade/alpha including zero endpoints', () => {
    const color = { kind: 'scheme', value: 'tx1', transforms: [{ kind: 'tint', value: 50000 }, { kind: 'shade', value: 50000 }, { kind: 'alpha', value: 0 }] }
    const entries = [layer('r', 'run', { color })]
    expect(resolve('color', entries, theme)).toMatchObject({
      authored: color, resolved: { rgb: '485058', alpha: 0 }, dependencyIds: ['r', 'theme:1'],
    })
    for (const [kind, rgb] of [['tint', 'FFFFFF'], ['shade', '000000']]) {
      expect(resolve('color', [layer('r', 'run', { color: { kind: 'srgb', value: '204060', transforms: [{ kind, value: 0 }] } })]).resolved.rgb).toBe(rgb)
    }
    expect(resolve('color', entries).unsupportedReason).toBe('missing-theme-color')
  })

  it('supports luminance transforms and never aliases result data to input', () => {
    const color = { kind: 'srgb', value: 'FF0000', transforms: [{ kind: 'lumMod', value: 50000 }, { kind: 'lumOff', value: 25000 }] }
    expect(resolve('color', [layer('r', 'run', { color })]).resolved.rgb).toBe('FF0000')
    const tabs = [{ positionEmu: 0 }]
    const result = resolve('tabs', [layer('p', 'paragraph', { tabs })])
    result.resolved[0].positionEmu = 100
    expect(result.authored[0].positionEmu).toBe(0)
    expect(tabs[0].positionEmu).toBe(0)
  })

  it('rejects duplicate layers, unknown properties, malformed sources, and future enums', () => {
    const entry = layer('r', 'run', { bold: false })
    expect(() => resolve('bold', [entry, entry])).toThrow(TypeError)
    expect(() => resolve('unknown', [entry])).toThrow(TypeError)
    expect(() => resolve('bold', [{ ...entry, source: {} }])).toThrow(TypeError)
    expect(() => resolve('bold', [{ ...entry, kind: 'anything' }])).toThrow(TypeError)
    expect(() => resolve('color', [layer('r', 'run', { color: { kind: 'srgb', value: 'fff' } })])).toThrow(TypeError)
  })
})

describe('checked scope style resolution', () => {
  it('runs common layer matching once per composition, not once per property', () => {
    const layers = cloneOwnedTextData({ target, entries: [
      layer('layout', 'layoutList', { bold: true }, { placeholder: { index: 0, type: 'body' } }),
    ] })
    // Observe the actual predicate operation, not source text or unsafe input
    // accessors. Context discovery and common eligibility each match it once.
    const startsWith = String.prototype.startsWith
    let matches = 0
    const spy = vi.spyOn(String.prototype, 'startsWith').mockImplementation(function (prefix, ...args) {
      if (String(this) === 'layoutList' && prefix === 'layout') matches++
      return startsWith.call(this, prefix, ...args)
    })
    let first, second, coldMatches, warmMatches
    try {
      first = resolveProperties({ scope: 'run', layers })
      coldMatches = matches
      second = resolveProperties({ scope: 'run', layers })
      warmMatches = matches - coldMatches
    } finally { spy.mockRestore() }
    expect(first.bold.resolved).toBe(true)
    expect(second).toEqual(first)
    expect(coldMatches).toBe(2)
    expect(warmMatches).toBe(coldMatches)
  })

  it('keeps mixed-rank, level, reference and fallback behavior for every property and scope', () => {
    const entries = [
      layer('z', 'run', { bold: false }),
      layer('ä', 'run', { italic: true }),
      layer('a', 'run', {}),
      layer('body', 'body', { insetLeftEmu: 0 }),
      layer('paragraph', 'paragraph', { tabs: [], direction: 'rtl', bulletFont: 'text' }),
      layer('wrong-level', 'shapeList', { fontSizePt: 99 }, { level: 8 }),
      layer('layout', 'layoutList', {}, { level: 0, placeholder: { index: 0, type: 'title' } }),
      layer('layout-default', 'layoutList', { fontSizePt: 24 }, { placeholder: { index: 0, type: 'title' } }),
      layer('wrong-layout', 'layoutFontReference', { fontLatin: { typeface: 'Wrong' } }, { placeholder: { index: 9 } }),
      layer('reference', 'fontReference', { fontLatin: { typeface: '+mn-lt' }, bold: true, highlight: { kind: 'srgb', value: 'FFFFFF' } }),
      layer('master-title', 'masterList', { underline: 'sng' }, { placeholder: { type: 'title' } }),
      layer('master-body', 'masterList', { fontEastAsian: { typeface: 'Wrong' } }, { placeholder: { type: 'body' } }),
      layer('text-style', 'masterTextStyle', { fontComplexScript: { typeface: '+mn-cs', script: 'Arab' } }, { category: 'title' }),
      layer('presentation', 'presentationDefault', { direction: 'ltr', fontSizePt: 18 }),
      layer('theme-default', 'theme', { fontEastAsian: { typeface: '+mn-ea' }, color: { kind: 'scheme', value: 'accent1' }, strike: 'sngStrike' }),
    ]
    for (const context of [target, { level: 0 }, { level: 1, placeholder: { index: 0 } }]) {
      for (const selectedTheme of [theme, undefined]) {
        for (const scope of Object.keys(TEXT_PROPERTY_SCOPES)) {
          const input = { scope, layers: { target: context, entries }, ...(selectedTheme ? { theme: selectedTheme } : {}) }
          const batch = resolveProperties(input)
          for (const property of TEXT_PROPERTY_SCOPES[scope])
            expect(batch[property]).toEqual(resolveProperty({ property, ...input }))
          expect(resolveProperties({ ...input, layers: { ...input.layers, entries: [...entries].reverse() } })).toEqual(batch)
        }
      }
    }
    const run = resolveProperties({ scope: 'run', layers: { target, entries }, theme })
    expect(run.bold).toMatchObject({ resolved: false, dependencyIds: ['a', 'ä', 'z'] })
    expect(run.fontSizePt).toMatchObject({ resolved: 24, source: { layerId: 'layout-default' } })
    expect(run.underline.source.layerId).toBe('master-title')
    expect(run.fontLatin.resolved).toBe('Example Sans')
    expect(run.fontEastAsian.unsupportedReason).toBe('missing-theme-font')
    expect(run.color.resolved).toEqual({ rgb: 'FF0000', alpha: 1 })
    expect(run.highlight.unsupportedReason).toBe('property-not-defined')
    expect(run.strike.unsupportedReason).toBe('property-not-defined')
  })

  it('matches individual results for every scope, including provenance and explicit clearing', () => {
    const entries = [
      layer('body', 'body', { insetLeftEmu: 0, anchorCenter: false }),
      layer('run', 'run', { bold: false, baseline: 0, color: { kind: 'scheme', value: 'tx1' } }),
      layer('paragraph', 'paragraph', {
        tabs: [], direction: 'rtl', spaceBefore: { unit: 'points', value: 0 }, bulletFont: 'text',
      }),
      layer('layout', 'layoutList', { fontLatin: { typeface: '+mn-lt' } }, {
        placeholder: { index: 0, type: 'body' }, level: 0,
      }),
      layer('wrong-layout', 'layoutList', { fontSizePt: 99 }, { placeholder: { index: 9 } }),
      layer('master', 'masterList', { fontEastAsian: { typeface: '+mn-ea', script: 'Jpan' } }, {
        placeholder: { type: 'body' }, level: 0,
      }),
      layer('defaults', 'theme', { fontComplexScript: { typeface: '+mn-cs', script: 'Arab' } }),
    ]
    for (const scope of Object.keys(TEXT_PROPERTY_SCOPES)) {
      const input = { scope, layers: { target, entries }, theme }
      const results = resolveProperties(input)
      expect(Object.keys(results)).toEqual(TEXT_PROPERTY_SCOPES[scope])
      for (const property of TEXT_PROPERTY_SCOPES[scope])
        expect(results[property]).toEqual(resolveProperty({ property, ...input }))
    }
    const results = resolveProperties({ scope: 'run', layers: { target, entries }, theme })
    expect(results.bold).toMatchObject({ authored: false, resolved: false, source: { layerId: 'run' } })
    expect(results.baseline.resolved).toBe(0)
    expect(results.fontEastAsian).toMatchObject({
      resolved: 'CJK Face', dependencyIds: ['run', 'paragraph', 'layout', 'master', 'theme:1'],
    })
    const paragraph = resolveProperties({ scope: 'paragraph', layers: { target, entries }, theme })
    expect(paragraph.tabs.resolved).toEqual([])
    expect(paragraph.bulletFont.unsupportedReason).toBe('requires-bullet-run-style')
  })

  it('preserves ambiguous precedence and conflicting placeholder errors', () => {
    const entries = ['b', 'a'].map(id => layer(id, 'layoutList', { bold: true }, {
      placeholder: { index: 0, type: 'body' }, level: 0,
    }))
    const input = { scope: 'run', layers: { target, entries } }
    expect(resolveProperties(input).bold).toEqual(resolveProperty({ property: 'bold', ...input }))
    expect(resolveProperties(input).bold).toMatchObject({
      dependencyIds: ['a', 'b'], unsupportedReason: 'ambiguous-style-source',
    })
    entries[1].placeholder.type = 'title'
    expect(() => resolveProperties(input)).toThrow('conflicting layout placeholder types')
    expect(() => resolveProperty({ property: 'bold', ...input })).toThrow('conflicting layout placeholder types')
  })

  it('checks unused and ineligible declarations, sources, themes, and duplicate IDs', () => {
    const direct = layer('direct', 'run', { bold: false })
    const inputs = [
      { entries: [direct, layer('unused', 'layoutList', { underline: 'future' }, { placeholder: { index: 99 } })] },
      { entries: [direct, layer('unused', 'masterList', { tabs: [{ positionEmu: '0' }] }, { level: 8 })] },
      { entries: [direct, layer('unused', 'body', { unknown: true })] },
      { entries: [direct, { ...layer('unused', 'body', {}), source: {} }] },
      { entries: [direct, { ...direct }] },
      { entries: [direct], theme: { ...theme, id: direct.id } },
      { entries: [direct], theme: { ...theme, colors: { accent1: 'fff' } } },
    ]
    for (const { entries, theme: invalidTheme } of inputs) {
      const input = {
        scope: 'run', layers: { target, entries }, ...(invalidTheme ? { theme: invalidTheme } : {}),
      }
      expect(() => resolveProperties(input)).toThrow(TypeError)
      expect(() => resolveProperty({ property: 'bold', ...input })).toThrow(TypeError)
    }
  })

  it('requires an explicit scope and rejects extra or unsafe input without reading accessors', () => {
    const layers = { target, entries: [] }
    for (const input of [
      { layers }, { scope: undefined, layers }, { scope: 'future', layers },
      { scope: 'run', layers, property: 'bold' }, { scope: 'run', layers, properties: ['bold'] },
      Object.assign(Object.create(null), { scope: 'run', layers }),
      Object.assign(Object.create({ scope: 'run' }), { layers }),
      Object.defineProperty({ scope: 'run', layers }, 'hidden', { value: true }),
      { scope: 'run', layers, [Symbol('extra')]: true },
    ]) expect(() => resolveProperties(input)).toThrow(TypeError)
    let reads = 0
    const accessor = () => { reads++; throw new Error('must not read') }
    const scopeAccessor = Object.defineProperty({ layers }, 'scope', { enumerable: true, get: accessor })
    const nestedAccessor = Object.defineProperty({}, 'bold', { enumerable: true, get: accessor })
    expect(() => resolveProperties(scopeAccessor)).toThrow(TypeError)
    expect(() => resolveProperties({ scope: { toString: accessor }, layers })).toThrow(TypeError)
    expect(() => resolveProperties({
      scope: 'run', layers: { target, entries: [layer('unsafe', 'body', nestedAccessor)] },
    })).toThrow(TypeError)
    expect(reads).toBe(0)
    const defaults = { target, entries: [layer('defaults', 'presentationDefault', { direction: 'rtl' })] }
    expect(resolveProperties({ scope: 'paragraph', layers: defaults }).direction.resolved).toBe('rtl')
    expect(resolveProperties({ scope: 'run', layers: defaults }).direction.resolved).toBeNull()
    expect(() => resolveProperty({ property: 'direction', layers: defaults })).toThrow(TypeError)
    expect(() => resolveProperty({ property: 'fontSizePt', scope: 'body', layers: defaults })).toThrow(TypeError)
  })

  it('isolates authored, resolved, sibling, and subsequent results from caller mutations', () => {
    const spacing = { unit: 'points', value: 0 }
    const input = { scope: 'paragraph', layers: { target: structuredClone(target), entries: [
      layer('paragraph', 'paragraph', { spaceBefore: spacing, spaceAfter: spacing, tabs: [{ positionEmu: 0 }] }),
    ] } }
    const results = resolveProperties(input)
    results.spaceBefore.authored.value = 12
    results.spaceBefore.source.path = 'changed'
    results.spaceBefore.dependencyIds.push('changed')
    results.tabs.resolved[0].positionEmu = 99
    expect(results.spaceBefore.resolved.value).toBe(0)
    expect(results.spaceAfter.authored.value).toBe(0)
    expect(results.spaceAfter.source.path).toBe(source('').path)
    expect(results.spaceAfter.dependencyIds).toEqual(['paragraph'])
    expect(results.tabs.authored[0].positionEmu).toBe(0)
    expect(spacing.value).toBe(0)
    expect(input.layers.entries[0].properties.tabs[0].positionEmu).toBe(0)
    spacing.value = 24
    input.layers.entries[0].source.path = 'new-source'
    const next = resolveProperties(input)
    expect(next.spaceBefore).toMatchObject({
      authored: { value: 24 }, resolved: { value: 24 }, source: { path: 'new-source' }, dependencyIds: ['paragraph'],
    })
    expect(next.tabs.resolved[0].positionEmu).toBe(0)
    expect(results.spaceAfter.resolved.value).toBe(0)
    const runInput = {
      scope: 'run', theme: structuredClone(theme),
      layers: { target: structuredClone(target), entries: [
        layer('run', 'run', { color: { kind: 'scheme', value: 'tx1' }, fontLatin: { typeface: '+mn-lt' } }),
      ] },
    }
    const before = resolveProperties(runInput)
    runInput.theme.colors.dk1 = 'FFFFFF'
    runInput.theme.fonts.minor.latin = 'Changed Face'
    runInput.layers.entries[0].properties.color.value = 'accent1'
    expect(before.color.resolved.rgb).toBe('204060')
    expect(before.color.authored.value).toBe('tx1')
    expect(before.fontLatin.resolved).toBe('Example Sans')
    const after = resolveProperties(runInput)
    expect(after.color.resolved.rgb).toBe('FF0000')
    expect(after.fontLatin.resolved).toBe('Changed Face')
    runInput.layers.entries[0].properties.bold = 'malformed-after-call'
    expect(() => resolveProperties(runInput)).toThrow(TypeError)
  })

  it('does not treat frozen caller data as previously validated', () => {
    const properties = { bold: false }
    const input = Object.freeze({ scope: 'run', layers: { target, entries: [layer('run', 'run', properties)] } })
    expect(resolveProperties(input).bold.resolved).toBe(false)
    properties.underline = 'future'
    expect(() => resolveProperties(input)).toThrow(TypeError)
    expect(() => resolveProperties(Object.freeze({
      scope: 'run', layers: { target, entries: [layer('bad', 'body', Object.freeze({ bold: 'false' }))] },
    }))).toThrow(TypeError)
  })

  it('retains the strictest individual property envelope at the exact byte boundary', () => {
    const bytes = (value) => {
      if (typeof value === 'string') return value.length * 2
      if (!value || typeof value !== 'object') return 0
      return Object.entries(value).reduce((total, [key, child]) => total + key.length * 2 + 16 + bytes(child), 0)
    }
    const names = [...TEXT_PROPERTY_SCOPES.run].sort((a, b) => a.length - b.length)
    const shortest = names[0], longest = names[names.length - 1]
    const entries = Array.from({ length: 1100 }, (_, index) => layer(`padding-${index}`, 'run', {
      fontLatin: { typeface: 'x'.repeat(900) },
      fontEastAsian: { typeface: 'x'.repeat(900) },
      fontComplexScript: { typeface: 'x'.repeat(900) },
    }))
    const input = { scope: 'run', layers: { target, entries } }
    let remaining = (TEXT_DOCUMENT_LIMITS.maxBytes - bytes({ property: shortest, ...input })) / 2
    expect(remaining).toBeGreaterThan(0)
    let lastPadded
    for (const entry of entries) {
      const count = Math.min(remaining, 1024 - entry.source.path.length)
      entry.source.path += 'x'.repeat(count)
      remaining -= count
      lastPadded = entry
      if (remaining === 0) break
    }
    expect(remaining).toBe(0)
    expect(resolveProperty({ property: shortest, ...input }).property).toBe(shortest)
    expect(() => resolveProperty({ property: longest, ...input })).toThrow('JSON bytes')
    expect(() => resolveProperties(input)).toThrow('JSON bytes')
    lastPadded.source.path = lastPadded.source.path.slice(0, -(longest.length - shortest.length))
    expect(bytes({ property: longest, ...input })).toBe(TEXT_DOCUMENT_LIMITS.maxBytes)
    expect(Object.keys(resolveProperties(input))).toEqual(TEXT_PROPERTY_SCOPES.run)
    const ownedInput = cloneOwnedTextData(input)
    expect(Object.keys(resolveProperties(ownedInput))).toEqual(TEXT_PROPERTY_SCOPES.run)
    expect(Object.keys(resolveProperties(ownedInput))).toEqual(TEXT_PROPERTY_SCOPES.run)
    // A warmed positive receipt must not waive aggregate envelope charging.
    expect(() => resolveProperties({ ...ownedInput, extra: true })).toThrow('JSON bytes')
  })

  it.each([false, true])('rejects envelope extras and unknown dispatch scopes (warm: %s)', warm => {
    const layers = cloneOwnedTextData({ target, entries: [layer('r', 'run', { bold: false })] })
    const input = { scope: 'run', layers }
    if (warm) expect(resolveProperties(input).bold.resolved).toBe(false)
    for (const scope of ['unknown', 'constructor', '__proto__', 'toString'])
      expect(() => resolveProperties({ ...input, scope })).toThrow(TypeError)
    for (const key of ['extra', 'properties', 'property'])
      expect(() => resolveProperties({ ...input, [key]: true })).toThrow(TypeError)
    for (const key of ['__proto__', 'constructor', 'prototype'])
      expect(() => resolveProperties(JSON.parse(`{"scope":"run","${key}":{},"layers":{"target":{},"entries":[]}}`))).toThrow(TypeError)
    expect(resolveProperties(input).bold.resolved).toBe(false)
  })

  it('does not confuse admitted JSON with successful validation or context resolution', () => {
    const layers = cloneOwnedTextData({ target, entries: [layer('r', 'run', { bold: true })] })
    expect(resolveProperties({ scope: 'run', layers }).bold.resolved).toBe(true)
    const invalidTheme = cloneOwnedTextData({ ...theme, id: 'r' })
    for (let i = 0; i < 2; i++)
      expect(() => resolveProperties({ scope: 'run', layers, theme: invalidTheme })).toThrow('duplicate theme ID')
    const invalidLayers = cloneOwnedTextData({ target, entries: [layer('bad', 'run', { bold: 'true' })] })
    for (let i = 0; i < 2; i++)
      expect(() => resolveProperties({ scope: 'run', layers: invalidLayers })).toThrow(TypeError)
    const conflicting = cloneOwnedTextData({ target, entries: ['body', 'title'].map((type, index) =>
      layer(`layout-${index}`, 'layoutList', {}, { placeholder: { index: 0, type } })) })
    for (let i = 0; i < 2; i++)
      expect(() => resolveProperties({ scope: 'run', layers: conflicting })).toThrow('conflicting layout placeholder types')
  })

  it.each([false, true])('charges complete owned envelopes before rejecting extras (warm: %s)', warm => {
    const layers = cloneOwnedTextData({ target, entries: [] })
    if (warm) resolveProperties({ scope: 'run', layers })
    const bytes = cloneOwnedTextData({ text: 'x'.repeat(1000000) })
    expect(() => resolveProperties({ scope: 'run', layers, extra: Array(5).fill(bytes) })).toThrow('JSON bytes')
    const nodes = cloneOwnedTextData(Array(60000).fill(null))
    expect(() => resolveProperties({ scope: 'run', layers, extra: Array(6).fill(nodes) })).toThrow('JSON budget')
    let deep = cloneOwnedTextData({ leaf: true })
    for (let i = 0; i < TEXT_DOCUMENT_LIMITS.maxDepth; i++) deep = { child: deep }
    expect(() => resolveProperties({ scope: 'run', layers, extra: deep })).toThrow('JSON budget')
    expect(resolveProperties({ scope: 'run', layers }).bold.resolved).toBeNull()
  })

  it('revalidates raw shallow-frozen themes and targets after owned-layer hits', () => {
    const layers = cloneOwnedTextData({ target, entries: [layer('r', 'run', { fontLatin: { typeface: '+mn-lt' } })] })
    const mutableTheme = structuredClone(theme)
    Object.freeze(mutableTheme)
    const input = { scope: 'run', layers, theme: mutableTheme }
    expect(resolveProperties(input).fontLatin.resolved).toBe('Example Sans')
    mutableTheme.fonts.minor.latin = 'Changed'
    expect(resolveProperties(input).fontLatin.resolved).toBe('Changed')
    mutableTheme.colors.dk1 = 'bad'
    expect(() => resolveProperties(input)).toThrow(TypeError)
    const rawLayers = Object.freeze({ target: { level: 0 }, entries: layers.entries })
    expect(resolveProperties({ scope: 'run', layers: rawLayers }).bold.resolved).toBeNull()
    rawLayers.target.level = 9
    expect(() => resolveProperties({ scope: 'run', layers: rawLayers })).toThrow(TypeError)
  })

  it('retains aggregate node and depth limits even for declarations unused by the scope', () => {
    const nodes = Array.from({ length: 128 }, () => Array(128).fill(0))
    const large = { scope: 'run', layers: { target, entries: Array.from({ length: 20 }, (_, index) =>
      layer(`large-${index}`, 'body', { unused: nodes })) } }
    expect(() => resolveProperties(large)).toThrow('JSON budget')
    expect(() => resolveProperty({ property: 'bold', ...large })).toThrow('JSON budget')
    let deep = {}
    for (let index = 0; index < TEXT_DOCUMENT_LIMITS.maxDepth; index++) deep = { nested: deep }
    const input = { scope: 'run', layers: { target, entries: [layer('deep', 'body', { unused: deep })] } }
    expect(() => resolveProperties(input)).toThrow('JSON budget')
    expect(() => resolveProperty({ property: 'bold', ...input })).toThrow('JSON budget')
  })
})
