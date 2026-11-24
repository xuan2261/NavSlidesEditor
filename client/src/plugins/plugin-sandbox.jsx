import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  buildSandboxFrameDocument,
  HTML_SANDBOX,
} from 'revealjs-shared/src/education/html-sandbox-policy.js'
import { createPluginHostBridge } from 'revealjs-shared/src/education/plugin-message-contract.js'

export default function PluginSandbox({
  sandboxUrl,
  pluginData = {},
  width = 360,
  height = 180,
  interactive = false,
  onDataUpdate,
}) {
  const iframeRef = useRef(null)
  const bridgeRef = useRef(null)
  const latest = useRef({ pluginData, width, height, onDataUpdate })
  latest.current = { pluginData, width, height, onDataUpdate }
  const [srcDoc, setSrcDoc] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setSrcDoc('')
    async function load() {
      try {
        const response = await fetch(sandboxUrl, { signal: controller.signal })
        if (!response.ok) throw new Error(`Plugin sandbox unavailable (HTTP ${response.status}).`)
        const content = await response.text()
        if (!controller.signal.aborted)
          setSrcDoc(buildSandboxFrameDocument(content, undefined, { plugin: true }))
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message || 'Plugin sandbox unavailable.')
      }
    }
    load()
    return () => controller.abort()
  }, [sandboxUrl])
  useLayoutEffect(() => {
    if (!iframeRef.current || !srcDoc) return undefined
    try {
      const state = latest.current
      const bridge = createPluginHostBridge({
        frame: iframeRef.current,
        pluginData: state.pluginData,
        size: { width: state.width, height: state.height },
        onDataUpdate: (patch) => latest.current.onDataUpdate?.(patch),
      })
      bridgeRef.current = bridge
      return () => {
        bridge.destroy()
        bridgeRef.current = null
      }
    } catch (failure) {
      setError(failure.message)
      return undefined
    }
  }, [srcDoc, error])
  useEffect(() => {
    try {
      bridgeRef.current?.update(pluginData, { width, height })
    } catch (failure) {
      setError(failure.message)
    }
  }, [pluginData, width, height])
  const initialize = () => {
    try {
      bridgeRef.current?.load()
    } catch (failure) {
      setError(failure.message)
    }
  }
  if (error)
    return (
      <div
        role="alert"
        className="flex h-full w-full items-center justify-center text-xs text-text-muted"
      >
        {error}
      </div>
    )
  if (!srcDoc)
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
        Loading plugin...
      </div>
    )
  return (
    <iframe
      ref={iframeRef}
      title="Plugin sandbox"
      sandbox={HTML_SANDBOX}
      srcDoc={srcDoc}
      onLoad={initialize}
      className={`block h-full w-full border-0 ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
    />
  )
}
