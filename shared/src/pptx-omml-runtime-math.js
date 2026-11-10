// OpenType MATH constants, in native design units. No layout spacing is invented.
const values = ('mathLeading axisHeight accentBaseHeight flattenedAccentBaseHeight ' +
  'subscriptShiftDown subscriptTopMax subscriptBaselineDropMin superscriptShiftUp ' +
  'superscriptShiftUpCramped superscriptBottomMin superscriptBaselineDropMax ' +
  'subSuperscriptGapMin superscriptBottomMaxWithSubscript spaceAfterScript ' +
  'upperLimitGapMin upperLimitBaselineRiseMin lowerLimitGapMin lowerLimitBaselineDropMin ' +
  'stackTopShiftUp stackTopDisplayStyleShiftUp stackBottomShiftDown stackBottomDisplayStyleShiftDown ' +
  'stackGapMin stackDisplayStyleGapMin stretchStackTopShiftUp stretchStackBottomShiftDown ' +
  'stretchStackGapAboveMin stretchStackGapBelowMin fractionNumeratorShiftUp ' +
  'fractionNumeratorDisplayStyleShiftUp fractionDenominatorShiftDown fractionDenominatorDisplayStyleShiftUp ' +
  'fractionNumeratorGapMin fractionNumDisplayStyleGapMin fractionRuleThickness ' +
  'fractionDenominatorGapMin fractionDenomDisplayStyleGapMin skewedFractionHorizontalGap ' +
  'skewedFractionVerticalGap overbarVerticalGap overbarRuleThickness overbarExtraAscender ' +
  'underbarVerticalGap underbarRuleThickness underbarExtraDescender radicalVerticalGap ' +
  'radicalDisplayStyleVerticalGap radicalRuleThickness radicalExtraAscender ' +
  'radicalKernBeforeDegree radicalKernAfterDegree').split(' ')
function readOmmlMathConstants(bytes) {
  const fail = (detail) => { throw new TypeError(`Unsupported OMML font MATH: ${detail}`) }
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 33554432) fail('SFNT bytes')
  const v = new DataView(bytes)
  const u16 = (at) => {
    if (at < 0 || at + 2 > v.byteLength) fail('truncated table')
    return v.getUint16(at)
  }
  const u32 = (at) => {
    if (at < 0 || at + 4 > v.byteLength) fail('truncated table')
    return v.getUint32(at)
  }
  if (![0x00010000, 0x4f54544f].includes(u32(0)) || u16(4) > 256) fail('SFNT format')
  const tables = new Map()
  for (let i = 0; i < u16(4); i++) {
    const at = 12 + i * 16, tag = u32(at), offset = u32(at + 8), length = u32(at + 12)
    if (tables.has(tag) || offset + length > bytes.byteLength) fail('table directory')
    tables.set(tag, { offset, length })
  }
  const math = tables.get(0x4d415448), head = tables.get(0x68656164)
  if (!math || math.length < 10 || !head || head.length < 54 || tables.has(0x66766172))
    fail('MATH/head table required; variable fonts unsupported')
  const unitsPerEm = u16(head.offset + 18)
  if (unitsPerEm < 16 || unitsPerEm > 16384 || u32(math.offset) !== 0x00010000)
    fail('version or unitsPerEm')
  const relative = u16(math.offset + 4), start = math.offset + relative
  if (relative < 10 || relative + 8 + values.length * 4 + 2 > math.length) fail('constants bounds')
  const result = {
    unitsPerEm, scriptPercentScaleDown: v.getInt16(start),
    scriptScriptPercentScaleDown: v.getInt16(start + 2),
    delimitedSubFormulaMinHeight: u16(start + 4), displayOperatorMinHeight: u16(start + 6),
  }
  const deviceAdjustments = {}
  function device(offset, name) {
    const at = start + offset, end = math.offset + math.length
    const invalid = () => fail(`device adjustments: ${name}`)
    if (at < start + 8 + values.length * 4 + 2 || at + 6 > end) invalid()
    const startSize = u16(at), endSize = u16(at + 2), format = u16(at + 4)
    // 0x8000 is a VariationIndex, not a packed Device table. Variable MATH
    // requires an explicit variation-instance contract and is not guessed here.
    if (![1, 2, 3].includes(format) || endSize < startSize) invalid()
    const bits = 1 << format, perWord = 16 / bits, count = endSize - startSize + 1
    if (at + 6 + 2 * Math.ceil(count / perWord) > end) invalid()
    const deltas = Array.from({ length: count }, (_, i) => {
      const word = u16(at + 6 + 2 * Math.floor(i / perWord))
      const encoded = (word >>> (16 - bits * (i % perWord + 1))) & ((1 << bits) - 1)
      return encoded >= 1 << (bits - 1) ? encoded - (1 << bits) : encoded
    })
    return Object.freeze({ startSize, endSize, deltas: Object.freeze(deltas) })
  }
  values.forEach((name, index) => {
    const at = start + 8 + index * 4
    if (u16(at + 2)) deviceAdjustments[name] = device(u16(at + 2), name)
    result[name] = v.getInt16(at)
  })
  result.radicalDegreeBottomRaisePercent = u16(start + 8 + values.length * 4)
  result.deviceAdjustments = Object.freeze(deviceAdjustments)
  return Object.freeze(result)
}
function createOmmlMathMetrics(bytes, spacing, raster) {
  const constants = readOmmlMathConstants(bytes)
  if (Object.keys(constants.deviceAdjustments).length &&
      (!Number.isFinite(raster?.devicePixelRatio) || raster.devicePixelRatio <= 0))
    throw new TypeError('OMML MATH devicePixelRatio required for device adjustments')
  const fields = ['delimiterGap', 'columnGap', 'rowGap', 'accentGap', 'radicalDegreeRaise']
  if (spacing !== undefined && fields.some((key) =>
    typeof spacing[key] !== 'function' && (!Number.isFinite(spacing[key]) || spacing[key] < 0)))
    throw new TypeError('Explicit OMML spacing policy required')
  return (style) => {
    const scale = style.fontSize / constants.unitsPerEm
    // Device deltas are signed physical pixels at the selected integer ppem,
    // not design units. Preserve native constants and add delta / DPR in CSS px.
    const ppem = Math.round(style.fontSize * raster?.devicePixelRatio)
    const px = (name) => {
      const device = constants.deviceAdjustments[name]
      const delta = device?.deltas[ppem - device.startSize] ?? 0
      return constants[name] * scale + (delta ? delta / raster.devicePixelRatio : 0)
    }
    return {
      ...Object.fromEntries(values.map((name) => [name, px(name)])),
      axisHeight: px('axisHeight'),
      ruleThickness: px('fractionRuleThickness'),
      scriptScale: constants.scriptPercentScaleDown / 100,
      scriptShiftUp: px('superscriptShiftUp'),
      scriptShiftDown: px('subscriptShiftDown'),
      scriptGap: px('subSuperscriptGapMin'),
      fractionGap: Math.max(px('fractionNumeratorGapMin'), px('fractionDenominatorGapMin')),
      limitGap: Math.max(px('upperLimitGapMin'), px('lowerLimitGapMin')),
      radicalGap: px('radicalVerticalGap'),
      ...Object.fromEntries((spacing ? fields : []).map((key) => [key, typeof spacing[key] === 'function'
        ? spacing[key](style, constants) : spacing[key]])),
    }
  }
}
module.exports = { readOmmlMathConstants, createOmmlMathMetrics }
