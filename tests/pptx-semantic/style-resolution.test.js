import { describe, expect, it } from 'vitest'
import { resolveProperty, resolveProperties } from '../../shared/src/pptx-style-resolution'
import { TEXT_DOCUMENT_LIMITS, TEXT_PROPERTY_SCOPES } from '../../shared/src/pptx-text-document'

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
