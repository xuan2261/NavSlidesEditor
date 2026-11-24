const { normalizeTableDocument } = require('./pptx-table-document')
const { normalizeChartDocument } = require('./pptx-chart-document')
const { normalizeOmmlDocument } = require('./pptx-omml-document')
const { normalizeSmartArtDocument } = require('./pptx-smartart-document')
const { validateTextHyperlinkBindings } = require('./pptx-text-hyperlink-bindings')
const { validateDiagramDrawingReference } = require('./pptx-diagram-drawing-reference')
const { validateTableStyleReference } = require('./pptx-table-style-reference')

const { normalizeSvgDocument } = require('./pptx-svg-document')
const FAMILIES = {
  tableDocument: ['table', normalizeTableDocument],
  chartDocument: ['chart', normalizeChartDocument],
  ommlDocument: ['equation', normalizeOmmlDocument],
  smartArtDocument: ['diagram', normalizeSmartArtDocument],
  svgDocument: ['svg', normalizeSvgDocument],
}
const hasFamilyDocument = (value) =>
  Object.hasOwn(value, 'familyOperations') ||
  Object.hasOwn(value, 'drawingFallback') ||
  Object.hasOwn(value, 'tableStyleReference') ||
  Object.keys(FAMILIES).some((key) => Object.hasOwn(value, key))
const safePartUri = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1024 &&
  !/[\\:#?]/.test(value) &&
  ![...value].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127) &&
  !/%(?:2f|5c|2e)/i.test(value) &&
  !value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
const samePath = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const within = (path, parent) =>
  Array.isArray(path) &&
  Array.isArray(parent) &&
  path.length > parent.length &&
  parent.every((n, i) => path[i] === n)
const fail = (detail) => {
  throw new TypeError(`Invalid semantic family ${detail}`)
}

// These are reader-declared bindings, not a second package authority. The
// source baseline protects the whole declaration; package admission owns XML.
function validateFamilyDocuments(definition) {
  validateDiagramDrawingReference(definition, safePartUri)
  validateTableStyleReference(definition, safePartUri)
  const bindings = new Map(),
    roots = []
  const components = new Map(definition.components.map((c) => [c.id, c]))
  function bind(id, kind, source, token, parent) {
    const c = components.get(id),
      path = c?.locator?.path
    if (
      !c ||
      c.kind !== kind ||
      bindings.has(id) ||
      !safePartUri(source.partUri) ||
      (c.partUri ?? definition.source.partUri) !== source.partUri ||
      (source.partUri === definition.source.partUri &&
        source.preconditionHash !== definition.source.preconditionHash) ||
      c.locator.preconditionHash !== source.preconditionHash ||
      !Array.isArray(path) ||
      !path.length ||
      path.some((n) => !Number.isSafeInteger(n) || n < 0) ||
      c.locator.nativeId !== undefined ||
      id !== `${source.partUri}#${token}:${path.join('.')}` ||
      (source.path && !samePath(path, source.path)) ||
      (parent && !within(path, parent))
    )
      fail('component owner, kind or source binding')
    bindings.set(id, { partUri: source.partUri, preconditionHash: source.preconditionHash, path })
    return path
  }
  function equation(node, source, parent) {
    const math = [
      'http://schemas.openxmlformats.org/officeDocument/2006/math',
      'http://purl.oclc.org/ooxml/officeDocument/math',
    ].includes(node.namespaceUri)
    const path = bind(node.componentId, 'property', source,
      math ? 'math-component' : `omml-${node.type}`, parent)
    node.children.forEach((child) => equation(child, source, path))
    return path
  }
  function inlineEquation(run, source, paragraph) {
    const token = run.componentId.startsWith(`${source.partUri}#unknown-extension:`)
      ? 'unknown-extension' : 'inline-equation'
    const runPath = bind(run.componentId, 'run', source, token, paragraph)
    const root = equation(run.ommlDocument.root, source, paragraph)
    if (!(samePath(root, runPath) || within(root, runPath))) fail('inline equation root locator')
    if (token === 'unknown-extension' && !within(root, runPath)) fail('inline equation wrapper locator')
    roots.push({ ...source, path: runPath })
  }
  function text(d, source, prefix, parent) {
    const body = bind(
      d.componentId,
      'property',
      source,
      `${prefix}-${prefix === 'table' ? 'txBody' : 't'}`,
      parent
    )
    for (const p of d.paragraphs) {
      const paragraph = bind(p.componentId, 'paragraph', source, 'paragraph', body)
      for (const r of p.runs) {
        if (r.kind === 'equation') inlineEquation(r, source, paragraph)
        else bind(r.componentId, 'run', source,
          r.kind === 'break' ? `${prefix}-br` : r.kind === 'field' ? 'text-field' : 'text-run',
          paragraph)
      }
    }
  }
  function tableIdentity(entry, ownerPath, wrapperIndex) {
    if (entry.identity === undefined) return
    const path = bind(entry.identity.componentId, 'property', definition.source, 'unknown-extension', ownerPath)
    if (path.length !== ownerPath.length + 3 || path[ownerPath.length] !== wrapperIndex ||
        path.at(-2) !== 0 || path.at(-1) !== 0) fail('table native identity locator')
  }
  if (definition.content.textDocument && definition.origin !== 'project') {
    const source = definition.source
    const document = definition.content.textDocument
    const body = components.get(document.componentId)?.locator?.path
    for (const paragraph of document.paragraphs) {
      if (!paragraph.runs.some((run) => run.kind === 'equation')) continue
      const path = bind(paragraph.componentId, 'paragraph', source, 'paragraph', body)
      for (const run of paragraph.runs)
        if (run.kind === 'equation') inlineEquation(run, source, path)
    }
  }
  for (const [field, [kind, normalize]] of Object.entries(FAMILIES)) {
    if (!Object.hasOwn(definition.content, field)) continue
    if (definition.kind !== kind || definition.origin === 'project') fail('document kind/owner')
    const d = normalize(definition.content[field]),
      source = definition.source
    if (field === 'svgDocument') {
      const owner = source.componentLocator
      if (!owner || owner.preconditionHash !== source.preconditionHash ||
          !Array.isArray(owner.path) || !owner.path.length ||
          owner.path.some((n) => !Number.isSafeInteger(n) || n < 0)) fail('SVG owner locator')
      const root = bind(d.componentId, 'property', source, 'svg-root', owner.path)
      roots.push({ partUri: d.source.partUri, path: d.source.path })
      for (const path of d.paths)
        bind(path.componentId, 'path', path.source, 'svg-path', d.source.path)
      roots.push({ partUri: source.partUri, path: root })
    } else if (field === 'tableDocument') {
      const owner = source.componentLocator
      if (
        !owner ||
        owner.preconditionHash !== source.preconditionHash ||
        !Array.isArray(owner.path) ||
        !owner.path.length ||
        owner.path.some((n) => !Number.isSafeInteger(n) || n < 0)
      )
        fail('table owner locator')
      const root = bind(d.componentId, 'property', source, 'table', owner.path)
      roots.push({ ...source, path: root })
      for (const column of d.columns) {
        const columnPath = bind(column.componentId, 'column', source, 'table-gridCol', root)
        tableIdentity(column, columnPath, 0)
      }
      for (const row of d.rows) {
        const rowPath = bind(row.componentId, 'row', source, 'table-tr', root)
        tableIdentity(row, rowPath, d.columns.length)
        for (const cell of row.cells) {
          const cellPath = bind(cell.componentId, 'cell', source, 'table-cell', rowPath)
          text(cell.textDocument, source, 'table', cellPath)
        }
      }
    } else if (field === 'ommlDocument') {
      const owner = source.componentLocator
      if (!owner || owner.preconditionHash !== source.preconditionHash)
        fail('equation owner locator')
      const root = equation(d.root, source)
      if (!within(root, owner.path)) fail('equation root locator')
      roots.push({ ...source, path: root })
    } else if (field === 'smartArtDocument') {
      for (const r of d.relationships) if (!safePartUri(r.partUri)) fail('relationship part URI')
      const data = d.relationships.find((r) => r.role === 'data')
      const root = bind(d.componentId, 'property', { ...data, path: [0] }, 'smartart-dataModel')
      roots.push({ ...data, path: root })
      for (const p of d.points) {
        const point = bind(p.componentId, 'property', data, 'diagram-node', root)
        if (p.textDocument) text(p.textDocument, data, 'smartart', point)
      }
      for (const c of d.connections)
        bind(c.componentId, 'connection', data, 'diagram-connection', root)
      if (d.layout) {
        roots.push({ ...d.layout.source, path: [0] })
        for (const declaration of d.layout.declarations) {
          const token =
            {
              layoutNode: 'diagram-layout',
              alg: 'diagram-algorithm',
              constr: 'diagram-constraint',
            }[declaration.type] ?? `smartart-${declaration.type}`
          bind(declaration.componentId, 'property', declaration.source, token)
        }
      }
      if (d.sourceStyles) {
        const style = d.sourceStyles.styleSource
        roots.push(style)
        for (const label of d.sourceStyles.labels) {
          const labelPath = bind(
            label.componentId,
            'property',
            label.source,
            'smartart-styleLbl',
            style.path
          )
          if (label.textStyleDocument) {
            const textSource = {
              partUri: label.source.partUri,
              preconditionHash: label.source.preconditionHash,
            }
            const textRoot = bind(
              label.textStyleDocument.componentId,
              'property',
              textSource,
              'smartart-txPr',
              labelPath
            )
            for (const paragraph of label.textStyleDocument.paragraphs)
              bind(paragraph.componentId, 'paragraph', textSource, 'paragraph', textRoot)
          }
        }
      }
    } else {
      if (d.source.ownerDefinitionId !== definition.id || !safePartUri(d.source.partUri))
        fail('chart source owner')
      if (d.workbook && !d.workbook.external && !safePartUri(d.workbook.target))
        fail('workbook package target')
      roots.push({ ...d.source, path: [0] })
      for (const source of d.visualSources ?? []) {
        const component = components.get(source.definitionId)
        const token = { paragraph: 'paragraph', run: 'text-run' }[component?.kind]
        if (!token) fail('chart visual component kind')
        bind(source.definitionId, component.kind, source, token)
      }
      // Normalization restricts every embedded source to the chart snapshot.
      // Traverse all cache-bearing channels, including titles and data labels.
      function visit(value) {
        if (!value || typeof value !== 'object') return
        if (value.source?.definitionId) {
          const series = Object.hasOwn(value, 'data')
          const workbook = value === d.workbook
          bind(
            value.source.definitionId,
            series ? 'series' : workbook ? 'property' : 'point',
            value.source,
            series ? 'chart-series' : workbook ? 'chart-workbook-reference' : 'chart-data-point'
          )
        }
        Object.values(value).forEach(visit)
      }
      visit(d)
    }
  }
  for (const id of validateTextHyperlinkBindings(definition)) {
    const component = components.get(id)
    bindings.set(id, { partUri: definition.source.partUri,
      preconditionHash: component.locator.preconditionHash, path: component.locator.path })
  }
  for (const c of definition.components) {
    if (bindings.has(c.id)) continue
    const part = c.partUri ?? definition.source.partUri
    if (
      part !== definition.source.partUri ||
      roots.some(
        (root) =>
          part === root.partUri &&
          (samePath(c.locator?.path, root.path) || within(c.locator?.path, root.path))
      )
    )
      fail('unreferenced component binding')
  }
  return bindings
}

module.exports = { validateFamilyDocuments, hasFamilyDocument, safePartUri }
