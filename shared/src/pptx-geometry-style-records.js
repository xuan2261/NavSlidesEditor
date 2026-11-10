// Typed source data is not package authority. The server baseline owns trust.
const {
  geometryFillPaint,
  geometryStrokePaint,
  PRESET_DASH_PATTERNS,
  LINE_END_TYPES,
  LINE_END_SIZES,
} = require('./pptx-geometry-document.js')
const { geometryEffectProgramFields } = require('./pptx-geometry-effect-program')
const {
  GEOMETRY_COLOR_KINDS,
  isGeometryColorValue,
  isGeometryColorTransform,
  resolveGeometryColorPaint,
} = require('./pptx-geometry-color.js')
const { GEOMETRY_PATTERN_PRESETS } = require('./pptx-geometry-pattern.js')
const { blipPatch } = require('./pptx-geometry-blip.js')
const { validateBlipDerivedAssets } = require('./pptx-geometry-blip-assets')
const { gradientColors } = require('./pptx-geometry-gradient.js')
const { gradientPatch } = require('./pptx-geometry-gradient-edit.js')
const { validateTextContextRecord } = require('./pptx-semantic-text-context.js')
const { validateSourceOverlayBindings } = require('./pptx-geometry-effect-overlay-bindings.js')
const {
  semanticDefinition, semanticInstance, semanticStyle,
  semanticStyles,
  semanticIdentity,
} = require('./pptx-semantic-records.js')
const fail = (detail) => {
  throw new TypeError(`Invalid geometry style links: ${detail}`)
}
const id = (v) => typeof v === 'string' && v.length > 0 && v.length <= 1024
const one =
  (...values) =>
  (v) =>
    values.includes(v)
const number = (min, max) => (v) => Number.isSafeInteger(v) && v >= min && v <= max
const native = number(-2147483648, 2147483647)
const bool = (v) => typeof v === 'boolean'
const list =
  (check, max = 256) =>
  (v) =>
    Array.isArray(v) && v.length <= max && v.every(check)
function fields(value, checks, required = []) {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.entries(value).every(([key, entry]) => Object.hasOwn(checks, key) && checks[key](entry))
  )
}
const uri = (v) =>
  id(v) &&
  !/[\\:#?]/.test(v) &&
  !/%(?:2f|5c|2e)/i.test(v) &&
  v.split('/').every((part) => part && part !== '.' && part !== '..')
const hash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const path = (v) =>
  Array.isArray(v) && v.length > 0 && v.length <= 256 && v.every(number(0, 2147483647))
const source = (v) =>
  fields(
    v,
    {
      partUri: uri,
      preconditionHash: hash,
      componentLocator: (l) =>
        fields(l, { path, preconditionHash: (h) => h === v.preconditionHash }, [
          'path',
          'preconditionHash',
        ]),
    },
    ['partUri', 'preconditionHash', 'componentLocator']
  )
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const within = (child, parent) =>
  source(child) &&
  child.partUri === parent.partUri &&
  child.preconditionHash === parent.preconditionHash &&
  parent.componentLocator.path.every((entry, index) => child.componentLocator.path[index] === entry)
const scheme = (v) =>
  typeof v === 'string' &&
  /^(dk[12]|lt[12]|bg[12]|tx[12]|accent[1-6]|hlink|folHlink|phClr)$/.test(v)
const themeSlot = (v) => scheme(v) && !['bg1', 'bg2', 'tx1', 'tx2', 'phClr'].includes(v)
const mapSlot = (v) => scheme(v) && !['dk1', 'dk2', 'lt1', 'lt2', 'phClr'].includes(v)
const rgb = (v) => typeof v === 'string' && /^[a-f0-9]{6}$/i.test(v)
const transform = isGeometryColorTransform
function color(v, transformed = (entry) => transform(entry), allowNone = false) {
  if (allowNone && v?.kind === 'none') return fields(v, { kind: one('none') }, ['kind'])
  return (
    fields(
      v,
      {
        kind: one(...GEOMETRY_COLOR_KINDS, 'scheme', 'system'),
        value: (value) =>
          v?.kind === 'scheme'
            ? scheme(value)
            : v?.kind === 'system'
              ? id(value)
              : isGeometryColorValue(v?.kind, value),
        lastColor: rgb,
        transforms: list(transformed, 32),
      },
      ['kind', 'value']
    ) && (v.kind === 'system' ? rgb(v.lastColor) : !Object.hasOwn(v, 'lastColor'))
  )
}
const dash = (v, wrap) =>
  v?.kind === 'preset'
    ? fields(v, { kind: one('preset'), value: (x) => Object.hasOwn(PRESET_DASH_PATTERNS, x) }, [
        'kind',
        'value',
      ])
    : fields(
        v,
        {
          kind: one('custom'),
          stops: list(
            wrap((stop, childWrap) =>
              fields(
                stop,
                {
                  dash: childWrap(number(0, 2147483647)),
                  space: childWrap(number(0, 2147483647)),
                },
                ['dash', 'space']
              )
            )
          ),
        },
        ['kind', 'stops']
      ) && v.stops.length > 0
const join = (v, wrap) =>
  fields(
    v,
    {
      kind: one('round', 'bevel', 'miter'),
      limit: wrap(number(0, 2147483647)),
    },
    ['kind']
  ) &&
  (!Object.hasOwn(v, 'limit') || v.kind === 'miter')
const lineEnd = (v, wrap) =>
  fields(v, {
    type: wrap(one(...LINE_END_TYPES)),
    w: wrap(one(...LINE_END_SIZES)),
    len: wrap(one(...LINE_END_SIZES)),
  })
const stroke = (v, wrap) =>
  fields(v, {
    color: wrap((c, w) => color(c, w(transform), true)),
    width: wrap(number(0, 20116800)),
    cap: wrap(one('flat', 'rnd', 'sq')),
    compound: wrap(one('sng', 'dbl', 'thinThick', 'thickThin', 'tri')),
    alignment: wrap(one('ctr', 'in')),
    dash: wrap(dash),
    join: wrap(join),
    headEnd: wrap(lineEnd),
    tailEnd: wrap(lineEnd),
  })
const effects = (v, wrap) =>
  geometryEffectProgramFields(v, wrap, {
    color: (c, w) => color(c, w(transform)),
    fill: (f, w) => fill(f, w),
  })
const rectangle = (r, rw) =>
  fields(r, {
    l: rw(native),
    t: rw(native),
    r: rw(native),
    b: rw(native),
  })
const fill = (v, wrap) =>
  fields(v, {
    group: (value) => value === true,
    blip: wrap((b, w) => {
      return (
        fields(
          b,
          {
            embed: w(id),
            bindingId: id,
            dpi: w(number(0, 4294967295)),
            rotWithShape: w(bool),
            srcRect: w(rectangle),
            tile: w((tile, tw) =>
              fields(tile, {
                tx: tw(native),
                ty: tw(native),
                sx: tw(number(0, 2147483647)),
                sy: tw(number(0, 2147483647)),
                flip: tw(one('none', 'x', 'y', 'xy')),
                algn: tw(one('tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br')),
              })
            ),
            stretch: w((stretch, sw) => fields(stretch, { fillRect: sw(rectangle) })),
          },
          ['embed', 'bindingId']
        ) && !(b.tile && b.stretch)
      )
    }),
    color: wrap((c, w) => color(c, w(transform), true)),
    pattern: wrap((p, w) =>
      fields(p, {
        preset: w(one(...GEOMETRY_PATTERN_PRESETS)),
        foreground: w((c, cw) => color(c, cw(transform))),
        background: w((c, cw) => color(c, cw(transform))),
      })
    ),
    gradient: wrap(
      (g, w) =>
        fields(
          g,
          {
            kind: one('linear', 'path'),
            angle: w(number(0, 21599999)),
            scaled: w(bool),
            path: w(one('circle', 'rect', 'shape')),
            fillToRect: w(rectangle),
            rotWithShape: w(one(true)),
            stops: list(
              w((stop, sw) =>
                fields(
                  stop,
                  {
                    pos: sw(number(0, 100000)),
                    color: sw((c, cw) => color(c, cw(transform))),
                  },
                  ['pos', 'color']
                )
              )
            ),
            tileRect: w(rectangle),
          },
          ['kind', 'rotWithShape', 'stops', ...(g?.kind === 'linear' ? ['angle', 'scaled'] : [])]
        ) &&
        (g.kind === 'linear'
          ? !Object.hasOwn(g, 'path') && !Object.hasOwn(g, 'fillToRect')
          : !Object.hasOwn(g, 'angle') && !Object.hasOwn(g, 'scaled')) &&
        g.stops.length > 0
    ),
  }) && Object.keys(v).length === 1
const identity = (v) =>
  fields(v, { definitionId: id, componentId: id }, ['definitionId', 'componentId'])
const reference = (v, w) =>
  fields(
    v,
    {
      index: number(0, 4294967295),
      color: w((c, cw) => color(c, cw(transform))),
    },
    ['index', 'color']
  )
const placeholder = (v) =>
  fields(v, {
    idx: (x) => typeof x === 'string' && /^-?\d+$/.test(x) && number(0, 4294967295)(Number(x)),
    type: one(
      'title',
      'body',
      'ctrTitle',
      'subTitle',
      'dt',
      'sldNum',
      'ftr',
      'hdr',
      'obj',
      'chart',
      'tbl',
      'clipArt',
      'dgm',
      'media',
      'sldImg',
      'pic'
    ),
    orient: id,
    sz: id,
    hasCustomPrompt: id,
  })
const xfrm = (v, w, group = false) =>
  fields(v, {
    rot: w(native),
    flipH: w(bool),
    flipV: w(bool),
    off: w((off, ow) =>
      fields(
        off,
        {
          x: ow(number(-27273042316900, 27273042316900)),
          y: ow(number(-27273042316900, 27273042316900)),
        },
        ['x', 'y']
      )
    ),
    ext: w((ext, ew) =>
      fields(ext, { cx: ew(number(0, 27273042316900)), cy: ew(number(0, 27273042316900)) }, [
        'cx',
        'cy',
      ])
    ),
    ...(group
      ? {
          chOff: w((off, ow) =>
            fields(
              off,
              {
                x: ow(number(-27273042316900, 27273042316900)),
                y: ow(number(-27273042316900, 27273042316900)),
              },
              ['x', 'y']
            )
          ),
          chExt: w((ext, ew) =>
            fields(
              ext,
              {
                cx: ew(number(0, 27273042316900)),
                cy: ew(number(0, 27273042316900)),
              },
              ['cx', 'cy']
            )
          ),
        }
      : {}),
  })
function geometryProvider(document, instance) {
  instance = semanticInstance(document, instance.id) ?? instance
  let definition = semanticDefinition(document, instance.definitionId)
  if ((document.schemaVersion === 2 || document.schemaVersion === 3) && instance.sourceBinding !== undefined) {
    const context = semanticStyle(document, instance.sourceBinding.contextId)
    if (definition?.kind === 'group') {
      if (context?.kind !== 'group-fill-context' || context.payload.definitionId !== definition.id)
        fail('group context provider binding')
      return { definition, geometry: undefined }
    }
    if (
      context?.kind !== 'geometry-context' ||
      context.payload.definitionId !== instance.definitionId
    )
      fail('context provider binding')
    definition = semanticDefinition(document, context.payload.geometry.definitionId)
    if (
      !definition ||
      definition.content.geometry?.componentId !== context.payload.geometry.componentId
    )
      fail('context geometry provider')
  }
  return { definition, geometry: definition?.content.geometry }
}
function lookupThemeStyle(stylesOrDoc, styleId) {
  if (!stylesOrDoc || styleId === undefined || styleId === null) return undefined
  if (stylesOrDoc.schemaVersion !== undefined) {
    const rec = semanticStyle(stylesOrDoc, styleId)
    if (rec) return rec
  }
  const styles = stylesOrDoc.styles || stylesOrDoc
  if (styles[styleId]) return styles[styleId]
  if (typeof styleId === 'number' && styles[String(styleId)]) return styles[String(styleId)]
  for (const [key, entry] of Object.entries(styles)) {
    if (key === String(styleId) || entry?.id === styleId || entry?.source?.partUri === styleId) return entry
  }
  return undefined
}
function geometryThemeCategories(styles, context) {
  const themeRecord = lookupThemeStyle(styles, context?.themeId)
  const base = { styleId: context.themeId, value: themeRecord?.payload }
  const result = { colors: base, format: base }
  for (const [key, category] of [
    ['colors', 'colorScheme'],
    ['format', 'formatScheme'],
  ]) {
    const binding = context.themeOverrideBindings?.find(
      ({ styleId }) => lookupThemeStyle(styles, styleId)?.payload?.[category] !== undefined
    )
    if (binding)
      result[key] = {
        styleId: binding.styleId,
        value: lookupThemeStyle(styles, binding.styleId)?.payload?.[category]?.value,
      }
  }
  return result
}
function validateGeometryStyleRecords(document, { maxBytes = 8 * 1024 * 1024 } = {}) {
  const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength
  let expandedBytes = bytes(document)
  let remainingContextBytes = Object.values(document.styles)
    .filter((entry) => entry?.kind === 'text-context')
    .reduce((sum, entry) => sum + bytes(entry.payload), 0)
  function checkExpansionBudget() {
    // Future decoding can at most remove its own encoded payload. Use that
    // credit so early rejection cannot depend on context insertion order.
    if (expandedBytes - remainingContextBytes > maxBytes) fail('expanded semantic byte budget')
  }
  const resourceUsage = new Map()
  const expansionBudget = {
    maxBytes,
    resourceUsage,
    consumeByteDelta(delta) {
      if (document.schemaVersion !== 3) {
        expandedBytes += delta
        checkExpansionBudget()
      }
    },
  }
  const styles = document.styles,
    hashes = new Map(),
    overrides = new Set(),
    themeOverrides = new Set(),
    nativeOverrideParts = new Set()
  const geometryContextsByKey = new Map()
  for (const record of Object.values(styles)) {
    if (record?.kind === 'geometry-context' && record.payload) {
      const key = `${record.payload.definitionId}|${record.payload.hostSlidePartUri}|${(record.payload.relationshipChain ?? []).join('>')}`
      if (!geometryContextsByKey.has(key)) geometryContextsByKey.set(key, [])
      geometryContextsByKey.get(key).push(record)
    }
  }
  const indices = { geometryContextsByKey }
  function checkedSource(value) {
    if (hashes.has(value.partUri) && hashes.get(value.partUri) !== value.preconditionHash)
      fail('source part hash mismatch')
    hashes.set(value.partUri, value.preconditionHash)
    return true
  }
  for (const definition of Object.values(document.definitions)) {
    if (definition.source) {
      const { partUri, preconditionHash } = definition.source
      if (hashes.has(partUri) && hashes.get(partUri) !== preconditionHash)
        fail('definition source hash mismatch')
      hashes.set(partUri, preconditionHash)
    }
  }
  const wrapper = (owner) => (check) => (value) => {
    if (
      !fields(value, { source: checkedSource, value: () => true }, ['source', 'value']) ||
      !within(value.source, owner)
    )
      return false
    return check(value.value, wrapper(value.source))
  }
  function target(styleId, kind) {
    const entry = semanticStyle(document, styleId) ?? styles[styleId]
    const validId =
      document.schemaVersion === 3
        ? typeof styleId === 'number' || /^(?:0|[1-9]\d*)$/.test(styleId) || id(styleId)
        : id(styleId)
    if (!validId || !entry || entry.origin !== 'source' || entry.kind !== kind)
      fail(`missing ${kind} reference`)
    return entry
  }
  function declarationOwner(entry, definitionId) {
    const definition = semanticDefinition(document, definitionId) ?? document.definitions[definitionId]
    if (
      !definition ||
      definition.origin === 'project' ||
      definition.source.partUri !== entry.source.partUri ||
      definition.source.preconditionHash !== entry.source.preconditionHash ||
      (definition.source.componentLocator &&
        !same(definition.source.componentLocator, entry.source.componentLocator)) ||
      definition.components.some(
        (c) =>
          (c.partUri ?? definition.source.partUri) === entry.source.partUri &&
          c.locator.path && !within({ ...entry.source, componentLocator: c.locator }, entry.source)
      )
    )
      fail('source definition ownership')
    return definition
  }
  let linked = false,
    chartContext = false
  for (const [styleId, entry] of Object.entries(styles)) {
    const validStyleId =
      document.schemaVersion === 3
        ? /^(?:0|[1-9]\d*)$/.test(styleId) || id(styleId)
        : id(styleId)
    if (!validStyleId) fail('style identity')
    if (entry?.origin === 'project') {
      if (entry?.kind === 'inheritance-override') {
        validateInheritanceStyleRecord(document, entry, overrides)
        continue
      }
      if (entry?.kind === 'theme-override') {
        validateThemeOverrideRecord(document, entry, themeOverrides, target)
        continue
      }
      fail('project theme override')
    }
    if (
      !fields(
        entry,
        {
          kind: one(
            'geometry-blip-binding',
            'geometry-declarations',
            'theme',
            'native-theme-override',
            'color-map',
            'geometry-context',
            'group-fill-context',
            'text-context',
            'text-context-resources'
          ),
          origin: one('source'),
          source: checkedSource,
          payload: () => true,
        },
        ['kind', 'origin', 'source', 'payload']
      )
    )
      fail('source style record')
    const payload = entry.payload,
      w = wrapper(entry.source)
    if (entry.kind === 'text-context-resources') {
      if (
        !fields(
          payload,
          {
            schemaVersion: one(1),
            fontDescriptors: (descriptors) =>
              descriptors === undefined ||
              (Array.isArray(descriptors) &&
                descriptors.every(
                  (d) => !!d && typeof d === 'object' && !Array.isArray(d) && typeof d.typeface === 'string'
                )),
            records: (records) =>
              !!records &&
              typeof records === 'object' &&
              !Array.isArray(records) &&
              Object.entries(records).every(
                ([key, value]) =>
                  /^record-(0|[1-9]\d*)$/.test(key) &&
                  fields(
                    value,
                    {
                      kind: one('theme', 'provenance', 'font', 'declaration'),
                      value: (record) =>
                        !!record && typeof record === 'object' && !Array.isArray(record),
                    },
                    ['kind', 'value']
                  )
              ),
          },
          ['schemaVersion', 'records']
        )
     )
       fail('shared text resource payload')
      continue
    }
    if (entry.kind === 'text-context') {
      remainingContextBytes -= bytes(payload)
      if (validateTextContextRecord(document, styleId, entry, checkedSource, expansionBudget, indices))
        chartContext = true
      checkExpansionBudget()
      continue
    }
    if (entry.kind === 'geometry-blip-binding') {
      if (
        !fields(
          payload,
          {
            edge: (edge) =>
              fields(
                edge,
                {
                  fromPartUri: (value) => value === entry.source.partUri,
                  toPartUri: uri,
                  relationshipId: id,
                  type: one(
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                    'http://purl.oclc.org/ooxml/officeDocument/relationships/image'
                  ),
                  source: (value) =>
                    checkedSource(value) &&
                    value.partUri === entry.source.partUri.replace(/([^/]+)$/, '_rels/$1.rels'),
                },
                ['fromPartUri', 'toPartUri', 'relationshipId', 'type', 'source']
              ),
            asset: (asset) =>
              fields(
                asset,
                {
                  partUri: (value) => uri(value) && value === payload.edge?.toPartUri,
                  preconditionHash: hash,
                  byteLength: number(1, Number.MAX_SAFE_INTEGER),
                  width: number(1, 2147483647),
                  height: number(1, 2147483647),
                  format: one('png', 'jpeg', 'gif', 'bmp', 'webp'),
                  src: (value) =>
                    typeof value === 'string' &&
                    value.startsWith('/uploads/') &&
                    uri(value.slice('/uploads/'.length)),
                },
                ['partUri', 'preconditionHash', 'byteLength', 'src', 'width', 'height', 'format']
              ),
            derivedAssets: (assets) => Boolean(validateBlipDerivedAssets(assets, payload.asset)),
          },
          ['edge', 'asset']
        )
      )
        fail('geometry blip binding payload')
      const asset = payload.asset
      if (hashes.has(asset.partUri) && hashes.get(asset.partUri) !== asset.preconditionHash)
        fail('source image hash mismatch')
      hashes.set(asset.partUri, asset.preconditionHash)
      continue
    }
    if (entry.kind === 'geometry-declarations') {
      linked = true
      const group = document.definitions[payload.definitionId]?.kind === 'group'
      if (
        !fields(
          payload,
          {
            definitionId: id,
            ...(group ? { paintComponentId: id } : {}),
            properties: (v) => fields(v, { fill: w(fill), stroke: w(stroke), effects: w(effects) }),
            styleRefs: (v) =>
              fields(v, { fillRef: w(reference), lnRef: w(reference), effectRef: w(reference) }),
            placeholder: w(placeholder),
            transform: w((value, wrap) => xfrm(value, wrap, group)),
            geometry: identity,
            hiddenStroke: w(
              (v, wrap) =>
                stroke(v, wrap) &&
                Object.hasOwn(v, 'width') &&
                [...GEOMETRY_COLOR_KINDS, 'scheme', 'system'].includes(v.color?.value.kind)
            ),
            hiddenFill: w((v, wrap) => fields(v, {
              fill: wrap((value, nested) => fields(value, {
                color: nested((color) => color?.kind === 'none'
                  ? fields(color, { kind: one('none') }, ['kind'])
                  : fields(color, { kind: one('srgb', 'scheme'), value: color?.kind === 'srgb' ? rgb : scheme }, ['kind', 'value'])),
              }, ['color'])),
            }, ['fill'])),
            hiddenEffects: w((v, wrap) => fields(v, { effects: wrap(effects) }, ['effects'])),
          },
          ['definitionId', 'properties', 'styleRefs', ...(group ? ['paintComponentId'] : [])]
        )
      )
        fail('geometry declarations payload')
      const definition = declarationOwner(entry, payload.definitionId)
      for (const [field, child] of [['hiddenFill', 'fill'], ['hiddenEffects', 'effects']]) {
        const latent = payload[field]
        if (!latent) continue
        const parentPath = latent.source.componentLocator.path
        if (
          !definition.components.some((component) =>
            component.kind === 'property' && same(component.locator, latent.source.componentLocator)) ||
          !same(latent.value[child].source.componentLocator.path, [...parentPath, 0])
        )
          fail('latent geometry source identity')
      }
      const paintComponent = group
        ? definition.components.find(
            (component) =>
              component.id === payload.paintComponentId && component.kind === 'property'
          )
        : null
      if (
        group &&
        (!paintComponent ||
          [payload.transform, ...Object.values(payload.properties)].some(
            (field) =>
              field !== undefined &&
              !within(field.source, {
                ...entry.source,
                componentLocator: paintComponent.locator,
              })
          ) ||
          payload.geometry ||
          payload.placeholder ||
          payload.hiddenStroke ||
          payload.hiddenFill ||
          payload.hiddenEffects ||
          Object.keys(payload.properties).some((key) => key !== 'fill') ||
          Object.keys(payload.styleRefs).length)
      )
        fail('group paint declaration ownership')
      if (definition.content.geometrySource?.styleId !== styleId)
        fail('definition declaration binding')
      if (
        payload.geometry &&
        (payload.geometry.definitionId !== definition.id ||
          definition.content.geometry?.componentId !== payload.geometry.componentId ||
          !definition.components.some((c) => c.id === payload.geometry.componentId))
      )
        fail('geometry component ownership')
      if (definition.content.geometry?.schemaVersion !== undefined && !payload.geometry)
        fail('missing geometry declaration identity')
    } else if (entry.kind === 'theme' || entry.kind === 'native-theme-override') {
      if (entry.kind === 'native-theme-override') {
        if (nativeOverrideParts.has(entry.source.partUri))
          fail('duplicate native override source part')
        nativeOverrideParts.add(entry.source.partUri)
      }
      const unsupported = (v) =>
        fields(v, { kind: one('unsupported'), reason: id }, ['kind', 'reason'])
      const matrix = (check) =>
        list(w((v, nested) => (v?.kind === 'unsupported' ? unsupported(v) : check(v, nested))))
      const palette = (v, wrap) =>
        fields(
          v,
          Object.fromEntries(
            Object.keys(v || {})
              .filter(themeSlot)
              .map((key) => [key, wrap((c, cw) => color(c, cw(transform)) && c.kind !== 'scheme')])
          )
        )
      const format = {
        fillStyles: matrix(fill),
        backgroundFillStyles: matrix(fill),
        lineStyles: matrix(stroke),
        effectStyles: matrix((v, ew) => fields(v, { effects: ew(effects) }, ['effects'])),
      }
      if (entry.kind === 'native-theme-override') {
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
        if (
          !fields(payload, {
            fontScheme: w((value) => fields(value, { kind: one('preserved') }, ['kind'])),
            colorScheme: w((v, cw) =>
              fields(
                v,
                {
                  colors: (colors) =>
                    palette(colors, cw) && slots.every((slot) => Object.hasOwn(colors, slot)),
                },
                ['colors']
              )
            ),
            formatScheme: w((v, fw) => {
              const nestedMatrix = (check) =>
                list(
                  fw((value, nested) =>
                    value?.kind === 'unsupported' ? unsupported(value) : check(value, nested)
                  )
                )
              return fields(
                v,
                {
                  fillStyles: nestedMatrix(fill),
                  backgroundFillStyles: nestedMatrix(fill),
                  lineStyles: nestedMatrix(stroke),
                  effectStyles: nestedMatrix((value, ew) =>
                    fields(value, { effects: ew(effects) }, ['effects'])
                  ),
                },
                ['fillStyles', 'backgroundFillStyles', 'lineStyles', 'effectStyles']
              )
            }),
          })
        )
          fail('native theme override payload')
      } else if (
        !fields(
          payload,
          {
            colors: (v) => palette(v, w),
            ...format,
          },
          ['colors', 'fillStyles', 'backgroundFillStyles', 'lineStyles', 'effectStyles']
        )
      )
        fail('theme payload')
    } else if (entry.kind === 'color-map') {
      if (
        !fields(
          payload,
          {
            kind: one('mapping', 'master'),
            values: (v) =>
              fields(
                v,
                Object.fromEntries(
                  Object.keys(v || {})
                    .filter(mapSlot)
                    .map((key) => [key, w(themeSlot)])
                )
              ),
          },
          ['kind', 'values']
        ) ||
        (payload.kind === 'master' && Object.keys(payload.values).length)
      )
        fail('color map payload')
    }
  }
  for (const [styleId, entry] of Object.entries(styles))
    if (entry.kind === 'text-context-resources') {
      if (resourceUsage.get(styleId)?.size !== Object.keys(entry.payload.records).length)
        fail('unused shared text resource')
      if (
        !Object.values(styles).some(
          (context) => context.kind === 'text-context' && same(context.source, entry.source)
        )
      )
        fail('shared text resource source owner')
    }
  if (!linked && !chartContext) fail('schema two requires linked geometry or chart context')
  for (const definition of Object.values(document.definitions)) {
    const binding = definition.content.geometrySource
    if (definition.content.geometry?.schemaVersion !== undefined && binding === undefined)
      fail('missing linked geometry source')
    if (
      binding !== undefined &&
      (!fields(binding, { styleId: id }, ['styleId']) ||
        target(binding.styleId, 'geometry-declarations').payload.definitionId !== definition.id)
    )
      fail('geometry source binding')
  }
  const ownerOverrides = new Map()
  for (const entry of Object.values(styles))
    if (['geometry-context', 'group-fill-context'].includes(entry.kind))
      for (const binding of entry.payload.themeOverrideBindings ?? []) {
        const owner = binding?.edge?.fromPartUri
        if (!uri(owner)) fail('native override owner')
        if (ownerOverrides.has(owner) && !same(ownerOverrides.get(owner), binding))
          fail('contradictory native override owner binding')
        ownerOverrides.set(owner, binding)
      }
  for (const entry of Object.values(styles))
    if (['geometry-context', 'group-fill-context'].includes(entry.kind)) {
      const p = entry.payload
      const group = entry.kind === 'group-fill-context'
      if (
        !fields(
          p,
          {
            definitionId: id,
            hostSlidePartUri: uri,
            relationshipChain: list(id, 4),
            edges: list(
              (edge) =>
                fields(
                  edge,
                  {
                    fromPartUri: uri,
                    toPartUri: uri,
                    relationshipId: id,
                    type: id,
                    source: checkedSource,
                  },
                  ['fromPartUri', 'toPartUri', 'relationshipId', 'type', 'source']
                ),
              3
            ),
            declarationIds: list(id, 3),
            ...(!group
              ? {
                  geometry: identity,
                  transformDeclarationIds: list(id, 3),
                }
              : {}),
            themeId: (v) => v === null || id(v),
            colorMapIds: list(id, 3),
            ...(!group
              ? {
                  matrixBindings: (v) =>
                    fields(v, {
                      fillRef: () => true,
                      lnRef: () => true,
                      effectRef: () => true,
                    }),
                }
              : {}),
            themeOverrideBindings: list(
              (binding) =>
                fields(
                  binding,
                  {
                    styleId: id,
                    edge: (edge) =>
                      fields(
                        edge,
                        {
                          fromPartUri: uri,
                          toPartUri: uri,
                          relationshipId: id,
                          type: id,
                          source: checkedSource,
                        },
                        ['fromPartUri', 'toPartUri', 'relationshipId', 'type', 'source']
                      ),
                  },
                  ['styleId', 'edge']
                ),
              2
            ),
          },
          [
            'definitionId',
            'hostSlidePartUri',
            'relationshipChain',
            'edges',
            'declarationIds',
            ...(!group ? ['geometry', 'transformDeclarationIds'] : []),
            'themeId',
            'colorMapIds',
            ...(!group ? ['matrixBindings'] : []),
          ]
        )
      )
        fail('context payload')
      const definition = declarationOwner(entry, p.definitionId)
      if (group !== (definition.kind === 'group')) fail('context definition kind')
      const own = target(definition.content.geometrySource?.styleId, 'geometry-declarations')
      if (!same(entry.source, own.source)) fail('context source location')
      const parts = [p.hostSlidePartUri]
      for (const [index, edge] of p.edges.entries()) {
        const suffix = ['slideLayout', 'slideMaster', 'theme'][index]
        if (
          edge.fromPartUri !== parts[index] ||
          parts.includes(edge.toPartUri) ||
          ![
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'http://purl.oclc.org/ooxml/officeDocument/relationships',
          ].some((base) => edge.type === `${base}/${suffix}`) ||
          edge.source.partUri !== edge.fromPartUri.replace(/([^/]+)$/, '_rels/$1.rels')
        )
          fail('context relationship edge/cycle')
        parts.push(edge.toPartUri)
      }
      const sourceIndex = parts.indexOf(definition.source.partUri)
      if (
        sourceIndex < 0 ||
        sourceIndex > 2 ||
        !same(p.relationshipChain, [
          parts[0],
          ...p.edges.slice(0, sourceIndex).map((edge) => edge.relationshipId),
        ])
      )
        fail('context original host/relationship chain')
      const candidates = p.declarationIds.map((styleId) => target(styleId, 'geometry-declarations'))
      if (
        !candidates.length ||
        (group && candidates.length !== 1) ||
        candidates.length > Math.min(parts.length, 3) - sourceIndex ||
        candidates[0] !== own ||
        new Set(p.declarationIds).size !== candidates.length
      )
        fail('context declaration chain')
      for (let index = 1; !group && sourceIndex + index < Math.min(parts.length, 3); index++) {
        const previous = candidates[index - 1].payload.placeholder?.value
        const partIndex = sourceIndex + index,
          part = parts[partIndex]
        const masterTypes = {
          ctrTitle: 'title',
          subTitle: 'body',
          obj: 'body',
          chart: 'body',
          tbl: 'body',
          clipArt: 'body',
          dgm: 'body',
          media: 'body',
          pic: 'body',
        }
        const matches = Object.values(styles).filter((candidate) => {
          const ph = candidate.payload?.placeholder?.value
          return (
            candidate.kind === 'geometry-declarations' &&
            candidate.source.partUri === part &&
            ph &&
            previous &&
            (partIndex === 1
              ? Number(ph.idx ?? '0') === Number(previous.idx ?? '0')
              : (ph.type ?? 'obj') ===
                (masterTypes[previous.type ?? 'obj'] ?? previous.type ?? 'obj'))
          )
        })
        if (
          matches.length > 1 ||
          (matches.length === 1 && matches[0] !== candidates[index]) ||
          (matches.length === 0 && candidates[index])
        )
          fail('context placeholder provider')
        if (!matches.length) break
      }
      const provider = candidates.find((candidate) => candidate.payload.geometry)?.payload.geometry
      if (!group && (!provider || !same(provider, p.geometry)))
        fail('context exact geometry provider')
      if (
        !group &&
        (!same(
          p.transformDeclarationIds,
          p.declarationIds.filter((styleId) => styles[styleId].payload.transform)
        ) ||
          !['off', 'ext'].every((key) =>
            p.transformDeclarationIds.some(
              (styleId) => styles[styleId].payload.transform.value[key]
            )
          ))
      )
        fail('context transform providers')
      const theme = p.themeId === null ? null : target(p.themeId, 'theme')
      if (p.edges.length === 3 ? theme?.source.partUri !== parts[3] : theme !== null)
        fail('context theme edge')
      const expectedOverrides = parts
        .slice(0, 2)
        .flatMap((part) => (ownerOverrides.has(part) ? [ownerOverrides.get(part)] : []))
      if (!same(p.themeOverrideBindings ?? [], expectedOverrides))
        fail('context native override order/completeness')
      for (const binding of p.themeOverrideBindings ?? []) {
        const nativeOverride = target(binding.styleId, 'native-theme-override'),
          edge = binding.edge
        if (
          !parts.slice(0, 2).includes(edge.fromPartUri) ||
          parts.includes(edge.toPartUri) ||
          edge.toPartUri !== nativeOverride.source.partUri ||
          edge.source.partUri !== edge.fromPartUri.replace(/([^/]+)$/, '_rels/$1.rels') ||
          ![
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'http://purl.oclc.org/ooxml/officeDocument/relationships',
          ].some((base) => edge.type === `${base}/themeOverride`)
        )
          fail('context native override edge/target')
      }
      const formatProvider = geometryThemeCategories(styles, p).format
      const maps = Object.entries(styles)
        .filter(
          ([, candidate]) =>
            candidate.kind === 'color-map' && parts.slice(0, 3).includes(candidate.source.partUri)
        )
        .sort((a, b) => parts.indexOf(a[1].source.partUri) - parts.indexOf(b[1].source.partUri))
      if (
        new Set(maps.map(([, candidate]) => candidate.source.partUri)).size !== maps.length ||
        !same(
          p.colorMapIds,
          maps.map(([styleId]) => styleId)
        )
      )
        fail('context color map order')
      for (const [key, property, listName] of group
        ? []
        : [
            ['fillRef', 'fill', 'fillStyles'],
            ['lnRef', 'stroke', 'lineStyles'],
            ['effectRef', 'effects', 'effectStyles'],
          ]) {
        const eligible = candidates.find(
          (candidate) =>
            candidate.payload.styleRefs[key] ||
            (property !== 'stroke' && candidate.payload.properties[property])
        )
        const ref = eligible?.payload.styleRefs[key]
        const binding = p.matrixBindings[key]
        if (!ref || (property !== 'stroke' && eligible.payload.properties[property])) {
          if (binding !== undefined) fail('unexpected matrix binding')
          continue
        }
        const index = ref.value.index,
          listNameActual = key === 'fillRef' && index > 1000 ? 'backgroundFillStyles' : listName
        const entryIndex =
          index === 0 || (key === 'fillRef' && index === 1000)
            ? null
            : index - (listNameActual === 'backgroundFillStyles' ? 1001 : 1)
        const matrixEntry =
          entryIndex === null ? null : formatProvider.value?.[listNameActual]?.[entryIndex]
        const overrideStyleId =
          entryIndex !== null && formatProvider.styleId !== p.themeId
            ? formatProvider.styleId
            : undefined
        if (
          !fields(
            binding,
            {
              declarationId: id,
              index: number(0, 4294967295),
              themeId: (v) => v === null || id(v),
              list: one(listNameActual),
              entryIndex: (v) => v === entryIndex,
              source: checkedSource,
              overrideStyleId: id,
            },
            ['declarationId', 'index', 'themeId', 'list', 'entryIndex']
          ) ||
          styles[binding.declarationId] !== eligible ||
          binding.index !== index ||
          binding.themeId !== p.themeId ||
          binding.overrideStyleId !== overrideStyleId ||
          (entryIndex === null
            ? binding.source !== undefined
            : !matrixEntry ||
              matrixEntry.value.kind === 'unsupported' ||
              !same(binding.source, matrixEntry.source)) ||
          (ref.value.color.value.kind === 'scheme' && ref.value.color.value.value === 'phClr')
        )
          fail('selected unsupported/missing matrix entry or binding')
      }
    }
  for (const entry of Object.values(styles)) {
    const format =
      entry.kind === 'native-theme-override' ? entry.payload.formatScheme?.value : entry.payload
    const fills = [
      entry.payload?.properties?.fill,
      ...(format?.fillStyles || []),
      ...(format?.backgroundFillStyles || []),
    ]
    for (const field of fills) {
      const blip = field?.value?.blip
      if (!blip) continue
      const binding = target(blip.value.bindingId, 'geometry-blip-binding')
      if (
        !same(binding.source, blip.value.embed.source) ||
        binding.payload.edge.relationshipId !== blip.value.embed.value
      )
        fail('source blip binding identity')
    }
  }
  validateSourceOverlayBindings(document)
  for (const instance of Object.values(document.instances)) {
    const definition = document.definitions[instance.definitionId],
      binding = instance.sourceBinding
    if (definition.content.geometrySource && binding === undefined)
      fail('missing occurrence source binding')
    if (binding !== undefined) {
      if (
        !fields(
          binding,
          {
            contextId: id,
            ...(definition.kind === 'group'
              ? {}
              : {
                  nativeExtent: (extent) =>
                    fields(
                      extent,
                      {
                        cx: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
                        cy: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
                      },
                      ['cx', 'cy']
                    ),
                }),
          },
          ['contextId']
        )
      )
        fail('occurrence binding fields')
      const context = target(
        binding.contextId,
        definition.kind === 'group' ? 'group-fill-context' : 'geometry-context'
      ).payload
      if (
        context.definitionId !== instance.definitionId ||
        !same(instance.relationshipChain, context.relationshipChain)
      )
        fail('occurrence original source context')
      geometryProvider(document, instance)
    }
  }
  checkExpansionBudget()
}
function validateGeometryStyleOverride(style, geometry) {
  // Sparse leaves cannot be checked by seeding defaults or inherited paint.
  const plainWrap = (check) => (value) => check(value, plainWrap)
  const projectColor = (v) =>
    (color(v, transform, true) && v.kind !== 'system') ||
    fields(
      v,
      {
        kind: one('token'),
        value: (s) => typeof s === 'string' && /^var\(--ns-[a-z0-9-]+\)$/.test(s),
      },
      ['kind', 'value']
    )
  if (
    !fields(style, {
      fill: (v) =>
        fields(v, {
          color: projectColor,
          gradient: (g) => fill({ gradient: g }, plainWrap),
          gradientPatch: (g) => !!gradientPatch(g),
          blip: (b) => !!blipPatch(b),
          pattern: (p) =>
            fields(p, {
              preset: (x) => x === null || GEOMETRY_PATTERN_PRESETS.includes(x),
              foreground: (c) => c === null || (color(c) && c.kind !== 'system'),
              background: (c) => c === null || (color(c) && c.kind !== 'system'),
            }),
        }) &&
        (Object.keys(v).length === 1 ||
          (Object.keys(v).length === 2 && v.gradient && v.gradientPatch)),
      effects: (v) => effects(v, plainWrap),
      stroke: (v) =>
        fields(v, {
          color: projectColor,
          width: number(0, 20116800),
          dash: (x) => dash(x, plainWrap),
          cap: (x) => x === null || one('flat', 'rnd', 'sq')(x),
          compound: (x) => x === null || one('sng', 'dbl', 'thinThick', 'thickThin', 'tri')(x),
          alignment: (x) => x === null || one('ctr', 'in')(x),
          join: (x) => x === null || join(x, plainWrap),
          headEnd: (x) => x === null || lineEnd(x, plainWrap),
          tailEnd: (x) => x === null || lineEnd(x, plainWrap),
        }),
    })
  )
    fail('sparse geometry style fields')
  for (const c of [
    style.fill?.color,
    style.fill?.pattern?.foreground,
    style.fill?.pattern?.background,
    style.stroke?.color,
  ])
    if (GEOMETRY_COLOR_KINDS.includes(c?.kind)) resolveGeometryColorPaint(c)
  if (!geometry && style.fill?.gradient) gradientColors(style.fill.gradient)
  if (
    geometry &&
    style.fill &&
    !style.fill.pattern &&
    !style.fill.blip &&
    !style.fill.gradientPatch &&
    style.fill.color?.kind !== 'scheme'
  )
    geometryFillPaint({ ...geometry, style: { fill: style.fill } })
  if (
    style.stroke?.color &&
    (Object.hasOwn(style.stroke, 'width') || style.stroke.color.kind === 'none') &&
    style.stroke.color.kind !== 'scheme'
  ) {
    const checked = Object.fromEntries(
      Object.entries(style.stroke).filter(([, value]) => value !== null)
    )
    geometryStrokePaint({ ...geometry, style: { stroke: checked } })
  }
}
function validateInheritanceStyleRecord(document, entry, overrides = new Set()) {
  if (
    !fields(
      entry,
      {
        kind: one('inheritance-override'),
        origin: one('project'),
        baseDefinitionId: id,
        values: (v) => {
          if (!v || typeof v !== 'object' || Array.isArray(v)) return false
          if (!Object.keys(v).every((k) => ['label', 'textStyle', 'geometryStyle'].includes(k))) return false
          function checkDepth(obj, current = 1) {
            if (current > 8) return false
            if (obj && typeof obj === 'object') {
              for (const val of Object.values(obj)) {
                if (val && typeof val === 'object') {
                  if (!checkDepth(val, current + 1)) return false
                }
              }
            }
            return true
          }
          if (!checkDepth(v)) return false
          if (v.label !== undefined && (typeof v.label !== 'string' || v.label.length > 10000)) return false
          if (v.textStyle !== undefined) {
            if (typeof v.textStyle !== 'object' || Array.isArray(v.textStyle) || v.textStyle === null) return false
            try {
              const { normalizeTextProperties } = require('./pptx-text-document')
              normalizeTextProperties(v.textStyle)
            } catch {
              return false
            }
          }
          if (v.geometryStyle !== undefined) {
            if (typeof v.geometryStyle !== 'object' || Array.isArray(v.geometryStyle) || v.geometryStyle === null) return false
            try {
              validateGeometryStyleOverride(v.geometryStyle)
            } catch {
              return false
            }
          }
          return true
        },
      },
      ['kind', 'origin', 'baseDefinitionId', 'values']
    )
  )
    fail('project inheritance override')
  const baseDef = semanticDefinition(document, entry.baseDefinitionId) ?? document.definitions?.[entry.baseDefinitionId]
  if (
    !baseDef ||
    baseDef.origin === 'project' ||
    (baseDef.origin !== undefined && baseDef.origin !== 'source') ||
    ['presentation-properties', 'source-part-identity', 'source-guide-list'].includes(baseDef.kind) ||
    baseDef.content?.transitionDocument !== undefined
  )
    fail('invalid inheritance override target definition')
  if (overrides.has(entry.baseDefinitionId)) fail('duplicate inheritance override')
  overrides.add(entry.baseDefinitionId)
}

function resolveThemeTarget(document, styleId) {
  const isSchema3 = document?.schemaVersion === 3
  const validId = isSchema3
    ? (typeof styleId === 'number' && Number.isSafeInteger(styleId) && styleId >= 0) ||
      (id(styleId) && !/^(?:0|[1-9]\d*)$/.test(styleId))
    : id(styleId)
  if (!validId) fail('missing theme reference')
  const entry = semanticStyle(document, styleId) ?? document?.styles?.[styleId]
  if (!entry || entry.origin !== 'source' || entry.kind !== 'theme')
    fail('missing theme reference')
  return entry
}

function validateThemeOverrideRecord(document, entry, overrides = new Set(), resolveTarget) {
  const isSchema3 = document?.schemaVersion === 3
  const validBaseStyleId = (v) =>
    isSchema3
      ? (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) ||
        (id(v) && !/^(?:0|[1-9]\d*)$/.test(v))
      : id(v)
  if (
    !fields(
      entry,
      {
        kind: one('theme-override'),
        origin: one('project'),
        baseStyleId: validBaseStyleId,
        values: (v) =>
          fields(v, {
            colors: (colors) =>
              fields(
                colors,
                Object.fromEntries(
                  Object.keys(colors || {})
                    .filter(themeSlot)
                    .map((key) => [key, (c) => color(c) && c.kind !== 'scheme'])
                )
              ),
          }),
      },
      ['kind', 'origin', 'baseStyleId', 'values']
    )
  )
    fail('project theme override')

  const targetTheme = resolveTarget
    ? resolveTarget(entry.baseStyleId, 'theme')
    : resolveThemeTarget(document, entry.baseStyleId)

  const canonicalThemeId =
    isSchema3 && typeof entry.baseStyleId === 'number'
      ? semanticIdentity(document, entry.baseStyleId) ?? String(entry.baseStyleId)
      : String(entry.baseStyleId)

  if (overrides.has(canonicalThemeId)) fail('duplicate theme override')
  overrides.add(canonicalThemeId)
  return targetTheme
}

function validateInheritanceStyleRecords(document) {
  const overrides = new Set()
  const themeOverrides = new Set()
  const styles = semanticStyles(document, (entry) => entry?.origin === 'project')
  for (const [, entry] of styles) {
    if (entry?.origin !== 'project') continue
    if (entry.kind === 'theme-override') {
      validateThemeOverrideRecord(document, entry, themeOverrides)
    } else if (entry.kind === 'inheritance-override') {
      validateInheritanceStyleRecord(document, entry, overrides)
    } else {
      fail('unsupported project style record kind')
    }
  }
}

module.exports = {
  isGeometryStyleColor: color,
  validateGeometryStyleRecords,
  geometryProvider,
  geometryThemeCategories,
  validateGeometryStyleOverride,
  validateInheritanceStyleRecords,
  validateThemeOverrideRecord,
}
module.exports.default = module.exports
