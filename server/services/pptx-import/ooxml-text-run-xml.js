const P_URIS = new Set([
  'http://schemas.openxmlformats.org/presentationml/2006/main',
  'http://purl.oclc.org/ooxml/presentationml/main',
])
const A_URIS = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/main',
  'http://purl.oclc.org/ooxml/drawingml/main',
])

function error(code, message) {
  const result = new Error(message)
  result.code = code
  throw result
}

function validText(value) {
  if (typeof value !== 'string') return false
  for (let index = 0; index < value.length; index += 1) {
    let point = value.charCodeAt(index)
    if (point >= 0xd800 && point <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false
      point = 0x10000 + ((point - 0xd800) * 0x400) + next - 0xdc00
      index += 1
    } else if (point >= 0xdc00 && point <= 0xdfff) return false
    if (point < 0x20 || (point >= 0xfdd0 && point <= 0xfdef) ||
        (point & 0xffff) === 0xfffe || (point & 0xffff) === 0xffff) return false
  }
  return true
}

function decodeXml(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  let output = ''
  let cursor = 0
  const matcher = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g
  for (const match of value.matchAll(matcher)) {
    if (value.slice(cursor, match.index).includes('&')) return null
    output += value.slice(cursor, match.index)
    const token = match[0].slice(1, -1)
    if (Object.prototype.hasOwnProperty.call(entities, token)) output += entities[token]
    else {
      const point = Number.parseInt(token.slice(token.startsWith('#x') ? 2 : 1), token.startsWith('#x') ? 16 : 10)
      if (!Number.isInteger(point) || point > 0x10ffff || point < 0) return null
      output += String.fromCodePoint(point)
    }
    cursor = match.index + match[0].length
  }
  return value.slice(cursor).includes('&') ? null : output + value.slice(cursor)
}

function tagEnd(xml, start) {
  let quote = null
  for (let index = start + 1; index < xml.length; index += 1) {
    const char = xml[index]
    if (quote) { if (char === quote) quote = null } else if (char === '"' || char === "'") quote = char
    else if (char === '>') return index
  }
  error('TEXT_XML_INVALID', 'Unterminated XML tag')
}

function splitName(value) {
  const match = /^([A-Za-z_][\w.-]*)(?::([A-Za-z_][\w.-]*))?$/u.exec(value)
  if (!match) error('TEXT_XML_INVALID', 'Invalid XML name')
  return { prefix: match[2] ? match[1] : '', local: match[2] || match[1] }
}

function openTag(xml, start, end, inherited) {
  const raw = xml.slice(start, end + 1)
  const body = raw.slice(1, -1).replace(/\/$/u, '').trim()
  const selfClosing = /\/\s*>$/u.test(raw)
  const nameMatch = /^([^\s/>]+)/u.exec(body)
  if (!nameMatch) error('TEXT_XML_INVALID', 'Missing XML element name')
  const attrs = []
  let cursor = nameMatch[0].length
  while (cursor < body.length) {
    const space = /^\s+/u.exec(body.slice(cursor))
    if (!space) error('TEXT_XML_INVALID', 'Malformed XML attributes')
    cursor += space[0].length
    const attrStart = cursor
    const name = /^[^\s=/>]+/u.exec(body.slice(cursor))?.[0]
    if (!name) error('TEXT_XML_INVALID', 'Missing XML attribute name')
    cursor += name.length
    if (body[cursor] !== '=') error('TEXT_XML_INVALID', 'Missing XML attribute value')
    cursor += 1
    const quote = body[cursor]
    if (quote !== '"' && quote !== "'") error('TEXT_XML_INVALID', 'Unquoted XML attribute')
    const valueStart = ++cursor
    while (cursor < body.length && body[cursor] !== quote) cursor += 1
    if (cursor === body.length) error('TEXT_XML_INVALID', 'Unterminated XML attribute')
    attrs.push({ name, value: body.slice(valueStart, cursor), start: attrStart, end: cursor + 1 })
    cursor += 1
  }
  const namespaces = Object.create(inherited || null)
  for (const attr of attrs) {
    if (attr.name === 'xmlns') namespaces[''] = attr.value
    else if (attr.name.startsWith('xmlns:')) namespaces[attr.name.slice(6)] = attr.value
  }
  const qualified = splitName(nameMatch[0])
  return { attrs, end, name: nameMatch[0], namespaces, raw, selfClosing, start, ...qualified,
    uri: namespaces[qualified.prefix] || null, children: [] }
}

function parseXml(xml) {
  const roots = []
  const stack = []
  for (let index = 0; index < xml.length;) {
    const start = xml.indexOf('<', index)
    if (start < 0) break
    if (xml.startsWith('<!--', start)) { const end = xml.indexOf('-->', start + 4); if (end < 0) error('TEXT_XML_INVALID', 'Unterminated comment'); index = end + 3; continue }
    if (xml.startsWith('<![CDATA[', start)) { const end = xml.indexOf(']]>', start + 9); if (end < 0) error('TEXT_XML_INVALID', 'Unterminated CDATA'); index = end + 3; continue }
    if (xml.startsWith('<?', start)) { const end = xml.indexOf('?>', start + 2); if (end < 0) error('TEXT_XML_INVALID', 'Unterminated processing instruction'); index = end + 2; continue }
    if (xml.startsWith('<!', start)) error('TEXT_XML_INVALID', 'Unsupported XML declaration')
    const end = tagEnd(xml, start)
    if (xml[start + 1] === '/') {
      const name = xml.slice(start + 2, end).trim()
      const node = stack.pop()
      if (!node || node.name !== name) error('TEXT_XML_INVALID', 'Mismatched XML closing tag')
      node.closeStart = start; node.closeEnd = end; index = end + 1; continue
    }
    const parent = stack[stack.length - 1]
    const node = openTag(xml, start, end, parent?.namespaces)
    if (parent) parent.children.push(node); else roots.push(node)
    if (!node.selfClosing) stack.push(node); else { node.closeStart = end + 1; node.closeEnd = end }
    index = end + 1
  }
  if (stack.length) error('TEXT_XML_INVALID', 'Unclosed XML element')
  return roots
}

function descendants(node, predicate, result = []) {
  for (const child of node.children) { if (predicate(child)) result.push(child); descendants(child, predicate, result) }
  return result
}

function isNode(node, uris, local) { return uris.has(node.uri) && node.local === local }
function attr(node, name) { return node.attrs.find((item) => item.name === name)?.value || null }

function textContent(xml, node) {
  if (node.selfClosing) return ''
  let output = ''
  for (let index = node.end + 1; index < node.closeStart;) {
    if (xml[index] !== '<') { const next = xml.indexOf('<', index); const raw = xml.slice(index, next < 0 ? node.closeStart : next); const decoded = decodeXml(raw); if (decoded === null) error('TEXT_XML_INVALID', 'Invalid XML entity'); output += decoded; index = next < 0 ? node.closeStart : next; continue }
    if (!xml.startsWith('<![CDATA[', index)) error('TEXT_SOURCE_RICH_STRUCTURE', 'Text run contains markup')
    const end = xml.indexOf(']]>', index + 9); if (end < 0) error('TEXT_XML_INVALID', 'Unterminated CDATA')
    output += xml.slice(index + 9, end); index = end + 3
  }
  return output
}

function startTag(node, text) {
  let raw = node.raw.slice(0, node.selfClosing ? -2 : -1)
  for (const item of node.attrs.filter((entry) => entry.name === 'xml:space').sort((a, b) => b.start - a.start)) {
    raw = raw.slice(0, item.start) + raw.slice(item.end + 1)
  }
  return `${raw.trimEnd()}${/^\s|\s$/u.test(text) ? ' xml:space="preserve"' : ''}>`
}

function patchPlainRun(xml, nativeId, before, after) {
  if (!/^[1-9]\d*$/u.test(nativeId) || !Number.isSafeInteger(Number(nativeId))) error('TEXT_NATIVE_ID_INVALID', 'Native id must be canonical decimal')
  const shapes = descendants({ children: parseXml(xml) }, (node) => isNode(node, P_URIS, 'sp'))
  const shape = shapes.filter((node) => descendants(node, (child) => isNode(child, P_URIS, 'cNvPr') && attr(child, 'id') === nativeId).length === 1)
  if (shape.length !== 1) error('TEXT_XML_NAMESPACE_UNSUPPORTED', 'Exact OOXML shape identity is unavailable')
  const bodies = descendants(shape[0], (node) => isNode(node, P_URIS, 'txBody'))
  const body = bodies.length === 1 ? bodies[0] : null
  const paragraphs = body?.children.filter((node) => isNode(node, A_URIS, 'p')) || []
  const paragraph = paragraphs.length === 1 ? paragraphs[0] : null
  const runs = paragraph?.children.filter((node) => isNode(node, A_URIS, 'r')) || []
  const run = runs.length === 1 ? runs[0] : null
  const texts = run?.children.filter((node) => isNode(node, A_URIS, 't')) || []
  const text = texts.length === 1 ? texts[0] : null
  const allowed = (node, names) => node.children.every((child) => names.includes(child.local) && A_URIS.has(child.uri))
  const rich = body && descendants(body, (node) => A_URIS.has(node.uri) &&
    /^(?:br|fld|tab|hlinkClick|hlinkHover|bu[A-Z])/u.test(node.local)).length > 0
  if (!body || !allowed(body, ['bodyPr', 'lstStyle', 'p']) || !paragraph ||
      !allowed(paragraph, ['pPr', 'r']) || !run || !allowed(run, ['rPr', 't']) ||
      !text || text.children.length !== 0 || rich) {
    error('TEXT_SOURCE_RUN_COUNT_INVALID', 'Source must contain one plain paragraph, run, and text node')
  }
  const source = textContent(xml, text)
  if (!validText(source) || !validText(before) || !validText(after)) error('TEXT_XML_CHARACTER_INVALID', 'Text is not XML 1.0 safe')
  if (source !== before) error('TEXT_BEFORE_MISMATCH', 'Source text does not match journal before value')
  const replacement = `${startTag(text, after)}${after.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</${text.name}>`
  const end = text.selfClosing ? text.end + 1 : text.closeEnd + 1
  const shapeXml = xml.slice(shape[0].start, shape[0].closeEnd + 1)
  const from = text.start - shape[0].start
  const to = end - shape[0].start
  const patchedShape = shapeXml.slice(0, from) + replacement + shapeXml.slice(to)
  return {
    patched: xml.slice(0, shape[0].start) + patchedShape + xml.slice(shape[0].closeEnd + 1),
    shape: shapeXml,
    patchedShape,
  }
}

module.exports = { patchPlainRun, validText }
