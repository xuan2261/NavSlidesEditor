import { useEffect, useMemo, useRef, useState } from 'react'

function injectBridge(html) {
  const bridge = `<script>
window.navslides = window.navslides || {
  updateData: function(patch) {
    window.parent.postMessage({ source: 'navslides-plugin', type: 'update-data', patch: patch || {} }, '*');
  }
};
</script>`
  if (html.includes('</head>')) return html.replace('</head>', `${bridge}</head>`)
  return `${bridge}${html}`
}

export default function PluginSandbox({
  sandboxUrl,
  pluginData = {},
  width,
  height,
  interactive = false,
  onDataUpdate,
}) {
  const iframeRef = useRef(null)
  const [srcDoc, setSrcDoc] = useState('')
  const [error, setError] = useState('')
  const dataKey = useMemo(() => JSON.stringify(pluginData || {}), [pluginData])

  useEffect(() => {
    let cancelled = false
    fetch(sandboxUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Sandbox missing')
        return res.text()
      })
      .then((html) => {
        if (!cancelled) setSrcDoc(injectBridge(html))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Sandbox unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [sandboxUrl])

  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const message = event.data || {}
      if (message.source !== 'navslides-plugin') return
      if (message.type === 'ready') {
        iframeRef.current?.contentWindow?.postMessage({
          source: 'navslides-host',
          type: 'init',
          pluginData,
          size: { width, height },
        }, '*')
      }
      if (message.type === 'update-data') onDataUpdate?.(message.patch || {})
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [dataKey, height, onDataUpdate, pluginData, width])

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({
      source: 'navslides-host',
      type: 'data-changed',
      pluginData,
      size: { width, height },
    }, '*')
  }, [dataKey, height, pluginData, width])

  if (error) {
    return <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">{error}</div>
  }
  if (!srcDoc) {
    return <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">Loading plugin...</div>
  }
  return (
    <iframe
      ref={iframeRef}
      title="Plugin sandbox"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    />
  )
}
