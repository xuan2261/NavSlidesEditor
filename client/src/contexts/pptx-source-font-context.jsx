import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { loadPptxSourceFontRuntime } from '../hooks/use-pptx-source-font-loader'
import { collectSemanticFontRequests } from 'revealjs-shared/src/pptx-source-font-request.js'

const empty = { status: 'idle', fontRuntime: null, sourceIdentity: null, issues: [] }
export const PptxSourceFontContext = createContext(empty)

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
  presentationId, requestIdentity, fontRevision, children, outputDocument, loadRuntime, pptxSemantic,
}) {
  const environment = useSyncExternalStore(
    useCallback((notify) => subscribeBrowserProfile(outputDocument, notify), [outputDocument]),
    () => browserProfile(outputDocument),
    () => browserProfile(outputDocument),
  )
  const loadingState = {
    ...empty,
    status: 'loading',
    presentationId,
    requestIdentity,
    outputDocument,
    loadRuntime,
    environment,
  }
  const [state, setState] = useState(loadingState)
  const matching =
    state.outputDocument === outputDocument &&
    state.loadRuntime === loadRuntime &&
    state.environment === environment &&
    state.presentationId === presentationId &&
    state.requestIdentity === requestIdentity
  // Forget a disposed identity even when navigation later returns to the same
  // source while another registration is still pending.
  if (!matching) setState(loadingState)
  const resource = useRef(null),
    revision = useRef(fontRevision)
  useEffect(() => {
    revision.current = fontRevision
    resource.current?.retry(fontRevision)
  }, [fontRevision])
  useEffect(() => {
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
          setState({
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
          setState({
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
      controller.abort()
      runtime?.dispose()
      if (resource.current === owner) resource.current = null
    }
  }, [presentationId, requestIdentity, outputDocument, loadRuntime, environment])
  const value = matching ? state : loadingState
  return (
    <PptxSourceFontContext.Provider value={{ ...value, fontRevision, pptxSemantic }}>
      {children}
    </PptxSourceFontContext.Provider>
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
  const inherited = useContext(PptxSourceFontContext)
  let requestIdentity = null,
    invalid = false
  try {
    // Save acknowledgements can retry delivery, but do not identify font faces.
    // Derive the identity from the current declarations, including nested scopes.
    if (pptxSemantic) requestIdentity = collectSemanticFontRequests(pptxSemantic).identity
  } catch {
    invalid = true
  }
  if (invalid || !presentationId || !requestIdentity) {
    const value = invalid
      ? { ...empty, status: 'unavailable', issues: [{ code: 'source-font-declarations-invalid' }] }
      : empty
    return <PptxSourceFontContext.Provider value={value}>{children}</PptxSourceFontContext.Provider>
  }
  if (
    inherited.presentationId === presentationId &&
    inherited.requestIdentity === requestIdentity &&
    inherited.outputDocument === outputDocument &&
    inherited.loadRuntime === loadRuntime &&
    Object.is(inherited.fontRevision, fontRevision)
  )
    return children
  return (
    <SourceFontSession
      presentationId={presentationId} requestIdentity={requestIdentity} fontRevision={fontRevision}
      outputDocument={outputDocument} loadRuntime={loadRuntime} pptxSemantic={pptxSemantic}
    >
      {children}
    </SourceFontSession>
  )
}
