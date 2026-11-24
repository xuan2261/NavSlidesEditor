const { parseSpTree } = require('../ooxml-scene-graph/parse-sptree')
const { parseRelationshipTargets } = require('../ooxml-scene-graph/parse-rels')
const { parseXml, attr, decodeXml } = require('../ooxml-text-run-xml')
const { readSlideOrder } = require('../slide-order')

async function readPart(zip, partUri) {
  const entry = partUri && zip?.file?.(partUri)
  return entry ? entry.async('string') : ''
}

function relationshipPart(partUri) {
  const slash = partUri.lastIndexOf('/')
  return `${partUri.slice(0, slash)}/_rels/${partUri.slice(slash + 1)}.rels`
}

async function relationships(zip, partUri) {
  const relPart = relationshipPart(partUri)
  return parseRelationshipTargets(await readPart(zip, relPart), relPart)
}

async function resolveNativeParts(zip, slideIndex) {
  const slidePath =
    (await readSlideOrder(zip))[slideIndex] ||
    (!zip?.file?.('ppt/presentation.xml') ? `ppt/slides/slide${slideIndex + 1}.xml` : null)
  if (!slidePath || !/^ppt\/slides\/[^/]+\.xml$/i.test(slidePath))
    return { slidePath: null, layoutPath: null, masterPath: null }
  const slideRels = await relationships(zip, slidePath)
  const layoutPath = slideRels.find((rel) => /\/slideLayout$/.test(rel.type || ''))?.target || null
  const layoutRels = layoutPath ? await relationships(zip, layoutPath) : []
  const masterPath = layoutRels.find((rel) => /\/slideMaster$/.test(rel.type || ''))?.target || null
  return { slidePath, layoutPath, masterPath }
}

function falseFlag(value) {
  return value === '0' || value === 'false'
}

function masterVisible(xml) {
  const root = xml ? parseXml(xml)[0] : null
  return !root || !falseFlag(attr(root, 'showMasterSp'))
}

function sourceHidden(node) {
  const nv = String(node.sourceXml).match(/<(?:[\w]+:)?cNvPr\b[^>]*>/i)?.[0] || ''
  return /\bhidden\s*=\s*(["'])(?:1|true)\1/i.test(nv)
}

function sourceKindMatches(element, node) {
  const kind = element.type === 'group' ? 'grpSp' : element.type === 'image' ? 'pic' : null
  return kind ? node.kind === kind : ['shape', 'cxnSp', 'graphicFrame'].includes(node.kind)
}

function sourceMatches(element, node) {
  if (element.name != null && element.name !== decodeXml(node.name || '')) return false
  if (!sourceKindMatches(element, node)) return false
  if (!node.xfrm) return element.name != null
  return [
    [element.left ?? element.x, node.xfrm.x],
    [element.top ?? element.y, node.xfrm.y],
    [element.width, node.xfrm.cx],
    [element.height, node.xfrm.cy],
  ].every(
    ([raw, source]) =>
      raw != null && source != null && Math.abs(Number(raw) - Number(source)) <= 0.00011
  )
}

function rawOrder(left, right) {
  const a = left?.order == null ? NaN : Number(left.order)
  const b = right?.order == null ? NaN : Number(right.order)
  if (Number.isFinite(a) && Number.isFinite(b)) return a - b
  if (Number.isFinite(a)) return -1
  if (Number.isFinite(b)) return 1
  return 0
}

function matchGroupChild(element, candidates, siblings) {
  const sourceId =
    element.sourceId ?? element.ooxmlId ?? element.shapeId ?? element._pptxSource?.nodeId
  if (sourceId == null && siblings.filter((child) => child.name === element.name).length !== 1)
    return null
  const matches = candidates.filter(
    (item) =>
      sourceKindMatches(element, item.node) &&
      (sourceId != null
        ? String(sourceId) === String(item.node.id)
        : element.name != null && element.name === decodeXml(item.node.name || ''))
  )
  // Group-local geometry may be offset/scaled by chOff/chExt. A unique identity
  // within the actual source group is proof; ordinal/geometry guesses are not.
  if (matches.length !== 1 || matches[0].used) return null
  matches[0].used = true
  return matches[0].node
}

function tagPart(element, partUri, layer, node, unmatchedId, layoutNodeOrder, groupOrder) {
  const nativeSource = { nodeId: String(node?.id ?? unmatchedId), kind: node?.kind || element.type }
  // Flattened group paints stay contiguous, including ambiguous descendants.
  const paintOrder = groupOrder ?? layoutNodeOrder?.get(nativeSource.nodeId)
  if (layoutNodeOrder && paintOrder != null) layoutNodeOrder.set(nativeSource.nodeId, paintOrder)
  const tagged = {
    ...element,
    _pptxNativeLayer: layer,
    _pptxNativeSource: nativeSource,
    ...(partUri ? { _pptxNativePartUri: partUri } : {}),
  }
  if (element.type === 'group' && Array.isArray(element.elements)) {
    const candidates = node
      ? parseSpTree(node.sourceXml)
          .filter((child) => child.parentId === node.id)
          .map((child) => ({ node: child, used: false }))
      : []
    tagged.elements = element.elements.flatMap((child, index) => {
      const source = matchGroupChild(child, candidates, element.elements)
      if (source && sourceHidden(source)) return []
      return [
        tagPart(
          child,
          partUri,
          layer,
          source,
          `${nativeSource.nodeId}/unmatched-${index}`,
          layoutNodeOrder,
          paintOrder
        ),
      ]
    })
  }
  return tagged
}

/** Keep native parser payloads intact: media and geometry still use the normal mapper. */
async function mergeNativeLayoutLayers({ slide, zip, slideIndex }) {
  const parts = await resolveNativeParts(zip, slideIndex)
  const [slideXml, layoutXml, masterXml] = await Promise.all([
    readPart(zip, parts.slidePath),
    readPart(zip, parts.layoutPath),
    readPart(zip, parts.masterPath),
  ])
  const showMaster = masterVisible(slideXml) && masterVisible(layoutXml)
  const candidates = []
  const layoutNodeOrder = new Map()
  const nativeDecorationNodeIds = new Set()
  // pptxtojson reads layout before master, assigning global XML postorder numbers.
  // Consume matching raw elements in that order, including identical cross-layer shapes.
  for (const [xml, partUri, layer] of [
    [layoutXml, parts.layoutPath, 1],
    [masterXml, parts.masterPath, 0],
  ]) {
    const hiddenIds = new Set()
    for (const [index, node] of parseSpTree(xml).entries()) {
      if (sourceHidden(node) || hiddenIds.has(String(node.parentId))) hiddenIds.add(String(node.id))
      if (layer === 1) {
        layoutNodeOrder.set(String(node.id), index)
        // XML fallback walks leaves independently; hidden ancestors must also
        // block their descendants even when the parser omitted the whole group.
        if (hiddenIds.has(String(node.id))) nativeDecorationNodeIds.add(String(node.id))
      }
      if (node.parentId != null || (node.kind !== 'grpSp' && node.ph)) continue
      candidates.push({ node, partUri, layer, used: false })
    }
  }
  const background = []
  for (const element of [...(slide.layoutElements || [])].sort(rawOrder)) {
    const source = candidates.find((item) => !item.used && sourceMatches(element, item.node))
    if (source) source.used = true
    if (source?.layer === 1) {
      nativeDecorationNodeIds.add(String(source.node.id))
      if (source.node.kind === 'grpSp') {
        for (const child of parseSpTree(source.node.sourceXml))
          nativeDecorationNodeIds.add(String(child.id))
      }
    }
    if (source && (sourceHidden(source.node) || (source.layer === 0 && !showMaster))) continue
    // Unmatched parser content remains visible; suppression requires exact source proof.
    background.push(
      tagPart(
        element,
        source?.partUri,
        source?.layer ?? 1,
        source?.node,
        `unmatched-${background.length}`,
        source?.layer === 1 ? layoutNodeOrder : null
      )
    )
  }
  const foreground = (slide.elements || []).filter((element) => {
    const source = element?._pptxSource
    if (!source?.fromLayoutDecoration) return true
    const prefix = `layout:${parts.layoutPath}:`
    return (
      !String(source.nodeId || '').startsWith(prefix) ||
      !nativeDecorationNodeIds.has(String(source.nodeId).slice(prefix.length))
    )
  })
  return {
    slide: { ...slide, elements: [...background, ...foreground] },
    ...parts,
    nativeDecorationNodeIds,
    layoutNodeOrder,
  }
}

module.exports = { mergeNativeLayoutLayers, resolveNativeParts }
