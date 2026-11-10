const { createHash } = require('node:crypto')
const {
  parseXml,
  descendants,
  attr: rawAttr,
  decodeXml,
  P_URIS,
  A_URIS,
} = require('./ooxml-text-run-xml')
const { parseSvgSource } = require('./ooxml-semantic-svg')
const { readSlideOrder, relationshipPart } = require('./slide-order')
const { resolveTarget } = require('./package-store/raw-zip')
const { PptxImportError } = require('./diagnostics')

const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const R = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const GRAPHICS = new Set(['sp', 'grpSp', 'cxnSp', 'pic', 'graphicFrame'])

function attr(node, name) {
  const value = rawAttr(node, name)
  return typeof value === 'string' ? decodeXml(value) : value
}

function invalid(message, partUri, status = 400) {
  const error = new PptxImportError(partUri ? `${message}: ${partUri}` : message, { status })
  if (partUri) error.sourceLocation = { partUri }
  throw error
}
function nodeAttributes(node) {
  return Object.fromEntries(
    node.attrs
      .filter((item) => !item.name.startsWith('xmlns'))
      .map((item) => [item.name, decodeXml(item.value)])
  )
}
function nativeId(node) {
  if (!P_URIS.has(node.uri) || !GRAPHICS.has(node.local)) return null
  const nonvisual = node.children.find(
    (child) => P_URIS.has(child.uri) && /^nv.*Pr$/.test(child.local)
  )
  const identity = nonvisual?.children.find(
    (child) => P_URIS.has(child.uri) && child.local === 'cNvPr'
  )
  return identity ? attr(identity, 'id') : null
}
function kindOf(node) {
  if (P_URIS.has(node.uri))
    return (
      {
        sp: 'shape',
        grpSp: 'group',
        cxnSp: 'connector',
        pic: 'picture',
        graphicFrame: 'graphic-frame',
        control: 'activex',
        oleObj: 'ole',
        timing: 'timing',
        transition: 'transition',
      }[node.local] || null
    )
  if (A_URIS.has(node.uri))
    return (
      {
        r: 'text-run',
        fld: 'text-field',
        p: 'paragraph',
        tc: 'table-cell',
        tbl: 'table',
        custGeom: 'custom-geometry',
        prstGeom: 'preset-geometry',
        gd: 'geometry-guide',
        pt: 'path-point',
        stCxn: 'connector-binding',
        endCxn: 'connector-binding',
        hlinkClick: 'hyperlink',
        hlinkMouseOver: 'hyperlink',
        audioFile: 'media-segment',
        videoFile: 'media-segment',
        scene3d: 'property',
        sp3d: 'property',
      }[node.local] || null
    )
  if (
    node.uri === 'http://schemas.microsoft.com/office/powerpoint/2010/main' &&
    node.local === 'media'
  )
    return 'media-segment'
  if (
    node.uri === 'http://schemas.microsoft.com/office/powerpoint/2010/main' &&
    node.local === 'trim'
  )
    return null
  if (node.uri === C || node.uri === 'http://purl.oclc.org/ooxml/drawingml/chart') {
    return (
      { ser: 'chart-series', pt: 'chart-data-point', externalData: 'chart-workbook-reference' }[
        node.local
      ] || null
    )
  }
  if (node.uri === D || node.uri === 'http://purl.oclc.org/ooxml/drawingml/diagram') {
    return (
      {
        pt: 'diagram-node',
        cxn: 'diagram-connection',
        layoutNode: 'diagram-layout',
        alg: 'diagram-algorithm',
        constr: 'diagram-constraint',
        rule: 'diagram-rule',
      }[node.local] || null
    )
  }
  if (node.uri === M) return 'math-component'
  if (
    node.uri === 'http://schemas.microsoft.com/office/drawing/2017/model3d' &&
    node.local === 'model3d'
  )
    return '3d'
  if (node.uri === 'http://www.w3.org/2000/svg') return 'vector-component'
  if (
    node.uri &&
    !P_URIS.has(node.uri) &&
    !A_URIS.has(node.uri) &&
    !node.uri.startsWith('http://schemas.openxmlformats.org/') &&
    !node.uri.startsWith('http://purl.oclc.org/ooxml/')
  )
    return 'unknown-extension'
  return null
}

async function buildSemanticInventory(zip, { maxObjects = 100000, maxDepth = 256 } = {}) {
  if (
    !Number.isSafeInteger(maxObjects) ||
    maxObjects < 1 ||
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 1
  )
    invalid('Invalid semantic inventory budget')
  const parsedParts = new Map()
  const definitions = []
  const occurrences = []
  const issues = []
  const parts = []
  let xmlNodes = 0
  let contentTypes = null

  async function load(partUri) {
    if (parsedParts.has(partUri)) return parsedParts.get(partUri)
    const entry = zip.file(partUri)
    if (!entry) invalid('Missing required semantic source part', partUri)
    if (
      contentTypes &&
      !contentTypes.overrides.has(`/${partUri}`) &&
      !contentTypes.defaults.has(partUri.slice(partUri.lastIndexOf('.') + 1).toLowerCase())
    ) {
      invalid('Missing source content type', partUri)
    }
    const bytes = await entry.async('nodebuffer')
    const preconditionHash = createHash('sha256').update(bytes).digest('hex')
    const state = { partUri, preconditionHash, definitions: [], relationships: [] }
    parsedParts.set(partUri, state)
    parts.push({ partUri, preconditionHash, byteLength: bytes.length })
    if (/\.svg$/i.test(partUri)) {
      try {
        parseSvgSource(bytes)
      } catch {
        invalid('Invalid or unsupported SVG source', partUri)
      }
    }
    if (/\.svg$/i.test(partUri)) {
      const mime = contentTypes?.overrides.get(`/${partUri}`) ??
        contentTypes?.defaults.get(partUri.slice(partUri.lastIndexOf('.') + 1).toLowerCase())
      if (mime !== 'image/svg+xml') invalid('Invalid SVG source content type', partUri)
    }
    if (!/\.(?:xml|svg|rels)$/.test(partUri)) return state
    let roots
    try {
      roots = parseXml(bytes.toString('utf8'))
    } catch {
      invalid('Invalid semantic source XML', partUri)
    }
    state.roots = roots
    const identityIds = new Set()
    function visit(node, locatorPath, depth, parentDefinitionId) {
      if (depth > maxDepth || ++xmlNodes > maxObjects * 100) {
        invalid('Semantic source depth or node budget exceeded', partUri, 413)
      }
      if (
        node.uri === 'http://schemas.openxmlformats.org/markup-compatibility/2006' &&
        node.local === 'AlternateContent'
      ) {
        // Transition source preservation owns the complete wrapper; unlike
        // competing shape representations, both branches need exact locators.
        const transitionWrapper = node.children.some(branch => branch.children.some(entry =>
          P_URIS.has(entry.uri) && entry.local === 'transition'))
        if (transitionWrapper) {
          node.children.forEach((branch, index) => visit(branch, [...locatorPath, index], depth + 1, parentDefinitionId))
          return
        }
        const choice = node.children.find((child) => child.local === 'Choice')
        const fallback = node.children.find((child) => child.local === 'Fallback')
        const requiresV = choice?.attrs?.some(
          (item) => item.name === 'Requires' && item.value === 'v'
        )
        const branch = (!requiresV && choice) || fallback || choice
        if (branch) {
          visit(
            branch,
            [...locatorPath, node.children.indexOf(branch)],
            depth + 1,
            parentDefinitionId
          )
        }
        return
      }
      const identity = nativeId(node)
      if (identity !== null) {
        if (!identity || identityIds.has(identity))
          invalid('Ambiguous native source identity', partUri)
        identityIds.add(identity)
      }
      const kind = kindOf(node)
      let parent = parentDefinitionId
      if (kind) {
        if (definitions.length >= maxObjects)
          invalid('Semantic object budget exceeded', partUri, 413)
        const id = `${partUri}#${kind}:${identity === null ? locatorPath.join('.') : identity}`
        const disposition = ['ole', '3d', 'activex'].includes(kind)
          ? 'owner-excluded-preserved'
          : 'requires-mapping'
        const definition = {
          id,
          partUri,
          nativeId: identity,
          kind,
          localName: node.local,
          namespaceUri: node.uri,
          attributes: nodeAttributes(node),
          parentDefinitionId,
          disposition,
          componentLocators: [{ path: locatorPath, preconditionHash }],
          preconditionHash,
        }
        definitions.push(definition)
        state.definitions.push(definition)
        if (kind === 'unknown-extension') {
          issues.push({ code: 'source-extension-requires-mapping', definitionId: id, partUri })
        }
        parent = id
        if (disposition === 'owner-excluded-preserved') {
          return
        }
      }
      node.children.forEach((child, index) =>
        visit(child, [...locatorPath, index], depth + 1, parent)
      )
    }
    roots.forEach((root, index) => visit(root, [index], 0, null))
    if (partUri.endsWith('.rels')) return state
    const references = descendants({ children: roots }, () => true).flatMap((node) =>
      node.attrs
        .filter((item) => {
          const colon = item.name.indexOf(':')
          return colon > 0 && R.has(node.namespaces[item.name.slice(0, colon)])
        })
        .map((item) => decodeXml(item.value))
    )
    const relPath = relationshipPart(partUri)
    const relEntry = zip.file(relPath)
    if (references.length && !relEntry)
      invalid('Missing required relationship source part', relPath)
    if (relEntry) {
      const relState = await load(relPath)
      const relationRoots = relState.roots
      const relationRoot = relationRoots?.[0]
      const relationshipNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships'
      if (relationRoots?.length !== 1 || relationRoot.local !== 'Relationships' ||
          relationRoot.uri !== relationshipNamespace ||
          relationRoot.attrs.some((item) => !item.name.startsWith('xmlns')) ||
          relationRoot.children.some((node) => node.local !== 'Relationship' ||
            node.uri !== relationshipNamespace || node.children.length ||
            new Set(node.attrs.map((item) => item.name)).size !== node.attrs.length ||
            node.attrs.some((item) => !item.name.startsWith('xmlns') &&
              !['Id', 'Type', 'Target', 'TargetMode'].includes(item.name))))
        invalid('Invalid semantic source relationships', relPath)
      const relations = relationRoot.children
      const seen = new Set()
      for (const relation of relations) {
        const id = attr(relation, 'Id')
        const target = attr(relation, 'Target')
        const type = attr(relation, 'Type')
        const modeAttribute = relation.attrs.find((item) => item.name === 'TargetMode')
        const mode = modeAttribute ? decodeXml(modeAttribute.value) : null
        if (mode !== null && !['Internal', 'External'].includes(mode))
          invalid('Invalid semantic source relationship target mode', relPath)
        if (!id || !target || !type || seen.has(id))
          invalid('Ambiguous relationship source identity', relPath)
        seen.add(id)
        if (mode === 'External') {
          issues.push({ code: 'external-relationship-denied', partUri, relationshipId: id, type })
          state.relationships.push({ id, type, external: true })
          continue
        }
        let resolved
        try {
          resolved = resolveTarget(partUri, target)
        } catch {
          invalid('Unsafe semantic source relationship target', partUri)
        }
        state.relationships.push({ id, type, target: resolved, external: false })
      }
      if (references.some((id) => !seen.has(id)))
        invalid('Unresolved source relationship identity', partUri)
      for (const relation of state.relationships)
        if (!relation.external) await load(relation.target)
    }
    return state
  }
  const contentState = await load('[Content_Types].xml')
  const typeNodes = descendants(
    { children: contentState.roots },
    (node) =>
      node.uri === 'http://schemas.openxmlformats.org/package/2006/content-types' &&
      ['Default', 'Override'].includes(node.local)
  )
  contentTypes = { defaults: new Map(), overrides: new Map() }
  for (const node of typeNodes) {
    const map = node.local === 'Default' ? contentTypes.defaults : contentTypes.overrides
    const key =
      node.local === 'Default' ? attr(node, 'Extension')?.toLowerCase() : attr(node, 'PartName')
    const mime = attr(node, 'ContentType')
    if (!key || !mime || map.has(key))
      invalid('Ambiguous source content type', '[Content_Types].xml')
    map.set(key, mime)
  }
  if (!typeNodes.length) invalid('Missing source content type declarations', '[Content_Types].xml')
  await load('ppt/presentation.xml')
  const slideParts = await readSlideOrder(zip)
  const slides = slideParts.map((partUri, index) => ({ partUri, index }))
  for (const slide of slides) {
    const painted = new Set()
    let paintIndex = 0
    async function place(partUri, chain) {
      if (painted.has(partUri)) return
      painted.add(partUri)
      const state = await load(partUri)
      const root = state.roots[0]
      const parentRelationship = P_URIS.has(root?.uri)
        ? { sld: 'slideLayout', sldLayout: 'slideMaster' }[root.local]
        : null
      for (const relation of state.relationships) {
        // A master's layout relationships enumerate available layouts; they
        // are not inherited paint providers for this slide.
        if (
          parentRelationship &&
          !relation.external &&
          [...R].some((uri) => relation.type === `${uri}/${parentRelationship}`)
        ) {
          await place(relation.target, [...chain, relation.id])
        }
      }
      const ids = new Map()
      for (const definition of state.definitions) {
        const id = `${slide.partUri}@${chain.join('>')}#${definition.id}`
        ids.set(definition.id, id)
        occurrences.push({
          id,
          slidePartUri: slide.partUri,
          definitionId: definition.id,
          paintIndex: paintIndex++,
          parentOccurrenceId: definition.parentDefinitionId
            ? ids.get(definition.parentDefinitionId)
            : null,
          relationshipChain: chain,
        })
      }
    }
    await place(slide.partUri, [slide.partUri])
  }
  return { slides, definitions, occurrences, issues, parts }
}

module.exports = { buildSemanticInventory }
