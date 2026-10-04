const { createDragController } = require('./drag-controller.js')
const { moveOrder } = require('../assignment-state.js')

// Pointer placement produces the same permutation as repeated native Move up/down.
function createOrderingDrag({ root, rows, session, getOrder, onChange }) {
  const sources = rows.map((row) => ({ id: row.id, element: row.handle }))
  const targets = rows.map((row) => ({ id: row.id, element: row.element }))
  return createDragController({
    root,
    sources,
    targets,
    session,
    onCommit: (sourceId, targetId) => {
      let order = getOrder()
      const destination = order.indexOf(targetId)
      if (destination < 0 || sourceId === targetId) return
      let index = order.indexOf(sourceId)
      if (index < 0) return
      const direction = index < destination ? 1 : -1
      while (index !== destination) {
        order = moveOrder(order, sourceId, direction)
        index += direction
      }
      onChange(order, sourceId)
    },
  })
}

module.exports = { createOrderingDrag }
