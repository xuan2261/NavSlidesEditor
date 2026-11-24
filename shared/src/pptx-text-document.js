// Canonical project text, not HTML and not native package/source-map authority.
// Units: font/spacing points remain points; coordinates remain EMU; percentages
// remain OOXML 1/1000 percent; rotation remains 1/60000 degree. No defaults/fitting.
// Resolve only on first use: these modules can cycle back through text contracts.
let semanticRecords, ommlDocument, geometryColor, geometryDocument, textHyperlinks
const getSemanticRecords = () => semanticRecords ||= require('./pptx-semantic-records')
const getOmmlDocument = () => ommlDocument ||= require('./pptx-omml-document')
const getGeometryColor = () => geometryColor ||= require('./pptx-geometry-color')
const getGeometryDocument = () => geometryDocument ||= require('./pptx-geometry-document')
const getTextHyperlinks = () => textHyperlinks ||= require('./pptx-text-hyperlinks')
const validRunHyperlinks = (...args) => getTextHyperlinks().validRunHyperlinks(...args)
const TEXT_DOCUMENT_LIMITS = Object.freeze({
  maxParagraphs: 4096,
  maxRuns: 65536,
  maxTextLength: 1048576,
  maxTabs: 256,
  maxNodes: 300000,
  maxBytes: 8388608,
  maxDepth: 24,
})
const fail = (path) => {
  throw new TypeError(`Invalid PPTX text contract: ${path}`)
}
const string = (v) => typeof v === 'string' && v.length > 0 && v.length <= 1024
const id = (v) => string(v) && v.length <= 256
const bool = (v) => typeof v === 'boolean'
const number =
  (min, max, integer = false) =>
  (v) =>
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= min &&
    v <= max &&
    (!integer || Number.isSafeInteger(v))
const oneOf =
  (...values) =>
  (v) =>
    values.includes(v)
const emu = number(-2147483648, 2147483647, true)
const percent = number(0, 100000, true)
const array = (validate, max) => (v) => Array.isArray(v) && v.length <= max && v.every(validate)
function record(value, fields, required = []) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => Object.hasOwn(fields, key) && fields[key](value[key]))
  )
}
// Same descriptor/plain-object boundary as education/plugin-message-contract:
// reject accessors, symbols, special prototypes, holes, cycles and magic keys.
function cloneTextData(input) {
  return cloneTextDataCore(input, false)
}
// Internal owned handoff: public normalizers always allocate detached output.
const ownedTextReceipts = new WeakMap()
const ownedDocumentReceipts = new WeakMap()
const textBudgetKey = () => `text-contract-v1:${Object.values(TEXT_DOCUMENT_LIMITS).join(':')}`
function cloneOwnedTextData(input) {
  return cloneTextDataCore(input, true)
}
function cloneTextDataCore(input, reuseOwned) {
  // Limits are mutable in tests/embedders: receipts describe one complete budget.
  const budgetKey = textBudgetKey()
  const staged = []
  const ancestors = new Set()
  let nodes = 0,
    bytes = 0
  const frames = []
  const records = reuseOwned ? getSemanticRecords() : null
  function clone(value, depth) {
    const receipt = reuseOwned && value && typeof value === 'object' && ownedTextReceipts.get(value)?.get(budgetKey)
    if (receipt) {
      nodes += receipt.nodes
      bytes += receipt.bytes
      for (const frame of frames) frame.depth = Math.max(frame.depth, depth + receipt.depth)
      if (nodes > TEXT_DOCUMENT_LIMITS.maxNodes || depth + receipt.depth > TEXT_DOCUMENT_LIMITS.maxDepth)
        fail('JSON budget')
      if (bytes > TEXT_DOCUMENT_LIMITS.maxBytes) fail('JSON bytes')
      return value
    }
    for (const frame of frames) frame.depth = Math.max(frame.depth, depth)
    if (++nodes > TEXT_DOCUMENT_LIMITS.maxNodes || depth > TEXT_DOCUMENT_LIMITS.maxDepth)
      fail('JSON budget')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      bytes += value.length * 2
      if (bytes > TEXT_DOCUMENT_LIMITS.maxBytes) fail('JSON bytes')
      return value
    }
    if (!value || typeof value !== 'object' || ancestors.has(value)) fail('plain JSON')
    const list = Array.isArray(value)
    if (Object.getPrototypeOf(value) !== (list ? Array.prototype : Object.prototype))
      fail('JSON prototype')
    const keys = Reflect.ownKeys(value).filter((key) => !(list && key === 'length'))
    if (keys.length > TEXT_DOCUMENT_LIMITS.maxRuns || (list && keys.length !== value.length))
      fail('JSON keys')
    ancestors.add(value)
    const startNodes = nodes - 1, startBytes = bytes
    const frame = { depth, omml: false }
    frames.push(frame)
    const result = list ? [] : {}
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        typeof key !== 'string' ||
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value') ||
        (list && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
      )
        fail('JSON descriptor')
      bytes += key.length * 2 + 16
      if (bytes > TEXT_DOCUMENT_LIMITS.maxBytes) fail('JSON bytes')
      // Only equation runs own the deeper OMML JSON grammar. Inspect the tag's
      // descriptor, not value.kind: a later accessor must never run during handoff.
      if (key === 'ommlDocument' && !list &&
          Object.getOwnPropertyDescriptor(value, 'kind')?.value === 'equation' &&
          descriptor.value && typeof descriptor.value === 'object') {
        if (ancestors.has(descriptor.value)) fail('plain JSON')
        for (const frame of frames) frame.omml = true
        const subtree = getOmmlDocument().cloneOmmlData(descriptor.value)
        // The safe mutable clone has its own depth budget, but every JSON value
        // and key still consumes the same aggregate text node/byte budgets.
        const measure = (node) => {
          if (++nodes > TEXT_DOCUMENT_LIMITS.maxNodes) fail('JSON budget')
          if (typeof node === 'string') bytes += node.length * 2
          if (bytes > TEXT_DOCUMENT_LIMITS.maxBytes) fail('JSON bytes')
          if (!node || typeof node !== 'object') return
          for (const [key, child] of Object.entries(node)) {
            bytes += key.length * 2 + 16
            if (bytes > TEXT_DOCUMENT_LIMITS.maxBytes) fail('JSON bytes')
            measure(child)
          }
        }
        measure(subtree)
        if (reuseOwned) {
          const freeze = (node) => {
            if (!node || typeof node !== 'object') return
            for (const child of Object.values(node)) freeze(child)
            Object.freeze(node)
          }
          freeze(subtree)
        }
        result[key] = subtree
      } else {
        result[key] = clone(descriptor.value, depth + 1)
      }
    }
    ancestors.delete(value)
    frames.pop()
    if (reuseOwned) {
      Object.freeze(result)
      if (!frame.omml) {
        const receipt = { nodes: nodes - startNodes, bytes: bytes - startBytes, depth: frame.depth - depth }
        staged.push([result, receipt])
        // Only checked allocations, never merely frozen caller objects, qualify.
        if (records.isCheckedImmutableSemanticValue(value) ||
            records.isOwnedDecodedSemanticValue(value))
          staged.push([value, receipt])
      }
    }
    return result
  }
  const result = clone(input, 0)
  // A failed aggregate clone publishes no partial producer receipts.
  for (const [value, receipt] of staged) {
    let budgets = ownedTextReceipts.get(value)
    if (!budgets) ownedTextReceipts.set(value, budgets = new Map())
    budgets.set(budgetKey, receipt)
  }
  return result
}
const font = (v) =>
  record(
    v,
    {
      typeface: string,
      script: (s) => /^[A-Z][a-z]{3}$/.test(s),
      panose: (s) => typeof s === 'string' && s.length === 20 && /^[\da-fA-F]{20}$/.test(s),
      pitchFamily: oneOf(0, 1, 2, 16, 17, 18, 32, 33, 34, 48, 49, 50, 64, 65, 66, 80, 81, 82),
      charset: number(-128, 127, true),
    },
    ['typeface']
  )
const spacing = (v) =>
  record(
    v,
    {
      unit: oneOf('points', 'percent'),
      value: number(0, 20116800),
    },
    ['unit', 'value']
  ) &&
  (v.unit !== 'percent' || Number.isSafeInteger(v.value))
const color = (v) =>
  record(
    v,
    {
      kind: oneOf('srgb', 'scheme', 'preset'),
      value: string,
      transforms: array(
        (t) =>
          record(
            t,
            {
              kind: oneOf('tint', 'shade', 'lumMod', 'lumOff', 'alpha', 'alphaMod', 'alphaOff'),
              value: number(-100000, 1000000, true),
            },
            ['kind', 'value']
          ) &&
          (['lumOff', 'alphaOff'].includes(t.kind) ||
            (t.value >= 0 &&
              (['tint', 'shade', 'alpha'].includes(t.kind) ? t.value <= 100000 : true))),
        32
      ),
    },
    ['kind', 'value']
  ) &&
  (v.kind === 'srgb'
    ? /^[\da-fA-F]{6}$/.test(v.value)
    : v.kind === 'preset'
      ? getGeometryColor().isGeometryColorValue('preset', v.value)
      : /^(dk[12]|lt[12]|bg[12]|tx[12]|accent[1-6]|hlink|folHlink|phClr)$/.test(v.value))
const numbering = oneOf(
  'alphaLcParenBoth',
  'alphaUcParenBoth',
  'alphaLcParenR',
  'alphaUcParenR',
  'alphaLcPeriod',
  'alphaUcPeriod',
  'arabicParenBoth',
  'arabicParenR',
  'arabicPeriod',
  'arabicPlain',
  'romanLcParenBoth',
  'romanUcParenBoth',
  'romanLcParenR',
  'romanUcParenR',
  'romanLcPeriod',
  'romanUcPeriod',
  'circleNumDbPlain',
  'circleNumWdBlackPlain',
  'circleNumWdWhitePlain',
  'arabicDbPeriod',
  'arabicDbPlain',
  'ea1ChsPeriod',
  'ea1ChsPlain',
  'ea1ChtPeriod',
  'ea1ChtPlain',
  'ea1JpnChsDbPeriod',
  'ea1JpnKorPlain',
  'ea1JpnKorPeriod',
  'arabic1Minus',
  'arabic2Minus',
  'hebrew2Minus',
  'thaiAlphaPeriod',
  'thaiAlphaParenR',
  'thaiAlphaParenBoth',
  'thaiNumPeriod',
  'thaiNumParenR',
  'thaiNumParenBoth',
  'hindiAlphaPeriod',
  'hindiNumPeriod',
  'hindiNumParenR',
  'hindiAlpha1Period'
)
const bullet = (v) => {
  if (!v || typeof v !== 'object') return false
  if (v.kind === 'none') return record(v, { kind: oneOf('none') }, ['kind'])
  if (v.kind === 'character')
    return record(
      v,
      {
        kind: oneOf('character'),
        character: (s) => typeof s === 'string' && [...s].length === 1,
      },
      ['kind', 'character']
    )
  return record(v, { kind: oneOf('number'), scheme: numbering, startAt: number(1, 32767, true) }, [
    'kind',
    'scheme',
  ])
}
const outlineColor = (v) => {
  if (v?.kind === 'none') return record(v, { kind: oneOf('none') }, ['kind'])
  return color(v)
}
// Authored line declarations outlive any one renderer's paint capabilities.
const outlineFill = oneOf('none', 'solid')
const outlineDash = (v) => record(v, {
  kind: oneOf('preset'),
  value: (value) => Object.hasOwn(getGeometryDocument().PRESET_DASH_PATTERNS, value),
}, ['kind', 'value'])
const outline = (v) => {
  if (!record(v, {
    color: outlineColor,
    width: number(0, 20116800, true),
    fill: outlineFill,
    dash: outlineDash,
    // Glyph contours are closed: caps never introduce open line endpoints.
    cap: oneOf('flat', 'rnd', 'sq'),
    compound: oneOf('sng'),
    alignment: oneOf('ctr'),
    join: (j) => record(j, {
      kind: oneOf('round', 'bevel', 'miter'), limit: number(0, 2147483647, true),
    }, ['kind']) && (j.kind === 'miter' || !Object.hasOwn(j, 'limit')),
  })) return false
  if (v.fill === 'none' && v.color && v.color.kind !== 'none') return false
  if (v.fill === 'solid' && v.color?.kind === 'none') return false
  // Positive ink needs a resolved authored color; do not invent a line color.
  return !(v.width > 0 && v.fill !== 'none' && !v.color)
}
const RUN = {
  fontSizePt: number(1, 4000),
  fontLatin: font,
  fontEastAsian: font,
  fontComplexScript: font,
  fontSymbol: font,
  language: string,
  altLanguage: string,
  direction: oneOf('ltr', 'rtl'),
  bold: bool,
  italic: bool,
  kumimoji: bool,
  capitalization: oneOf('none', 'small', 'all'),
  normalizeHeight: bool,
  underline: oneOf(
    'none',
    'words',
    'sng',
    'dbl',
    'heavy',
    'dotted',
    'dottedHeavy',
    'dash',
    'dashHeavy',
    'dashLong',
    'dashLongHeavy',
    'dotDash',
    'dotDashHeavy',
    'dotDotDash',
    'dotDotDashHeavy',
    'wavy',
    'wavyHeavy',
    'wavyDbl'
  ),
  strike: oneOf('noStrike', 'sngStrike', 'dblStrike'),
  baseline: number(-100000, 100000, true),
  spacingPt: number(-4000, 4000),
  kerningPt: number(0, 4000),
  color,
  highlight: (v) => color(v) || record(v, { kind: oneOf('none') }, ['kind']),
  outline,
}
const PARAGRAPH = {
  level: number(0, 8, true),
  direction: oneOf('ltr', 'rtl'),
  alignment: oneOf('l', 'ctr', 'r', 'just', 'justLow', 'dist', 'thaiDist'),
  indentEmu: emu,
  marginLeftEmu: emu,
  marginRightEmu: emu,
  defaultTabSizeEmu: number(0, 2147483647, true),
  tabs: array(
    (t) =>
      record(t, { positionEmu: emu, alignment: oneOf('l', 'ctr', 'r', 'dec') }, ['positionEmu']),
    256
  ),
  bullet,
  bulletFont: (v) => v === 'text' || font(v),
  bulletColor: (v) => v === 'text' || color(v),
  bulletSize: (v) => v === 'text' || spacing(v),
  lineSpacing: spacing,
  spaceBefore: spacing,
  spaceAfter: spacing,
  fontAlignment: oneOf('auto', 't', 'ctr', 'base', 'b'),
  hangingPunctuation: bool,
  latinLineBreak: bool,
  eastAsianLineBreak: bool,
}
const BODY = {
  insetLeftEmu: emu,
  insetRightEmu: emu,
  insetTopEmu: emu,
  insetBottomEmu: emu,
  verticalAlign: oneOf('t', 'ctr', 'b', 'just', 'dist'),
  anchorCenter: bool,
  verticalText: oneOf(
    'horz',
    'vert',
    'vert270',
    'wordArtVert',
    'eaVert',
    'mongolianVert',
    'wordArtVertRtl'
  ),
  rotation: emu,
  wrap: bool,
  spaceFirstLastParagraph: bool,
  rtlColumns: bool,
  columnCount: number(1, 16, true),
  compatibleLineSpacing: bool,
  presetTextWarp: oneOf('textNoShape'),
  upright: bool,
  autofit: (v) =>
    record(
      v,
      { mode: oneOf('none', 'shape', 'normal'), fontScale: percent, lineSpaceReduction: percent },
      ['mode']
    ) &&
    (v.mode === 'normal' ||
      (!Object.hasOwn(v, 'fontScale') && !Object.hasOwn(v, 'lineSpaceReduction'))),
}
const TEXT_PROPERTY_SCOPES = Object.freeze({
  run: Object.freeze(Object.keys(RUN)),
  paragraph: Object.freeze(Object.keys(PARAGRAPH)),
  body: Object.freeze(Object.keys(BODY)),
})
const ownedPropertyScopes = new WeakMap()
function validProperties(value, scope) {
  return record(value, scope === 'run' ? RUN : scope === 'paragraph' ? PARAGRAPH : BODY)
}
function normalizeTextProperties(input, scope) {
  const value = cloneTextData(input)
  if (scope !== undefined && !Object.hasOwn(TEXT_PROPERTY_SCOPES, scope)) fail('property scope')
  if (
    scope ? !validProperties(value, scope) : !record(value, Object.assign({}, RUN, PARAGRAPH, BODY))
  )
    fail('properties')
  return value
}
function validateOwnedTextProperties(input, scope) {
  if (scope !== undefined && !Object.hasOwn(TEXT_PROPERTY_SCOPES, scope)) fail('property scope')
  const owned = ownedTextReceipts.get(input)?.has(textBudgetKey())
  if (owned && ownedPropertyScopes.get(input)?.has(scope)) return input
  const value = owned ? input : cloneOwnedTextData(input)
  if (scope ? !validProperties(value, scope) : !record(value, Object.assign({}, RUN, PARAGRAPH, BODY)))
    fail('properties')
  const scopes = ownedPropertyScopes.get(value) ?? new Set()
  scopes.add(scope)
  ownedPropertyScopes.set(value, scopes)
  return value
}
function normalizeTextDocument(input) {
  return validateTextDocument(cloneTextData(input))
}
// Internal immutable handoff. JSON ownership and successful schema validation
// are separate receipts; neither raw freezing nor producer identity is proof.
function normalizeOwnedTextDocument(input) {
  const cloned = cloneOwnedTextData(input)
  const key = textBudgetKey()
  const value = ownedTextReceipts.get(input)?.has(key) ? input : cloned
  if (!ownedDocumentReceipts.get(value)?.has(key)) {
    validateTextDocument(value)
    const receipts = ownedDocumentReceipts.get(value) ?? new Set()
    receipts.add(key)
    ownedDocumentReceipts.set(value, receipts)
  }
  return value
}
function validateTextDocument(value) {
  const ids = new Set()
  let runCount = 0,
    textLength = 0
  const component = (v) => {
    if (!id(v) || ids.has(v)) return false
    ids.add(v)
    return true
  }
  const text = (v) =>
    typeof v === 'string' && (textLength += v.length) <= TEXT_DOCUMENT_LIMITS.maxTextLength
  const proofing = (p) => record(p, { smtClean: bool, dirty: bool, err: bool, noProof: bool }) && Object.keys(p).length > 0
  const equation = (document) => {
    getOmmlDocument().normalizeOmmlDocument(document)
    const visit = (node) => component(node.componentId) &&
      (node.text === undefined || text(node.text)) && node.children.every(visit)
    return visit(document.root)
  }
  const run = (v) =>
    record(
      v,
      {
        componentId: component,
        kind: oneOf('text', 'break', 'field', 'equation'),
        text,
        properties: (p) => validProperties(p, 'run'),
        // Authored run-local metadata, deliberately outside inherited visual RUN.
        proofing,
        hyperlinks: (links) => validRunHyperlinks(links, id),
        field: (f) => record(f, { id: string, type: string }, ['id', 'type']),
        ommlDocument: equation,
      },
      ['componentId', 'kind']
    ) &&
    ++runCount <= TEXT_DOCUMENT_LIMITS.maxRuns &&
    (v.kind === 'equation'
      ? Object.hasOwn(v, 'ommlDocument') && !Object.hasOwn(v, 'text') && !Object.hasOwn(v, 'field')
      : !Object.hasOwn(v, 'ommlDocument') && (v.kind === 'break'
        ? !Object.hasOwn(v, 'text') && !Object.hasOwn(v, 'field')
        : Object.hasOwn(v, 'text') &&
          (v.kind === 'field' ? Object.hasOwn(v, 'field') : !Object.hasOwn(v, 'field'))))
  const paragraph = (v) =>
    record(
      v,
      {
        componentId: component,
        properties: (p) => validProperties(p, 'paragraph'),
        defaultRunProperties: (p) => validProperties(p, 'run'),
        endRunProperties: (p) => validProperties(p, 'run'),
        endRunProofing: proofing,
        runs: array(run, TEXT_DOCUMENT_LIMITS.maxRuns),
      },
      ['componentId', 'runs']
    )
  if (
    !record(
      value,
      {
        schemaVersion: (v) => v === 1,
        componentId: component,
        body: (b) => validProperties(b, 'body'),
        paragraphs: array(paragraph, TEXT_DOCUMENT_LIMITS.maxParagraphs),
      },
      ['schemaVersion', 'componentId', 'paragraphs']
    )
  )
    fail('document schema, component IDs or text budget')
  return value
}
const location = (v) => record(v, { part: string, path: string }, ['part', 'path'])
// Evidence is supplied by a trusted caller, never discovered or promoted here.
// OpenType OS/2 fsType: https://learn.microsoft.com/en-us/typography/opentype/spec/os2#fstype
function evaluateFontProfile(input) {
  const data = cloneTextData(input)
  if (!record(data, { profile: () => true, requests: () => true }, ['profile', 'requests']))
    fail('font input')
  const { profile, requests } = data
  const ids = new Set()
  const embedding = (v) =>
    record(
      v,
      {
        fsType: number(0, 65535, true),
        rights: oneOf('installable', 'restricted', 'previewPrint', 'editable'),
        extractionAllowed: bool,
        subset: bool,
      },
      ['fsType', 'rights', 'extractionAllowed', 'subset']
    ) &&
    (v.fsType & ~0x30e) === 0 &&
    { 0: 'installable', 2: 'restricted', 4: 'previewPrint', 8: 'editable' }[v.fsType & 15] ===
      v.rights
  const face = (v) =>
    record(
      v,
      {
        id: (s) => {
          if (!id(s) || ids.has(s)) return false
          ids.add(s)
          return true
        },
        typeface: string,
        bold: bool,
        italic: bool,
        substituteFor: string,
        assetHash: (s) => typeof s === 'string' && /^[a-fA-F0-9]{64}$/.test(s),
        installedFaceEvidence: (e) =>
          record(e, { platform: string, postscriptName: string, version: string, evidenceId: id }, [
            'platform',
            'postscriptName',
            'version',
            'evidenceId',
          ]),
        embedded: embedding,
      },
      ['id', 'typeface']
    ) &&
    (!v.embedded || Object.hasOwn(v, 'assetHash'))
  if (
    !record(profile, { schemaVersion: (v) => v === 1, faces: array(face, 4096) }, [
      'schemaVersion',
      'faces',
    ]) ||
    !array(
      (r) =>
        record(r, { typeface: string, bold: bool, italic: bool, source: location }, [
          'typeface',
          'source',
        ]),
      65536
    )(requests)
  )
    fail('font profile or requests')
  const results = requests.map((request) => {
    const matching = profile.faces.filter(
      (f) =>
        (f.bold ?? false) === (request.bold ?? false) &&
        (f.italic ?? false) === (request.italic ?? false)
    )
    const exact = matching.filter((f) => f.typeface === request.typeface && !f.substituteFor)
    const candidates = exact.length
      ? exact
      : matching.filter((f) => f.substituteFor === request.typeface)
    const selected = candidates.length === 1 ? candidates[0] : null
    const embedded = selected?.embedded
    const extractionAllowed =
      !!embedded &&
      embedded.extractionAllowed &&
      [0, 8].includes(embedded.fsType & 15) &&
      !(embedded.fsType & 0x200) &&
      !(embedded.subset && embedded.fsType & 0x100)
    const evidenced = !!(selected?.assetHash || selected?.installedFaceEvidence)
    const status =
      candidates.length > 1
        ? 'ambiguous'
        : !evidenced
          ? 'missing'
          : embedded && !extractionAllowed
            ? 'blocked'
            : selected.substituteFor
              ? 'substituted'
              : 'available'
    return {
      typeface: request.typeface,
      source: request.source,
      faceId: selected?.id ?? null,
      status,
      metricsQualified: status === 'available',
      extractionAllowed,
      evidence: selected,
      unsupportedReason: status === 'available' ? null : `font-${status}`,
    }
  })
  return { qualified: results.every((r) => r.metricsQualified), results }
}
module.exports = {
  TEXT_DOCUMENT_LIMITS,
  TEXT_PROPERTY_SCOPES,
  cloneTextData,
  cloneOwnedTextData,
  validateOwnedTextProperties,
  normalizeTextProperties,
  normalizeTextDocument,
  normalizeOwnedTextDocument,
  evaluateFontProfile,
}
