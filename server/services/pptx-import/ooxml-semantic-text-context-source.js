const { createHash } = require('node:crypto')
const { parseXml, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { tableSource } = require('./ooxml-semantic-table-source')
const { relationshipPart } = require('./slide-order')
const { resolveTarget } = require('./package-store/raw-zip')
const { PptxImportError } = require('./diagnostics')
const { sourceNamespace } = require('./semantic-source-slides')
const R = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const REL = new Set([
  'http://schemas.openxmlformats.org/package/2006/relationships',
  'http://purl.oclc.org/ooxml/package/relationships',
])

function contextFailure(partUri, node, path, detail) {
  const error = new PptxImportError(
    `Semantic text context ${detail}: ${partUri}#${path.join('.')}`,
    { status: 422 }
  )
  error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
  error.sourceLocation = { partUri, path, localName: node?.local }
  throw error
}
// Parsed nodes never escape into result records. Freeze only these freshly
// parsed, invocation-owned trees; caller-owned XML nodes are never cache keys.
function freezeOwned(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freezeOwned(child)
  return Object.freeze(value)
}
function createContextSourceFactory(zip, inputInventory) {
  const inventory = freezeOwned(structuredClone(inputInventory)), parsed = new Map()
  return { inventory, createSource: () => contextSourceGraph(zip, inventory, parsed) }
}
function contextSource(zip, inventory) {
  return createContextSourceFactory(zip, inventory).createSource()
}
function contextSourceGraph(zip, inventory, parsed) {
  const cache = new Map(),
    provenance = [],
    relationships = []
  async function part(partUri) {
    if (cache.has(partUri)) return cache.get(partUri)
    const records = inventory.parts.filter((p) => p.partUri === partUri)
    const file = zip.file(partUri)
    if (records.length !== 1 || !file)
      contextFailure(partUri, null, [], 'missing/ambiguous inventoried part')
    const bytes = await file.async('nodebuffer'),
      record = records[0]
    if (
      createHash('sha256').update(bytes).digest('hex') !== record.preconditionHash ||
      bytes.length !== record.byteLength
    )
      contextFailure(partUri, null, [], 'stale part')
    const xml = bytes.toString('utf8')
    let prior = parsed.get(partUri)
    if (!prior || prior.xml !== xml) {
      let roots
      try {
        roots = parseXml(xml)
      } catch {
        contextFailure(partUri, null, [], 'invalid XML')
      }
      if (roots.length !== 1) contextFailure(partUri, null, [], 'ambiguous XML root')
      freezeOwned(roots)
      const root = roots[0],
        paths = new Map(),
        nodes = new Map()
      const walk = (n, path) => {
        paths.set(n, path)
        nodes.set(path.join('.'), n)
        n.children.forEach((c, i) => walk(c, [...path, i]))
      }
      walk(root, [0])
      const definitions = inventory.definitions.filter((d) => d.partUri === partUri)
      for (const d of definitions) {
        const locator = d.componentLocators?.[0]
        let n = { children: roots }
        for (const i of locator?.path || []) n = n?.children[i]
        if (
          d.componentLocators?.length !== 1 ||
          d.preconditionHash !== record.preconditionHash ||
          locator.preconditionHash !== record.preconditionHash ||
          !n ||
          n.uri !== d.namespaceUri ||
          n.local !== d.localName ||
          nodes.has(d.id)
        )
          contextFailure(partUri, n, locator?.path || [], 'stale definition')
        nodes.set(d.id, n)
      }
      const source = {
        id: `${partUri}#text-context:0`,
        partUri,
        preconditionHash: record.preconditionHash,
        componentLocators: [{ path: [0], preconditionHash: record.preconditionHash }],
      }
      nodes.set(source.id, root)
      prior = { xml, roots, root, paths, nodes, definitions, source }
      parsed.set(partUri, prior)
    }
    const { root, paths, nodes, definitions, source } = prior
    const relFile = zip.file(relationshipPart(partUri))
    const relPart = relFile ? await part(relationshipPart(partUri)) : null
    const boundary = tableSource({ source, node: root, xml, components: definitions, nodes,
      sourceId: sourceNamespace(inventory), slideParts: new Set(inventory.slides.map((s) => s.partUri)),
      relationships: () => relPart?.root.children || [] })
    const fail = (n, detail) => contextFailure(partUri, n, paths.get(n) || [], detail)
    const one = (n, local, uris = A_URIS) => {
      const matches = n?.children.filter((c) => c.local === local) || []
      if (matches.length > 1 || matches.some((c) => !uris.has(c.uri)))
        fail(matches[0], `ambiguous/unsupported ${local}`)
      return matches[0]
    }
    const location = (n) => ({ part: partUri, path: paths.get(n).join('.') })
    const receipt = (n, id = `${partUri}#text-context:${paths.get(n).join('.')}`) => {
      if (!provenance.some((p) => p.id === id))
        provenance.push({
          id,
          source: location(n),
          preconditionHash: record.preconditionHash,
        })
      return id
    }
    const result = {
      ...boundary,
      bind: boundary.verify,
      fail,
      root,
      paths,
      definitions,
      nodes,
      one,
      location,
      receipt,
      partUri,
    }
    cache.set(partUri, result)
    return result
  }
  async function relations(owner) {
    const uri = relationshipPart(owner.partUri)
    if (!zip.file(uri)) return []
    const p = await part(uri),
      root = p.root
    if (!REL.has(root.uri) || root.local !== 'Relationships') p.fail(root, 'relationship root')
    p.attrs(root)
    const seen = new Set()
    return root.children.map((n) => {
      if (!REL.has(n.uri) || n.local !== 'Relationship' || n.children.length)
        p.fail(n, 'relationship declaration')
      const a = p.attrs(n, ['Id', 'Type', 'Target', 'TargetMode'])
      if (
        !a.Id ||
        !a.Type ||
        !a.Target ||
        seen.has(a.Id) ||
        (a.TargetMode && !['Internal', 'External'].includes(a.TargetMode))
      )
        p.fail(n, 'ambiguous relationship')
      seen.add(a.Id)
      return { ...a, node: n, part: p }
    })
  }
  async function related(owner, kind, id, required = true) {
    const rels = await relations(owner)
    if (rels.some((r) => [...R].some((uri) => r.Type === `${uri}/themeOverride`)))
      owner.fail(owner.root, 'unsupported theme override')
    const matches = rels.filter(
      (r) => [...R].some((uri) => r.Type === `${uri}/${kind}`) && (id === undefined || r.Id === id)
    )
    if (!matches.length && !required) return null
    if (matches.length !== 1) owner.fail(owner.root, `missing/ambiguous ${kind} relationship`)
    const r = matches[0]
    if (r.TargetMode === 'External') r.part.fail(r.node, 'external required relationship')
    let target
    try {
      target = resolveTarget(owner.partUri, r.Target)
    } catch {
      r.part.fail(r.node, 'unsafe target')
    }
    const targetPart = await part(target)
    relationships.push({
      ownerPartUri: owner.partUri,
      relationshipId: r.Id,
      type: r.Type,
      targetPartUri: target,
      source: r.part.location(r.node),
      preconditionHash: r.part.source.preconditionHash,
    })
    return targetPart
  }
  return { part, related, relations, provenance, relationships, R, P_URIS }
}
module.exports = { contextSource, contextFailure, createContextSourceFactory }
