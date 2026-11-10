const { normalizeOmmlDocument, cloneOmmlData } = require('./pptx-omml-document')
const { M, token } = require('./pptx-omml-document-grammar')

function fail(detail) { throw new TypeError(`Invalid OMML structural edit: ${detail}`) }
function editContext(input, componentId, identity) {
  const document = normalizeOmmlDocument(input)
  if (typeof identity !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(identity)) fail('authored identity')
  let selected
  function visit(node) {
    if (node.componentId === componentId) selected = node
    node.children.forEach(visit)
  }
  visit(document.root)
  if (!selected) fail('unknown component')
  let serial = 0
  const node = (type, children = [], attributes = [], text) => ({
    componentId: `${document.root.componentId}~authored:${identity}-edit-${++serial}`,
    namespaceUri: M, type, attributes, children,
    ...(text === undefined ? {} : { text }),
  })
  const value = (type, text) => node(type, [], [{ namespaceUri: M, name: 'val', value: text }])
  const cell = () => node('e', [node('r', [node('t', [], [], '')])])
  const target = cloneOmmlData(selected)
  return { target, node, value, cell,
    command: () => ({ type: 'replace', componentId, node: target }) }
}
const properties = {
  f: { type: ['bar', 'skw', 'lin', 'noBar'] },
  rad: { degHide: ['0', '1'] },
  r: { sty: ['p', 'b', 'i', 'bi'] },
  m: { baseJc: ['top', 'center', 'bottom'] },
  eqArr: { baseJc: ['top', 'center', 'bottom'] },
}
// Property edits replace only the selected atom. Existing property/run IDs and
// all untouched lexical declarations are retained for occurrence journal replay.
function createOmmlPropertyCommand(input, componentId, property, text, identity) {
  const c = editContext(input, componentId, identity), { target } = c
  const allowed = properties[target.type]?.[property]
  if (!allowed?.includes(text)) fail('unsupported property/value')
  let group = target.children.find((child) => token(child) === `m:${target.type}Pr`)
  if (!group) {
    group = c.node(`${target.type}Pr`)
    target.children.unshift(group)
  }
  const existing = group.children.find((child) => token(child) === `m:${property}`)
  if (existing) {
    const attribute = existing.attributes.find((attr) =>
      token({ namespaceUri: attr.namespaceUri, type: attr.name }) === 'm:val')
    if (attribute) attribute.value = text
    else existing.attributes.push({ namespaceUri: M, name: 'val', value: text })
  } else {
    // ctrlPr is the final property in structure property groups.
    const control = group.children.findIndex((child) => token(child) === 'm:ctrlPr')
    group.children.splice(control < 0 ? group.children.length : control, 0, c.value(property, text))
  }
  return c.command()
}
function createOmmlMatrixCommand(input, componentId, change, identity) {
  const request = cloneOmmlData(change)
  if (!request || Object.keys(request).length !== 3 ||
    !['row', 'column'].includes(request.axis) || !['insert', 'remove'].includes(request.action) ||
    !Number.isSafeInteger(request.index) || request.index < 0) fail('matrix request')
  const c = editContext(input, componentId, identity), { target } = c
  if (token(target) !== 'm:m') fail('matrix target')
  const rows = target.children.filter((child) => token(child) === 'm:mr')
  const size = request.axis === 'row' ? rows.length : rows[0].children.length
  if (request.index >= size + (request.action === 'insert' ? 1 : 0) ||
    (request.action === 'remove' && size === 1)) fail('matrix dimension/index')
  if (request.axis === 'row') {
    const offset = target.children.length - rows.length
    if (request.action === 'insert') target.children.splice(offset + request.index, 0,
      c.node('mr', rows[0].children.map(() => c.cell())))
    else target.children.splice(offset + request.index, 1)
  } else {
    for (const row of rows) {
      if (request.action === 'insert') row.children.splice(request.index, 0, c.cell())
      else row.children.splice(request.index, 1)
    }
    const declarations = target.children.find((child) => token(child) === 'm:mPr')
      ?.children.find((child) => token(child) === 'm:mcs')
    if (declarations) {
      let offset = 0
      for (const [index, column] of declarations.children.entries()) {
        const group = column.children[0]
        const count = group.children.find((child) => token(child) === 'm:count')
        const attribute = count?.attributes.find((attr) =>
          token({ namespaceUri: attr.namespaceUri, type: attr.name }) === 'm:val')
        const width = Number(attribute?.value ?? 1)
        if (request.index < offset + width || index === declarations.children.length - 1) {
          const next = width + (request.action === 'insert' ? 1 : -1)
          if (!next) declarations.children.splice(index, 1)
          else if (attribute) attribute.value = String(next)
          else group.children.unshift(c.value('count', String(next)))
          break
        }
        offset += width
      }
    }
  }
  return c.command()
}
module.exports = { createOmmlPropertyCommand, createOmmlMatrixCommand }
