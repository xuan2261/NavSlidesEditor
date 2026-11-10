const { decodeXml } = require('./pptx-xml-entities')
const P = new Set(['http://schemas.openxmlformats.org/presentationml/2006/main',
  'http://purl.oclc.org/ooxml/presentationml/main'])
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
const fail = detail => { throw new TypeError(`Invalid PPTX transition: ${detail}`) }
const namePattern = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/u
const localName = name => name.split(':').at(-1)
const namespace = (name, bindings, attribute = false) => name.includes(':')
  ? bindings[name.split(':')[0]] : attribute ? null : bindings[''] || null

// Deliberately limited XML grammar. Comments, PI, DTD and mixed text are not
// transition semantics and fail closed instead of disappearing in projection.
function parseTransitionXml(xml, inherited) {
  if (typeof xml !== 'string' || !xml.length || xml.length > 65536 || /<!|<\?/u.test(xml)) fail('XML budget or markup')
  if (!inherited || typeof inherited !== 'object' || Array.isArray(inherited) || Object.keys(inherited).length > 64)
    fail('namespace bindings')
  for (const [prefix, uri] of Object.entries(inherited))
    if ((prefix && !/^[A-Za-z_][\w.-]*$/u.test(prefix)) || typeof uri !== 'string' || !uri.length || uri.length > 2048)
      fail('namespace binding')
  const roots = [], stack = []
  let cursor = 0, count = 0
  while (cursor < xml.length) {
    const match = /^\s*(<\/?[A-Za-z_][\w.:-]*(?:\s+(?:[^<>"']|"[^"]*"|'[^']*')*)?\s*\/?>)/u.exec(xml.slice(cursor))
    if (!match) fail('XML token')
    cursor += match[0].length
    const token = match[1]
    if (token.startsWith('</')) {
      const name = token.slice(2, -1).trim()
      if (!namePattern.test(name) || stack.pop()?.qualifiedName !== name) fail('XML closing tag')
      continue
    }
    const head = /^<([^\s/>]+)/u.exec(token)[1]
    if (!namePattern.test(head)) fail('XML name')
    const empty = /\/>$/u.test(token)
    const body = token.slice(head.length + 1, empty ? -2 : -1)
    const attributes = [], names = new Set()
    let rest = body
    while (rest.trim()) {
      const found = /^\s+([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/u.exec(rest)
      if (!found || !namePattern.test(found[1]) || names.has(found[1])) fail('XML attribute')
      const value = decodeXml(found[2] ?? found[3])
      if (value === null || /</u.test(found[2] ?? found[3])) fail('XML attribute value')
      names.add(found[1]); attributes.push({ qualifiedName: found[1], name: localName(found[1]), value })
      rest = rest.slice(found[0].length)
    }
    const parent = stack.at(-1)
    const bindings = Object.assign(Object.create(null), parent?.bindings || inherited)
    for (const entry of attributes) {
      if (entry.qualifiedName === 'xmlns') bindings[''] = entry.value
      else if (entry.qualifiedName.startsWith('xmlns:')) bindings[entry.name] = entry.value
    }
    const uri = namespace(head, bindings)
    if (!uri || ++count > 128 || stack.length > 16) fail('namespace or tree budget')
    const expanded = new Set()
    for (const entry of attributes) {
      entry.namespace = entry.qualifiedName === 'xmlns' || entry.qualifiedName.startsWith('xmlns:')
        ? 'http://www.w3.org/2000/xmlns/' : namespace(entry.qualifiedName, bindings, true)
      if (entry.qualifiedName.includes(':') && !entry.namespace) fail('unbound attribute namespace')
      const key = `${entry.namespace || ''}#${entry.name}`
      if (expanded.has(key)) fail('duplicate expanded attribute')
      expanded.add(key)
    }
    const children = parent ? parent.children : roots
    const node = { qualifiedName: head, name: localName(head), namespace: uri, bindings, attributes,
      path: parent ? [...parent.path, children.length] : [], children: [] }
    children.push(node)
    if (!empty) stack.push(node)
  }
  if (stack.length || roots.length !== 1) fail('XML root')
  return roots[0]
}
const attributes = node => node.attributes.filter(entry => entry.namespace !== 'http://www.w3.org/2000/xmlns/')
module.exports = { P, MC, P14, fail, parseTransitionXml, attributes }
