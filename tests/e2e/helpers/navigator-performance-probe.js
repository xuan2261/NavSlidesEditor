// Injected before document scripts: all clocks below use the browser time origin.
// Double rAF is a painted-frame upper bound, not an exact compositor timestamp.
export async function installProbe(context) {
  await context.addInitScript(() => {
    const unavailable = (reason) => ({ available: false, value: null, reason })
    const state = { samples: [], eventTiming: [], longTasks: [], identities: new WeakMap(), order: [] }
    const observe = (type, target, options = {}) => {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return unavailable(`${type} observer unsupported`)
      const observer = new PerformanceObserver((list) => target.push(...list.getEntries().map((entry) => ({ name: entry.name, startTime: entry.startTime, duration: entry.duration, interactionId: entry.interactionId ?? null }))))
      try { observer.observe({ type, buffered: true, ...options }); return { available: true, value: target } }
      catch (error) { return unavailable(error.message) }
    }
    state.longTaskAvailability = observe('longtask', state.longTasks)
    state.eventTimingAvailability = observe('event', state.eventTiming, { durationThreshold: 16 })
    const nav = () => document.querySelector('nav[aria-label="Slides"]')
    const parents = () => [...(nav()?.querySelectorAll(':scope > ul > li') || [])]
    const children = () => [...(nav()?.querySelectorAll(':scope > ul > li > ul > li') || [])]
    const flattened = () => parents().length + children().length
    const order = () => parents().map((node) => state.identities.get(node) ?? null)
    const canvasHas = (id) => [...document.querySelectorAll('[data-testid^="slide-element-"]')].some((node) => node.getAttribute('data-element-id') === id)
    const inputEditor = (config) => document.querySelector(`[data-testid="slide-element-${CSS.escape(config.elementId)}"] .ProseMirror`)
    const selected = (id) => parents().find((node) => state.identities.get(node) === id)?.querySelector(':scope > button')
    const paint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))))
    const idle = () => new Promise((resolve) => {
      if (window.requestIdleCallback) requestIdleCallback(resolve, { timeout: 100 })
      else requestAnimationFrame(resolve)
    })
    const until = (predicate) => new Promise((resolve, reject) => {
      let frame
      const timeout = setTimeout(() => { cancelAnimationFrame(frame); reject(new Error('Semantic ready oracle timed out')) }, 30000)
      const tick = () => {
        if (predicate()) { clearTimeout(timeout); resolve(); return }
        frame = requestAnimationFrame(tick)
      }
      tick()
    })
    const semantic = (config) => {
      if (config.kind === 'selection') return canvasHas(config.elementId) && document.querySelector(`button[aria-label="${config.label}"]`)?.getAttribute('aria-current') === 'true'
      if (config.kind === 'input') return inputEditor(config)?.textContent.includes(config.marker) && selected(config.slideId)?.getAttribute('aria-current') === 'true'
      if (config.kind === 'scroll') return config.direction * ((nav()?.scrollTop ?? config.before) - config.before) > 0
      if (config.kind === 'drop') return JSON.stringify(order()) === JSON.stringify(config.order) && canvasHas(config.elementId) && selected(config.activeId)?.getAttribute('aria-current') === 'true' && selected(config.activeId)?.getAttribute('aria-pressed') === 'true'
      return false
    }
    window.__navigatorProbe = {
      idle,
      async ready(ids, firstElementId, synthetic) {
        await until(() => parents().length === ids.length && canvasHas(firstElementId))
        parents().forEach((node, index) => {
          if (synthetic && !node.querySelector(':scope > button')?.textContent.includes(`Identity ${ids[index]}`)) throw new Error(`Fixture content mismatch for ${ids[index]}`)
          state.identities.set(node, ids[index])
        })
        state.order = ids
        await document.fonts.ready
        const images = [...(nav()?.querySelectorAll('img') || [])]
        await Promise.all(images.map((image) => image.decode()))
        if (images.some((image) => image.naturalWidth === 0)) throw new Error('Fixture image did not decode')
        return { openToReadyMs: await paint(), parentCount: parents().length, flattenedCount: flattened(), identityMode: synthetic ? 'source-content IDs + canvas element IDs' : 'persisted source order + keyed DOM node identity + canvas element IDs' }
      },
      async arm(config) {
        await idle()
        await paint()
        const record = { ...config, startTime: null, endTime: null, paintUpperBoundMs: null, status: 'armed' }
        state.samples.push(record)
        let resolve, reject, frame, started = false, cleaned = false
        const promise = new Promise((yes, no) => { resolve = yes; reject = no })
        // Store a handled promise immediately; a failed native action must not leak a rejection.
        promise.catch(() => {})
        const eventName = { selection: 'click', input: 'beforeinput', scroll: 'wheel', drop: 'drop' }[config.kind]
        const cleanup = () => {
          if (cleaned) return
          cleaned = true; clearTimeout(timer); cancelAnimationFrame(frame)
          document.removeEventListener(eventName, begin, true)
        }
        const fail = (message) => { cleanup(); record.status = 'failed'; record.error = message; reject(new Error(message)) }
        const finish = () => {
          if (cleaned) return
          if (!semantic(config)) { frame = requestAnimationFrame(finish); return }
          frame = requestAnimationFrame(() => {
            if (cleaned) return
            if (!semantic(config)) { frame = requestAnimationFrame(finish); return }
            record.endTime = performance.now(); record.paintUpperBoundMs = record.endTime - record.startTime
            record.status = 'passed'; cleanup(); resolve(record)
          })
        }
        const begin = (event) => {
          if (started) return
          if (config.kind === 'selection' && !event.target.closest(`button[aria-label="${config.label}"]`)) return
          if (config.kind === 'input' && !inputEditor(config)?.contains(event.target)) return
          if (['scroll', 'drop'].includes(config.kind) && !nav()?.contains(event.target)) return
          if (!event.isTrusted) { fail('Untrusted synthetic event is not a native timing sample'); return }
          const dispatched = performance.now()
          if (!(event.timeStamp > 0 && event.timeStamp <= dispatched + 1)) { fail('Native event timestamp does not share the browser time origin'); return }
          started = true; record.startTime = event.timeStamp; record.dispatchStartTime = dispatched; record.dispatchQueueDelayMs = dispatched - event.timeStamp; record.nativeEvent = event.type; record.trusted = event.isTrusted
          frame = requestAnimationFrame(finish)
        }
        const timer = setTimeout(() => fail(`Native ${config.kind} event or stable-ID paint oracle timed out`), 10000)
        document.addEventListener(eventName, begin, true)
        state.pending = promise
      },
      finish: () => state.pending,
      order,
      snapshot() {
        const memory = performance.memory
        const samples = state.samples.map((sample) => {
          const matches = state.eventTiming.filter((entry) => sample.startTime !== null && entry.startTime >= sample.startTime - 2 && entry.startTime <= (sample.endTime ?? sample.startTime) && (entry.name === sample.nativeEvent || sample.kind === 'input' && ['keydown', 'keypress', 'input', 'beforeinput'].includes(entry.name)))
          return { ...sample, nativePaint: matches.length ? { available: true, entries: matches, resolution: 'Event Timing durations rounded to8ms; reporting threshold16ms' } : unavailable(state.eventTimingAvailability.available ? 'No correlated native Event Timing entry (unsupported event or below reporting threshold)' : state.eventTimingAvailability.reason) }
        })
        return {
          samples, longTasks: state.longTaskAvailability, eventTiming: state.eventTimingAvailability,
          dom: { documentElements: document.querySelectorAll('*').length, navigatorElements: nav()?.querySelectorAll('*').length ?? null, parentEntries: parents().length, flattenedEntries: flattened() },
          heap: memory ? { available: true, usedBytes: memory.usedJSHeapSize, totalBytes: memory.totalJSHeapSize, limitBytes: memory.jsHeapSizeLimit, source: 'performance.memory; browser may bucket estimates' } : unavailable('performance.memory unsupported'),
          reactCommit: unavailable('Normal production build has no React profiling instrumentation; never merge profiling-build samples'),
          resources: performance.getEntriesByType('resource').map((entry) => ({ name: new URL(entry.name, location.href).pathname, initiatorType: entry.initiatorType, duration: entry.duration, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })),
        }
      },
    }
  })
}

export async function captureAttribution(session) {
  const result = {}
  for (const [key, method] of [['performance', 'Performance.getMetrics'], ['dom', 'Memory.getDOMCounters'], ['heap', 'Runtime.getHeapUsage']]) {
    try { result[key] = { available: true, value: await session.send(method) } }
    catch (error) { result[key] = { available: false, value: null, reason: error.message } }
  }
  return result
}
