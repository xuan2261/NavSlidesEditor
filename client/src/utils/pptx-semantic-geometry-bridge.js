import groups from 'revealjs-shared/src/pptx-semantic-groups.js'
import affine from 'revealjs-shared/src/pptx-affine.js'
import renderTree from 'revealjs-shared/src/pptx-semantic-render-tree.js'
import geometryCore from 'revealjs-shared/src/pptx-geometry-document.js'
import semanticCore from 'revealjs-shared/src/pptx-semantic-document.js'
import geometryStyles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import geometryRecords from 'revealjs-shared/src/pptx-geometry-style-records.js'
import { assertCanonicalTextEdit } from 'revealjs-shared/src/pptx-text-operations.js'
import pictureOperations from 'revealjs-shared/src/pptx-picture-operations.js'
import mediaOperations from 'revealjs-shared/src/pptx-media-operations.js'
import mediaDocument from 'revealjs-shared/src/pptx-media-document.js'
import { semanticInstance, semanticDefinition, semanticInstances, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

const { instanceWorldTransform, moveSemanticInstance, transformSemanticInstance } = groups
const { multiply, invert, transformPoint } = affine
export const { EMU_TO_CSS } = renderTree
const OOXML_ANGLE_SCALE = 60000
function quantizeNativeRotation(rad) {
  const deg = (rad * 180) / Math.PI
  const quantized = Math.round(deg * OOXML_ANGLE_SCALE) / OOXML_ANGLE_SCALE
  return ((quantized % 360) + 360) % 360
}

export function semanticElement(document, instanceId, element) {
  const instance = semanticInstance(document, instanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  let extent = geometryStyles.geometryLocalExtent(document, instanceId)
  let x = 0,
    y = 0
  if (definition.kind === 'group') {
    const reader = groups.createSemanticInstanceReader(document)
    document = reader.document
    const inverse = invert(reader.instanceWorldTransform(instanceId))
    const points = []
    for (const [, child] of semanticInstances(document)) {
      if (child.lineage?.tombstone || child.id === instanceId) continue
      let parentId = child.parentInstanceId
      while (parentId !== null && parentId !== undefined && parentId !== instanceId)
        parentId = semanticInstance(document, parentId)?.parentInstanceId
      const childDef = semanticDefinition(document, child.definitionId)
      if (parentId !== instanceId || childDef.kind === 'group') continue
      const size = geometryStyles.geometryLocalExtent(document, child.id)
      if (!size) continue
      const matrix = multiply(inverse, reader.instanceWorldTransform(child.id))
      for (const [px, py] of [
        [0, 0],
        [size.cx, 0],
        [0, size.cy],
        [size.cx, size.cy],
      ])
        points.push(transformPoint(matrix, { x: px, y: py }))
    }
    if (points.length) {
      x = Math.min(...points.map((p) => p.x))
      y = Math.min(...points.map((p) => p.y))
      extent = {
        cx: Math.max(...points.map((p) => p.x)) - x,
        cy: Math.max(...points.map((p) => p.y)) - y,
      }
      x *= EMU_TO_CSS
      y *= EMU_TO_CSS
    }
  }
  return {
    ...element,
    id: element?.id || instanceId,
    pptxInstanceId: instanceId,
    type: element?.type || 'semantic-group',
    x,
    y,
    rotation: 0,
    flipH: false,
    flipV: false,
    width: extent ? extent.cx * EMU_TO_CSS : element?.width || 1,
    height: extent ? extent.cy * EMU_TO_CSS : element?.height || 1,
    zIndex: instance.paintIndex,
    _semanticLocal: true,
  }
}

export function semanticCompatibility(document, slide, previous) {
  return {
    ...slide,
    elements: (slide.elements || []).map((element) => {
      const id = element.pptxInstanceId
      if (!id) return element
      const instance = semanticInstance(document, id)
      if (instance?.lineage?.tombstone) return element
      const painted = mediaDocument.mediaCompatibilityElement(document,
        pictureOperations.pictureCompatibilityElement(
          document,
          geometryStyles.geometryCompatibilityElement(document, element)
        ))
      const local = semanticElement(document, id, painted)
      const world = instanceWorldTransform(document, id)
      if (semanticInstance(previous, id) && !semanticInstance(previous, id).lineage?.tombstone) {
        const before = instanceWorldTransform(previous, id)
        const beforeLocal = semanticElement(previous, id, element)
        if (
          world.every((value, index) => value === before[index]) &&
          ['x', 'y', 'width', 'height'].every((key) => local[key] === beforeLocal[key])
        )
          return painted
      }
      const origin = transformPoint(world, { x: 0, y: 0 })
      return {
        ...painted,
        x: origin.x * EMU_TO_CSS,
        y: origin.y * EMU_TO_CSS,
        width: Math.hypot(world[0], world[1]) * local.width,
        height: Math.hypot(world[2], world[3]) * local.height,
        rotation: quantizeNativeRotation(Math.atan2(world[1], world[0])),
      }
    }),
  }
}

// The pointer operation and preview use the same matrix reducer as the commit.
export function semanticPointerUpdates(document, element, drag, dx, dy, mouse, shiftKey) {
  const id = element.pptxInstanceId
  const world = instanceWorldTransform(document, id)
  let operation
  if (drag.type === 'move') {
    operation = [1, 0, 0, 1, dx / EMU_TO_CSS, dy / EMU_TO_CSS]
  } else {
    const local = semanticElement(document, id, element)
    const width = local.width / EMU_TO_CSS,
      height = local.height / EMU_TO_CSS
    if (drag.type === 'rotate') {
      const center = transformPoint(world, {
        x: local.x / EMU_TO_CSS + width / 2,
        y: local.y / EMU_TO_CSS + height / 2,
      })
      let angle =
        Math.atan2(mouse.y / EMU_TO_CSS - center.y, mouse.x / EMU_TO_CSS - center.x) -
        Math.atan2(
          drag.startMouseY / EMU_TO_CSS - center.y,
          drag.startMouseX / EMU_TO_CSS - center.x
        )
      if (shiftKey) angle = (Math.round(angle / (Math.PI / 12)) * Math.PI) / 12
      const c = Math.cos(angle),
        s = Math.sin(angle)
      operation = multiply(multiply([1, 0, 0, 1, center.x, center.y], [c, s, -s, c, 0, 0]), [
        1,
        0,
        0,
        1,
        -center.x,
        -center.y,
      ])
    } else {
      const inverse = invert(world)
      const delta = transformPoint(inverse, { x: dx / EMU_TO_CSS, y: dy / EMU_TO_CSS })
      const zero = transformPoint(inverse, { x: 0, y: 0 })
      const lx = delta.x - zero.x,
        ly = delta.y - zero.y
      const handle = drag.handle || 'se'
      let sx = /[ew]/.test(handle) ? 1 + (handle.includes('w') ? -lx : lx) / width : 1
      let sy = /[ns]/.test(handle) ? 1 + (handle.includes('n') ? -ly : ly) / height : 1
      if (shiftKey) sx = sy = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy
      const anchorX = local.x / EMU_TO_CSS + (handle.includes('w') ? width : 0)
      const anchorY = local.y / EMU_TO_CSS + (handle.includes('n') ? height : 0)
      const scale = [sx, 0, 0, sy, anchorX * (1 - sx), anchorY * (1 - sy)]
      operation = multiply(multiply(world, scale), inverse)
    }
  }
  const next = transformSemanticInstance(document, id, operation)
  if (drag.startEls?.length > 1) {
    const selected = new Set(drag.startEls.map((item) => item.pptxInstanceId))
    return drag.startEls
      .filter((item) => {
        let parent = semanticInstance(document, item.pptxInstanceId)?.parentInstanceId
        while (parent !== null && parent !== undefined) {
          if (selected.has(parent)) return false
          parent = semanticInstance(document, parent)?.parentInstanceId
        }
        return Boolean(item.pptxInstanceId)
      })
      .map((item) => ({
        id: item.id,
        semanticWorldOperation: operation,
        semanticLocalTransform: semanticInstance(transformSemanticInstance(document, item.pptxInstanceId, operation), item.pptxInstanceId)?.localTransform,
      }))
  }
  return {
    semanticWorldOperation: operation,
    semanticLocalTransform: semanticInstance(next, id)?.localTransform,
  }
}

export function applySemanticGeometry(document, slide, updates) {
  // A selection command is atomic when one source-bound media owner is locked.
  if (updates.some(({ id, ...patch }) => {
    const element = slide.elements?.find((entry) => entry.id === id)
    const instanceId = element?.pptxInstanceId || id
    const instance = semanticInstance(document, instanceId)
    return semanticDefinition(document, instance?.definitionId)?.content?.mediaDocument &&
      mediaDocument.MEDIA_PLAYBACK_FIELDS.some((key) => Object.hasOwn(patch, key)) &&
      !mediaOperations.mediaOperationAvailable(document, instanceId)
  })) return document
  let next = document
  for (const { id, ...update } of updates) {
    const element = slide.elements?.find((e) => e.id === id)
    const instanceId = element?.pptxInstanceId || (semanticInstance(document, id) ? id : null)
    if (!instanceId) continue
    if (semanticInstance(document, instanceId)?.slideId !== slide.id)
      throw new TypeError('Semantic geometry targets a different slide')
    let instance = semanticInstance(next, instanceId)
    const mediaSource = semanticDefinition(next, instance?.definitionId)?.content?.mediaDocument
    if (mediaSource) {
      const playback = Object.fromEntries(mediaDocument.MEDIA_PLAYBACK_FIELDS
        .filter((key) => Object.hasOwn(update, key)).map((key) => [key, update[key]]))
      if (Object.keys(playback).length) {
        next = mediaOperations.editMediaPlaybackOccurrence(next, instanceId,
          mediaSource.embeddedComponentId, playback)
        instance = semanticInstance(next, instanceId)
      }
    }
    const pictureSource = semanticDefinition(next, instance?.definitionId)?.content?.pictureDocument
    if (pictureSource) {
      if (
        [
          ...pictureOperations.PICTURE_LEGACY_FIELDS,
          'src',
          'pptxPicture',
          'pptxPictureGeometry',
          'pptxPictureAsset',
          'pptxOccurrenceMatrix',
        ].some((key) => Object.hasOwn(update, key))
      )
        throw new TypeError('Use a source-bound picture operation for crop and alpha')
    }
    const textSource = semanticDefinition(next, instance?.definitionId)?.content?.textDocument
    if (
      Object.hasOwn(update, 'semanticTextDocument') ||
      (textSource &&
        ['text', 'textHtml', 'content'].some((field) => Object.hasOwn(update, field)))
    ) {
      if (
        !textSource ||
        !['shape', 'text'].includes(element?.type) ||
        !Object.hasOwn(update, 'semanticTextDocument')
      )
        throw new TypeError('Use a source-bound canonical document for native text')
      const textDocument = assertCanonicalTextEdit(next, slide, element, update.semanticTextDocument)
      next = replaceSemanticRecords(next, {
        instances: {
          [instanceId]: {
            ...instance,
            overrides: {
              ...instance.overrides,
              components: {
                ...instance.overrides.components,
                [textSource.componentId]: {
                  ...instance.overrides.components?.[textSource.componentId],
                  textDocument,
                },
              },
            },
          },
        },
      })
      instance = semanticInstance(next, instanceId)
    }
    const baseline = geometryRecords.geometryProvider(next, instance).geometry
    if (
      baseline &&
      ['fill', 'stroke', 'strokeWidth'].some((field) => Object.hasOwn(update, field))
    ) {
      const previous = instance.overrides.components?.[baseline.componentId] ?? {}
      let geometry = geometryStyles.materializeGeometry(next, instanceId)
      if (Object.hasOwn(update, 'fill')) {
        const fill = update.fill
        const color = ['none', 'transparent'].includes(fill)
          ? { kind: 'none' }
          : fill.startsWith('#')
            ? { kind: 'srgb', value: fill.slice(1) }
            : { kind: 'token', value: fill }
        if (color.kind === 'srgb') {
          const alpha = geometry.style?.fill?.color?.transforms?.filter((transform) =>
            ['alpha', 'alphaMod', 'alphaOff'].includes(transform.kind)
          )
          if (alpha?.length) color.transforms = alpha
        }
        geometry = geometryCore.editGeometryDocument(geometry, {
          type: 'fill-paint',
          color,
        })
      }
      if (Object.hasOwn(update, 'stroke') || Object.hasOwn(update, 'strokeWidth')) {
        const paint = geometryCore.geometryStrokePaint(geometry)
        const stroke = update.stroke ?? paint?.stroke ?? element.stroke ?? 'none'
        const color = ['none', 'transparent'].includes(stroke)
          ? { kind: 'none' }
          : stroke.startsWith('#')
            ? { kind: 'srgb', value: stroke.slice(1) }
            : { kind: 'token', value: stroke }
        geometry = geometryCore.editGeometryDocument(geometry, {
          type: 'stroke-paint',
          color,
          width: (update.strokeWidth ?? paint?.strokeWidth ?? element.strokeWidth ?? 0) * 9525,
        })
      }
      let componentOverride = { geometryDocument: geometry }
      if (next.schemaVersion === 2) {
        const style = { ...previous.geometryStyle }
        if (Object.hasOwn(update, 'fill')) style.fill = geometry.style.fill
        if (Object.hasOwn(update, 'stroke') || Object.hasOwn(update, 'strokeWidth')) {
          const stroke = { ...style.stroke }
          if (Object.hasOwn(update, 'stroke')) stroke.color = geometry.style.stroke.color
          if (Object.hasOwn(update, 'strokeWidth')) stroke.width = geometry.style.stroke.width
          style.stroke = stroke
        }
        componentOverride = { ...previous, geometryStyle: style }
      }
      next = replaceSemanticRecords(next, {
        instances: {
          [instanceId]: {
            ...instance,
            overrides: {
              ...instance.overrides,
              components: {
                ...instance.overrides.components,
                [baseline.componentId]: componentOverride,
              },
            },
          },
        },
      })
      next = semanticCore.normalizePptxSemanticDocument(next)
    }
    if (update.semanticWorldOperation) {
      next = transformSemanticInstance(next, instanceId, update.semanticWorldOperation)
    } else {
      const world = instanceWorldTransform(next, instanceId)
      if (update.x !== undefined || update.y !== undefined) {
        next = moveSemanticInstance(next, instanceId, {
          x: update.x === undefined ? 0 : update.x / EMU_TO_CSS - world[4],
          y: update.y === undefined ? 0 : update.y / EMU_TO_CSS - world[5],
        })
      }
      const local = semanticElement(next, instanceId, element)
      if (
        update.width !== undefined ||
        update.height !== undefined ||
        update.rotation !== undefined
      ) {
        const w = instanceWorldTransform(next, instanceId)
        let operation = [1, 0, 0, 1, 0, 0]
        if (update.width !== undefined || update.height !== undefined) {
          const sx =
            update.width === undefined ? 1 : update.width / (local.width * Math.hypot(w[0], w[1]))
          const sy =
            update.height === undefined
              ? 1
              : update.height / (local.height * Math.hypot(w[2], w[3]))
          operation = multiply(
            multiply(w, [
              sx,
              0,
              0,
              sy,
              (local.x / EMU_TO_CSS) * (1 - sx),
              (local.y / EMU_TO_CSS) * (1 - sy),
            ]),
            invert(w)
          )
        }
        if (update.rotation !== undefined) {
          const center = transformPoint(w, {
            x: (local.x + local.width / 2) / EMU_TO_CSS,
            y: (local.y + local.height / 2) / EMU_TO_CSS,
          })
          const currentRotation = quantizeNativeRotation(Math.atan2(w[1], w[0]))
          const angle = (((update.rotation - currentRotation) % 360) * Math.PI) / 180
          const c = Math.cos(angle),
            s = Math.sin(angle)
          operation = multiply(
            multiply(multiply([1, 0, 0, 1, center.x, center.y], [c, s, -s, c, 0, 0]), [
              1,
              0,
              0,
              1,
              -center.x,
              -center.y,
            ]),
            operation
          )
        }
        next = transformSemanticInstance(next, instanceId, operation)
      }
    }
  }
  return next
}

export function withoutSemanticGeometry(element, updates) {
  if (!element?.pptxInstanceId) return updates
  const {
    x: _x,
    y: _y,
    width: _w,
    height: _h,
    rotation: _r,
    semanticWorldOperation: _op,
    semanticLocalTransform: _local,
    semanticTextDocument: _text,
    ...rest
  } = updates
  return rest
}
