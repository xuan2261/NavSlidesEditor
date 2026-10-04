function freezeState(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freezeState(child)
  return Object.freeze(value)
}
const defaultClock = {
  now: () => performance.now(),
  setTimeout: (fn, delay) => setTimeout(fn, delay),
  clearTimeout: (handle) => clearTimeout(handle),
}
function createRuntimeSession(
  initialState,
  reducer,
  { clock = defaultClock, onState = () => {}, pauseOnHide = true } = {}
) {
  let generation = 0,
    alive = true,
    paused = false,
    pausedAt = 0,
    totalHiddenMs = 0
  const timers = new Set(),
    resources = new Set()
  const activityClock = {
    now: () => (paused ? pausedAt : clock.now()) - totalHiddenMs,
    setTimeout: (callback, delay) => schedule(callback, delay),
    clearTimeout: (cancel) => {
      if (typeof cancel === 'function') cancel()
    },
  }
  let state = freezeState({ ...initialState(activityClock), generation })
  const emit = () => {
    onState(state)
    return state
  }
  function dispatch(command, expectedGeneration = generation) {
    if (!alive || expectedGeneration !== generation) return state
    const next = reducer(state, command, activityClock)
    if (next !== state) {
      state = freezeState({ ...next, generation })
      emit()
    }
    return state
  }
  function cancelTimer(timer) {
    timer.ticket++
    clock.clearTimeout(timer.handle)
    timers.delete(timer)
  }
  function arm(timer) {
    const ticket = ++timer.ticket
    timer.due = clock.now() + timer.remaining
    timer.handle = clock.setTimeout(() => {
      if (
        !alive ||
        paused ||
        timer.generation !== generation ||
        ticket !== timer.ticket ||
        !timers.has(timer)
      )
        return
      timers.delete(timer)
      timer.callback()
    }, timer.remaining)
  }
  function schedule(callback, delay) {
    if (!alive) return () => {}
    const timer = { callback, remaining: delay, generation, ticket: 0, handle: undefined }
    timers.add(timer)
    if (!paused) arm(timer)
    return () => cancelTimer(timer)
  }
  function own(cleanup) {
    let owned = true
    const dispose = () => {
      if (owned) {
        owned = false
        resources.delete(dispose)
        cleanup()
      }
    }
    if (alive) resources.add(dispose)
    else dispose()
    return dispose
  }
  function clearResources() {
    for (const timer of timers) cancelTimer(timer)
    let failure
    for (const dispose of [...resources]) {
      try {
        dispose()
      } catch (error) {
        failure ||= error
      }
    }
    if (failure) throw failure
  }
  function reset() {
    if (!alive) return state
    generation++
    clearResources()
    state = freezeState({ ...initialState(activityClock), generation })
    return emit()
  }
  function pause() {
    if (!alive || paused || !pauseOnHide) return
    paused = true
    pausedAt = clock.now()
    for (const timer of timers) {
      timer.remaining = Math.max(0, timer.due - pausedAt)
      timer.ticket++
      clock.clearTimeout(timer.handle)
    }
  }
  function resume() {
    if (!alive || !paused) return
    totalHiddenMs += clock.now() - pausedAt
    paused = false
    for (const timer of timers) arm(timer)
  }
  function destroy() {
    if (!alive) return
    alive = false
    generation++
    clearResources()
  }
  return {
    getState: () => state,
    dispatch,
    schedule,
    own,
    reset,
    pause,
    resume,
    destroy,
    clock: activityClock,
  }
}
module.exports = { createRuntimeSession }
