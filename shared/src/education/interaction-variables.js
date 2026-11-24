const LIMIT = 1_000_000_000
const MAX_INTERACTION_VARIABLES = 32
const isId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 160 &&
  !/[\u0000-\u001f\u007f]/.test(value)
const isNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LIMIT

function normalizeInteractionVariables(value) {
  if (value == null) return { variables: [], error: '' }
  const fail = (error) => ({ variables: null, error })
  if (!Array.isArray(value) || value.length > MAX_INTERACTION_VARIABLES)
    return fail('Declare at most 32 interaction variables.')
  const ids = new Set(),
    variables = []
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.keys(item).some((key) => !['id', 'name', 'initialValue', 'min', 'max'].includes(key))
    )
      return fail('Variable contains unsupported fields.')
    if (!isId(item.id) || ids.has(item.id)) return fail('Variable IDs must be valid and unique.')
    if (
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 80 ||
      /[<>\u0000-\u001f\u007f]/.test(item.name)
    )
      return fail('Variable name must be plain text of at most 80 characters.')
    if (
      ![item.min, item.initialValue, item.max].every(isNumber) ||
      item.min > item.initialValue ||
      item.initialValue > item.max
    )
      return fail('Variable requires finite min ≤ initialValue ≤ max within ±1,000,000,000.')
    ids.add(item.id)
    variables.push({
      id: item.id,
      name: item.name.trim(),
      initialValue: item.initialValue,
      min: item.min,
      max: item.max,
    })
  }
  return { variables, error: '' }
}

function initialInteractionValues(variables) {
  return Object.freeze(
    Object.fromEntries(variables.map((variable) => [variable.id, variable.initialValue]))
  )
}

function reduceInteractionVariables(state, variables, command) {
  if (command?.kind === 'reset') {
    if (command.variableIds === undefined) return initialInteractionValues(variables)
    if (!Array.isArray(command.variableIds))
      throw new TypeError('Reset variable IDs must be an array.')
    const selected = new Set(command.variableIds)
    if ([...selected].some((id) => !variables.some((variable) => variable.id === id)))
      throw new RangeError('Choose declared interaction variables before resetting scores.')
    if (!selected.size) return state
    return Object.freeze({
      ...state,
      ...Object.fromEntries(
        variables
          .filter((variable) => selected.has(variable.id))
          .map((variable) => [variable.id, variable.initialValue])
      ),
    })
  }
  if (command?.kind !== 'change')
    throw new TypeError('Choose change or reset for interaction variables.')
  const variable = variables.find((item) => item.id === command.variableId)
  if (!variable || !Object.hasOwn(state, variable.id))
    throw new RangeError('Choose a declared interaction variable.')
  if (!Number.isFinite(command.delta) || Math.abs(command.delta) > LIMIT)
    throw new RangeError('Score delta must be finite and at most 1,000,000,000.')
  const current = state[variable.id]
  if (!isNumber(current) || current < variable.min || current > variable.max)
    throw new RangeError('Interaction variable state is outside its authored bounds.')
  const next = Math.min(variable.max, Math.max(variable.min, current + command.delta))
  return next === current ? state : Object.freeze({ ...state, [variable.id]: next })
}

function createInteractionVariableStore(value = []) {
  const { variables, error } = normalizeInteractionVariables(value)
  if (error) throw new TypeError(error)
  let state = initialInteractionValues(variables),
    alive = true
  const listeners = new Set()
  function read(variableId) {
    if (!Object.hasOwn(state, variableId))
      throw new RangeError('Choose a declared interaction variable.')
    return state[variableId]
  }
  function dispatch(command) {
    if (!alive) throw new Error('Interaction variable store is destroyed.')
    const next = reduceInteractionVariables(state, variables, command)
    if (Object.keys(next).some((id) => next[id] !== state[id])) {
      state = next
      for (const listener of [...listeners]) listener(state)
    }
    return state
  }
  return {
    read,
    getState: () => state,
    change: (variableId, delta) => {
      dispatch({ kind: 'change', variableId, delta })
      return read(variableId)
    },
    reset: (variableIds) => dispatch({ kind: 'reset', variableIds }),
    subscribe: (listener) => {
      if (!alive) throw new Error('Interaction variable store is destroyed.')
      if (typeof listener !== 'function') throw new TypeError('Subscriber must be a function.')
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy: () => {
      alive = false
      listeners.clear()
    },
  }
}

module.exports = {
  MAX_INTERACTION_VARIABLES,
  INTERACTION_VALUE_LIMIT: LIMIT,
  normalizeInteractionVariables,
  initialInteractionValues,
  reduceInteractionVariables,
  createInteractionVariableStore,
}
