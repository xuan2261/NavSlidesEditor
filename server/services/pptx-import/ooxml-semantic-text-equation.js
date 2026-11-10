const { P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { readSemanticEquation } = require('./ooxml-semantic-equation')
const M = new Set(['http://schemas.openxmlformats.org/officeDocument/2006/math'])
const A14 = 'http://schemas.microsoft.com/office/drawing/2010/main'
const isMathRoot = (n) => n && M.has(n.uri) && ['oMath', 'oMathPara'].includes(n.local)
const isMathWrapper = (n) => n?.uri === A14 && n.local === 'm'
const isEquationEntry = (n) => isMathWrapper(n) || isMathRoot(n)

// Dispatch only an entire single-equation body. All other bodies retain normal
// geometry and ordered paragraph/run admission, including empty paragraphs.
function standaloneEquationTopology(node) {
  const bodies = node.children.filter((n) => P_URIS.has(n.uri) && n.local === 'txBody')
  if (bodies.length !== 1) return false
  const paragraphs = bodies[0].children.filter((n) => A_URIS.has(n.uri) && n.local === 'p')
  if (paragraphs.length !== 1) return false
  const children = paragraphs[0].children
  const content = children.filter((n) => !(A_URIS.has(n.uri) && ['pPr', 'endParaRPr'].includes(n.local)))
  if (content.length !== 1 || !isEquationEntry(content[0])) return false
  const entry = content[0]
  if (isMathWrapper(entry) && (entry.children.length !== 1 || !isMathRoot(entry.children[0]))) return false
  const names = children.map((n) => isEquationEntry(n) ? 'equation' : A_URIS.has(n.uri) ? n.local : '?').join(',')
  return /^(?:pPr,)?equation(?:,endParaRPr)?$/.test(names)
}

function validateParagraphChildren(paragraph, boundary) {
  // Use the normal mixed-content and duplicate checks, then enforce each QName;
  // a union of namespaces alone would wrongly admit m:r or a:oMath.
  boundary.children(paragraph, ['pPr', 'r', 'br', 'fld', 'endParaRPr', 'm', 'oMath', 'oMathPara'],
    ['r', 'br', 'fld', 'm', 'oMath', 'oMathPara'], new Set([...A_URIS, ...M, A14]))
  for (const n of paragraph.children)
    if (!isEquationEntry(n) && !(A_URIS.has(n.uri) && ['pPr', 'r', 'br', 'fld', 'endParaRPr'].includes(n.local)))
      boundary.fail(n, 'unsupported paragraph child or namespace')
}

function createInlineEquationReader(context, boundary) {
  const { source, node, components, nodes } = context
  const paths = new Map()
  function walk(n, path) {
    paths.set(n, path)
    n.children.forEach((c, i) => walk(c, [...path, i]))
  }
  walk(node, source.componentLocators[0].path)
  return (entry, paragraphId) => {
    let root = entry, parentId = paragraphId, runId
    if (isMathWrapper(entry)) {
      boundary.attrs(entry)
      boundary.children(entry, ['oMath', 'oMathPara'], [], M)
      if (entry.children.length !== 1) boundary.fail(entry, 'missing or ambiguous equation root')
      root = entry.children[0]
      parentId = runId = boundary.bind(entry, 'unknown-extension', paragraphId, 'run')
      if (components.find((d) => d.id === runId).componentLocators.length !== 1)
        boundary.fail(entry, 'ambiguous equation wrapper locator')
    }
    if (!isMathRoot(root)) boundary.fail(root, 'unsupported equation root namespace')
    const rootPath = paths.get(root)
    const matches = components.filter((d) => nodes.get(d.id) === root)
    if (matches.length !== 1) boundary.fail(root, 'missing/ambiguous equation source component')
    const equation = matches[0]
    boundary.verify(root, 'math-component', parentId, 'property')
    const descendants = components.filter((d) => {
      const path = d.componentLocators?.[0]?.path
      return d.id !== equation.id && d.partUri === source.partUri && Array.isArray(path) &&
        path.length > rootPath.length && rootPath.every((n, i) => path[i] === n)
    })
    const result = readSemanticEquation({ ...context, source: equation, node: root, components: descendants })
    const generated = !runId
    if (generated) runId = `${source.partUri}#inline-equation:${paths.get(entry).join('.')}`
    return {
      run: { componentId: runId, kind: 'equation', ommlDocument: result.ommlDocument },
      components: [...(generated ? [{ id: runId, kind: 'run', locator: {
        path: paths.get(entry), preconditionHash: source.preconditionHash,
      } }] : []), ...result.components],
      mappedDefinitionIds: result.mappedDefinitionIds,
    }
  }
}
module.exports = { isEquationEntry, standaloneEquationTopology, validateParagraphChildren, createInlineEquationReader }
