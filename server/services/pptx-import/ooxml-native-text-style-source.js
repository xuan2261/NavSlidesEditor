const { parseXml, descendants, isNode, attr, decodeXml, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { resolveTarget } = require('./package-store/raw-zip')

const child = (node, local, uris = A_URIS) => node?.children.find((item) => isNode(item, uris, local))
const all = (node, local, uris = A_URIS) => descendants(node || { children: [] }, (item) => isNode(item, uris, local))
const value = (node, name) => node ? attr(node, name) : null
const decoded = (node, name) => { const raw = value(node, name); return raw === null ? null : decodeXml(raw) }
const body = (shape) => child(shape, 'txBody', P_URIS)
const placeholder = (shape) => all(shape, 'ph', P_URIS)[0]
const relPath = (part) => `${part.slice(0, part.lastIndexOf('/'))}/_rels/${part.split('/').pop()}.rels`
const R_URIS = new Set(['http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships'])
const REL_URIS = new Set(['http://schemas.openxmlformats.org/package/2006/relationships',
  'http://purl.oclc.org/ooxml/package/relationships'])

function shapes(root) { return all(root, 'sp', P_URIS) }
function identity(shape) { return child(child(shape, 'nvSpPr', P_URIS), 'cNvPr', P_URIS) }
function unique(list, predicate) { const matches = list.filter(predicate); return matches.length === 1 ? matches[0] : null }
function matchShape(root, element) {
  const list = shapes(root)
  const id = element._pptxNativeSource?.nodeId ?? element._pptxSource?.nodeId
    ?? element.sourceId ?? element.ooxmlId ?? element.shapeId
  if (id != null) return unique(list, (shape) => value(identity(shape), 'id') === String(id))
  const name = element.name || element._pptxSource?.name
  return name ? unique(list, (shape) => decoded(identity(shape), 'name') === name) : null
}
function inheritedShape(root, ph, byType = false) {
  if (!ph) return null
  const idx = value(ph, 'idx') ?? '0'
  const type = value(ph, 'type') || 'obj'
  return unique(shapes(root), (shape) => {
    const candidate = placeholder(shape)
    if (!candidate) return false
    if (!byType) return (value(candidate, 'idx') ?? '0') === idx
    const candidateType = value(candidate, 'type') || 'obj'
    return candidateType === type || (type === 'obj' && candidateType === 'body')
  })
}

async function nativeSourceContext(zip, slideIndex) {
  const cache = new Map()
  async function part(uri) {
    if (!uri) return null
    if (!cache.has(uri)) {
      cache.set(uri, (async () => {
        const file = zip.file(uri)
        if (!file) return null
        try {
          const xml = await file.async('string')
          return { uri, xml, children: parseXml(xml) }
        } catch (cause) {
          throw new Error(`Cannot resolve native text source ${uri}`, { cause })
        }
      })())
    }
    return cache.get(uri)
  }
  async function relationships(uri) {
    const root = await part(relPath(uri))
    return root ? all(root, 'Relationship', REL_URIS) : []
  }
  async function related(uri, suffix) {
    const matches = (await relationships(uri)).filter((node) => value(node, 'Type')?.endsWith(`/${suffix}`))
    return matches.length === 1 && value(matches[0], 'TargetMode') !== 'External'
      ? part(resolveTarget(uri, decoded(matches[0], 'Target'))) : null
  }
  async function themeFor(parts, master) {
    if (!master) return null
    for (const source of parts.filter(Boolean)) {
      if ((await relationships(source.uri)).some((node) => value(node, 'Type')?.endsWith('/themeOverride'))) return null
    }
    return related(master.uri, 'theme')
  }
  const presentation = await part('ppt/presentation.xml')
  if (!presentation) return null
  const slideIds = all(child(presentation.children[0], 'sldIdLst', P_URIS), 'sldId', P_URIS)
  const selected = slideIds[slideIndex]
  const rid = selected?.attrs.find((item) => item.name.includes(':') &&
    item.name.split(':')[1] === 'id' && R_URIS.has(selected.namespaces[item.name.split(':')[0]]))?.value
  const rels = await relationships(presentation.uri)
  const slideRel = unique(rels, (node) => value(node, 'Id') === rid && value(node, 'Type')?.endsWith('/slide'))
  const foreground = slideRel && value(slideRel, 'TargetMode') !== 'External'
    ? await part(resolveTarget(presentation.uri, decoded(slideRel, 'Target'))) : null
  return {
    defaults: child(presentation.children[0], 'defaultTextStyle', P_URIS),
    async resolve(element) {
      const source = element._pptxNativePartUri ? await part(element._pptxNativePartUri) : foreground
      if (!source) return null
      const shape = matchShape(source, element)
      if (!shape || !body(shape)) return null
      const ph = placeholder(shape)
      const layout = source.uri.includes('/slides/') ? await related(source.uri, 'slideLayout') : null
      const master = layout ? await related(layout.uri, 'slideMaster')
        : source.uri.includes('/slideLayouts/') ? await related(source.uri, 'slideMaster')
          : source.uri.includes('/slideMasters/') ? source : null
      // Native master/layout elements retain their source identity, but use host
      // slide color overrides only when the host's relationship chain matches.
      let slide = source.uri.includes('/slides/') ? source : null
      let applicableLayout = layout || (source.uri.includes('/slideLayouts/') ? source : null)
      if (!slide && foreground) {
        const hostLayout = await related(foreground.uri, 'slideLayout')
        const hostMaster = hostLayout ? await related(hostLayout.uri, 'slideMaster') : null
        if (applicableLayout ? hostLayout?.uri === applicableLayout.uri : master && hostMaster?.uri === master.uri) {
          slide = foreground
          applicableLayout = hostLayout
        }
      }
      const theme = await themeFor([slide, applicableLayout, master], master)
      const layoutShape = inheritedShape(layout, ph)
      const masterShape = inheritedShape(master, placeholder(layoutShape) || ph, true)
      return { source, shape, body: body(shape), ph, layoutShape, masterShape, master,
        slide, layout: applicableLayout, theme }
    },
  }
}

module.exports = { nativeSourceContext, child, all, value, decoded, body }
