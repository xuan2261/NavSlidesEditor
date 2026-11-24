const { resolveFontTypeface } = require('./pptx-style-resolution')

function validateChartVisual(value, kind) {
  const fail = () => {
    throw new TypeError(`Invalid PPTX chart ${kind}`)
  }
  function object(v, keys) {
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      Object.keys(v).some((k) => !keys.includes(k))
    )
      fail()
  }
  function color(v) {
    if (typeof v !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(v)) fail()
  }
  function fill(v) {
    object(v, ['kind', 'color', 'scheme'])
    if (v.kind === 'none') {
      if (Object.keys(v).length !== 1) fail()
    } else if (v.kind === 'solid') {
      if (Object.keys(v).length !== 2 || !!v.color === !!v.scheme) fail()
      if (v.color) color(v.color)
      if (
        v.scheme &&
        !/^(?:accent[1-6]|dk[12]|lt[12]|tx[12]|bg[12]|hlink|folHlink)$/.test(v.scheme)
      )
        fail()
    } else fail()
  }
  if (kind === 'paint') {
    object(value, ['fill', 'line'])
    if (value.fill) fill(value.fill)
    if (value.line) {
      object(value.line, ['fill', 'widthEmu', 'cap', 'dash', 'join'])
      const l = value.line
      if (l.fill) fill(l.fill)
      if (
        'widthEmu' in l &&
        (!Number.isSafeInteger(l.widthEmu) || l.widthEmu < 0 || l.widthEmu > 20116800)
      )
        fail()
      if ('cap' in l && !['flat', 'rnd', 'sq'].includes(l.cap)) fail()
      if (
        'dash' in l &&
        ![
          'solid',
          'dash',
          'dot',
          'dashDot',
          'lgDash',
          'lgDashDot',
          'lgDashDotDot',
          'sysDash',
          'sysDot',
          'sysDashDot',
          'sysDashDotDot',
        ].includes(l.dash)
      )
        fail()
      if ('join' in l && !['round', 'bevel'].includes(l.join)) fail()
    }
  } else if (kind === 'textStyle') {
    object(value, ['fontFamily', 'fontSizePt', 'bold', 'italic', 'color', 'language'])
    if (
      'fontFamily' in value &&
      (typeof value.fontFamily !== 'string' ||
        !value.fontFamily.trim() ||
        value.fontFamily.length > 256)
    )
      fail()
    if (
      'fontSizePt' in value &&
      (!Number.isFinite(value.fontSizePt) || value.fontSizePt <= 0 || value.fontSizePt > 4000)
    )
      fail()
    for (const key of ['bold', 'italic'])
      if (key in value && typeof value[key] !== 'boolean') fail()
    if ('color' in value) color(value.color)
    if (
      'language' in value &&
      (typeof value.language !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(value.language))
    )
      fail()
  } else fail()
}
function chartTextStyle(document, ...styles) {
  return Object.assign({}, document.textStyle, ...styles)
}
function resolvedChartTextStyle(document, theme, ...styles) {
  const style = chartTextStyle(document, ...styles)
  if (style.fontFamily === undefined) return { style, reason: null }
  const font = resolveFontTypeface({ typeface: style.fontFamily }, theme)
  return { style: { ...style, fontFamily: font.value }, reason: font.reason }
}
module.exports = { validateChartVisual, chartTextStyle, resolvedChartTextStyle }
