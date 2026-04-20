const SNAP_THRESHOLD = 6

export function calculateGuides(draggedEl, allElements, canvasW = 960, canvasH = 540) {
  const guides = []
  let snappedX = draggedEl.x
  let snappedY = draggedEl.y

  // Reference edges for the dragged element
  const dragEdges = {
    left: draggedEl.x,
    centerX: draggedEl.x + draggedEl.width / 2,
    right: draggedEl.x + draggedEl.width,
    top: draggedEl.y,
    centerY: draggedEl.y + draggedEl.height / 2,
    bottom: draggedEl.y + draggedEl.height,
  }

  // Collect reference points from other elements + canvas
  const xRefs = [
    { pos: 0, source: 'canvas' },
    { pos: canvasW / 2, source: 'canvas' },
    { pos: canvasW, source: 'canvas' },
  ]
  const yRefs = [
    { pos: 0, source: 'canvas' },
    { pos: canvasH / 2, source: 'canvas' },
    { pos: canvasH, source: 'canvas' },
  ]

  allElements.forEach((el) => {
    if (el.id === draggedEl.id) return
    xRefs.push({ pos: el.x, source: el.id })
    xRefs.push({ pos: el.x + el.width / 2, source: el.id })
    xRefs.push({ pos: el.x + el.width, source: el.id })
    yRefs.push({ pos: el.y, source: el.id })
    yRefs.push({ pos: el.y + el.height / 2, source: el.id })
    yRefs.push({ pos: el.y + el.height, source: el.id })
  })

  // Find closest X snap
  let bestXDist = SNAP_THRESHOLD + 1
  let bestXSnap = null

  for (const ref of xRefs) {
    for (const [edgeName, edgeVal] of [
      ['left', dragEdges.left],
      ['centerX', dragEdges.centerX],
      ['right', dragEdges.right],
    ]) {
      const dist = Math.abs(edgeVal - ref.pos)
      if (dist < bestXDist) {
        bestXDist = dist
        bestXSnap = { refPos: ref.pos, edge: edgeName, offset: ref.pos - edgeVal }
      }
    }
  }

  if (bestXSnap) {
    snappedX = draggedEl.x + bestXSnap.offset
    guides.push({ axis: 'x', position: bestXSnap.refPos })
  }

  // Find closest Y snap
  let bestYDist = SNAP_THRESHOLD + 1
  let bestYSnap = null

  for (const ref of yRefs) {
    for (const [edgeName, edgeVal] of [
      ['top', dragEdges.top],
      ['centerY', dragEdges.centerY],
      ['bottom', dragEdges.bottom],
    ]) {
      const dist = Math.abs(edgeVal - ref.pos)
      if (dist < bestYDist) {
        bestYDist = dist
        bestYSnap = { refPos: ref.pos, edge: edgeName, offset: ref.pos - edgeVal }
      }
    }
  }

  if (bestYSnap) {
    snappedY = draggedEl.y + bestYSnap.offset
    guides.push({ axis: 'y', position: bestYSnap.refPos })
  }

  return { guides, snappedX, snappedY }
}
