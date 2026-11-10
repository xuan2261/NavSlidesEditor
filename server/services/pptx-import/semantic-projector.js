const { createHash } = require('node:crypto')
const { buildSemanticInventory } = require('./semantic-inventory')
const { parseXml, attr, decodeXml, textContent, descendants, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { child, all } = require('./ooxml-native-text-style-source')
const { persistZipMediaRef, persistImageBuffer, createMediaIndex } = require('./media')
const { convertEmfWmfBuffer } = require('./vector-media-convert')
const { resolveTarget } = require('./package-store/raw-zip')
const { relationshipPart } = require('./slide-order')
const { PptxImportError } = require('./diagnostics')
const { normalizePptxSemanticDocument } = require('../../../shared/src/pptx-semantic-document')
const { compactSemanticGraph } = require('../../../shared/src/pptx-semantic-source-graph')
const { normalizeSemanticPresentation } = require('../../../shared/src/pptx-semantic-presentation')
const { readSemanticTextAdmission } = require('./ooxml-semantic-text-admission')
const { readPictureSource, pictureMedia } = require('./ooxml-semantic-picture')
const { extractGeometryImageMetadata } = require('./geometry-image-metadata')
const { readSemanticMedia } = require('./ooxml-semantic-media')
const { readSemanticTiming } = require('./ooxml-semantic-timing')
const { buildSemanticTextStyleContexts } = require('./ooxml-semantic-text-context')
const { compactTextContexts } = require('../../../shared/src/pptx-semantic-text-context-codec')
const { readNativeCreationIdentity } = require('./ooxml-native-creation-identity')
const { projectPresentationProperties } = require('./semantic-presentation-properties')
const { projectSourcePartIdentities } = require('./semantic-source-part-identities')
const { projectSourceGuideLists } = require('./semantic-source-guides')
const { projectSourceTransitions } = require('./semantic-source-transitions')
const { projectTheme3dAppearance } = require('./ooxml-theme-3d-appearance')
const { sourceTransition } = require('../../../shared/src/pptx-transition-document')
const { projectSlideMetadata } = require('./semantic-slide-metadata')
const { validateNotesSourceExtensions } = require('./semantic-notes-source-extensions')
const { readShape3dAppearance } = require('./ooxml-shape-3d-appearance')
const { createBoundedWarnings } = require('./warning-budget')
const { projectTableFrame } = require('./semantic-table-adapter')
const { projectChartFrame } = require('./semantic-chart-adapter')
const { projectSmartArtFrame } = require('./semantic-smartart-adapter')
const { projectOmmlShape } = require('./semantic-omml-adapter')
const { standaloneEquationTopology } = require('./ooxml-semantic-text-equation')
const { resolveRgbPaint } = require('../../../shared/src/pptx-style-resolution')
const { materializeTextDocument } = require('../../../shared/src/pptx-text-materialization')
const { textDocumentHtml } = require('../../../shared/src/pptx-shape-label')
const { readGeometrySource } = require('./ooxml-geometry-source')
const { readSemanticSvgPicture } = require('./semantic-svg-adapter')
const {
  buildGeometryStyleSources,
  parseGeometryEffectSource,
} = require('./ooxml-geometry-style-source')
const { sourceNamespace, sourceSlidesForImport } = require('./semantic-source-slides')
const { stageGeometryBlipSourceAssets } = require('./geometry-blip-source-assets')
const { geometryProvider } = require('../../../shared/src/pptx-geometry-style-records')
const {
  resolveGeometryTransform,
  materializeGeometry,
} = require('../../../shared/src/pptx-geometry-style-resolution')
const {
  PRESET_DASH_PATTERNS,
  LINE_END_TYPES,
  LINE_END_SIZES,
  geometryFillPaint,
  geometryStrokePaint,
} = require('../../../shared/src/pptx-geometry-document')
const {
  leafTransform,
  groupTransform,
  multiply,
  invert,
  transformPoint,
  IDENTITY,
} = require('../../../shared/src/pptx-affine')
const EMU_TO_CSS = 96 / 914400
const REL_URIS = new Set(['http://schemas.openxmlformats.org/package/2006/relationships'])
const R_URIS = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const value = (node, name) => (node ? decodeXml(attr(node, name) ?? '') : '')
function fail(source, detail) {
  const error = new PptxImportError(
    `Semantic admission ${detail}: ${source.partUri}#${source.nativeId ?? source.id}`,
    { status: 422 }
  )
  error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
  error.sourceLocation = { partUri: source.partUri, definitionId: source.id,
    ...(source.componentLocators?.[0]?.path ? { path: [...source.componentLocators[0].path] } : {}) }
  throw error
}
function fillNodeText(node, context) {
  if (node.selfClosing) return
  let cursor = node.end + 1
  for (const nested of node.children) {
    if (context.xml.slice(cursor, nested.start).trim()) fail(context.source, 'invalid fill text')
    cursor = nested.closeEnd + 1
  }
  if (context.xml.slice(cursor, node.closeStart).trim()) fail(context.source, 'invalid fill text')
}
function nativeRgbFillColor(color, context) {
  const source = context.source
  if (
    !color ||
    !A_URIS.has(color.uri) ||
    color.local !== 'srgbClr' ||
    color.attrs.length !== 1 ||
    color.attrs[0].name !== 'val' ||
    !/^[\da-f]{6}$/i.test(value(color, 'val'))
  )
    fail(source, 'invalid fill color')
  fillNodeText(color, context)
  const result = { kind: 'srgb', value: value(color, 'val') }
  if (color.children.length)
    result.transforms = color.children.map((entry) => {
      const raw = value(entry, 'val')
      if (
        !A_URIS.has(entry.uri) ||
        !['tint', 'shade', 'lumMod', 'lumOff', 'alpha', 'alphaMod', 'alphaOff'].includes(
          entry.local
        ) ||
        entry.attrs.length !== 1 ||
        entry.attrs[0].name !== 'val' ||
        entry.children.length ||
        textContent(context.xml, entry).trim().length ||
        !/^-?\d+$/.test(raw)
      )
        fail(source, 'invalid fill color transform')
      return { kind: entry.local, value: Number(raw) }
    })
  try {
    resolveRgbPaint(result)
  } catch (error) {
    fail(source, error.message)
  }
  return result
}
function nativeGradient(fill, context) {
  const source = context.source
  const stopList = child(fill, 'gsLst')
  const line = child(fill, 'lin')
  const path = child(fill, 'path')
  const tile = child(fill, 'tileRect')
  if (
    fill.attrs.some((entry) => !['rotWithShape', 'flip'].includes(entry.name)) ||
    !['1', 'true'].includes(value(fill, 'rotWithShape')) ||
    (fill.attrs.some((entry) => entry.name === 'flip') && value(fill, 'flip') !== 'none') ||
    !stopList ||
    !!line === !!path ||
    fill.children.some(
      (entry) =>
        !A_URIS.has(entry.uri) || !['gsLst', 'lin', 'path', 'tileRect'].includes(entry.local)
    ) ||
    ['gsLst', 'lin', 'path', 'tileRect'].some(
      (local) => fill.children.filter((entry) => entry.local === local).length > 1
    ) ||
    stopList.attrs.length ||
    (line &&
      (line.attrs.length !== 2 ||
        line.attrs.some((entry) => !['ang', 'scaled'].includes(entry.name)) ||
        line.children.length ||
        !/^\d+$/.test(value(line, 'ang')) ||
        !['0', '1', 'false', 'true'].includes(value(line, 'scaled')))) ||
    (path &&
      (path.attrs.some((entry) => entry.name !== 'path') ||
        path.attrs.length > 1 ||
        (path.attrs.length && !['circle', 'rect', 'shape'].includes(value(path, 'path'))) ||
        path.children.length > 1 ||
        path.children.some((entry) => !A_URIS.has(entry.uri) || entry.local !== 'fillToRect')))
  )
    fail(source, 'unsupported/malformed gradient')
  for (const entry of [fill, stopList, line, path]) if (entry) fillNodeText(entry, context)
  const rectangle = (node) => {
    if (
      node.children.length ||
      node.attrs.some((entry) => !['l', 't', 'r', 'b'].includes(entry.name)) ||
      new Set(node.attrs.map((entry) => entry.name)).size !== node.attrs.length
    )
      fail(source, 'invalid gradient rectangle')
    fillNodeText(node, context)
    return Object.fromEntries(
      node.attrs.map((entry) => {
        const raw = value(node, entry.name)
        if (!/^-?\d+$/.test(raw)) fail(source, 'invalid gradient rectangle coordinate')
        return [entry.name, Number(raw)]
      })
    )
  }
  const stops = stopList.children.map((entry) => {
    if (
      !A_URIS.has(entry.uri) ||
      entry.local !== 'gs' ||
      entry.attrs.length !== 1 ||
      entry.attrs[0].name !== 'pos' ||
      !/^\d+$/.test(value(entry, 'pos')) ||
      entry.children.length !== 1
    )
      fail(source, 'invalid gradient stop')
    fillNodeText(entry, context)
    return {
      pos: Number(value(entry, 'pos')),
      color: nativeRgbFillColor(entry.children[0], context),
    }
  })
  return {
    ...(line
      ? {
          kind: 'linear',
          angle: Number(value(line, 'ang')),
          scaled: ['1', 'true'].includes(value(line, 'scaled')),
        }
      : {
          kind: 'path',
          path: path.attrs.length ? value(path, 'path') : 'shape',
          ...(child(path, 'fillToRect')
            ? { fillToRect: rectangle(child(path, 'fillToRect')) }
            : {}),
        }),
    rotWithShape: true,
    stops,
    ...(tile ? { tileRect: rectangle(tile) } : {}),
    ...(fill.attrs.some((entry) => entry.name === 'flip') ? { flip: 'none' } : {}),
  }
}
function nativeGeometryEffects(effects, context) {
  const source = context.source
  const check = (node, attributes, children = []) => {
    if (
      !A_URIS.has(node.uri) ||
      node.attrs.some(
        (attribute) => !/^xmlns(?::|$)/.test(attribute.name) && !attributes.includes(attribute.name)
      ) ||
      new Set(node.attrs.map((attribute) => attribute.name)).size !== node.attrs.length ||
      node.children.some((entry) => !A_URIS.has(entry.uri) || !children.includes(entry.local))
    )
      fail(source, `unsupported/malformed ${node.local}`)
    fillNodeText(node, context)
  }
  const color = (node) => {
    if (node.children.length !== 1) fail(source, 'missing/ambiguous effect color')
    return nativeRgbFillColor(node.children[0], context)
  }
  try {
    return parseGeometryEffectSource(effects, {
      check,
      raw: attr,
      wrap: (_, result) => result,
      number: (node, key, min, max) => {
        const raw = value(node, key),
          result = Number(raw)
        if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(result) || result < min || result > max)
          fail(source, 'invalid effect integer')
        return result
      },
      flag: (node, key) => {
        const raw = value(node, key)
        if (!['0', '1', 'false', 'true'].includes(raw)) fail(source, 'invalid effect boolean')
        return raw === '1' || raw === 'true'
      },
      color,
      fill: (node) => {
        if (node.local === 'noFill') {
          check(node, [])
          return { color: { kind: 'none' } }
        }
        if (node.local === 'solidFill') {
          check(node, [], ['srgbClr'])
          return { color: color(node) }
        }
        if (node.local === 'gradFill') return { gradient: nativeGradient(node, context) }
        fail(source, `unsupported direct effect fill ${node.local}`)
      },
    })
  } catch (error) {
    if (error instanceof PptxImportError) throw error
    fail(source, error.message)
  }
}
function number(node, name, source) {
  const raw = value(node, name),
    result = Number(raw)
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(result)) fail(source, `missing/invalid ${name}`)
  return result
}
function transform(node, source) {
  const properties = child(node, source.kind === 'group' ? 'grpSpPr' : 'spPr', P_URIS)
  const xfrm = child(properties, 'xfrm') || child(node, 'xfrm', P_URIS)
  const pair = (local, x, y) => ({
    [x]: number(child(xfrm, local), x, source),
    [y]: number(child(xfrm, local), y, source),
  })
  const data = { off: pair('off', 'x', 'y'), ext: pair('ext', 'cx', 'cy') }
  for (const flag of ['flipH', 'flipV']) {
    const raw = value(xfrm, flag)
    if (raw && !['0', '1', 'true', 'false'].includes(raw)) fail(source, `invalid ${flag}`)
    data[flag] = raw === '1' || raw === 'true'
  }
  if (value(xfrm, 'rot')) data.rotation = number(xfrm, 'rot', source)
  if (source.kind === 'group')
    Object.assign(data, { chOff: pair('chOff', 'x', 'y'), chExt: pair('chExt', 'cx', 'cy') })
  try {
    return {
      extent: data.ext,
      sourceTransform: data,
      localTransform: source.kind === 'group' ? groupTransform(data) : leafTransform(data),
    }
  } catch (error) {
    fail(source, error.message)
  }
}
function nativeSourcePlacement(source, parent, group, logicalGeometry) {
  if (parent === IDENTITY) {
    const world = group ? groupTransform(source) : leafTransform(source)
    return { localTransform: world, world, nativeExtent: source.ext }
  }
  const sx = Math.hypot(parent[0], parent[1]),
    sy = Math.hypot(parent[2], parent[3])
  // Native sizing uses source-angle sectors, not the angle of the skewed
  // affine product. An odd own flip reverses exact boundary tie selection.
  const direction = Boolean(source.flipH) !== Boolean(source.flipV) ? -1 : 1
  const turn = 21600000
  const rotation = ((((source.rotation ?? 0) * direction) % turn) + turn) % turn
  const swap = Math.floor((rotation + 2700000) / 5400000) % 2 === 1
  const scaleX = swap ? sy : sx,
    scaleY = swap ? sx : sy
  const nativeExtent = {
    cx: source.ext.cx === 0 ? 0 : source.ext.cx * scaleX,
    cy: source.ext.cy === 0 ? 0 : source.ext.cy * scaleY,
  }
  const basis = multiply(
    [parent[0] / sx, parent[1] / sx, parent[2] / sy, parent[3] / sy, 0, 0],
    leafTransform({ ...source, off: { x: 0, y: 0 }, ext: { cx: 0, cy: 0 } })
  )
  const center = transformPoint(parent, {
    x: source.off.x + source.ext.cx / 2,
    y: source.off.y + source.ext.cy / 2,
  })
  const xScale = group ? nativeExtent.cx / source.chExt.cx : logicalGeometry ? 1 : scaleX
  const yScale = group ? nativeExtent.cy / source.chExt.cy : logicalGeometry ? 1 : scaleY
  const [a, b, c, d] = [basis[0] * xScale, basis[1] * xScale, basis[2] * yScale, basis[3] * yScale]
  const cx = group
    ? source.chOff.x + source.chExt.cx / 2
    : (logicalGeometry ? nativeExtent.cx : source.ext.cx) / 2
  const cy = group
    ? source.chOff.y + source.chExt.cy / 2
    : (logicalGeometry ? nativeExtent.cy : source.ext.cy) / 2
  const world = [a, b, c, d, center.x - a * cx - c * cy, center.y - b * cx - d * cy]
  return { localTransform: multiply(invert(parent), world), world, nativeExtent }
}
async function baselineAdapter(context) {
  const { source, node, components } = context
  if (source.kind === 'shape' && standaloneEquationTopology(node))
    return projectOmmlShape(context)
  if (source.kind === 'graphic-frame') {
    const payload = child(child(node, 'graphic'), 'graphicData')
    const uri = value(payload, 'uri')
    for (const [family, local, adapter] of [
      ['chart', 'chart', projectChartFrame],
      ['diagram', 'relIds', projectSmartArtFrame],
    ]) {
      const namespaces = new Set([
        `http://schemas.openxmlformats.org/drawingml/2006/${family}`,
        `http://purl.oclc.org/ooxml/drawingml/${family}`,
      ])
      if (
        namespaces.has(uri) &&
        payload.children.length === 1 &&
        namespaces.has(payload.children[0].uri) &&
        payload.children[0].local === local
      )
        return adapter(context)
    }
  }
  if (source.kind === 'graphic-frame' && components.some((item) => item.kind === 'table'))
    return projectTableFrame(context)
  const externalMedia =
    source.kind === 'picture' &&
    (() => {
      const declarations = [
        ...descendants(
          node,
          (entry) => A_URIS.has(entry.uri) && ['audioFile', 'videoFile'].includes(entry.local)
        ),
      ]
      if (declarations.length !== 1) return null
      const modern = descendants(
        node,
        (entry) =>
          entry.uri === 'http://schemas.microsoft.com/office/powerpoint/2010/main' &&
          entry.local === 'media'
      )
      if (modern.length > 0) return null
      const id = declarations[0].attrs.find((a) => a.name.endsWith(':link'))?.value
      if (!id) return null
      const matches = context
        .relationships(source.partUri)
        .filter((r) => value(r, 'Id') === decodeXml(id))
      if (matches.length !== 1) return null
      const mode = value(matches[0], 'TargetMode')
      if (mode !== 'External') return null
      return {
        target: decodeXml(value(matches[0], 'Target') || ''),
        declaration: declarations[0],
      }
    })()
  const excluded =
    (source.kind === 'graphic-frame' &&
      components.some((item) => item.disposition === 'owner-excluded-preserved')) ||
    Boolean(externalMedia)
  if (!['group', 'shape', 'picture', 'connector'].includes(source.kind) && !excluded)
    fail(source, `unimplemented ${source.kind}`)
  const linked = context.geometryDeclarations !== undefined
  const authoredExtent = context.geometryDeclarations?.transform?.value.ext?.value
  // A definition has no host. Missing geometry uses its checked provider later;
  // an authored geometry cannot borrow one occurrence's dimensions as source data.
  const geometry = linked
    ? authoredExtent
      ? { extent: { cx: authoredExtent.cx.value, cy: authoredExtent.cy.value } }
      : {}
    : transform(node, source)
  if (excluded) {
    const preservedGeometry = externalMedia
      ? components.find((item) => ['preset-geometry', 'custom-geometry'].includes(item.kind))
      : null
    let shapeGeometry
    if (preservedGeometry) {
      const spPr = child(node, 'spPr', P_URIS)
      const geometryNode = all(spPr, 'custGeom', A_URIS)[0] || all(spPr, 'prstGeom', A_URIS)[0]
      if (!geometryNode) fail(source, 'missing preserved media geometry')
      try {
        shapeGeometry = readGeometrySource(geometryNode, {
          componentId: preservedGeometry.id,
          ...(linked && !authoredExtent
            ? { template: true }
            : { width: geometry.extent.cx, height: geometry.extent.cy }),
          componentIdFor: (entry) =>
            components.find((item) => context.nodes.get(item.id) === entry)?.id,
        })
      } catch (error) {
        if (!(error instanceof TypeError)) throw error
        fail(source, error.message)
      }
    }
    return {
      kind: 'opaque',
      content: {
        extent: geometry.extent,
        ...(shapeGeometry ? { geometry: shapeGeometry } : {}),
        excludedObjects: components.map((item) => ({
          id: item.id,
          kind: item.kind,
          attributes: {
            ...(externalMedia && item.kind === 'media-segment' ? { externalTarget: externalMedia.target } : {}),
          },
          locator: item.componentLocators[0],
        })),
      },
      ...geometry,
      excluded: true,
      mappedDefinitionIds: [source.id, ...components.map((item) => item.id)],
    }
  }
  if (source.kind === 'group') {
    const properties = child(node, 'grpSpPr', P_URIS)
    if (
      properties.children.some(
        (entry) =>
          !A_URIS.has(entry.uri) ||
          ![
            'xfrm',
            ...(linked
              ? ['solidFill', 'noFill', 'gradFill', 'pattFill', 'blipFill', 'grpFill']
              : []),
          ].includes(entry.local)
      )
    )
      fail(source, 'unimplemented group paint')
    const groupGeometry = transform(node, source)
    return {
      kind: 'group',
      content: { extent: groupGeometry.extent },
      ...groupGeometry,
      mappedDefinitionIds: [
        source.id,
        ...(context.creationId ? [context.creationId.componentId] : []),
      ],
    }
  }
  const spPr = child(node, 'spPr', P_URIS)
  if (
    spPr.children.some(
      (entry) =>
        !A_URIS.has(entry.uri) ||
        ![
          'xfrm',
          'prstGeom',
          'custGeom',
          'solidFill',
          'noFill',
          'gradFill',
          'ln',
          'effectLst',
          'effectDag',
          'scene3d',
          'sp3d',
          ...(linked ? ['extLst', 'pattFill', 'blipFill', 'grpFill'] : []),
        ].includes(entry.local)
    )
  )
    fail(source, 'unimplemented shape property')
  if (!linked && (child(node, 'style', P_URIS) || all(node, 'ph', P_URIS).length))
    fail(source, 'unimplemented inherited shape style')
  const preset = child(spPr, 'prstGeom'),
    name = value(preset, 'prst')
  const custom = child(spPr, 'custGeom')
  if ((!linked && !preset && !custom) || (preset && custom))
    fail(source, 'missing/ambiguous geometry')
  const geometrySource = components.find((item) =>
    ['preset-geometry', 'custom-geometry'].includes(item.kind)
  )
  if ((preset || custom) && !geometrySource) fail(source, 'missing geometry component identity')
  let shapeGeometry
  try {
    if (geometrySource)
      shapeGeometry = readGeometrySource(custom || preset, {
        componentId: geometrySource.id,
        ...(linked && !authoredExtent
          ? { template: true }
          : { width: geometry.extent.cx, height: geometry.extent.cy }),
        componentIdFor: (entry) =>
          components.find((item) => context.nodes.get(item.id) === entry)?.id,
      })
  } catch (error) {
    if (!(error instanceof TypeError)) throw error
    fail(source, error.message)
  }
  if (source.kind === 'connector') {
    if (!shapeGeometry) fail(source, 'connector without authored geometry')
    const nonvisual = child(child(node, 'nvCxnSpPr', P_URIS), 'cNvCxnSpPr', P_URIS)
    if (
      !nonvisual ||
      nonvisual.attrs.length ||
      nonvisual.children.some(
        (entry) =>
          !A_URIS.has(entry.uri) || !['cxnSpLocks', 'stCxn', 'endCxn'].includes(entry.local)
      )
    )
      fail(source, 'unimplemented connector nonvisual properties')
    const locks = nonvisual.children.filter((entry) => entry.local === 'cxnSpLocks')
    if (
      locks.length > 1 ||
      locks.some(
        (entry) =>
          entry.attrs.length ||
          entry.children.length ||
          (!entry.selfClosing && textContent(context.xml, entry).trim().length)
      )
    )
      fail(source, 'unimplemented connector locks')
    const endpoints = {}
    for (const [local, end] of [
      ['stCxn', 'start'],
      ['endCxn', 'end'],
    ]) {
      const entries = nonvisual.children.filter((entry) => entry.local === local)
      if (entries.length > 1) fail(source, 'ambiguous connector binding')
      if (!entries.length) continue
      const entry = entries[0],
        shapeId = value(entry, 'id'),
        index = value(entry, 'idx')
      const targets = context.inventoryDefinitions.filter(
        (target) => target.partUri === source.partUri && target.nativeId === shapeId
      )
      const component = components.find((item) => context.nodes.get(item.id) === entry)
      if (
        entry.children.length ||
        entry.attrs.length !== 2 ||
        entry.attrs.some((attribute) => !['id', 'idx'].includes(attribute.name)) ||
        !/^\d+$/.test(shapeId) ||
        !/^\d+$/.test(index) ||
        !Number.isSafeInteger(Number(index)) ||
        Number(index) > 255 ||
        targets.length !== 1 ||
        !component
      )
        fail(source, 'missing/malformed connector target')
      endpoints[end] = {
        shapeId,
        index: Number(index),
        targetDefinitionId: targets[0].id,
        componentId: component.id,
      }
    }
    shapeGeometry.connector = endpoints
  }
  if (linked)
    return finishLeafProjection(
      context,
      geometry,
      {
        ...(geometry.extent ? { extent: geometry.extent } : {}),
        ...(shapeGeometry ? { geometry: shapeGeometry } : {}),
      },
      { type: 'shape', shape: name === 'ellipse' ? 'circle' : 'rect' }
    )
  const fill = child(spPr, 'solidFill'),
    color = child(fill, 'srgbClr'),
    noFill = child(spPr, 'noFill'),
    gradientFill = child(spPr, 'gradFill')
  if (
    spPr.children.filter(
      (entry) => A_URIS.has(entry.uri) && ['solidFill', 'noFill', 'gradFill'].includes(entry.local)
    ).length > 1 ||
    (noFill &&
      (noFill.attrs.length ||
        noFill.children.length ||
        textContent(context.xml, noFill).trim().length)) ||
    (fill &&
      (fill.attrs.length ||
        fill.children.length !== 1 ||
        !color ||
        color.attrs.length !== 1 ||
        color.attrs[0].name !== 'val' ||
        !/^[\da-f]{6}$/i.test(value(color, 'val'))))
  )
    fail(source, 'unimplemented fill')
  for (const entry of [fill, color]) {
    if (!entry || entry.selfClosing) continue
    let cursor = entry.end + 1
    for (const nested of entry.children) {
      if (context.xml.slice(cursor, nested.start).trim()) fail(source, 'invalid fill text')
      cursor = nested.closeEnd + 1
    }
    if (context.xml.slice(cursor, entry.closeStart).trim()) fail(source, 'invalid fill text')
  }
  const fillColor = color ? nativeRgbFillColor(color, context) : { kind: 'none' }
  let resolvedFill
  if (color) {
    try {
      resolvedFill = resolveRgbPaint(fillColor)
    } catch (error) {
      fail(source, error.message)
    }
  }
  if (fill || noFill)
    shapeGeometry.style = {
      ...shapeGeometry.style,
      fill: { color: fillColor },
    }
  const gradient = gradientFill ? nativeGradient(gradientFill, context) : null
  let gradientPaint
  if (gradient) {
    shapeGeometry.style = { ...shapeGeometry.style, fill: { gradient } }
    try {
      gradientPaint = geometryFillPaint(shapeGeometry)
    } catch (error) {
      fail(source, error.message)
    }
  }
  const effectNodes = spPr.children.filter(
    (entry) => A_URIS.has(entry.uri) && ['effectLst', 'effectDag'].includes(entry.local)
  )
  if (effectNodes.length > 1) fail(source, 'unsupported/malformed effect program')
  const effects = effectNodes[0]
  if (effects) {
    shapeGeometry.style = {
      ...shapeGeometry.style,
      effects: nativeGeometryEffects(effects, context),
    }
  }
  let content = {
    extent: geometry.extent,
    geometry: shapeGeometry,
    fill: gradient ? { gradient } : fillColor,
  }
  let compatibility = {
    type: 'shape',
    shape: name === 'ellipse' ? 'circle' : 'rect',
    fill: gradientPaint
      ? gradientPaint.fill
      : resolvedFill
        ? `#${resolvedFill.rgb}`
        : 'transparent',
    stroke: 'none',
    strokeWidth: 0,
  }
  const outline = child(spPr, 'ln')
  if (spPr.children.filter((entry) => A_URIS.has(entry.uri) && entry.local === 'ln').length > 1)
    fail(source, 'ambiguous outline')
  if (outline) {
    const outlineFill = child(outline, 'solidFill')
    const outlineNone = child(outline, 'noFill')
    const outlineColor = child(outlineFill, 'srgbClr')
    const width = value(outline, 'w')
    const hasWidth = outline.attrs.some((attribute) => attribute.name === 'w')
    if (
      outline.children.some(
        (entry) =>
          !A_URIS.has(entry.uri) ||
          ![
            'solidFill',
            'noFill',
            'custDash',
            'prstDash',
            'round',
            'bevel',
            'miter',
            'headEnd',
            'tailEnd',
          ].includes(entry.local)
      ) ||
      [
        'solidFill',
        'noFill',
        'custDash',
        'prstDash',
        'round',
        'bevel',
        'miter',
        'headEnd',
        'tailEnd',
      ].some((local) => outline.children.filter((entry) => entry.local === local).length > 1) ||
      (outlineNone && outlineFill) ||
      (outlineNone
        ? outlineNone.attrs.length ||
          outlineNone.children.length ||
          textContent(context.xml, outlineNone).trim().length
        : outlineFill?.attrs.length || outlineFill?.children.length !== 1 || !outlineColor) ||
      ((hasWidth || !outlineNone) && (!/^\d+$/.test(width) || !Number.isSafeInteger(Number(width))))
    )
      fail(source, 'unimplemented/malformed outline')
    if (outline.attrs.some((attribute) => !['w', 'cap', 'cmpd', 'algn'].includes(attribute.name)))
      fail(source, 'unimplemented outline attribute')
    const cap = value(outline, 'cap')
    if (cap && !['flat', 'rnd', 'sq'].includes(cap)) fail(source, 'invalid outline cap')
    const nativeFields = {}
    for (const [attribute, field, supported] of [
      ['cmpd', 'compound', 'sng'],
      ['algn', 'alignment', 'ctr'],
    ]) {
      const matches = outline.attrs.filter((entry) => entry.name === attribute)
      if (!matches.length) continue
      if (matches.length !== 1 || value(outline, attribute) !== supported)
        fail(source, `unsupported outline ${field}`)
      nativeFields[field] = supported
    }
    const joins = outline.children.filter(
      (entry) => A_URIS.has(entry.uri) && ['round', 'bevel', 'miter'].includes(entry.local)
    )
    if (joins.length > 1) fail(source, 'ambiguous outline join')
    const join = joins[0]
    const miterLimit = join?.attrs.some((attribute) => attribute.name === 'lim')
      ? value(join, 'lim')
      : undefined
    if (
      join &&
      (join.children.length ||
        join.attrs.some((attribute) => join.local !== 'miter' || attribute.name !== 'lim') ||
        (miterLimit !== undefined &&
          (!/^\d+$/.test(miterLimit) || Number(miterLimit) > 2147483647)))
    )
      fail(source, 'malformed outline join')
    const dash = child(outline, 'custDash')
    const presetDash = child(outline, 'prstDash')
    const presetValue = value(presetDash, 'val')
    if (
      presetDash &&
      (dash ||
        presetDash.attrs.length !== 1 ||
        presetDash.attrs[0].name !== 'val' ||
        presetDash.children.length ||
        !Object.hasOwn(PRESET_DASH_PATTERNS, presetValue))
    )
      fail(source, 'malformed/ambiguous outline preset dash')
    const stops = dash?.children.map((entry) => {
      if (
        !A_URIS.has(entry.uri) ||
        entry.local !== 'ds' ||
        entry.children.length ||
        entry.attrs.length !== 2 ||
        entry.attrs.some((attribute) => !['d', 'sp'].includes(attribute.name))
      )
        fail(source, 'malformed outline dash')
      const result = { dash: value(entry, 'd'), space: value(entry, 'sp') }
      if (
        Object.values(result).some(
          (amount) => !/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount))
        )
      )
        fail(source, 'malformed outline dash percentage')
      return { dash: Number(result.dash), space: Number(result.space) }
    })
    if (dash && (dash.attrs.length || !stops.length || stops.length > 256))
      fail(source, 'malformed outline dash')
    const ends = {}
    for (const field of ['headEnd', 'tailEnd']) {
      const end = child(outline, field)
      if (!end) continue
      if (
        end.children.length ||
        new Set(end.attrs.map((attribute) => attribute.name)).size !== end.attrs.length ||
        end.attrs.some(
          (attribute) =>
            !['type', 'w', 'len'].includes(attribute.name) ||
            !(attribute.name === 'type' ? LINE_END_TYPES : LINE_END_SIZES).includes(
              value(end, attribute.name)
            )
        ) ||
        textContent(context.xml, end).trim().length
      )
        fail(source, 'malformed outline line end')
      ends[field] = Object.fromEntries(
        end.attrs.map((attribute) => [attribute.name, value(end, attribute.name)])
      )
    }
    shapeGeometry.style = {
      ...shapeGeometry.style,
      stroke: {
        color: outlineNone ? { kind: 'none' } : nativeRgbFillColor(outlineColor, context),
        ...(hasWidth ? { width: Number(width) } : {}),
        ...(cap ? { cap } : {}),
        ...nativeFields,
        ...(join
          ? {
              join: {
                kind: join.local,
                ...(miterLimit === undefined ? {} : { limit: Number(miterLimit) }),
              },
            }
          : {}),
        ...(dash
          ? { dash: { kind: 'custom', stops } }
          : presetDash
            ? { dash: { kind: 'preset', value: presetValue } }
            : {}),
        ...ends,
      },
    }
    Object.assign(compatibility, geometryStrokePaint(shapeGeometry))
  }
  if (gradient) Object.assign(compatibility, geometryFillPaint(shapeGeometry))
  return finishLeafProjection(context, geometry, content, compatibility)
}
async function finishLeafProjection(context, geometry, content, compatibility) {
  const { source, node, components } = context
  let pictureComponent, pictureDpiComponent, svgPicture
  if (source.kind === 'picture') {
    const mediaDeclarations = [...all(node, 'audioFile'), ...all(node, 'videoFile')]
    if (mediaDeclarations.length) {
      const media = await readSemanticMedia(context, fail)
      content = { ...content, mediaDocument: media.document }
      compatibility = media.compatibility
    } else {
      const blipFill = child(node, 'blipFill', P_URIS),
        blip = child(blipFill, 'blip')
      if (!blip) fail(source, 'missing picture blip')
      const relation = blip.attrs.find(
        (item) =>
          item.name.endsWith(':embed') && R_URIS.has(blip.namespaces[item.name.split(':')[0]])
      )
      const match = context
        .relationships(source.partUri)
        .filter(
          (item) =>
            value(item, 'Id') === decodeXml(relation?.value || '') &&
            /\/image$/.test(value(item, 'Type')) &&
            ['', 'Internal'].includes(value(item, 'TargetMode'))
        )
      if (match.length !== 1) fail(source, 'missing/ambiguous image relationship')
      const mediaPart = resolveTarget(source.partUri, value(match[0], 'Target'))
      if (/\.svg$/i.test(mediaPart)) {
        const frameGeometry = components.find((item) => item.kind === 'preset-geometry')
        const frameGeometryNode = frameGeometry && context.nodes.get(frameGeometry.id)
        const srcRect = child(blipFill, 'srcRect', A_URIS)
        const nonzeroCrop = srcRect?.attrs.some((attribute) =>
          ['l', 't', 'r', 'b'].includes(attribute.name) && Number(value(srcRect, attribute.name)) !== 0)
        const frameStroke = content.geometry?.style?.stroke?.color
        if (blip.children.length || nonzeroCrop || value(frameGeometryNode, 'prst') !== 'rect' ||
            (frameStroke && frameStroke.kind !== 'none'))
          fail(source, 'unsupported SVG picture effects, crop, or frame geometry')
        svgPicture = await readSemanticSvgPicture(context, blip, blipFill, fail)
        content = { ...content, svgDocument: svgPicture.document }
        compatibility = { type: 'svg' }
      } else {
        let media = await persistZipMediaRef(
          context.mediaIndex,
          mediaPart,
          context.uploadsDir,
          context.mediaOptions
        )
        let convertedBuffer = null
        if (media.unsupportedBrowserImage) {
          const normalized = String(mediaPart || '').replace(/\\/g, '/').replace(/^\/+/, '')
          const entry = context.mediaIndex?.files.get(normalized)
          if (entry) {
            const rawBuffer = Buffer.from(await entry.async('nodebuffer'))
            const converted = await convertEmfWmfBuffer(rawBuffer, {
              signal: context.mediaOptions.signal,
            })
            let previewMetadata
            try {
              previewMetadata = extractGeometryImageMetadata(converted?.buffer)
            } catch {}
            if (converted?.ok && previewMetadata?.format === 'png') {
              const persisted = await persistImageBuffer(
                converted.buffer,
                'image/png',
                context.uploadsDir,
                context.mediaOptions
              )
              if (persisted.url) {
                media = persisted
                convertedBuffer = converted.buffer
                context.projectionWarnings.push({
                  type: 'emf-converted-to-png',
                  code: 'emf-converted-to-png', partUri: source.partUri,
                  definitionId: source.id, nativeId: source.nativeId, mediaPartUri: mediaPart,
                  message: 'Vector original retained; raster PNG preview supports whole-picture edits, not editable source vector primitives. Native/export fidelity remains unqualified.',
                })
              }
            }
          }
        }
        if (!media.url || media.unsupportedBrowserImage)
          fail(source, `image admission ${media.warning?.code || 'failed'}`)
        let mediaBinding
        try {
          mediaBinding = await pictureMedia(context, mediaPart, value(match[0], 'Id'), media.url, convertedBuffer)
        } catch (error) {
          fail(source, error.message)
        }
        const picture = readPictureSource(context, mediaBinding, fail)
        pictureComponent = picture.component
        pictureDpiComponent = picture.dpiComponent
        content = {
          ...content,
          media: mediaBinding,
          pictureDocument: picture.picture,
        }
        compatibility = { type: 'image', src: media.url }
      }
    }
  }
  const textAdmission = readSemanticTextAdmission(context, fail)
  const textDocument = textAdmission?.textDocument
  if (textDocument) {
    content.textDocument = textDocument
    if (textAdmission.textListStyle) content.textListStyle = textAdmission.textListStyle
    compatibility.text = textDocument.paragraphs
      .map((p) => p.runs.map((r) => r.text).join(''))
      .join('\n')
    if (['1', 'true'].includes(value(all(node, 'cNvSpPr', P_URIS)[0], 'txBox')))
      compatibility = { type: 'text' }
  }
  const allowed = new Set([
    'paragraph',
    'text-run',
    'preset-geometry',
    'custom-geometry',
    'geometry-guide',
    'path-point',
    'media-segment',
    ...(source.kind === 'connector' ? ['connector-binding'] : []),
  ])
  const mappedFields = new Set(
    textDocument?.paragraphs.flatMap((paragraph) =>
      paragraph.runs.filter((run) => run.kind === 'field').map((run) => run.componentId)
    )
  )
  for (const entry of components) {
    const hiddenSources = [
      context.geometryDeclarations?.hiddenStroke?.source,
      context.geometryDeclarations?.hiddenFill?.source,
      context.geometryDeclarations?.hiddenEffects?.source,
    ].filter(Boolean)
    const mappedHidden =
      entry.kind === 'unknown-extension' &&
      hiddenSources.some((hidden) =>
        entry.partUri === hidden.partUri &&
        entry.preconditionHash === hidden.preconditionHash &&
        entry.componentLocators.some(
          (locator) => JSON.stringify(locator.path) === JSON.stringify(hidden.componentLocator.path)
        )
      )
    const mappedField = entry.kind === 'text-field' && mappedFields.has(entry.id)
    const mappedIdentity = entry.id === context.creationId?.componentId
    const mappedHyperlink =
      entry.kind === 'hyperlink' && textAdmission?.mappedDefinitionIds?.includes(entry.id)
    const mappedAppearance = [context.shape3dAppearance?.scene, context.shape3dAppearance?.shape]
      .some((root) => root?.componentId === entry.id)
    const mappedMath = ['math-component', 'unknown-extension'].includes(entry.kind) &&
      textAdmission?.mappedDefinitionIds?.includes(entry.id)
    const mappedPicture = entry.kind === 'unknown-extension' && entry.id === pictureDpiComponent?.id
    if (!allowed.has(entry.kind) && !mappedHidden && !mappedField && !mappedIdentity && !mappedHyperlink && !mappedAppearance && !mappedMath && !mappedPicture)
      fail(entry, `unimplemented component ${entry.kind}`)
  }
  return {
    kind: compatibility.type,
    content,
    compatibility,
    ...geometry,
    additionalTextComponents: textAdmission?.components || [],
    ...(svgPicture ? { additionalSvgComponents: svgPicture.components } : {}),
    ...(pictureComponent ? { additionalPictureComponents: [pictureComponent] } : {}),
    mappedDefinitionIds: [source.id, ...components.map((item) => item.id),
      ...(svgPicture?.mappedDefinitionIds || [])],
  }
}
async function projectSemanticImport({
  zip,
  presentation,
  adapters = {},
  geometryInheritance = false,
  ...mediaOptions
}) {
  const inventory = await buildSemanticInventory(zip)
  if (inventory.slides.length !== presentation.slides?.length)
    fail({ partUri: 'ppt/presentation.xml' }, 'missing/ambiguous slide identity')
  const parts = new Map(),
    nodes = new Map(),
    byId = new Map(inventory.definitions.map((source) => [source.id, source]))
  for (const part of inventory.parts.filter((item) => /\.(?:xml|rels|svg)$/i.test(item.partUri))) {
    const xml = await zip.file(part.partUri).async('string')
    if (createHash('sha256').update(xml).digest('hex') !== part.preconditionHash)
      fail(part, 'source hash changed')
    parts.set(part.partUri, { xml, roots: parseXml(xml) })
  }
  const relationships = (part) =>
    all({ children: parts.get(relationshipPart(part))?.roots || [] }, 'Relationship', REL_URIS)
  for (const source of inventory.definitions) {
    let node = { children: parts.get(source.partUri)?.roots || [] }
    for (const index of source.componentLocators[0].path) node = node?.children[index]
    if (!node || node.local !== source.localName || node.uri !== source.namespaceUri)
      fail(source, 'missing source locator')
    nodes.set(source.id, node)
  }
  const metadataSource = { definitions: {} }
  const dispositions = new Map()
  const sourceGuideIds = projectSourceGuideLists({
    inventory, parts, nodes, relationships, semantic: metadataSource, dispositions, fail,
  })
  const slideMetadata = projectSlideMetadata({
    inventory, parts, relationships, semantic: metadataSource, dispositions, sourceGuideIds, fail,
  })
  await validateNotesSourceExtensions({
    zip,
    inventory,
    parts,
    nodes,
    noteParts: slideMetadata.noteParts,
    dispositions,
    fail,
  })
  const mediaIndex = createMediaIndex(zip)
  const geometrySources =
    geometryInheritance === true
      ? await buildGeometryStyleSources(zip, {
          ...inventory,
          definitions: inventory.definitions.filter((source) => !slideMetadata.noteParts.has(source.partUri)),
        }, {
          mediaIndex,
          uploadsDir: mediaOptions.uploadsDir,
          mediaOptions,
        })
      : null
  const templates = new Set(geometrySources?.templateOccurrenceIds)
  const hasLinkedGeometry = Object.keys(geometrySources?.definitionBindings || {}).length > 0
  const semantic = {
    schemaVersion: hasLinkedGeometry ? 2 : 1,
    definitions: metadataSource.definitions,
    instances: {},
    styles: hasLinkedGeometry ? geometrySources.styles : {},
    fonts: {},
    sourceSlides: sourceSlidesForImport(inventory, presentation.slides),
  }
  const projections = new Map(),
    baselineDefinitions = new Set()
  const appearanceWarnings = createBoundedWarnings()
  const sourceId = sourceNamespace(inventory)
  const slideParts = new Set(inventory.slides.map((slide) => slide.partUri))
  for (const source of inventory.definitions.filter((item) => item.nativeId !== null &&
    !slideMetadata.noteParts.has(item.partUri))) {
    const components = inventory.definitions.filter((item) => {
      let parent = byId.get(item.parentDefinitionId)
      while (parent && parent.nativeId === null) parent = byId.get(parent.parentDefinitionId)
      return parent?.id === source.id
    })
    const adapter = adapters[source.kind] || baselineAdapter
    if (adapter === baselineAdapter) baselineDefinitions.add(source.id)
    const context = {
      source,
      inventory,
      parts,
      sourceId,
      slideParts,
      inventoryDefinitions: inventory.definitions,
      node: nodes.get(source.id),
      xml: parts.get(source.partUri).xml,
      components,
      nodes,
      relationships,
      zip,
      mediaIndex,
      mediaOptions,
      projectionWarnings: appearanceWarnings,
      uploadsDir: mediaOptions.uploadsDir,
      ...(geometrySources?.definitionBindings[source.id]
        ? {
            geometryDeclarations:
              geometrySources.styles[geometrySources.definitionBindings[source.id].styleId].payload,
          }
        : {}),
    }
    if (
      adapter === baselineAdapter &&
      !components.some((item) => item.disposition === 'owner-excluded-preserved')
    )
      context.creationId = readNativeCreationIdentity(context, fail)
    const appearance = readShape3dAppearance(context)
    if (appearance) {
      context.shape3dAppearance = appearance.appearance
      for (const warning of appearance.warnings) appearanceWarnings.push(warning)
    }
    const projected = await adapter(context)
    for (const id of projected.mappedDefinitionIds || []) {
      if (!byId.has(id)) fail(source, 'unknown adapter disposition')
      if (dispositions.has(id)) {
        if (byId.get(id).kind === 'vector-component' && dispositions.get(id).partUri === byId.get(id).partUri)
          continue
        fail(source, 'ambiguous adapter disposition')
      }
      dispositions.set(id, {
        definitionId: id,
        partUri: byId.get(id).partUri,
        locator: byId.get(id).componentLocators[0],
        disposition: projected.excluded ? 'owner-excluded-preserved' : 'semantically-mapped',
      })
    }
    projections.set(source.id, projected)
    semantic.definitions[source.id] = {
      id: source.id,
      kind: projected.kind,
      source: {
        partUri: source.partUri,
        nativeId: source.nativeId,
        preconditionHash: source.preconditionHash,
        componentLocator: source.componentLocators[0],
        ...(context.creationId ? { creationId: context.creationId } : {}),
      },
      content: {
        ...projected.content,
        ...(context.shape3dAppearance ? { shape3dAppearance: context.shape3dAppearance } : {}),
        ...(geometrySources?.definitionBindings[source.id]
          ? { geometrySource: { styleId: geometrySources.definitionBindings[source.id].styleId } }
          : {}),
      },
      components:
        projected.components ??
        components.map((item) => ({
          id: item.id,
          kind:
            item.kind === 'connector-binding'
              ? 'connection'
              : ['text-run', 'text-field'].includes(item.kind)
                ? 'run'
                : item.kind === 'paragraph'
                  ? 'paragraph'
                  : item.kind === 'path-point'
                    ? 'control-point'
                    : item.kind === 'media-segment'
                      ? 'media-segment'
                      : item.kind === 'hyperlink'
                        ? 'hyperlink'
                        : 'property',
          locator: item.componentLocators[0],
        })),
    }
    const paintComponent = geometrySources?.definitionBindings[source.id]?.paintComponent
    if (paintComponent)
      semantic.definitions[source.id].components.push({
        id: paintComponent.id,
        kind: paintComponent.kind,
        locator: paintComponent.locator.componentLocator,
      })
    for (const component of projected.additionalTextComponents || []) {
      const existing = semantic.definitions[source.id].components.find((item) => item.id === component.id)
      if (!existing) semantic.definitions[source.id].components.push(component)
      else existing.kind = component.kind
    }
    for (const component of projected.additionalPictureComponents || [])
      semantic.definitions[source.id].components.push(component)
    for (const component of projected.additionalSvgComponents || [])
      semantic.definitions[source.id].components.push(component)
    if (projected.content.textDocument) {
      const sourceNode = nodes.get(source.id)
      const body = child(sourceNode, 'txBody', P_URIS)
      if (!body) fail(source, 'missing text body component source')
      semantic.definitions[source.id].components.push({
        id: projected.content.textDocument.componentId,
        kind: 'property',
        locator: {
          path: [...source.componentLocators[0].path, sourceNode.children.indexOf(body)],
          preconditionHash: source.preconditionHash,
        },
      })
    }
  }
  projectPresentationProperties({
    inventory,
    parts,
    nodes,
    relationships,
    semantic,
    dispositions,
    fail,
  })
  projectSourcePartIdentities({
    inventory,
    parts,
    nodes,
    relationships,
    semantic,
    dispositions,
    fail,
  })
  for (const source of inventory.definitions.filter((item) => item.kind === 'timing')) {
    let parent = byId.get(source.parentDefinitionId)
    let nestedTiming = false
    while (parent) {
      if (parent.kind === 'timing') nestedTiming = true
      parent = byId.get(parent.parentDefinitionId)
    }
    if (nestedTiming) continue
    const owned = inventory.definitions.filter((item) => {
      let ancestor = byId.get(item.parentDefinitionId)
      while (ancestor && ancestor.id !== source.id) ancestor = byId.get(ancestor.parentDefinitionId)
      return item.id === source.id || ancestor?.id === source.id
    })
    const timingNode = nodes.get(source.id)
    const timingDocument = readSemanticTiming({
      source, node: timingNode, xml: parts.get(source.partUri).xml,
    })
    semantic.definitions[source.id] = {
      id: source.id,
      kind: 'opaque',
      source: {
        partUri: source.partUri,
        ...(source.nativeId !== null ? { nativeId: source.nativeId } : {}),
        preconditionHash: source.preconditionHash,
        componentLocator: source.componentLocators[0],
      },
      content: {
        excludedObjects: owned.map((item) => ({
          id: item.id,
          kind: item.kind,
          attributes: item.attributes,
          locator: item.componentLocators[0],
        })),
        targetReferences: timingDocument.targetReferences,
        timingDocument,
      },
      components: [],
    }
    for (const item of owned) {
      if (dispositions.has(item.id)) fail(source, 'ambiguous timing disposition')
      dispositions.set(item.id, {
        definitionId: item.id,
        partUri: item.partUri,
        locator: item.componentLocators[0],
        disposition: 'owner-excluded-preserved',
      })
    }
  }
  projectSourceTransitions({ inventory, parts, nodes, semantic, dispositions, fail })
  projectTheme3dAppearance({ inventory, parts, nodes, dispositions, fail, warnings: appearanceWarnings })
  for (const source of inventory.definitions)
    if (!dispositions.has(source.id)) fail(source, `unmapped required ${source.kind}`)
  const textStyleContexts = geometryInheritance
    ? Object.fromEntries(
        (
          await buildSemanticTextStyleContexts({
            zip,
            inventory,
            occurrenceIds: inventory.occurrences
              .filter(
                (occurrence) =>
                  (byId.get(occurrence.definitionId)?.kind === 'shape' &&
                    (projections.get(occurrence.definitionId)?.content.textDocument ||
                      projections.get(occurrence.definitionId)?.content.ommlDocument)) ||
                  (byId.get(occurrence.definitionId)?.kind === 'graphic-frame' &&
                    projections.get(occurrence.definitionId)?.content.chartDocument)
              )
              .map((occurrence) => occurrence.id),
          })
        ).map((context) => [context.occurrenceId, context])
      )
    : {}
  if (
    !hasLinkedGeometry &&
    Object.values(textStyleContexts).some(
      (context) => projections.get(context.definitionId)?.content.chartDocument
    )
  ) {
    semantic.schemaVersion = 2
    semantic.styles = geometrySources.styles
  }
  const resourcesId = `text-context-resources:${createHash('sha256')
    .update(JSON.stringify(textStyleContexts))
    .digest('hex')}`
  const compacted = compactTextContexts(Object.values(textStyleContexts), resourcesId)
  for (const context of compacted.contexts) {
    const source = byId.get(context.definitionId)
    semantic.styles[`text-context:${context.occurrenceId}`] = {
      kind: 'text-context',
      origin: 'source',
      source: {
        partUri: source.partUri,
        preconditionHash: source.preconditionHash,
        componentLocator: source.componentLocators[0],
      },
      payload: context,
    }
  }
  if (compacted.contexts.length)
    semantic.styles[resourcesId] = {
      kind: 'text-context-resources',
      origin: 'source',
      source: semantic.styles[`text-context:${compacted.contexts[0].occurrenceId}`].source,
      payload: {
        schemaVersion: 1,
        records: compacted.records,
        ...(compacted.fontDescriptors?.length ? { fontDescriptors: compacted.fontDescriptors } : {}),
      },
    }
  const slides = presentation.slides.map((slide, index) => ({
    ...slide, elements: [], pptxSlideSource: slideMetadata.slideSources[index],
    ...sourceTransition(semantic, slide),
    ...(slide.notes === undefined && slideMetadata.slideNotes[index] !== undefined
      ? { notes: slideMetadata.slideNotes[index] } : {}),
  })),
    world = new Map()
  for (const occurrence of inventory.occurrences.filter(
    (item) => projections.has(item.definitionId) && !templates.has(item.id)
  )) {
    const source = byId.get(occurrence.definitionId),
      projected = projections.get(source.id)
    const slideIndex = inventory.slides.findIndex(
      (slide) => slide.partUri === occurrence.slidePartUri
    )
    const parentInstanceId = occurrence.parentOccurrenceId
    if (parentInstanceId && !semantic.instances[parentInstanceId])
      fail(source, 'missing parent occurrence')
    const sourceBinding = geometrySources?.occurrenceBindings[occurrence.id]
    const localTransform =
      sourceBinding && source.kind !== 'group' && baselineDefinitions.has(source.id)
        ? IDENTITY
        : projected.localTransform
    const matrix = multiply(
      parentInstanceId ? world.get(parentInstanceId) : IDENTITY,
      localTransform
    )
    world.set(occurrence.id, matrix)
    const identity = nodes
      .get(source.id)
      .children.find((item) => P_URIS.has(item.uri) && /^nv.*Pr$/.test(item.local))
    let hidden = ['1', 'true'].includes(value(child(identity, 'cNvPr', P_URIS), 'hidden'))
    if (source.partUri.includes('/slideMasters/')) {
      let part = occurrence.slidePartUri
      for (const rid of occurrence.relationshipChain.slice(1)) {
        if (['0', 'false'].includes(value(parts.get(part)?.roots[0], 'showMasterSp'))) hidden = true
        const relation = relationships(part).find((item) => value(item, 'Id') === rid)
        if (!relation) fail(source, 'missing occurrence relationship')
        part = resolveTarget(part, value(relation, 'Target'))
      }
    }
    semantic.instances[occurrence.id] = {
      id: occurrence.id,
      slideId: slides[slideIndex].id,
      definitionId: source.id,
      parentInstanceId,
      localTransform,
      paintIndex: occurrence.paintIndex,
      relationshipChain: occurrence.relationshipChain,
      hidden,
      overrides: {},
      ...(sourceBinding ? { sourceBinding } : {}),
      ...(textStyleContexts[occurrence.id]
        ? { textSourceBinding: { contextId: `text-context:${occurrence.id}` } }
        : {}),
    }
    // Linked leaves are emitted after the complete graph has been validated.
    if (sourceBinding) continue
    if (['group', 'opaque'].includes(projected.kind)) continue
    const origin = transformPoint(matrix, { x: 0, y: 0 })
    slides[slideIndex].elements.push({
      ...projected.compatibility,
      id: occurrence.id,
      pptxInstanceId: occurrence.id,
      x: origin.x * EMU_TO_CSS,
      y: origin.y * EMU_TO_CSS,
      width: projected.extent.cx * EMU_TO_CSS,
      height: projected.extent.cy * EMU_TO_CSS,
      zIndex: occurrence.paintIndex,
      hidden,
      _pptxSource: {
        nodeId:
          source.partUri === occurrence.slidePartUri
            ? source.nativeId
            : `inherited:${source.partUri}:${source.nativeId}`,
        matchedBy: 'sourceId',
        partUri: source.partUri,
      },
    })
  }
  for (const instance of Object.values(semantic.instances)) {
    const source = byId.get(instance.definitionId)
    const connector = geometryProvider(semantic, instance).geometry?.connector
    if (!connector) continue
    const bindings = {}
    for (const end of ['start', 'end']) {
      const endpoint = connector[end]
      if (!endpoint) {
        bindings[end] = null
        continue
      }
      const targets = Object.values(semantic.instances).filter((target) => {
        if (target.slideId !== instance.slideId) return false
        if (!geometrySources)
          return (
            target.definitionId === endpoint.targetDefinitionId &&
            JSON.stringify(target.relationshipChain) === JSON.stringify(instance.relationshipChain)
          )
        const context = semantic.styles[target.sourceBinding?.contextId]?.payload
        // A suppressed source template may be represented by exactly one visible
        // substitution. Keep native endpoint identities and original chains intact.
        return (
          target.definitionId === endpoint.targetDefinitionId ||
          context?.declarationIds.some(
            (id) => semantic.styles[id].payload.definitionId === endpoint.targetDefinitionId
          )
        )
      })
      if (targets.length !== 1) fail(source, 'missing/ambiguous connector occurrence')
      bindings[end] = { targetInstanceId: targets[0].id, index: endpoint.index }
    }
    instance.connectorBindings = bindings
  }
  const size = all({ children: parts.get('ppt/presentation.xml').roots }, 'sldSz', P_URIS)
  if (size.length !== 1) fail({ partUri: 'ppt/presentation.xml' }, 'missing/ambiguous slide size')
  const pptxSlideSize = {
    cx: number(size[0], 'cx', { partUri: 'ppt/presentation.xml' }),
    cy: number(size[0], 'cy', { partUri: 'ppt/presentation.xml' }),
  }
  if (pptxSlideSize.cx <= 0 || pptxSlideSize.cy <= 0)
    fail({ partUri: 'ppt/presentation.xml' }, 'invalid slide size')
  let document = semantic
  if (geometrySources) {
    world.clear()
    const nativeInstances = new Set()
    for (const instance of Object.values(document.instances)) {
      const group = document.definitions[instance.definitionId].kind === 'group'
      const linked = instance.sourceBinding && !group
      const owned = baselineDefinitions.has(instance.definitionId)
      const projected = projections.get(instance.definitionId)
      const parent = instance.parentInstanceId ? world.get(instance.parentInstanceId) : IDENTITY
      const sourceTransform = linked
        ? resolveGeometryTransform(document, instance.id).transform
        : projected.sourceTransform
      const source = linked
        ? {
            ...sourceTransform,
            ...(sourceTransform.rot === undefined ? {} : { rotation: sourceTransform.rot }),
          }
        : sourceTransform
      let localTransform = instance.localTransform
      if (
        owned &&
        (instance.parentInstanceId === null || nativeInstances.has(instance.parentInstanceId))
      ) {
        const placement = nativeSourcePlacement(source, parent, group, Boolean(linked))
        localTransform = placement.localTransform
        nativeInstances.add(instance.id)
        if (
          linked &&
          (placement.nativeExtent.cx !== source.ext.cx ||
            placement.nativeExtent.cy !== source.ext.cy)
        )
          semantic.instances[instance.id].sourceBinding = {
            ...instance.sourceBinding,
            nativeExtent: placement.nativeExtent,
          }
      } else if (owned && linked) localTransform = leafTransform(source)
      semantic.instances[instance.id].localTransform = localTransform
      world.set(instance.id, multiply(parent, localTransform))
    }
    document = semantic
    document = await stageGeometryBlipSourceAssets(document, zip, {
      uploadsDir: mediaOptions.uploadsDir,
      mediaOptions,
    })
    world.clear()
    for (const slide of slides) slide.elements = []
    for (const instance of Object.values(document.instances)) {
      const matrix = multiply(
        instance.parentInstanceId ? world.get(instance.parentInstanceId) : IDENTITY,
        instance.localTransform
      )
      world.set(instance.id, matrix)
      const source = byId.get(instance.definitionId),
        projected = projections.get(source.id)
      if (['group', 'opaque'].includes(projected.kind)) continue
      const geometry = instance.sourceBinding
          ? materializeGeometry(document, instance.id)
          : undefined,
        extent = geometry ? { cx: geometry.width, cy: geometry.height } : projected.extent,
        origin = transformPoint(matrix, { x: 0, y: 0 })
      const slide = slides.find((item) => item.id === instance.slideId)
      const host =
        document.styles[instance.sourceBinding?.contextId]?.payload.hostSlidePartUri ??
        inventory.slides[slides.indexOf(slide)].partUri
      slide.elements.push({
        ...projected.compatibility,
        ...(geometry ? geometryFillPaint(geometry) : {}),
        ...(geometry ? geometryStrokePaint(geometry) : {}),
        id: instance.id,
        pptxInstanceId: instance.id,
        x: origin.x * EMU_TO_CSS,
        y: origin.y * EMU_TO_CSS,
        width: extent.cx * EMU_TO_CSS,
        height: extent.cy * EMU_TO_CSS,
        zIndex: instance.paintIndex,
        hidden: instance.hidden,
        _pptxSource: {
          nodeId:
            source.partUri === host
              ? source.nativeId
              : `inherited:${source.partUri}:${source.nativeId}`,
          matchedBy: 'sourceId',
          partUri: source.partUri,
        },
      })
    }
    for (const slide of slides) slide.elements.sort((a, b) => a.zIndex - b.zIndex)
  }
  const hyperlinkPresentation = { ...presentation, slides, pptxSemantic: document }
  for (const slide of slides) for (const element of slide.elements) {
    const instance = document.instances[element.pptxInstanceId]
    if (!document.definitions[instance?.definitionId]?.content.textDocument) continue
    try {
      const text = materializeTextDocument(document, instance.id)
      if (text.paragraphs.some((paragraph) => paragraph.runs.some((run) => run.kind === 'equation'))) {
        // Canonical text owns equation paint and edits; static HTML has no font runtime.
        delete element.content
        delete element.textHtml
        continue
      }
      const html = textDocumentHtml(text, { hyperlinkPresentation })
      if (element.type === 'text') element.content = html
      else element.textHtml = html
    } catch (error) {
      fail(byId.get(instance.definitionId), error.message)
    }
  }
  const resolution = { width: pptxSlideSize.cx * EMU_TO_CSS, height: pptxSlideSize.cy * EMU_TO_CSS }
  return {
    warnings: appearanceWarnings,
    presentation: normalizeSemanticPresentation({
      ...presentation,
      slides,
      ...resolution,
      resolution,
      pptxSlideSize,
      pptxSemantic: (() => {
        const rawBytes = Buffer.byteLength(JSON.stringify(document))
        const finalDoc = rawBytes > 8388608 ? compactSemanticGraph(document) : document
        return normalizePptxSemanticDocument(finalDoc)
      })(),
      _pptxMeta: {
        ...presentation._pptxMeta,
        layoutProvenance: {
          source: 'pptx-native-master',
          treatment: 'semantic-linked-occurrences',
        },
      },
    }),
    inventory,
    admission: {
      textStyleContexts,
      dispositions: [...dispositions.values()],
      visualQualification: 'unqualified',
      ...(geometrySources ? { templateOccurrenceIds: [...templates] } : {}),
    },
    trustedSemanticImportMetadata: {
      textStyleContexts,
      schemaVersion: document.schemaVersion,
      definitions: document.definitions,
      sourceParts: inventory.parts,
      ...(geometrySources
        ? {
            modelVersion: 2,
            styles: document.styles,
            occurrenceBindings: Object.fromEntries(
              Object.values(document.instances)
                .filter((instance) => instance.sourceBinding)
                .map((instance) => [instance.id, instance.sourceBinding])
            ),
          }
        : {}),
    },
  }
}
module.exports = { EMU_TO_CSS, baselineAdapter, projectSemanticImport }
