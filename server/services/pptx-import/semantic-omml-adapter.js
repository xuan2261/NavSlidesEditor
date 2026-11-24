const BW_MODES = new Set([
  'clr', 'auto', 'gray', 'lightGray', 'invGray',
  'grayWhite', 'blackGray', 'blackWhite', 'black', 'white', 'hidden',
])
const { P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { frameSource } = require('./semantic-frame-adapter-source')
const { readFrameIdentity, readFrameTransform, finishFrame } = require('./semantic-frame-adapter')
const { readSemanticEquation } = require('./ooxml-semantic-equation')
const { readSemanticTextBody } = require('./ooxml-semantic-text-body')
const { tableSource } = require('./ooxml-semantic-table-source')
const { runProperties } = require('./ooxml-semantic-table-text-properties')
const { listParagraphProperties } = require('./ooxml-semantic-text-list-style-properties')
const { readSemanticTextListStyle } = require('./ooxml-semantic-text-list-style')
const { readGeometrySource } = require('./ooxml-geometry-source')
const { readTableColor } = require('./ooxml-semantic-table-properties')
const { placeholder } = require('./ooxml-semantic-text-context-layers')
const M = new Set(['http://schemas.openxmlformats.org/officeDocument/2006/math'])
const M14 = new Set(['http://schemas.microsoft.com/office/drawing/2010/main'])

function projectOmmlShape(context) {
  const s = frameSource(context)
  const { node, source, attrs, children, fail } = s
  if (source.kind !== 'shape' || !P_URIS.has(node.uri) || node.local !== 'sp')
    fail(node, 'wrong equation containing shape')
  attrs(node)
  const hasStyle = node.children[2]?.local === 'style'
  children(node, [
    [P_URIS, 'nvSpPr'],
    [P_URIS, 'spPr'],
    ...(hasStyle ? [[P_URIS, 'style']] : []),
    [P_URIS, 'txBody'],
  ])
  const [nonvisual, properties] = node.children
  const body = node.children.at(-1)
  const frameProperties = readFrameIdentity(s, nonvisual, true, (application) => {
    children(application, application.children.length ? [[P_URIS, 'ph']] : [])
    if (!application.children.length) return undefined
    placeholder(
      {
        ...s,
        number: s.integer,
        one: (entry, local, uris) =>
          entry?.children.find((child) => child.local === local && uris.has(child.uri)),
      },
      node
    )
    return attrs(application.children[0], ['type', 'idx', 'orient', 'sz', 'hasCustomPrompt'])
  })
  const propAttrs = attrs(properties, ['bwMode'])
  if (propAttrs.bwMode && !BW_MODES.has(propAttrs.bwMode)) {
    fail(properties, 'invalid bwMode')
  }
  const expected = [[A_URIS, 'xfrm']]
  if (properties.children.some((c) => c.local === 'prstGeom')) expected.push([A_URIS, 'prstGeom'])
  if (properties.children.some((c) => c.local === 'noFill')) expected.push([A_URIS, 'noFill'])
  if (properties.children.some((c) => c.local === 'ln')) expected.push([A_URIS, 'ln'])
  children(properties, expected)
  const placement = readFrameTransform(s, properties.children[0])
  const outer = [],
    mapped = []
  function bind(entry, kind, componentKind, parentId) {
    const matches = context.components.filter((c) => context.nodes.get(c.id) === entry)
    const d = matches[0],
      path = s.paths.get(entry),
      locator = d?.componentLocators?.[0]
    if (
      matches.length !== 1 ||
      d.kind !== kind ||
      d.parentDefinitionId !== parentId ||
      d.partUri !== source.partUri ||
      d.preconditionHash !== source.preconditionHash ||
      d.namespaceUri !== entry.uri ||
      d.localName !== entry.local ||
      d.componentLocators.length !== 1 ||
      locator?.preconditionHash !== source.preconditionHash ||
      JSON.stringify(locator.path) !== JSON.stringify(path)
    )
      fail(entry, 'wrong containing-shape component binding')
    outer.push({ id: d.id, kind: componentKind, partUri: source.partUri, locator })
    mapped.push(d.id)
    return d
  }
  const mathFrame = {}
  if (hasStyle) {
    const style = node.children[2]
    attrs(style)
    children(style, [[A_URIS, 'fontRef']])
    const ref = style.children[0]
    const index = attrs(ref, ['idx']).idx
    if (!['major', 'minor', 'none'].includes(index)) fail(ref, 'font reference index')
    if (ref.children.length !== 1) fail(ref, 'font reference color')
    children(ref, [[A_URIS, ref.children[0].local]])
    mathFrame.fontReference = {
      index,
      color: readTableColor(ref.children[0], tableSource(context)),
    }
  }
  let geometry
  const preset = properties.children.find((c) => c.local === 'prstGeom')
  if (preset) {
    if (attrs(preset, ['prst']).prst !== 'rect') fail(preset, 'unsupported equation shape geometry')
    children(preset, [[A_URIS, 'avLst']])
    attrs(preset.children[0])
    children(preset.children[0])
    const definition = bind(preset, 'preset-geometry', 'property', source.id)
    geometry = readGeometrySource(preset, {
      componentId: definition.id,
      ...(context.geometryDeclarations
        ? { template: true }
        : {
            width: placement.extent.cx,
            height: placement.extent.cy,
          }),
    })
    mathFrame.presetGeometry = 'rect'
  }
  const noFill = properties.children.find((c) => c.local === 'noFill')
  if (noFill) {
    attrs(noFill)
    children(noFill)
  }
  const ln = properties.children.find((c) => c.local === 'ln')
  if (ln) {
    attrs(ln, ['w', 'cmpd', 'algn', 'cap'])
    if (!ln.children.some((c) => c.local === 'noFill')) {
      fail(ln, 'unsupported equation border fill')
    }
    const lnExpected = []
    if (ln.children.some((c) => c.local === 'noFill')) lnExpected.push([A_URIS, 'noFill'])
    if (ln.children.some((c) => c.local === 'miter')) lnExpected.push([A_URIS, 'miter'])
    if (ln.children.some((c) => c.local === 'round')) lnExpected.push([A_URIS, 'round'])
    if (ln.children.some((c) => c.local === 'bevel')) lnExpected.push([A_URIS, 'bevel'])
    if (ln.children.some((c) => c.local === 'headEnd')) lnExpected.push([A_URIS, 'headEnd'])
    if (ln.children.some((c) => c.local === 'tailEnd')) lnExpected.push([A_URIS, 'tailEnd'])
    children(ln, lnExpected)
    for (const child of ln.children) {
      if (child.local === 'noFill') {
        attrs(child)
        children(child)
      } else if (child.local === 'miter') {
        attrs(child, ['lim'])
        children(child)
      } else if (['round', 'bevel'].includes(child.local)) {
        attrs(child)
        children(child)
      } else if (['headEnd', 'tailEnd'].includes(child.local)) {
        attrs(child, ['type', 'w', 'len'])
        children(child)
      }
    }
  }
  attrs(body)
  children(body, [
    [A_URIS, 'bodyPr'],
    [A_URIS, 'lstStyle'],
    [A_URIS, 'p'],
  ])
  const [, , paragraph] = body.children
  const listSource = readSemanticTextListStyle(context)
  outer.push(...listSource.components)
  mapped.push(...listSource.mappedDefinitionIds)
  const bodyProperties = readSemanticTextBody(body, context, (_owner, detail) => fail(body, detail))
  mathFrame.textBody = bodyProperties ?? {}
  attrs(paragraph)
  const hasProperties = paragraph.children[0]?.local === 'pPr'
  const hasEnd = paragraph.children.at(-1)?.local === 'endParaRPr'
  const entry = paragraph.children[hasProperties ? 1 : 0]
  const wrapped = M14.has(entry?.uri) && entry.local === 'm'
  if (!entry || !(wrapped || (M.has(entry.uri) && ['oMath', 'oMathPara'].includes(entry.local))))
    fail(paragraph, 'missing or unsupported equation root')
  children(paragraph, [
    ...(hasProperties ? [[A_URIS, 'pPr']] : []),
    [wrapped ? M14 : M, entry.local],
    ...(hasEnd ? [[A_URIS, 'endParaRPr']] : []),
  ])
  const paragraphDefinition = bind(paragraph, 'paragraph', 'paragraph', source.id)
  // Reuse the strict rich-property readers; no text content or math is flattened.
  const textSource = tableSource(context)
  if (hasProperties)
    mathFrame.paragraph = listParagraphProperties(paragraph.children[0], textSource)
  if (hasEnd) {
    const end = runProperties(paragraph.children.at(-1), textSource, true)
    mathFrame.endParagraphProperties = end.properties
    if (end.proofing) mathFrame.endParagraphProofing = end.proofing
  }
  let root = entry, equationParentId = paragraphDefinition.id
  if (wrapped) {
    attrs(entry)
    if (entry.children.length !== 1 || !['oMath', 'oMathPara'].includes(entry.children[0].local))
      fail(entry, 'missing or ambiguous equation root')
    children(entry, [[M, entry.children[0].local]])
    equationParentId = bind(entry, 'unknown-extension', 'property', paragraphDefinition.id).id
    root = entry.children[0]
  }
  const rootMatches = context.components.filter((d) => context.nodes.get(d.id) === root)
  const equation = rootMatches[0]
  if (rootMatches.length !== 1 || equation.parentDefinitionId !== equationParentId)
    fail(root, 'wrong equation ancestry')
  const rootPath = s.paths.get(root)
  const components = context.components.filter((d) => {
    const path = d.componentLocators?.[0]?.path
    return (
      d.id !== equation.id &&
      d.partUri === source.partUri &&
      Array.isArray(path) &&
      path.length > rootPath.length &&
      rootPath.every((n, i) => path[i] === n)
    )
  })
  const result = readSemanticEquation({ ...context, source: equation, node: root, components })
  return {
    kind: 'equation',
    content: {
      ommlDocument: result.ommlDocument,
      mathFrame,
      ...(geometry ? { geometry } : {}),
      frameProperties,
      extent: placement.extent,
    },
    components: [
      ...result.components.map((c) => ({ ...c, partUri: source.partUri })),
      ...outer,
      ...s.metadata,
    ],
    ...placement,
    compatibility: { type: 'latex' },
    mappedDefinitionIds: finishFrame(s, [...mapped, ...result.mappedDefinitionIds]),
  }
}
module.exports = { projectOmmlShape }
