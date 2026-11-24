import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { loadPptxSourceFontRuntime } from '../hooks/use-pptx-source-font-loader'
import { collectSemanticFontRequests, readCachedSemanticFontRequests } from 'revealjs-shared/src/pptx-source-font-request.js'
import { normalizePptxSemanticDocument } from 'revealjs-shared/src/pptx-semantic-document.js'

const empty = { status: 'idle', fontRuntime: null, sourceIdentity: null, issues: [] }
export const PptxSourceFontContext = createContext(empty)
// Ownership follows exact admitted roots, not the public runtime snapshot.
const PptxSourceFontOwnerContext = createContext(null)
const invalidState = { ...empty, status: 'unavailable', issues: [{ code: 'source-font-declarations-invalid' }] }

// Match the measurer's browser identity, not viewport geometry or touch support.
const browserProfile = (document) => {
  const win = document?.defaultView
  return JSON.stringify(win ? [win.navigator.userAgent, win.navigator.platform,
    win.navigator.language, win.devicePixelRatio] : null)
}
function subscribeBrowserProfile(document, notify) {
  const win = document?.defaultView
  if (!win) return () => {}
  let resolution
  const arm = () => {
    resolution?.removeEventListener('change', changed)
    resolution = win.matchMedia?.(`(resolution: ${win.devicePixelRatio}dppx)`)
    resolution?.addEventListener('change', changed)
  }
  const changed = () => { arm(); notify() }
  const events = ['resize', 'languagechange', 'pageshow', 'focus']
  for (const event of events) win.addEventListener(event, changed)
  document.addEventListener('visibilitychange', changed)
  arm()
  return () => {
    resolution?.removeEventListener('change', changed)
    for (const event of events) win.removeEventListener(event, changed)
    document.removeEventListener('visibilitychange', changed)
  }
}

function SourceFontSession({
  mode, inherited, inheritedValue,
  presentationId, requestIdentity, fontRevision, children, outputDocument, loadRuntime, pptxSemantic,
}) {
  const trackEnvironment = mode === 'active' || mode === 'pending'
  const environment = useSyncExternalStore(
    useCallback((notify) => (trackEnvironment ? subscribeBrowserProfile(outputDocument, notify) : () => {}), [trackEnvironment, outputDocument]),
    () => (trackEnvironment ? browserProfile(outputDocument) : null),
    () => (trackEnvironment ? browserProfile(outputDocument) : null),
  )
  const loadingState = useMemo(() => ({
    ...empty,
    status: 'loading',
    presentationId,
    requestIdentity,
    outputDocument,
    loadRuntime,
    environment,
  }), [presentationId, requestIdentity, outputDocument, loadRuntime, environment])
  const binding = useMemo(() => ({}),
    [mode, presentationId, requestIdentity, outputDocument, loadRuntime, environment])
  const generation = useRef(0)
  const [stored, setState] = useState(null)
  const matching = stored?.binding === binding && stored.generation === generation.current
  // Inactive transitions must forget ready state, even if repaired to the exact
  // same request later. Never publish a runtime disposed by effect cleanup.
  if (stored && !matching) setState(null)
  const resource = useRef(null),
    revision = useRef(fontRevision)
  useEffect(() => {
    revision.current = fontRevision
    if (mode === 'active') resource.current?.retry(fontRevision)
  }, [fontRevision, mode])
  useEffect(() => {
    if (mode !== 'active') return
    const currentGeneration = ++generation.current
    const publish = (value) => setState({ binding, generation: currentGeneration, value })
    const controller = new AbortController()
    let runtime = null,
      loading = false,
      failed = false,
      retryPending = false
    const start = () => {
      loading = true
      failed = false
      retryPending = false
      loadRuntime({
        presentationId,
        requestIdentity,
        document: outputDocument,
        signal: controller.signal,
      })
        .then((result) => {
          loading = false
          if (controller.signal.aborted) {
            result.fontRuntime.dispose()
            return
          }
          runtime = result.fontRuntime
          publish({
            status: 'ready',
            outputDocument,
            loadRuntime,
            environment,
            presentationId,
            requestIdentity,
            issues: [],
            ...result,
          })
        })
        .catch((cause) => {
          loading = false
          failed = true
          if (controller.signal.aborted) return
          if (retryPending) {
            start()
            return
          }
          publish({
            ...empty,
            status: 'unavailable',
            outputDocument,
            loadRuntime,
            environment,
            presentationId,
            requestIdentity,
            issues: cause.issues ?? [{ code: cause.code ?? 'source-font-runtime-unavailable' }],
          })
        })
    }
    const owner = {
      revision: revision.current,
      retry(nextRevision) {
        if (Object.is(owner.revision, nextRevision)) return
        owner.revision = nextRevision
        if (failed) start()
        else if (loading) retryPending = true
      },
    }
    resource.current = owner
    start()
    return () => {
      ++generation.current
      controller.abort()
      runtime?.dispose()
      if (resource.current === owner) resource.current = null
    }
  }, [binding, mode, presentationId, requestIdentity, outputDocument, loadRuntime, environment])
  // State already contains the full request binding and loader result (including
  // diagnostics/provenance). Root edits and revision acknowledgements alone must
  // not notify every public font consumer.
  const value = mode === 'inherited' ? inheritedValue
    : mode === 'invalid' ? invalidState
    : mode === 'idle' ? empty
    : mode === 'pending' ? loadingState
    : matching ? stored.value : loadingState
  const localOwner = useMemo(() => ({ presentationId, requestIdentity, fontRevision,
    outputDocument, loadRuntime, pptxSemantic }),
  [presentationId, requestIdentity, fontRevision, outputDocument, loadRuntime, pptxSemantic])
  return (
    <PptxSourceFontOwnerContext.Provider value={mode === 'inherited' ? inherited
      : mode === 'active' || mode === 'pending' ? localOwner : null}>
      <PptxSourceFontContext.Provider value={value}>
        {children}
      </PptxSourceFontContext.Provider>
    </PptxSourceFontOwnerContext.Provider>
  )
}

export function PptxSourceFontProvider({
  presentationId,
  pptxSemantic,
  fontRevision,
  children,
  document: outputDocument = globalThis.document,
  loadRuntime = loadPptxSourceFontRuntime,
}) {
  const inherited = useContext(PptxSourceFontOwnerContext)
  const inheritedValue = useContext(PptxSourceFontContext)
  const coldStarted = useRef(false)
  const [, collectionCompleted] = useState(0)
  let requestIdentity = null, normalized = null, pending = false, inherit = false,
    invalid = false
  try {
    // Admission/recovery remains synchronous and mandatory. Only collection of
    // the first cold root yields a task; edits keep synchronous layout semantics.
    if (pptxSemantic) {
      normalized = normalizePptxSemanticDocument(pptxSemantic)
      const cached = readCachedSemanticFontRequests(normalized)
      const exactParent = inherited?.pptxSemantic === normalized &&
        inherited.presentationId === presentationId &&
        inherited.outputDocument === outputDocument && inherited.loadRuntime === loadRuntime &&
        Object.is(inherited.fontRevision, fontRevision)
      if (exactParent) { inherit = true; requestIdentity = inherited.requestIdentity }
      else if (cached) requestIdentity = cached.identity
      else if (!coldStarted.current && presentationId) pending = true
      else requestIdentity = collectSemanticFontRequests(normalized).identity
    }
  } catch {
    invalid = true
  }
  useEffect(() => {
    if (!pending || invalid) return
    coldStarted.current = true
    let cancelled = false
    const task = setTimeout(() => {
      if (cancelled) return
      // Errors are re-observed by the synchronous path on the next render.
      try { collectSemanticFontRequests(normalized) } catch { /* fail closed below */ }
      if (!cancelled) collectionCompleted(value => value + 1)
    }, 0)
    return () => { cancelled = true; clearTimeout(task) }
  }, [pending, invalid, normalized, presentationId, outputDocument, loadRuntime, fontRevision])
  const mode = invalid ? 'invalid' : inherit ? 'inherited' : pending ? 'pending'
    : !presentationId || !requestIdentity ? 'idle' : 'active'
  return (
    <SourceFontSession
      mode={mode} inherited={inherited} inheritedValue={inheritedValue}
      presentationId={presentationId} requestIdentity={requestIdentity} fontRevision={fontRevision}
      outputDocument={outputDocument} loadRuntime={loadRuntime} pptxSemantic={normalized}
    >
      {children}
    </SourceFontSession>
  )
}
