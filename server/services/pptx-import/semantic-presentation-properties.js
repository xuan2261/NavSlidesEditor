const { attr, decodeXml, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { readColorSource } = require('./ooxml-color-source')
const { resolveTarget } = require('./package-store/raw-zip')
const { PRESENTATION_PROPERTIES } = require('../../../shared/src/pptx-presentation-properties')
const R = [
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
]
const attributes = (node) => node.attrs.filter((item) => !/^xmlns(?::|$)/.test(item.name))
const value = (node, key) => decodeXml(attr(node, key) ?? '')

function projectPresentationProperties({
  inventory,
  parts,
  nodes,
  relationships,
  semantic,
  dispositions,
  fail,
}) {
  const bindings = relationships('ppt/presentation.xml').filter((node) =>
    R.some((uri) => value(node, 'Type') === `${uri}/presProps`)
  )
  if (bindings.length > 1)
    fail({ partUri: 'ppt/presentation.xml' }, 'ambiguous presentation properties owner')
  for (const binding of bindings) {
    const partUri = resolveTarget('ppt/presentation.xml', value(binding, 'Target'))
    const part = parts.get(partUri)
    const source = inventory.parts.find((entry) => entry.partUri === partUri)
    const reject = (detail) => fail({ partUri }, `presentation properties ${detail}`)
    if (!part || !source || !['', 'Internal'].includes(value(binding, 'TargetMode')))
      reject('missing/internal owner')
    const { roots, xml } = part
    const root = roots[0]
    const checkText = (node) => {
      if (node.selfClosing) return
      let cursor = node.end + 1
      for (const child of node.children) {
        if (xml.slice(cursor, child.start).trim()) reject('unexpected text')
        cursor = child.closeEnd + 1
      }
      if (xml.slice(cursor, node.closeStart).trim()) reject('unexpected text')
    }
    if (
      roots.length !== 1 ||
      !P_URIS.has(root?.uri) ||
      root.local !== 'presentationPr' ||
      attributes(root).length ||
      new Set(root.children.map((node) => node.local)).size !== root.children.length ||
      root.children.some((node) => !P_URIS.has(node.uri) || !['clrMru', 'extLst'].includes(node.local))
    )
      reject('unsupported/malformed owner')
    checkText(root)
    const mru = root.children.find((node) => node.local === 'clrMru')
    const extLstIndex = mru ? 1 : 0
    const list = root.children.find((node) => node.local === 'extLst')
    if ((mru && root.children[0] !== mru) || (list && root.children[extLstIndex] !== list))
      reject('misordered declarations')
    const properties = {}, components = [], mapped = []
    let colorMru
    if (mru) {
      if (attributes(mru).length) reject('invalid color MRU')
      checkText(mru)
      const preconditionHash = source.preconditionHash
      const locations = new Map()
      mru.children.forEach((node, index) => {
        locations.set(node, [0, 0, index])
        node.children.forEach((transform, ordinal) => locations.set(transform, [0, 0, index, ordinal]))
      })
      const wrap = (node, entry) => ({
        source: { partUri, preconditionHash,
          componentLocator: { path: locations.get(node), preconditionHash } },
        value: entry,
      })
      const check = (node, allowed, children = []) => {
        if (!node || !A_URIS.has(node.uri) ||
          new Set(node.attrs.map((item) => item.name)).size !== node.attrs.length ||
          attributes(node).some((item) => !allowed.includes(item.name)) ||
          node.children.some((child) => !A_URIS.has(child.uri) || !children.includes(child.local)))
          reject('unsupported/malformed color')
        checkText(node)
      }
      const number = (node, key, min = -2147483648, max = 2147483647) => {
        const raw = value(node, key), typed = Number(raw)
        if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(typed) || typed < min || typed > max)
          reject('invalid color value')
        return wrap(node, typed)
      }
      const colorSource = { check, number, raw: value, wrap, fail: reject }
      const componentId = `${partUri}#color-mru:0.0`
      colorMru = { componentId, colors: mru.children.map((node) => readColorSource(node, colorSource)) }
      components.push({ id: componentId, kind: 'property', locator: { path: [0, 0], preconditionHash } })
    }
    if (list) {
      if (attributes(list).length) reject('unsupported/malformed extension list')
      checkText(list)
    }
    for (const [index, wrapper] of (list?.children || []).entries()) {
      const declaration = wrapper.children[0]
      const name = declaration?.local
      const spec = Object.hasOwn(PRESENTATION_PROPERTIES, name) && PRESENTATION_PROPERTIES[name]
      if (
        !P_URIS.has(wrapper.uri) ||
        wrapper.local !== 'ext' ||
        attributes(wrapper).length !== 1 ||
        attributes(wrapper)[0].name !== 'uri' ||
        wrapper.children.length !== 1 ||
        !spec ||
        value(wrapper, 'uri').toUpperCase() !== spec.extensionUri ||
        declaration.uri !== spec.namespaceUri ||
        Object.hasOwn(properties, name) ||
        attributes(declaration).length !== 1 ||
        attributes(declaration)[0].name !== 'val' ||
        declaration.children.length
      )
        reject('unsupported/malformed declaration')
      checkText(wrapper)
      checkText(declaration)
      const raw = value(declaration, 'val')
      if (
        spec.type === 'boolean'
          ? !['0', '1', 'true', 'false'].includes(raw)
          : !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 4294967295
      )
        reject('invalid typed value')
      const entry = inventory.definitions.find(
        (item) => item.partUri === partUri && nodes.get(item.id) === declaration
      )
      if (
        !entry ||
        entry.parentDefinitionId !== null ||
        JSON.stringify(entry.componentLocators[0].path) !== JSON.stringify([0, extLstIndex, index, 0])
      )
        reject('missing/ambiguous source binding')
      properties[name] = {
        value: spec.type === 'boolean' ? ['1', 'true'].includes(raw) : Number(raw),
        namespaceUri: spec.namespaceUri,
        extensionUri: spec.extensionUri,
        componentId: entry.id,
        wrapperLocator: { path: [0, extLstIndex, index], preconditionHash: source.preconditionHash },
      }
      components.push({ id: entry.id, kind: 'property', locator: entry.componentLocators[0] })
      mapped.push(entry)
    }
    if (!mapped.length && !colorMru) continue
    const id = `${partUri}#presentation-properties:0`
    semantic.definitions[id] = {
      id,
      kind: 'presentation-properties',
      source: {
        partUri,
        preconditionHash: source.preconditionHash,
        componentLocator: { path: [0], preconditionHash: source.preconditionHash },
      },
      content: { presentationProperties: properties, ...(colorMru ? { colorMru } : {}) },
      components,
    }
    for (const entry of mapped) {
      if (dispositions.has(entry.id)) reject('duplicate disposition')
      dispositions.set(entry.id, {
        definitionId: entry.id,
        partUri,
        locator: entry.componentLocators[0],
        disposition: 'semantically-mapped',
      })
    }
  }
}
module.exports = { projectPresentationProperties }
