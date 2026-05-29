const { placeholder } = require('./utils-base')
const {
  applyToPoint,
  identityMatrix,
  multiply,
  readCoord,
  readNumber,
  rotateAround,
  scaleAround,
  translate,
} = require('../geometry')

const MAX_GROUP_DEPTH = 10

function buildGroupMatrix(group, scale, parentMatrix = identityMatrix()) {
  const left = readCoord(group?.left, group?.x, 0) * scale.x
  const top = readCoord(group?.top, group?.y, 0) * scale.y
  const width = Math.max(1, readNumber(group?.width, 80, 0) * scale.x)
  const height = Math.max(1, readNumber(group?.height, 40, 0) * scale.y)
  const cx = left + width / 2
  const cy = top + height / 2

  let matrix = translate(left, top)
  const rotation = readNumber(group?.rotate, 0)
  if (rotation !== 0) matrix = multiply(rotateAround(rotation, cx, cy), matrix)
  if (group?.isFlipH) matrix = multiply(scaleAround(-1, 1, cx, cy), matrix)
  if (group?.isFlipV) matrix = multiply(scaleAround(1, -1, cx, cy), matrix)

  return multiply(parentMatrix, matrix)
}

async function withContextZIndex(context, zIndex, callback) {
  const previousZIndex = context.zIndex
  context.zIndex = zIndex
  try {
    return await callback()
  } finally {
    context.zIndex = previousZIndex
  }
}

async function flattenGroupElement(group, context, mapElementFn, depth = 0, parentMatrix = identityMatrix(), inheritedRotate = 0) {
  const results = []

  if (depth > MAX_GROUP_DEPTH) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'group-depth-exceeded', message: `Group depth ${depth} exceeds ${MAX_GROUP_DEPTH}` })
    results.push(placeholder(group, context.scale, context.zIndex, context.slideIndex, context.warnings, 'grouped-complex', 'Deep group locked'))
    return results
  }

  const groupRotation = readNumber(group?.rotate, 0)
  const groupMatrix = buildGroupMatrix(group, context.scale, parentMatrix)
  const children = group.elements || []
  for (const child of children) {
    const childZIndex = context.zIndex + results.length
    if (child?.type === 'group') {
      const nested = await withContextZIndex(context, childZIndex, () => flattenGroupElement(
        child,
        context,
        mapElementFn,
        depth + 1,
        groupMatrix,
        inheritedRotate + groupRotation
      ))
      for (const nestedChild of nested) {
        results.push({ ...nestedChild, zIndex: context.zIndex + results.length })
      }
      continue
    }

    const childBoxLocal = {
      x: readCoord(child?.left, child?.x, 0) * context.scale.x,
      y: readCoord(child?.top, child?.y, 0) * context.scale.y,
      width: Math.max(1, readNumber(child?.width, 80, 0) * context.scale.x),
      height: Math.max(1, readNumber(child?.height, 40, 0) * context.scale.y),
    }
    const isLine = child?.x1 != null && child?.y1 != null && child?.x2 != null && child?.y2 != null
    // Transform the child's CENTER through the group matrix and preserve its
    // intrinsic dimensions. The previous code used mapBoxByMatrix (the rotated
    // AABB, already enlarged) AND re-set rotate, so the wrapper rotated an
    // already-rotated/bloated box a second time.
    const childCenter = applyToPoint(
      groupMatrix,
      childBoxLocal.x + childBoxLocal.width / 2,
      childBoxLocal.y + childBoxLocal.height / 2
    )
    const childRotate = readNumber(child?.rotate, 0)
    const transformedChild = {
      ...child,
      left: (childCenter.x - childBoxLocal.width / 2) / context.scale.x,
      top: (childCenter.y - childBoxLocal.height / 2) / context.scale.y,
      width: childBoxLocal.width / context.scale.x,
      height: childBoxLocal.height / context.scale.y,
      // Shapes: the wrapper rotates once about center, so accumulate all
      // rotation here. Lines: their endpoints already carry the full accumulated
      // rotation via groupMatrix, so keep only the child's own rotation or the
      // wrapper would rotate them again.
      rotate: isLine ? childRotate : childRotate + inheritedRotate + groupRotation,
    }

    if (isLine) {
      const p1 = applyToPoint(groupMatrix, childBoxLocal.x + readNumber(child.x1, 0) * context.scale.x, childBoxLocal.y + readNumber(child.y1, 0) * context.scale.y)
      const p2 = applyToPoint(groupMatrix, childBoxLocal.x + readNumber(child.x2, 0) * context.scale.x, childBoxLocal.y + readNumber(child.y2, 0) * context.scale.y)
      transformedChild.x1 = p1.x / context.scale.x
      transformedChild.y1 = p1.y / context.scale.y
      transformedChild.x2 = p2.x / context.scale.x
      transformedChild.y2 = p2.y / context.scale.y
    }

    const mappedChildren = await withContextZIndex(context, childZIndex, () => mapElementFn(transformedChild, context))
    for (const mappedChild of mappedChildren) {
      results.push({ ...mappedChild, zIndex: context.zIndex + results.length })
    }
  }

  return results
}

module.exports = {
  MAX_GROUP_DEPTH,
  buildGroupMatrix,
  flattenGroupElement,
}
