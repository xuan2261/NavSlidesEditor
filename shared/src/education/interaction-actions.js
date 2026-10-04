const INTERACTION_ACTION_KINDS = new Set([
  'show',
  'hide',
  'toggle',
  'score-add',
  'score-subtract',
  'reset-slide',
])
const VISIBILITY_KINDS = new Set(['show', 'hide', 'toggle'])
const SCORE_KINDS = new Set(['score-add', 'score-subtract'])
const validId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 160 &&
  !/[\u0000-\u001f\u007f]/.test(value)
const validElementId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 512 &&
  !/[\u0000-\u001f\u007f]/.test(value)

function normalizeInteractionAction(value) {
  const fail = (error) => ({ action: null, error })
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !INTERACTION_ACTION_KINDS.has(value.kind)
  )
    return fail('Choose a supported interaction action.')
  const allowed = new Set(['kind', 'label', 'hotspot'])
  if (VISIBILITY_KINDS.has(value.kind)) {
    allowed.add('targetElementId')
    allowed.add('referenceError')
  }
  if (SCORE_KINDS.has(value.kind)) {
    allowed.add('variableId')
    allowed.add('amount')
  }
  if (value.kind === 'reset-slide') allowed.add('resetVariables')
  if (Object.keys(value).some((key) => !allowed.has(key)))
    return fail('Interaction action contains unsupported fields.')
  if (
    value.label != null &&
    (typeof value.label !== 'string' ||
      value.label.length > 240 ||
      /[\u0000-\u001f\u007f]/.test(value.label))
  )
    return fail('Action label must be plain text of at most 240 characters.')
  if (value.hotspot != null && typeof value.hotspot !== 'boolean')
    return fail('Action hotspot must be boolean.')
  const action = { kind: value.kind }
  if (value.label?.trim()) action.label = value.label.trim()
  if (value.hotspot === true) action.hotspot = true
  if (VISIBILITY_KINDS.has(value.kind)) {
    if (!validElementId(value.targetElementId))
      return fail('Choose a target element in this effective slide.')
    action.targetElementId = value.targetElementId
    if (value.referenceError !== undefined) {
      if (
        typeof value.referenceError !== 'string' ||
        !value.referenceError.trim() ||
        value.referenceError.length > 240 ||
        /[\u0000-\u001f\u007f]/.test(value.referenceError)
      )
        return fail('Target diagnostic must be plain text of at most 240 characters.')
      action.referenceError = value.referenceError.trim()
    }
  }
  if (SCORE_KINDS.has(value.kind)) {
    if (!validId(value.variableId)) return fail('Choose a declared interaction variable.')
    if (!Number.isFinite(value.amount) || value.amount <= 0 || value.amount > 1_000_000)
      return fail('Score amount must be finite, positive and at most 1,000,000.')
    action.variableId = value.variableId
    action.amount = value.amount
  }
  if (value.kind === 'reset-slide') {
    if (value.resetVariables != null && typeof value.resetVariables !== 'boolean')
      return fail('Reset variables must be boolean.')
    action.resetVariables = value.resetVariables === true
  }
  return { action, error: '' }
}

function createInteractionSlideState(slide) {
  const initialVisibility = Object.freeze(
    Object.fromEntries(
      (slide?.elements || [])
        .filter((element) => validElementId(element?.id) && !element.hidden)
        .map((element) => [element.id, element.initialVisibility !== 'hidden'])
    )
  )
  return Object.freeze({
    slideId: slide?.id,
    generation: 0,
    initialVisibility,
    visibility: initialVisibility,
  })
}

function isInteractionElementVisible(state, elementId, fragmentGate = true) {
  return (
    Object.hasOwn(state.visibility, elementId) &&
    state.visibility[elementId] === true &&
    fragmentGate === true
  )
}

function reduceInteractionAction(state, value) {
  const { action, error } = normalizeInteractionAction(value)
  if (error) return { state, error }
  if (action.kind === 'reset-slide')
    return {
      state: Object.freeze({
        ...state,
        generation: state.generation + 1,
        visibility: state.initialVisibility,
      }),
      error: '',
    }
  if (!VISIBILITY_KINDS.has(action.kind)) return { state, error: '' }
  if (action.referenceError) return { state, error: action.referenceError }
  if (!Object.hasOwn(state.visibility, action.targetElementId))
    return {
      state,
      error: 'Target is missing from this effective slide. Choose an existing, exported element.',
    }
  const visible =
    action.kind === 'toggle' ? !state.visibility[action.targetElementId] : action.kind === 'show'
  if (visible === state.visibility[action.targetElementId]) return { state, error: '' }
  return {
    state: Object.freeze({
      ...state,
      visibility: Object.freeze({ ...state.visibility, [action.targetElementId]: visible }),
    }),
    error: '',
  }
}

// Side effects are injected by the document presenter; no DOM/global store here.
function executeInteractionAction(state, value, { variables, onReset } = {}) {
  const { action, error } = normalizeInteractionAction(value)
  if (error) return { state, error }
  const result = reduceInteractionAction(state, action)
  if (result.error) return result
  if (SCORE_KINDS.has(action.kind) || (action.kind === 'reset-slide' && action.resetVariables)) {
    if (!variables) return { state, error: 'Interaction variable store is unavailable.' }
    try {
      if (SCORE_KINDS.has(action.kind))
        variables.change(
          action.variableId,
          action.kind === 'score-add' ? action.amount : -action.amount
        )
      else variables.reset()
    } catch (failure) {
      return { state, error: failure.message }
    }
  }
  if (action.kind === 'reset-slide') onReset?.(result.state)
  return result
}

module.exports = {
  INTERACTION_ACTION_KINDS,
  normalizeInteractionAction,
  createInteractionSlideState,
  isInteractionElementVisible,
  reduceInteractionAction,
  executeInteractionAction,
}
