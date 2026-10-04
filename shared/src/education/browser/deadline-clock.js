const defaultClock = {
  now: () => performance.now(),
  setTimeout: (fn, delay) => setTimeout(fn, delay),
  clearTimeout: (handle) => clearTimeout(handle),
}
function createDeadlineClock({
  clock = defaultClock,
  live = false,
  onTick = () => {},
  onExpire = () => {},
} = {}) {
  let remainingMs = 0,
    deadline = 0,
    running = false,
    expired = false,
    alive = true,
    generation = 0,
    handle
  const remaining = () => (running ? Math.max(0, deadline - clock.now()) : remainingMs)
  const getState = () => ({ remainingMs: remaining(), running, expired })
  function arm() {
    const expectedGeneration = generation
    handle = clock.setTimeout(
      () => {
        if (!alive || !running || generation !== expectedGeneration) return
        remainingMs = remaining()
        if (remainingMs === 0) {
          running = false
          expired = true
        }
        onTick(getState())
        if (expired) onExpire()
        else arm()
      },
      Math.min(100, remaining())
    )
  }
  function start(durationMs) {
    if (!alive) return
    generation++
    clock.clearTimeout(handle)
    remainingMs = durationMs
    deadline = clock.now() + durationMs
    expired = false
    running = true
    onTick(getState())
    arm()
  }
  function pause() {
    if (!alive || live || !running) return
    remainingMs = remaining()
    running = false
    generation++
    clock.clearTimeout(handle)
    onTick(getState())
  }
  function resume() {
    if (!alive || running || expired) return
    deadline = clock.now() + remainingMs
    running = true
    generation++
    onTick(getState())
    arm()
  }
  function destroy() {
    if (!alive) return
    remainingMs = remaining()
    running = false
    alive = false
    generation++
    clock.clearTimeout(handle)
  }
  return { getState, start, pause, resume, destroy }
}
module.exports = { createDeadlineClock }
