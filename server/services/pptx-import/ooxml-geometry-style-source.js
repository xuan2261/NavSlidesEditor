const { createHash } = require('node:crypto')
const { parseXml, descendants, attr, decodeXml, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { relationshipPart } = require('./slide-order')
const { resolveTarget } = require('./package-store/raw-zip')
const { persistZipMediaRef } = require('./media')
const { extractGeometryImageMetadata } = require('./geometry-image-metadata')
const { geometryThemeCategories } = require('../../../shared/src/pptx-geometry-style-records')
const { GEOMETRY_PATTERN_PRESETS } = require('../../../shared/src/pptx-geometry-pattern')
const {
  EFFECT_RANGES,
  EFFECT_LIST_ORDER,
  validateGeometryEffectGraph,
  unwrapGeometryEffectValue,
} = require('../../../shared/src/pptx-geometry-effect-program')
const { overlayBlips } = require('../../../shared/src/pptx-geometry-effect-overlay-bindings')
const { GEOMETRY_COLOR_KINDS } = require('../../../shared/src/pptx-geometry-color')
const { readColorSource } = require('./ooxml-color-source')
const REL = new Set([
  'http://schemas.openxmlformats.org/package/2006/relationships',
  'http://purl.oclc.org/ooxml/package/relationships',
])
const R = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const fail = (reason) => {
  const error = new TypeError(`Unsupported geometry style source: ${reason}`)
  error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
  throw error
}
const raw = (node, key) => (node ? attr(node, key) : null)
const single = (node, names, uris = A_URIS) => {
  const found = node?.children.filter((n) => uris.has(n.uri) && names.includes(n.local)) || []
  if (found.length > 1) fail(`ambiguous ${names.join('/')}`)
  return found[0]
}
const fills = ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill']
const colorNames = ['srgbClr', 'scrgbClr', 'hslClr', 'prstClr', 'schemeClr', 'sysClr']
const HIDDEN_LINE_URI = 'http://schemas.microsoft.com/office/drawing/2010/main'
const HIDDEN_LINE_EXTENSION = '{91240B29-F687-4F45-9708-019B960494DF}'
const HIDDEN_FILL_EXTENSION = '{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}'
const HIDDEN_EFFECTS_EXTENSION = '{AF507438-7753-43E0-B8FC-AC1667EBCBE1}'
function parseGeometryEffectSource(node, { check, raw, wrap, number, flag, color, fill }) {
  let count = 0
  const token = (n, key) => {
    const value = decodeXml(raw(n, key))
    if (value === null || !value.trim() || value.length > 1024) fail('invalid effect token')
    return wrap(n, value.trim().replace(/[ \t\r\n]+/g, ' '))
  }
  function parse(n, depth = 0) {
    if (++count > 256 || depth > 16) fail('effect program budget')
    if (
      n.attrs.some((attribute) => !/^xmlns(?::|$)/.test(attribute.name) && attribute.value === '')
    )
      fail('empty effect attribute')
    if (['effectLst', 'effectDag', 'cont'].includes(n.local)) {
      const list = n.local === 'effectLst'
      check(
        n,
        list ? [] : ['name', 'type'],
        list ? EFFECT_LIST_ORDER : [...EFFECT_LIST_ORDER, 'cont', 'effect']
      )
      if (depth > 0 && n.local !== 'cont') fail('nested effect root')
      if (list) {
        let previous = -1
        for (const child of n.children) {
          const index = EFFECT_LIST_ORDER.indexOf(child.local)
          if (index <= previous) fail('effect list order/duplicate')
          previous = index
        }
      }
      const value = { kind: list ? 'list' : n.local === 'cont' ? 'cont' : 'dag' }
      if (raw(n, 'name') !== null) value.name = token(n, 'name')
      if (raw(n, 'type') !== null) {
        if (!['sib', 'tree'].includes(raw(n, 'type'))) fail('effect container type')
        value.type = wrap(n, raw(n, 'type'))
      }
      value.effects = n.children.map((child) => parse(child, depth + 1))
      return wrap(n, value)
    }
    if (n.local === 'effect') {
      check(n, ['ref'])
      if (raw(n, 'ref') === null) fail('missing effect reference')
      return wrap(n, { kind: 'effect', ref: token(n, 'ref') })
    }
    if (!Object.hasOwn(EFFECT_RANGES, n.local)) fail('unsupported effect')
    const colored = ['outerShdw', 'innerShdw', 'glow', 'prstShdw'].includes(n.local)
    const transformed = ['outerShdw', 'reflection'].includes(n.local)
    const ranges = EFFECT_RANGES[n.local]
    check(
      n,
      [
        ...Object.keys(ranges),
        ...(transformed ? ['algn', 'rotWithShape'] : []),
        ...(n.local === 'blur' ? ['grow'] : []),
        ...(n.local === 'prstShdw' ? ['prst'] : []),
        ...(n.local === 'fillOverlay' ? ['blend'] : []),
      ],
      colored ? colorNames : n.local === 'fillOverlay' ? fills : []
    )
    const value = { kind: n.local, ...(colored ? { color: color(n) } : {}) }
    for (const key of Object.keys(ranges))
      if (raw(n, key) !== null) value[key] = number(n, key, ...ranges[key])
    for (const key of ['rotWithShape', 'grow']) if (raw(n, key) !== null) value[key] = flag(n, key)
    if (raw(n, 'algn') !== null) {
      if (!['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br'].includes(raw(n, 'algn')))
        fail('effect alignment')
      value.algn = wrap(n, raw(n, 'algn'))
    }
    if (n.local === 'prstShdw') {
      if (!/^shdw(?:[1-9]|1\d|20)$/.test(raw(n, 'prst') ?? '')) fail('preset shadow')
      value.prst = wrap(n, raw(n, 'prst'))
    }
    if (n.local === 'fillOverlay') {
      if (
        !['over', 'mult', 'screen', 'darken', 'lighten'].includes(raw(n, 'blend')) ||
        n.children.length !== 1
      )
        fail('fill overlay blend/fill')
      value.blend = wrap(n, raw(n, 'blend'))
      value.fill = fill(n.children[0])
    }
    return wrap(n, value)
  }
  const program = parse(node)
  try {
    validateGeometryEffectGraph(unwrapGeometryEffectValue(program))
  } catch (error) {
    fail(error.message)
  }
  return program
}
async function buildGeometryStyleSources(zip, inventory, media = {}) {
  const parts = new Map(),
    nodes = new Map(),
    locations = new Map(),
    styles = {},
    definitionBindings = {},
    occurrenceBindings = {},
    templates = new Set(),
    blips = []
  for (const part of inventory.parts.filter((p) => /\.(xml|rels|svg)$/i.test(p.partUri))) {
    const file = zip.file(part.partUri)
    if (!file) fail(`missing part ${part.partUri}`)
    const bytes = await file.async('nodebuffer')
    if (createHash('sha256').update(bytes).digest('hex') !== part.preconditionHash)
      fail(`changed source hash ${part.partUri}`)
    const xml = bytes.toString('utf8'),
      roots = parseXml(xml)
    parts.set(part.partUri, { ...part, xml, roots })
    const visit = (node, path) => {
      locations.set(node, {
        partUri: part.partUri,
        preconditionHash: part.preconditionHash,
        componentLocator: { path, preconditionHash: part.preconditionHash },
      })
      node.children.forEach((n, i) => visit(n, [...path, i]))
    }
    roots.forEach((n, i) => visit(n, [i]))
  }
  const wrap = (node, value) => ({ source: locations.get(node), value })
  const check = (node, attributes, children = [], uris = A_URIS, childUris = A_URIS) => {
    if (
      !node ||
      !uris.has(node.uri) ||
      new Set(node.attrs.map((a) => a.name)).size !== node.attrs.length ||
      node.attrs.some((a) => !/^xmlns(?::|$)/.test(a.name) && !attributes.includes(a.name)) ||
      node.children.some((n) => !childUris.has(n.uri) || !children.includes(n.local))
    )
      fail(`unsupported/malformed ${node?.local}`)
    if (!node.selfClosing) {
      const xml = parts.get(locations.get(node).partUri).xml
      let cursor = node.end + 1
      for (const nested of node.children) {
        if (xml.slice(cursor, nested.start).trim()) fail('declaration text')
        cursor = nested.closeEnd + 1
      }
      if (xml.slice(cursor, node.closeStart).trim()) fail('declaration text')
    }
  }
  const number = (node, key, min = -2147483648, max = 2147483647) => {
    const value = raw(node, key)
    if (
      !/^-?\d+$/.test(value ?? '') ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < min ||
      Number(value) > max
    )
      fail(`invalid ${node.local}.${key}`)
    return wrap(node, Number(value))
  }
  const flag = (node, key) => {
    if (!['0', '1', 'false', 'true'].includes(raw(node, key))) fail(`invalid ${key}`)
    return wrap(node, ['1', 'true'].includes(raw(node, key)))
  }
  const colorSource = { check, number, raw, wrap, fail }
  const color = (node) => readColorSource(node, colorSource)
  const oneColor = (node) => {
    if (node.children.length !== 1) fail('ambiguous/missing color')
    return color(node.children[0])
  }
  const fill = (node) => {
    if (node.local === 'grpFill') {
      check(node, [])
      return wrap(node, { group: true })
    }
    if (node.local === 'noFill') {
      check(node, [])
      return wrap(node, { color: wrap(node, { kind: 'none' }) })
    }
    if (node.local === 'solidFill') {
      check(node, [], colorNames)
      return wrap(node, { color: oneColor(node) })
    }
    if (node.local === 'blipFill') {
      check(node, ['dpi', 'rotWithShape'], ['blip', 'srcRect', 'tile', 'stretch'])
      const image = single(node, ['blip'])
      const embeds =
        image?.attrs.filter((entry) => {
          const [prefix, local] = entry.name.split(':')
          return local === 'embed' && R.has(image.namespaces[prefix])
        }) || []
      if (embeds.length !== 1) fail('missing/ambiguous blip embed')
      check(image, [embeds[0].name, 'cstate'])
      const value = { embed: wrap(image, decodeXml(embeds[0].value)) }
      if (raw(node, 'dpi') !== null) value.dpi = number(node, 'dpi', 0, 4294967295)
      if (raw(node, 'rotWithShape') !== null) value.rotWithShape = flag(node, 'rotWithShape')
      const rectangle = (entry) => {
        check(entry, ['l', 't', 'r', 'b'])
        return wrap(
          entry,
          Object.fromEntries(
            ['l', 't', 'r', 'b']
              .filter((key) => raw(entry, key) !== null)
              .map((key) => [key, number(entry, key)])
          )
        )
      }
      const crop = single(node, ['srcRect']),
        tile = single(node, ['tile']),
        stretch = single(node, ['stretch'])
      if (tile && stretch) fail('ambiguous blip placement')
      if (crop) value.srcRect = rectangle(crop)
      if (tile) {
        check(tile, ['tx', 'ty', 'sx', 'sy', 'flip', 'algn'])
        const fields = {}
        for (const key of ['tx', 'ty', 'sx', 'sy'])
          if (raw(tile, key) !== null)
            fields[key] = number(tile, key, ['sx', 'sy'].includes(key) ? 1 : -2147483648)
        for (const [key, allowed] of [
          ['flip', ['none', 'x', 'y', 'xy']],
          ['algn', ['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br']],
        ])
          if (raw(tile, key) !== null) {
            if (!allowed.includes(raw(tile, key))) fail(`invalid tile.${key}`)
            fields[key] = wrap(tile, raw(tile, key))
          }
        value.tile = wrap(tile, fields)
      }
      if (stretch) {
        check(stretch, [], ['fillRect'])
        const rect = single(stretch, ['fillRect'])
        value.stretch = wrap(stretch, rect ? { fillRect: rectangle(rect) } : {})
      }
      const result = { blip: wrap(node, value) }
      blips.push({ image, value, result })
      return wrap(node, result)
    }
    if (node.local === 'pattFill') {
      check(node, ['prst'], ['fgClr', 'bgClr'])
      const pattern = {}
      if (raw(node, 'prst') !== null) {
        if (!GEOMETRY_PATTERN_PRESETS.includes(raw(node, 'prst'))) fail('pattern preset')
        pattern.preset = wrap(node, raw(node, 'prst'))
      }
      for (const [child, field] of [
        ['fgClr', 'foreground'],
        ['bgClr', 'background'],
      ]) {
        const container = single(node, [child])
        if (container) {
          check(container, [], colorNames)
          pattern[field] = oneColor(container)
        }
      }
      return wrap(node, { pattern: wrap(node, pattern) })
    }
    if (node.local !== 'gradFill') fail(`unsupported fill ${node.local}`)
    check(node, ['rotWithShape', 'flip'], ['gsLst', 'lin', 'path', 'tileRect'])
    const list = single(node, ['gsLst']),
      lin = single(node, ['lin']),
      path = single(node, ['path']),
      tile = single(node, ['tileRect'])
    check(list, [], ['gs'])
    if (!!lin === !!path) fail('ambiguous/missing gradient shading')
    if (lin) check(lin, ['ang', 'scaled'])
    if (path) {
      check(path, ['path'], ['fillToRect'])
      if (raw(path, 'path') !== null && !['circle', 'rect', 'shape'].includes(raw(path, 'path')))
        fail('gradient path')
    }
    if (raw(node, 'flip') !== null && raw(node, 'flip') !== 'none') fail('gradient flip')
    if (!['1', 'true'].includes(raw(node, 'rotWithShape')) || !list.children.length)
      fail('gradient shape rotation/stops')
    const stops = list.children.map((n) => {
      check(n, ['pos'], colorNames)
      return wrap(n, { pos: number(n, 'pos', 0, 100000), color: oneColor(n) })
    })
    const rectangle = (entry) => {
      check(entry, ['l', 't', 'r', 'b'])
      return wrap(
        entry,
        Object.fromEntries(
          ['l', 't', 'r', 'b']
            .filter((key) => raw(entry, key) !== null)
            .map((key) => [key, number(entry, key)])
        )
      )
    }
    const focus = path && single(path, ['fillToRect'])
    return wrap(node, {
      gradient: wrap(node, {
        ...(lin
          ? { kind: 'linear', angle: number(lin, 'ang', 0, 21599999), scaled: flag(lin, 'scaled') }
          : {
              kind: 'path',
              ...(raw(path, 'path') !== null ? { path: wrap(path, raw(path, 'path')) } : {}),
              ...(focus ? { fillToRect: rectangle(focus) } : {}),
            }),
        rotWithShape: flag(node, 'rotWithShape'),
        stops,
        ...(tile ? { tileRect: rectangle(tile) } : {}),
      }),
    })
  }
  const stroke = (node, uris = A_URIS) => {
    const childNames = [
      ...fills,
      'prstDash',
      'custDash',
      'round',
      'bevel',
      'miter',
      'headEnd',
      'tailEnd',
    ]
    check(node, ['w', 'cap', 'cmpd', 'algn'], childNames, uris)
    const value = {},
      paint = single(node, fills),
      dash = single(node, ['prstDash', 'custDash']),
      join = single(node, ['round', 'bevel', 'miter'])
    if (paint) {
      const parsed = fill(paint).value
      if (!parsed.color) fail('gradient outline')
      value.color = parsed.color
    }
    if (raw(node, 'w') !== null) value.width = number(node, 'w', 0, 20116800)
    if (raw(node, 'cap') !== null) {
      if (!['flat', 'rnd', 'sq'].includes(raw(node, 'cap'))) fail('line cap')
      value.cap = wrap(node, raw(node, 'cap'))
    }
    for (const [attribute, field, supported] of [
      ['cmpd', 'compound', ['sng', 'dbl', 'thinThick', 'thickThin', 'tri']],
      ['algn', 'alignment', ['ctr', 'in']],
    ]) {
      const entries = node.attrs.filter((entry) => entry.name === attribute)
      if (!entries.length) continue
      if (entries.length !== 1 || !supported.includes(raw(node, attribute))) fail(`line ${field}`)
      value[field] = wrap(node, raw(node, attribute))
    }
    if (dash) {
      if (dash.local === 'prstDash') {
        check(dash, ['val'])
        if (
          ![
            'solid',
            'dot',
            'dash',
            'dashDot',
            'lgDash',
            'lgDashDot',
            'lgDashDotDot',
            'sysDot',
            'sysDash',
            'sysDashDot',
            'sysDashDotDot',
          ].includes(raw(dash, 'val'))
        )
          fail('preset dash')
        value.dash = wrap(dash, { kind: 'preset', value: raw(dash, 'val') })
      } else {
        check(dash, [], ['ds'])
        if (!dash.children.length) fail('empty custom dash')
        value.dash = wrap(dash, {
          kind: 'custom',
          stops: dash.children.map((n) => {
            check(n, ['d', 'sp'])
            return wrap(n, { dash: number(n, 'd', 0), space: number(n, 'sp', 0) })
          }),
        })
      }
    }
    if (join) {
      check(join, join.local === 'miter' ? ['lim'] : [])
      value.join = wrap(join, {
        kind: join.local,
        ...(raw(join, 'lim') !== null ? { limit: number(join, 'lim', 0) } : {}),
      })
    }
    for (const end of ['headEnd', 'tailEnd']) {
      const n = single(node, [end])
      if (!n) continue
      check(n, ['type', 'w', 'len'])
      const fields = {}
      for (const key of ['type', 'w', 'len'])
        if (raw(n, key) !== null) {
          if (
            !(
              key === 'type'
                ? ['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow']
                : ['sm', 'med', 'lg']
            ).includes(raw(n, key))
          )
            fail('line end')
          fields[key] = wrap(n, raw(n, key))
        }
      value[end] = wrap(n, fields)
    }
    return wrap(node, value)
  }
  const effects = (node) => {
    try {
      return parseGeometryEffectSource(node, {
        check,
        raw,
        wrap,
        number,
        flag,
        color: oneColor,
        fill,
      })
    } catch (error) {
      if (error.code !== 'PPTX_SEMANTIC_ADMISSION_FAILED') throw error
      error.sourceLocation = locations.get(node)
      error.message += ` at ${error.sourceLocation.partUri}:${error.sourceLocation.componentLocator.path.join('.')}`
      throw error
    }
  }
  const xfrm = (node, group = false) => {
    const coordinates = group ? ['off', 'ext', 'chOff', 'chExt'] : ['off', 'ext']
    check(node, ['rot', 'flipH', 'flipV'], coordinates)
    const value = {}
    if (raw(node, 'rot') !== null) value.rot = number(node, 'rot')
    for (const key of ['flipH', 'flipV']) if (raw(node, key) !== null) value[key] = flag(node, key)
    for (const local of coordinates) {
      const n = single(node, [local])
      if (!n) continue
      const offset = ['off', 'chOff'].includes(local)
      const keys = offset ? ['x', 'y'] : ['cx', 'cy']
      check(n, keys)
      value[local] = wrap(
        n,
        Object.fromEntries(
          keys.map((k) => [k, number(n, k, offset ? -27273042316900 : 0, 27273042316900)])
        )
      )
    }
    return wrap(node, value)
  }
  const record = (id, kind, node, payload) => {
    styles[id] = { kind, origin: 'source', source: locations.get(node), payload }
    return id
  }
  for (const definition of inventory.definitions) {
    let node = { children: parts.get(definition.partUri)?.roots || [] }
    for (const index of definition.componentLocators[0].path) node = node?.children[index]
    if (
      !node ||
      node.local !== definition.localName ||
      node.uri !== definition.namespaceUri ||
      locations.get(node).preconditionHash !== definition.preconditionHash
    )
      fail('invalid definition locator/hash')
    nodes.set(definition.id, node)
    if (!['shape', 'connector', 'picture', 'group'].includes(definition.kind)) continue
    const group = definition.kind === 'group'
    const propertiesNode = single(node, [group ? 'grpSpPr' : 'spPr'], P_URIS),
      style = single(node, ['style'], P_URIS),
      properties = {},
      styleRefs = {}
    check(
      propertiesNode,
      ['bwMode'],
      group
        ? ['xfrm', ...fills]
        : ['xfrm', 'prstGeom', 'custGeom', ...fills, 'ln', 'effectLst', 'effectDag', 'extLst', 'scene3d', 'sp3d'],
      P_URIS
    )
    if (group && style) fail('group style reference')
    if (style) check(style, [], ['fillRef', 'lnRef', 'effectRef', 'fontRef'], P_URIS)
    const placeholderNodes = group
      ? []
      : descendants(node, (n) => P_URIS.has(n.uri) && n.local === 'ph')
    if (placeholderNodes.length > 1) fail('ambiguous placeholder')
    const placeholder = placeholderNodes[0],
      transform = single(propertiesNode, ['xfrm']),
      geom = single(propertiesNode, ['prstGeom', 'custGeom'])
    for (const [key, names, parse] of [
      ['fill', fills, fill],
      ['stroke', ['ln'], stroke],
      ['effects', ['effectLst', 'effectDag'], effects],
    ]) {
      const n = single(propertiesNode, names)
      if (n) {
        properties[key] = parse(n)
      }
    }
    for (const key of ['fillRef', 'lnRef', 'effectRef']) {
      const n = single(style, [key])
      if (!n) continue
      check(n, ['idx'], colorNames)
      styleRefs[key] = wrap(n, { index: number(n, 'idx', 0, 4294967295).value, color: oneColor(n) })
    }
    const paintComponent = group
      ? {
          id: `${definition.id}:group-properties`,
          kind: 'property',
          locator: locations.get(propertiesNode),
        }
      : null
    const payload = {
      definitionId: definition.id,
      properties,
      styleRefs,
      ...(paintComponent ? { paintComponentId: paintComponent.id } : {}),
    }
    const extensions = single(propertiesNode, ['extLst'])
    if (extensions) {
      check(extensions, [], ['ext'])
      if (!extensions.children.length) fail('empty extension list')
      const seenUris = new Set()
      for (const extension of extensions.children) {
        try {
          const uri = raw(extension, 'uri')
          if (!uri || seenUris.has(uri)) fail('duplicate or missing extension uri')
          seenUris.add(uri)
          if (uri === HIDDEN_LINE_EXTENSION) {
            if (payload.hiddenStroke) fail('duplicate hidden outline')
            check(extension, ['uri'], ['hiddenLine'], A_URIS, new Set([HIDDEN_LINE_URI]))
            if (extension.children.length !== 1) fail('hidden outline extension identity')
            const hidden = extension.children[0]
            payload.hiddenStroke = stroke(hidden, new Set([HIDDEN_LINE_URI]))
            const latent = payload.hiddenStroke.value
            if (
              !latent.width ||
              !latent.color ||
              ![...GEOMETRY_COLOR_KINDS, 'scheme', 'system'].includes(latent.color.value.kind)
            )
              fail('unsupported hidden outline paint/width')
          } else if (uri === HIDDEN_FILL_EXTENSION) {
            check(extension, ['uri'], ['hiddenFill'], A_URIS, new Set([HIDDEN_LINE_URI]))
            if (extension.children.length !== 1) fail('hidden fill extension identity')
            const hidden = extension.children[0]
            // MS-ODRAWXML 2.3.1.5: retain latent fill, never active paint.
            check(hidden, [], ['noFill', 'solidFill'], new Set([HIDDEN_LINE_URI]))
            if (hidden.children.length !== 1) fail('hidden fill identity')
            const paint = hidden.children[0]
            if (paint.local === 'solidFill') {
              check(paint, [], ['srgbClr', 'schemeClr'])
              if (paint.children.length !== 1) fail('hidden fill color identity')
              check(paint.children[0], ['val'])
            }
            payload.hiddenFill = wrap(hidden, { fill: fill(paint) })
          } else if (uri === HIDDEN_EFFECTS_EXTENSION) {
            if (payload.hiddenEffects) fail('duplicate hidden effects')
            check(extension, ['uri'], ['hiddenEffects'], A_URIS, new Set([HIDDEN_LINE_URI]))
            if (extension.children.length !== 1) fail('hidden effects extension identity')
            const hidden = extension.children[0]
            check(hidden, [], ['effectLst', 'effectDag'], new Set([HIDDEN_LINE_URI]))
            if (hidden.children.length !== 1) fail('hidden effects program identity')
            // MS-ODRAWXML 2.3.1.4: invisible authored effects never enter active paint.
            payload.hiddenEffects = wrap(hidden, { effects: effects(hidden.children[0]) })
          } else {
            fail('unsupported extension uri')
          }
        } catch (error) {
          if (error.code !== 'PPTX_SEMANTIC_ADMISSION_FAILED') throw error
          if (!error.sourceLocation) {
            error.sourceLocation = locations.get(extension)
            error.message += ` at ${error.sourceLocation.partUri}:${error.sourceLocation.componentLocator.path.join('.')}`
          }
          throw error
        }
      }
    }
    if (placeholder) {
      if (
        definition.parentDefinitionId ||
        placeholder.children.length ||
        placeholder.attrs.some(
          (a) => !['idx', 'type', 'orient', 'sz', 'hasCustomPrompt'].includes(a.name)
        )
      )
        fail('placeholder declaration')
      if (raw(placeholder, 'idx') !== null) number(placeholder, 'idx', 0, 4294967295)
      if (
        raw(placeholder, 'type') !== null &&
        ![
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
          'pic',
        ].includes(raw(placeholder, 'type'))
      )
        fail('placeholder type')
      payload.placeholder = wrap(
        placeholder,
        Object.fromEntries(placeholder.attrs.map((a) => [a.name, decodeXml(a.value)]))
      )
    }
    if (transform) payload.transform = xfrm(transform, group)
    if (geom) {
      const component = inventory.definitions.filter(
        (d) =>
          nodes.get(d.id) === geom ||
          (d.partUri === definition.partUri &&
            JSON.stringify(d.componentLocators[0].path) ===
              JSON.stringify(locations.get(geom).componentLocator.path))
      )
      if (component.length !== 1 || component[0].parentDefinitionId !== definition.id)
        fail('missing geometry identity')
      payload.geometry = { definitionId: definition.id, componentId: component[0].id }
    }
    definitionBindings[definition.id] = {
      ...(paintComponent ? { paintComponent } : {}),
      styleId: record(
        `${definition.id}:geometry-declarations`,
        'geometry-declarations',
        node,
        payload
      ),
    }
  }
  const declarations = (id) => styles[definitionBindings[id]?.styleId]?.payload
  const relationCache = new Map()
  const relationships = (uri) => {
    if (relationCache.has(uri)) return relationCache.get(uri)
    const state = parts.get(relationshipPart(uri)),
      all = descendants({ children: state?.roots || [] }, (n) => n.local === 'Relationship'),
      entries = all.filter((n) => REL.has(n.uri)),
      ids = new Set()
    if (all.some((n) => raw(n, 'Type')?.endsWith('/themeOverride') && !REL.has(n.uri)))
      fail('invalid themeOverride relationship namespace')
    if (
      all.some((n) => raw(n, 'Type')?.endsWith('/themeOverride')) &&
      (state.roots.length !== 1 ||
        state.roots[0].local !== 'Relationships' ||
        !REL.has(state.roots[0].uri) ||
        all.some(
          (n) =>
            raw(n, 'Type')?.endsWith('/themeOverride') &&
            (!state.roots[0].children.includes(n) ||
              n.children.length ||
              n.attrs.some(
                (a) =>
                  !/^xmlns(?::|$)/.test(a.name) &&
                  !['Id', 'Type', 'Target', 'TargetMode'].includes(a.name)
              ))
        ))
    )
      fail('malformed themeOverride relationship')
    const edges = entries.map((n) => {
      const id = raw(n, 'Id'),
        type = raw(n, 'Type'),
        target = raw(n, 'Target')
      if (!id || !type || !target || ids.has(id)) fail('ambiguous relationship')
      ids.add(id)
      return { id, type, target, mode: raw(n, 'TargetMode'), node: n }
    })
    if (
      edges.some(
        (e) =>
          e.type.endsWith('/themeOverride') && ![...R].some((r) => e.type === `${r}/themeOverride`)
      )
    )
      fail('invalid themeOverride relationship type')
    relationCache.set(uri, edges)
    return edges
  }
  const hosts = new Map()
  for (const slide of inventory.slides) {
    const chain = [slide.partUri],
      edges = [],
      path = [slide.partUri]
    if (
      parts.get(slide.partUri)?.roots.length !== 1 ||
      parts.get(slide.partUri).roots[0].local !== 'sld' ||
      !P_URIS.has(parts.get(slide.partUri).roots[0].uri)
    )
      fail('invalid host slide')
    for (const [suffix, root] of [
      ['slideLayout', 'sldLayout'],
      ['slideMaster', 'sldMaster'],
      ['theme', 'theme'],
    ]) {
      const from = path[path.length - 1],
        matches = relationships(from).filter((e) => [...R].some((r) => e.type === `${r}/${suffix}`))
      if (!matches.length) break
      if (matches.length !== 1 || (matches[0].mode && matches[0].mode !== 'Internal'))
        fail('ambiguous/external relationship')
      const edge = matches[0],
        to = resolveTarget(from, decodeXml(edge.target))
      if (path.includes(to)) fail('dependency cycle')
      if (
        !parts.has(to) ||
        parts.get(to).roots.length !== 1 ||
        parts.get(to).roots[0].local !== root ||
        !(root === 'theme' ? A_URIS : P_URIS).has(parts.get(to).roots[0].uri)
      )
        fail('invalid relationship target kind')
      edges.push({
        fromPartUri: from,
        toPartUri: to,
        relationshipId: edge.id,
        type: edge.type,
        source: locations.get(edge.node),
      })
      path.push(to)
      chain.push(edge.id)
    }
    path.forEach(relationships)
    hosts.set(slide.partUri, { path, edges, chain })
  }
  const matrix = (format, native = false) => {
    const payload = {}
    if (native)
      check(format, ['name'], ['fillStyleLst', 'bgFillStyleLst', 'lnStyleLst', 'effectStyleLst'])
    for (const [key, local, parse, children] of [
      ['fillStyles', 'fillStyleLst', fill, fills],
      ['backgroundFillStyles', 'bgFillStyleLst', fill, fills],
      ['lineStyles', 'lnStyleLst', stroke, ['ln']],
      [
        'effectStyles',
        'effectStyleLst',
        (n) => {
          check(n, [], ['effectLst', 'effectDag'])
          const e = single(n, ['effectLst', 'effectDag'])
          if (!e) fail('unsupported effect style')
          return wrap(n, { effects: effects(e) })
        },
        ['effectStyle'],
      ],
    ]) {
      const list = single(format, [local])
      if (native && list) check(list, [], children)
      payload[key] = (list?.children || []).map((n) => {
        try {
          return parse(n)
        } catch (error) {
          if (error.code !== 'PPTX_SEMANTIC_ADMISSION_FAILED') throw error
          return wrap(n, { kind: 'unsupported', reason: error.message })
        }
      })
    }
    return payload
  }
  const themeFor = (uri) => {
    if (!uri) return null
    const id = `${uri}:geometry-theme`
    if (styles[id]) return id
    const root = parts.get(uri).roots[0],
      elements = single(root, ['themeElements']),
      scheme = single(elements, ['clrScheme']),
      format = single(elements, ['fmtScheme']),
      colors = {}
    for (const n of scheme?.children || []) {
      if (
        !A_URIS.has(n.uri) ||
        !/^(?:dk[12]|lt[12]|accent[1-6]|hlink|folHlink)$/.test(n.local) ||
        Object.hasOwn(colors, n.local)
      )
        fail('ambiguous/unsupported theme color')
      colors[n.local] = oneColor(n)
      if (colors[n.local].value.kind === 'scheme') fail('unsupported recursive theme color')
    }
    const payload = { colors, ...matrix(format) }
    return record(id, 'theme', root, payload)
  }
  const overrideFor = (uri) => {
    const id = `${uri}:geometry-theme-override`
    if (styles[id]) return id
    const roots = parts.get(uri)?.roots,
      root = roots?.[0]
    if (roots?.length !== 1 || root.local !== 'themeOverride') fail('invalid themeOverride root')
    check(root, [], ['clrScheme', 'fmtScheme', 'fontScheme'])
    const scheme = single(root, ['clrScheme']),
      format = single(root, ['fmtScheme']),
      font = single(root, ['fontScheme'])
    const payload = {}
    if (scheme) {
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
        ],
        colors = {}
      check(scheme, ['name'], slots)
      for (const n of scheme.children) {
        check(
          n,
          [],
          colorNames.filter((name) => name !== 'schemeClr')
        )
        if (Object.hasOwn(colors, n.local)) fail('duplicate native theme color')
        colors[n.local] = oneColor(n)
      }
      if (slots.some((slot) => !Object.hasOwn(colors, slot))) fail('incomplete native color scheme')
      payload.colorScheme = wrap(scheme, { colors })
    }
    if (format) payload.formatScheme = wrap(format, matrix(format, true))
    if (font) payload.fontScheme = wrap(font, { kind: 'preserved' })
    return record(id, 'native-theme-override', root, payload)
  }
  const overrideOwners = new Set(
    [...hosts.values()].flatMap((host) =>
      host.path
        .slice(0, 2)
        .filter((uri) => ['sld', 'sldLayout'].includes(parts.get(uri).roots[0].local))
    )
  )
  for (const uri of parts.keys()) {
    if (!uri.endsWith('.rels')) continue
    const owner = uri.replace(
      /(?:^|\/)_rels\/([^/]+)\.rels$/,
      (_, name) => `${uri.startsWith('_rels/') ? '' : '/'}${name}`
    )
    if (
      relationships(owner).some((e) => e.type.endsWith('/themeOverride')) &&
      !overrideOwners.has(owner)
    )
      fail('unsupported themeOverride owner')
  }
  for (const host of hosts.values()) {
    host.themeOverrideBindings = []
    for (const from of host.path.filter((uri) => overrideOwners.has(uri))) {
      const matches = relationships(from).filter((e) =>
        [...R].some((r) => e.type === `${r}/themeOverride`)
      )
      if (!matches.length) continue
      if (matches.length !== 1 || (matches[0].mode && matches[0].mode !== 'Internal'))
        fail('ambiguous/external themeOverride relationship')
      const edge = matches[0],
        to = resolveTarget(from, decodeXml(edge.target))
      if (host.path.includes(to)) fail('themeOverride dependency cycle')
      host.themeOverrideBindings.push({
        styleId: overrideFor(to),
        edge: {
          fromPartUri: from,
          toPartUri: to,
          relationshipId: edge.id,
          type: edge.type,
          source: locations.get(edge.node),
        },
      })
    }
  }
  const colorMaps = (path) =>
    path
      .filter((uri) => P_URIS.has(parts.get(uri).roots[0].uri))
      .flatMap((uri) => {
        const root = parts.get(uri).roots[0],
          direct = single(root, ['clrMap'], P_URIS),
          override = single(root, ['clrMapOvr'], P_URIS)
        const node = direct || single(override, ['masterClrMapping', 'overrideClrMapping'])
        if (!node) return []
        if (override && override.children.length !== 1) fail('ambiguous color map')
        const slots = [
          'bg1',
          'tx1',
          'bg2',
          'tx2',
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
          node.children.length ||
          node.attrs.some(
            (a) =>
              !/^xmlns(?::|$)/.test(a.name) &&
              (!slots.includes(a.name) ||
                !/^(?:dk[12]|lt[12]|accent[1-6]|hlink|folHlink)$/.test(a.value) ||
                node.local === 'masterClrMapping')
          )
        )
          fail('invalid color map')
        const id = `${uri}:geometry-color-map`
        if (!styles[id])
          record(id, 'color-map', node, {
            kind: node.local === 'masterClrMapping' ? 'master' : 'mapping',
            values: Object.fromEntries(
              node.attrs
                .filter((a) => !/^xmlns(?::|$)/.test(a.name))
                .map((a) => [a.name, wrap(node, decodeXml(a.value))])
            ),
          })
        return [id]
      })
  for (const occurrence of inventory.occurrences.filter(
    (o) => definitionBindings[o.definitionId]
  )) {
    const definition = inventory.definitions.find((d) => d.id === occurrence.definitionId),
      host = hosts.get(occurrence.slidePartUri),
      sourceIndex = host?.path.indexOf(definition.partUri)
    if (
      !host ||
      sourceIndex < 0 ||
      sourceIndex > 2 ||
      JSON.stringify(occurrence.relationshipChain) !==
        JSON.stringify(host.chain.slice(0, sourceIndex + 1))
    )
      fail('invalid occurrence relationship chain')
    const candidates = [definition.id]
    if (definition.kind === 'group') {
      const id = `${occurrence.id}:group-fill-context`
      record(id, 'group-fill-context', nodes.get(definition.id), {
        definitionId: definition.id,
        hostSlidePartUri: occurrence.slidePartUri,
        relationshipChain: [...occurrence.relationshipChain],
        edges: host.edges,
        declarationIds: [definitionBindings[definition.id].styleId],
        themeId: themeFor(host.path.find((uri) => A_URIS.has(parts.get(uri).roots[0].uri))),
        colorMapIds: colorMaps(host.path),
        ...(host.themeOverrideBindings.length
          ? { themeOverrideBindings: host.themeOverrideBindings }
          : {}),
      })
      occurrenceBindings[occurrence.id] = { contextId: id }
      continue
    }
    let previous = declarations(definition.id)
    // Ancestor placeholders provide declarations to actual slide shapes; they
    // are not additional slide ink when no local placeholder uses them.
    if (sourceIndex > 0 && previous.placeholder) templates.add(occurrence.id)
    for (let i = sourceIndex + 1; i < Math.min(host.path.length, 3) && previous.placeholder; i++) {
      const ph = previous.placeholder.value,
        masterType = {
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
      const matches = inventory.definitions.filter((d) => {
        const candidate = declarations(d.id)?.placeholder?.value
        return (
          d.partUri === host.path[i] &&
          candidate &&
          (i === 1
            ? Number(candidate.idx ?? '0') === Number(ph.idx ?? '0')
            : (candidate.type ?? 'obj') === (masterType[ph.type ?? 'obj'] ?? ph.type ?? 'obj'))
        )
      })
      if (matches.length > 1) fail('ambiguous placeholder provider')
      if (!matches.length) break
      previous = declarations(matches[0].id)
      candidates.push(matches[0].id)
      const template = inventory.occurrences.filter(
        (o) =>
          o.slidePartUri === occurrence.slidePartUri &&
          o.definitionId === matches[0].id &&
          JSON.stringify(o.relationshipChain) === JSON.stringify(host.chain.slice(0, i + 1))
      )
      if (template.length !== 1) fail('missing template occurrence')
      templates.add(template[0].id)
    }
    const geometry = candidates.map(declarations).find((d) => d.geometry)?.geometry
    if (!geometry) fail('missing bound geometry')
    const transformIds = candidates
      .filter((id) => declarations(id).transform)
      .map((id) => definitionBindings[id].styleId)
    if (
      !['off', 'ext'].every((key) =>
        transformIds.some((id) => styles[id].payload.transform.value[key])
      )
    )
      fail('missing bound transform')
    const themeId = themeFor(host.path.find((uri) => A_URIS.has(parts.get(uri).roots[0].uri)))
    const formatProvider = geometryThemeCategories(styles, {
      themeId,
      themeOverrideBindings: host.themeOverrideBindings,
    }).format
    const matrixBindings = {}
    for (const [key, property, list] of [
      ['fillRef', 'fill', 'fillStyles'],
      ['lnRef', 'stroke', 'lineStyles'],
      ['effectRef', 'effects', 'effectStyles'],
    ]) {
      const eligible = candidates
        .map(declarations)
        .find((d) => d.styleRefs[key] || (property !== 'stroke' && d.properties[property]))
      const reference = eligible?.styleRefs[key]
      if (!reference || (property !== 'stroke' && eligible.properties[property])) continue
      const index = reference.value.index,
        targetList = key === 'fillRef' && index > 1000 ? 'backgroundFillStyles' : list,
        entryIndex =
          index === 0 || (key === 'fillRef' && index === 1000)
            ? null
            : index - (targetList === 'backgroundFillStyles' ? 1001 : 1)
      const entry = entryIndex === null ? null : formatProvider.value?.[targetList]?.[entryIndex]
      if (entryIndex !== null && (!entry || entry.value.kind === 'unsupported')) {
        if (key === 'effectRef' && entry) {
          const error = new TypeError(`Unsupported geometry style source: ${entry.value.reason}`)
          error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
          error.sourceLocation = entry.source
          throw error
        }
        fail('selected unsupported/missing style matrix entry')
      }
      if (
        reference.value.color.value.kind === 'scheme' &&
        reference.value.color.value.value === 'phClr'
      )
        fail('unbound phClr reference color')
      matrixBindings[key] = {
        declarationId: definitionBindings[eligible.definitionId].styleId,
        index,
        themeId,
        list: targetList,
        entryIndex,
        ...(entry
          ? {
              source: entry.source,
              ...(formatProvider.styleId !== themeId
                ? { overrideStyleId: formatProvider.styleId }
                : {}),
            }
          : {}),
      }
    }
    const payload = {
      definitionId: definition.id,
      hostSlidePartUri: occurrence.slidePartUri,
      relationshipChain: [...occurrence.relationshipChain],
      edges: host.edges,
      declarationIds: candidates.map((id) => definitionBindings[id].styleId),
      geometry,
      transformDeclarationIds: transformIds,
      themeId,
      colorMapIds: colorMaps(host.path),
      matrixBindings,
    }
    if (host.themeOverrideBindings.length)
      payload.themeOverrideBindings = host.themeOverrideBindings
    const id = `${occurrence.id}:geometry-context`
    record(id, 'geometry-context', nodes.get(definition.id), payload)
    occurrenceBindings[occurrence.id] = { contextId: id }
  }
  // Overlay blips are nested in effect programs, not exposed as top-level fills.
  const overlayBlipValues = new Set()
  const collectOverlayBlips = (program) =>
    overlayBlips(program?.value, (blip) => overlayBlipValues.add(blip), true)
  for (const entry of Object.values(styles)) {
    const format =
      entry.kind === 'native-theme-override' ? entry.payload.formatScheme?.value : entry.payload
    collectOverlayBlips(entry.payload.properties?.effects)
    collectOverlayBlips(entry.payload.hiddenEffects?.value.effects)
    for (const effectStyle of format?.effectStyles ?? [])
      collectOverlayBlips(effectStyle.value.effects)
  }
  for (const blip of blips) {
    const matrixOwners = Object.values(styles).filter((entry) => {
      const format =
        entry.kind === 'native-theme-override' ? entry.payload.formatScheme?.value : entry.payload
      return ['fillStyles', 'backgroundFillStyles'].some((key) =>
        format?.[key]?.some((field) => field.value === blip.result)
      )
    })
    const declarationOwners = Object.values(styles).filter(
      (entry) => entry.payload.properties?.fill?.value === blip.result
    )
    const overlayOwned = overlayBlipValues.has(blip.value)
    if (!matrixOwners.length && !declarationOwners.length && !overlayOwned) continue
    let placementStarted = false
    try {
      const owner = locations.get(blip.image)
      const relationshipId = decodeXml(blip.value.embed.value)
      const edges = relationships(owner.partUri).filter((edge) => edge.id === relationshipId)
      if (edges.length !== 1) fail('missing/ambiguous blip image relationship')
      const edge = edges[0]
      const relationRoots = parts.get(relationshipPart(owner.partUri))?.roots
      if (
        relationRoots?.length !== 1 ||
        relationRoots[0].local !== 'Relationships' ||
        !REL.has(relationRoots[0].uri) ||
        !relationRoots[0].children.includes(edge.node)
      )
        fail('malformed blip image relationship root')
      if (
        ![...R].some((uri) => edge.type === `${uri}/image`) ||
        ![null, '', 'Internal'].includes(edge.mode)
      )
        fail('unsupported blip image relationship')
      check(edge.node, ['Id', 'Type', 'Target', 'TargetMode'], [], REL)
      const target = decodeXml(edge.target)
      if (/[?#\\]/.test(target)) fail('unsafe blip image target')
      const partUri = resolveTarget(owner.partUri, target)
      const asset = inventory.parts.find((part) => part.partUri === partUri)
      const file = zip.file(partUri)
      if (!asset || !file) fail('uninventoried/missing blip image')
      const bytes = await file.async('nodebuffer')
      if (
        createHash('sha256').update(bytes).digest('hex') !== asset.preconditionHash ||
        bytes.length !== asset.byteLength
      )
        fail('changed blip image hash')
      let metadata
      try {
        metadata = extractGeometryImageMetadata(bytes)
      } catch (error) {
        if (!(error instanceof TypeError)) throw error
        fail('unsupported blip image header')
      }
      if (!media.mediaIndex || !media.uploadsDir) fail('missing blip media placement context')
      placementStarted = true
      const placed = await persistZipMediaRef(
        media.mediaIndex,
        partUri,
        media.uploadsDir,
        media.mediaOptions
      )
      if (!placed.url || placed.unsupportedBrowserImage) fail('blip image admission')
      const bindingId = `${owner.partUri}#geometry-blip-binding:${owner.componentLocator.path.join('.')}`
      record(bindingId, 'geometry-blip-binding', blip.image, {
        edge: {
          fromPartUri: owner.partUri,
          toPartUri: partUri,
          relationshipId,
          type: edge.type,
          source: locations.get(edge.node),
        },
        asset: { ...asset, ...metadata, src: placed.url },
      })
      blip.value.bindingId = bindingId
    } catch (error) {
      if (
        placementStarted ||
        declarationOwners.length ||
        overlayOwned ||
        error.code !== 'PPTX_SEMANTIC_ADMISSION_FAILED'
      )
        throw error
      delete blip.result.blip
      Object.assign(blip.result, { kind: 'unsupported', reason: error.message })
    }
  }
  for (const context of Object.values(styles).filter(
    (entry) => entry.kind === 'geometry-context'
  )) {
    const binding = context.payload.matrixBindings.fillRef
    if (!binding || binding.entryIndex === null) continue
    const format = geometryThemeCategories(styles, context.payload).format.value
    if (format[binding.list][binding.entryIndex].value.kind === 'unsupported')
      fail('selected unsupported style matrix image')
  }
  return { styles, definitionBindings, occurrenceBindings, templateOccurrenceIds: [...templates] }
}
module.exports = { buildGeometryStyleSources, parseGeometryEffectSource }
