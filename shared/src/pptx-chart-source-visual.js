// Strict DrawingML subset shared by the relationship-bound chart reader.
// Unknown paints, effects and text properties are never silently approximated.
function chartVisualReader({ attr, decodeXml, textContent, xml, fail, component }) {
  const A = new Set(['http://schemas.openxmlformats.org/drawingml/2006/main', 'http://purl.oclc.org/ooxml/drawingml/main'])
  const val = (n, key = 'val') => decodeXml(attr(n, key) || '')
  function attrs(n, names = []) {
    if (n.attrs.some(a => !a.name.startsWith('xmlns') && !names.includes(a.name)))
      fail('unsupported visual attribute', n)
  }
  function children(n, names, repeats = []) {
    const seen = new Set()
    for (const c of n.children) {
      if (!A.has(c.uri) || !names.includes(c.local) || (seen.has(c.local) && !repeats.includes(c.local)))
        fail('unsupported visual child', c)
      seen.add(c.local)
    }
    if (!n.selfClosing) {
      let cursor = n.end + 1
      for (const c of n.children) {
        if (xml.slice(cursor, c.start).trim()) fail('unexpected visual text', n)
        cursor = c.closeEnd + 1
      }
      if (xml.slice(cursor, n.closeStart).trim()) fail('unexpected visual text', n)
    }
  }
  const one = (n, name) => n.children.find(c => c.local === name)
  function empty(n) { attrs(n); children(n, []) }
  function fill(n) {
    attrs(n)
    if (n.local === 'noFill') { empty(n); return { kind: 'none' } }
    children(n, ['srgbClr', 'schemeClr'])
    if (n.children.length !== 1) fail('ambiguous visual fill', n)
    const c = n.children[0]
    attrs(c, ['val'])
    if (c.children.length) fail('unsupported color transform', c)
    return { kind: 'solid', [c.local === 'srgbClr' ? 'color' : 'scheme']: val(c) }
  }
  function paint(n) {
    attrs(n)
    children(n, ['noFill', 'solidFill', 'ln', 'effectLst'])
    if (one(n, 'noFill') && one(n, 'solidFill')) fail('ambiguous fill', n)
    const result = {}, f = one(n, 'noFill') || one(n, 'solidFill')
    if (f) result.fill = fill(f)
    const l = one(n, 'ln')
    if (l) {
      attrs(l, ['w', 'cap'])
      children(l, ['noFill', 'solidFill', 'prstDash', 'round', 'bevel'])
      if ((one(l, 'noFill') && one(l, 'solidFill')) || (one(l, 'round') && one(l, 'bevel')))
        fail('ambiguous line paint', l)
      const line = {}, lf = one(l, 'noFill') || one(l, 'solidFill')
      if (lf) line.fill = fill(lf)
      if (attr(l, 'w') !== null) {
        if (!/^\d+$/.test(val(l, 'w'))) fail('invalid line width', l)
        line.widthEmu = Number(val(l, 'w'))
      }
      if (attr(l, 'cap') !== null) line.cap = val(l, 'cap')
      if (one(l, 'prstDash')) {
        const dash = one(l, 'prstDash'); attrs(dash, ['val'])
        if (dash.children.length) fail('unsupported line dash', dash)
        line.dash = val(dash)
      }
      for (const join of ['round', 'bevel']) if (one(l, join)) {
        empty(one(l, join)); line.join = join
      }
      result.line = line
    }
    if (one(n, 'effectLst')) empty(one(n, 'effectLst'))
    return result
  }
  function runStyle(n) {
    if (!n) return {}
    attrs(n, ['sz', 'b', 'i', 'u', 'strike', 'lang'])
    children(n, ['solidFill', 'latin'])
    if (attr(n, 'u') !== null && val(n, 'u') !== 'none') fail('unsupported chart underline', n)
    if (attr(n, 'strike') !== null && val(n, 'strike') !== 'noStrike') fail('unsupported chart strike', n)
    const style = {}
    if (attr(n, 'lang') !== null) style.language = val(n, 'lang')
    if (attr(n, 'sz') !== null) {
      if (!/^\d+$/.test(val(n, 'sz'))) fail('invalid text size', n)
      style.fontSizePt = Number(val(n, 'sz')) / 100
    }
    for (const [key, name] of [['b', 'bold'], ['i', 'italic']]) if (attr(n, key) !== null) {
      if (!['0', '1', 'true', 'false'].includes(val(n, key))) fail('invalid text boolean', n)
      style[name] = ['1', 'true'].includes(val(n, key))
    }
    const latin = one(n, 'latin')
    if (latin) { attrs(latin, ['typeface']); if (latin.children.length) fail('invalid latin face', latin); style.fontFamily = val(latin, 'typeface') }
    if (one(n, 'solidFill')) {
      const f = fill(one(n, 'solidFill'))
      if (!f.color) fail('unresolved chart text scheme color', n)
      style.color = f.color
    }
    return style
  }
  function text(n, rich = false) {
    attrs(n); children(n, ['bodyPr', 'lstStyle', 'p'], ['p'])
    for (const name of ['bodyPr', 'lstStyle']) if (one(n, name)) empty(one(n, name))
    const paragraphs = n.children.filter(c => c.local === 'p')
    if (paragraphs.length !== 1) fail('unsupported multi-paragraph chart text', n)
    const p = paragraphs[0]
    component(p, 'paragraph')
    attrs(p); children(p, ['pPr', 'r', 'endParaRPr'], ['r'])
    const pp = one(p, 'pPr')
    if (pp) { attrs(pp); children(pp, ['defRPr']) }
    const defaults = runStyle(pp && one(pp, 'defRPr'))
    let style = defaults, content = '', hasRun = false
    if (one(p, 'endParaRPr')) runStyle(one(p, 'endParaRPr'))
    for (const r of p.children.filter(c => c.local === 'r')) {
      component(r, 'text-run')
      attrs(r); children(r, ['rPr', 't'])
      const t = one(r, 't')
      if (!t || t.children.length) fail('missing chart text', r)
      attrs(t, ['xml:space'])
      const effective = { ...defaults, ...runStyle(one(r, 'rPr')) }
      if (hasRun && Object.keys({ ...effective, ...style }).some(k => effective[k] !== style[k]))
        fail('unsupported mixed chart text styles', r)
      style = effective
      hasRun = true
      content += textContent(xml, t)
    }
    if (!rich && content) fail('unexpected text in chart text defaults', n)
    return rich ? { kind: 'text', value: content, textStyle: style } : style
  }
  return { paint, text }
}
module.exports = { chartVisualReader }
