const JSZip = require('jszip')
const { createHash } = require('node:crypto')
const { parseRawEntries, resolveTarget } = require('./package-store/raw-zip')
const { relationshipPart } = require('./slide-order')
const { parseXml, attr, decodeXml, textContent } = require('./ooxml-text-run-xml')
const S = new Set([
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  'http://purl.oclc.org/ooxml/spreadsheetml/main',
])
const R = [
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
]
const OPC = 'http://schemas.openxmlformats.org/package/2006/relationships'
const get = (node, name) => decodeXml(attr(node, name) || '')
const reject = (message) => {
  throw new Error(`Workbook ${message}`)
}
function nodes(node, name) {
  return node.children.filter((n) => S.has(n.uri) && n.local === name)
}
function one(node, name, required = false) {
  const found = nodes(node, name)
  if (found.length > 1 || (required && !found.length)) reject(`missing/ambiguous ${name}`)
  return found[0]
}
function uint(raw, max = 2147483647) {
  if (!/^(0|[1-9]\d*)$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max)
    reject('invalid integer')
  return Number(raw)
}
function attributes(node) {
  return Object.fromEntries(
    node.attrs.filter((a) => !a.name.startsWith('xmlns')).map((a) => [a.name, get(node, a.name)])
  )
}
function richText(state, node) {
  if (
    node.children.some((n) => !S.has(n.uri) || !['t', 'r', 'rPh', 'phoneticPr'].includes(n.local))
  )
    reject('unsupported string structure')
  const direct = nodes(node, 't')
  const runs = nodes(node, 'r')
  if (direct.length > 1 || (direct.length && runs.length)) reject('ambiguous string')
  return [...direct, ...runs.map((r) => one(r, 't', true))]
    .map((t) => textContent(state.xml, t))
    .join('')
    .replace(/_x([0-9a-fA-F]{4})_/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
}
async function openWorkbook(bytes) {
  if (bytes.length > 8388608) reject('archive budget exceeded')
  const entries = parseRawEntries(bytes)
  if (
    entries.length > 4096 ||
    entries.some((e) => e.encrypted || e.uncompressedSize > 8388608) ||
    entries.reduce((n, e) => n + e.uncompressedSize, 0) > 33554432
  )
    reject('archive budget exceeded')
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
  const states = new Map(),
    parts = []
  async function load(partUri) {
    if (states.has(partUri)) return states.get(partUri)
    const file = zip.file(partUri)
    if (!file) reject(`missing part ${partUri}`)
    const data = await file.async('nodebuffer')
    if (data.length > 8388608) reject('part budget exceeded')
    const xml = data.toString('utf8'),
      roots = parseXml(xml)
    if (roots.length !== 1) reject('ambiguous XML root')
    const preconditionHash = createHash('sha256').update(data).digest('hex')
    const paths = new Map()
    let count = 0
    function visit(n, path) {
      if (++count > 200000 || path.length > 64) reject('XML budget exceeded')
      if (new Set(n.attrs.map((a) => a.name)).size !== n.attrs.length) reject('duplicate attribute')
      paths.set(n, path)
      n.children.forEach((child, i) => visit(child, [...path, i]))
    }
    visit(roots[0], [0])
    const state = {
      xml,
      root: roots[0],
      source: (n) => ({ partUri, preconditionHash, path: paths.get(n) }),
    }
    states.set(partUri, state)
    parts.push({ partUri, preconditionHash })
    return state
  }
  async function relationships(partUri) {
    const state = await load(partUri === '/' ? '_rels/.rels' : relationshipPart(partUri))
    if (state.root.uri !== OPC || state.root.local !== 'Relationships')
      reject('invalid relationship root')
    const ids = new Set()
    return state.root.children.map((n) => {
      const id = get(n, 'Id'),
        type = get(n, 'Type'),
        mode = get(n, 'TargetMode')
      if (
        n.uri !== OPC ||
        n.local !== 'Relationship' ||
        !id ||
        ids.has(id) ||
        !type ||
        !get(n, 'Target') ||
        (mode && !['Internal', 'External'].includes(mode))
      )
        reject('invalid relationship')
      ids.add(id)
      const external = mode === 'External'
      return {
        id,
        type,
        external,
        target: external ? get(n, 'Target') : resolveTarget(partUri, get(n, 'Target')),
        source: state.source(n),
      }
    })
  }
  function relation(rels, type, id) {
    const matches = rels.filter(
      (r) => R.some((prefix) => r.type === `${prefix}/${type}`) && (id === undefined || r.id === id)
    )
    if (matches.length !== 1) reject(`missing/ambiguous ${type} relationship`)
    if (matches[0].external) reject(`external ${type} fetch denied`)
    return matches[0]
  }
  function rid(n) {
    const refs = n.attrs.filter((a) => {
      const [prefix, local] = a.name.split(':')
      return local === 'id' && R.includes(n.namespaces[prefix])
    })
    if (refs.length !== 1) reject('missing/ambiguous relationship id')
    return get(n, refs[0].name)
  }
  return { load, relationships, relation, rid, parts }
}
module.exports = { openWorkbook, nodes, one, get, uint, attributes, richText, reject, S, R }
