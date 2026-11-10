const { normalizePptxSemanticDocument } = require('./pptx-semantic-document')
const { decodeSemanticOutputResources, validateSemanticOutputResources, outputFailure } = require('./pptx-semantic-output-resources')
const { cloneTextData } = require('./pptx-text-document')
const { createTableFontRuntime } = require('./pptx-table-runtime-fonts')
const { prepareSemanticOutputPaint } = require('./pptx-semantic-output-paint')

function startSemanticOutput(document, payload, pending) {
  const win = document.defaultView
  if (win.__navslidesSemanticOutput !== pending?.handle) win.__navslidesSemanticOutput?.dispose()
  let runtime, generation = 0, rejectReady, media, observer
  const listeners = []
  const handle = pending?.handle || { state: 'loading', ready: null, issues: [] }
  if (handle.state === 'disposed') return handle
  Object.assign(handle, { dispose, ensureReady })
  win.__navslidesSemanticOutput = handle
  let retained, invalid
  try {
    retained = { semantic: normalizePptxSemanticDocument(payload.semantic),
      resources: payload.resources == null ? null : validateSemanticOutputResources(payload.resources),
      mounts: cloneTextData(payload.mounts),
      slides: payload.slides == null ? null : cloneTextData(payload.slides) }
  } catch (error) { invalid = error }
  const live = () => win.__navslidesSemanticOutput === handle && handle.state !== 'disposed'
  const validate = () => runtime?.measurement.validate(runtime.fontProfile, runtime.rendererProfile)
  function emit() {
    win.dispatchEvent(new win.CustomEvent('navslides-semantic-output', {
      detail: { state: handle.state, issues: handle.issues },
    }))
  }
  function revoke() {
    win.__navslidesExportReady = false
    document.querySelector('#print-bar button')?.setAttribute('disabled', '')
    for (const node of document.querySelectorAll('[data-pptx-semantic-mount]')) node.replaceChildren()
    runtime?.dispose()
    runtime = null
  }
  function dispose() {
    if (handle.state === 'disposed') return
    generation++
    handle.state = 'disposed'
    rejectReady?.(outputFailure('semantic-output-disposed', 'document disposed'))
    observer?.disconnect()
    media?.removeEventListener('change', changed)
    for (const [target, type, listener] of listeners) target.removeEventListener(type, listener)
    revoke()
    emit()
  }
  function fail(error) {
    if (!live()) return
    handle.state = 'error'
    handle.issues = (error.issues?.length ? error.issues : [error]).map((issue) => ({
      code: issue.code || error.code || 'semantic-output-error',
      message: issue.message || error.message,
      instanceId: issue.instanceId || error.instanceId,
      componentId: issue.componentId || error.componentId,
      part: issue.part || error.part, path: issue.path || error.path,
    }))
    revoke()
    for (const node of document.querySelectorAll('[data-pptx-semantic-mount]')) {
      node.textContent = `Canonical output unavailable: ${error.message}`
      node.setAttribute('role', 'alert')
    }
    win.__navslidesExportError = { code: 'semantic-output-error', issues: handle.issues }
    emit()
  }
  function rebuild() {
    const token = ++generation
    rejectReady?.(outputFailure('semantic-output-stale', 'generation replaced'))
    observer?.disconnect()
    revoke()
    handle.state = 'loading'
    handle.issues = []
    win.__navslidesExportError = null
    handle.ready = new Promise((resolve, reject) => {
      rejectReady = reject
      Promise.resolve().then(async () => {
        if (invalid) throw invalid
        const semantic = retained.semantic
        const resources = await decodeSemanticOutputResources(semantic, retained.resources, win)
        if (!live() || token !== generation) throw outputFailure('semantic-output-stale', 'generation replaced')
        const loaded = resources.assets.length
          ? await createTableFontRuntime({ document, ...resources }) : null
        if (!live() || token !== generation) {
          loaded?.dispose()
          throw outputFailure('semantic-output-stale', 'generation replaced')
        }
        runtime = loaded
        const hyperlinkPresentation = retained.slides ? { slides: retained.slides, pptxSemantic: semantic } : null
        const plan = prepareSemanticOutputPaint(document, semantic, retained.mounts, runtime, hyperlinkPresentation)
        const stale = validate()
        if (stale) throw outputFailure('semantic-output-stale', stale)
        for (const { node, svg } of plan) {
          node.innerHTML = svg
          node.removeAttribute('role')
        }
        handle.state = 'ready'
        media?.removeEventListener('change', changed)
        media = win.matchMedia(`(resolution: ${win.devicePixelRatio}dppx)`)
        media.addEventListener('change', changed)
        observer = new win.MutationObserver(() => {
          if (live() && handle.state === 'ready' && validate()) rebuild()
        })
        observer.observe(document.body, { childList: true, subtree: true })
        emit()
        resolve()
      }).catch((error) => {
        if (token === generation) fail(error)
        reject(error)
      })
    })
    // Observe rejection without replacing the rejecting public Promise.
    handle.ready.catch(() => {})
    emit()
    return handle.ready
  }
  function ensureReady() {
    if (!live()) return Promise.reject(outputFailure('semantic-output-disposed', 'document disposed'))
    if (handle.state === 'ready' && validate()) return rebuild()
    return handle.ready
  }
  function changed() {
    if (live() && handle.state === 'ready' && validate()) rebuild()
  }
  function on(target, type, listener) {
    target.addEventListener(type, listener)
    listeners.push([target, type, listener])
  }
  on(win, 'resize', changed)
  on(win, 'languagechange', changed)
  on(document, 'visibilitychange', changed)
  on(document.fonts, 'loadingdone', changed)
  on(win, 'beforeprint', changed)
  // A persisted document owns a new measurement session after restoration.
  on(win, 'pagehide', (event) => {
    dispose()
    if (event.persisted) win.addEventListener('pageshow', function restore(event) {
      if (!event.persisted) return
      win.removeEventListener('pageshow', restore)
      if (win.__navslidesSemanticOutput === handle) startSemanticOutput(document, retained || payload)
    })
  })
  rebuild()
  if (pending) handle.ready.then(pending.resolve, pending.reject)
  return handle
}
module.exports = { startSemanticOutput }
