function rotateVector(x, y, rotation = 0) {
  if (!rotation) return { x, y }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

export function computeCropCommitGeometry(element, crop) {
  const width = Math.round(crop.w * element.width)
  const height = Math.round(crop.h * element.height)
  const localCenterOffsetX = (crop.x + crop.w / 2 - 0.5) * element.width
  const localCenterOffsetY = (crop.y + crop.h / 2 - 0.5) * element.height
  const worldOffset = rotateVector(
    localCenterOffsetX,
    localCenterOffsetY,
    element.rotation
  )
  const oldCenterX = element.x + element.width / 2
  const oldCenterY = element.y + element.height / 2
  return {
    x: oldCenterX + worldOffset.x - width / 2,
    y: oldCenterY + worldOffset.y - height / 2,
    width,
    height,
  }
}

export function computeCropResetGeometry(element) {
  const width = element.imageW ?? element.width
  const height = element.imageH ?? element.height
  const localCenterOffsetX =
    (element.imageOffsetX ?? 0) + width / 2 - element.width / 2
  const localCenterOffsetY =
    (element.imageOffsetY ?? 0) + height / 2 - element.height / 2
  const worldOffset = rotateVector(
    localCenterOffsetX,
    localCenterOffsetY,
    element.rotation
  )
  const currentCenterX = element.x + element.width / 2
  const currentCenterY = element.y + element.height / 2
  return {
    x: currentCenterX + worldOffset.x - width / 2,
    y: currentCenterY + worldOffset.y - height / 2,
    width,
    height,
  }
}
