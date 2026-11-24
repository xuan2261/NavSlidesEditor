function createAssignmentState() {
  return { assignments: [], selectedId: null, error: null }
}

// Arrays retain arbitrary stable IDs safely; labels and display positions never identify an answer.
function reduceAssignment(config, state, command) {
  if (
    !command ||
    (command.generation !== undefined &&
      state.generation !== undefined &&
      command.generation !== state.generation)
  )
    return state
  const sourceId = command.sourceId ?? state.selectedId
  const reject = (error) => ({ ...state, error })
  if (command.type === 'cancel') return { ...state, selectedId: null, error: null }
  if (!['select', 'assign', 'clear'].includes(command.type)) return state
  if (!config.sourceIds.includes(sourceId)) return reject('Unknown source ID.')
  if (command.type === 'select') return { ...state, selectedId: sourceId, error: null }
  if (command.type === 'clear')
    return {
      ...state,
      assignments: state.assignments.filter((row) => row.sourceId !== sourceId),
      selectedId: null,
      error: null,
    }
  if (!config.targetIds.includes(command.targetId)) return reject('Unknown target ID.')
  if (
    config.bijection !== false &&
    state.assignments.some((row) => row.targetId === command.targetId && row.sourceId !== sourceId)
  ) {
    return reject(
      'Target occupied. Clear or move its current source before assigning another source.'
    )
  }
  const assignments = state.assignments.filter((row) => row.sourceId !== sourceId)
  assignments.push({ sourceId, targetId: command.targetId })
  return { ...state, assignments, selectedId: null, error: null }
}

function assignmentAnswer(state, sourceKey = 'sourceId', targetKey = 'targetId') {
  return state.assignments.map((row) => ({ [sourceKey]: row.sourceId, [targetKey]: row.targetId }))
}

function moveOrder(itemIds, itemId, direction) {
  if (direction !== -1 && direction !== 1) return itemIds
  const index = itemIds.indexOf(itemId),
    destination = index + direction
  if (index < 0 || destination < 0 || destination >= itemIds.length) return itemIds
  const next = [...itemIds]
  ;[next[index], next[destination]] = [next[destination], next[index]]
  return next
}

module.exports = { createAssignmentState, reduceAssignment, assignmentAnswer, moveOrder }
