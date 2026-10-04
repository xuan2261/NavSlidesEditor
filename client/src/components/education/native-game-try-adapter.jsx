import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeGameConfig, createInteractionVariableStore } from 'revealjs-shared'
import { mount, getRootLifecycle } from 'revealjs-shared/src/education/browser/mount.js'
import { serializeEducationConfig } from 'revealjs-shared/src/education/config-serialization.js'
import 'revealjs-shared/src/education/browser/runtime.css'

export default function NativeGameTryAdapter({ element, effectiveSlideId, variables = [] }) {
  const root = useRef(null)
  const [error, setError] = useState('')
  const config = useMemo(() => normalizeGameConfig(element), [element])
  const variableSignature = JSON.stringify(variables)
  useEffect(() => {
    const target = root.current,
      document = target.ownerDocument
    let instance, store
    setError('')
    const reconcileVisibility = () => {
      const lifecycle = getRootLifecycle(target)
      if (document.hidden) lifecycle?.pause()
      else lifecycle?.resume()
    }
    try {
      store = createInteractionVariableStore(JSON.parse(variableSignature))
      instance = mount(target, { mode: 'local', variables: store })
      document.addEventListener('visibilitychange', reconcileVisibility)
      reconcileVisibility()
    } catch (failure) {
      setError(failure.message)
    }
    return () => {
      document.removeEventListener('visibilitychange', reconcileVisibility)
      instance?.destroy()
      store?.destroy()
    }
  }, [config, effectiveSlideId, variableSignature])
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      <div
        ref={root}
        data-ns-game="true"
        data-ns-game-type={element.gameType}
        data-ns-element-id={element.id}
        data-ns-effective-slide-id={effectiveSlideId}
        data-ns-education-view="local"
        style={{
          width: '100%',
          height: 'min(60vh, 480px)',
          color: '#fff',
          backgroundColor: element.backgroundColor || '#1a1a2e',
          borderRadius: 8,
          fontFamily: element.fontFamily,
        }}
      >
        <script type="application/json" data-ns-game-config>
          {serializeEducationConfig(config)}
        </script>
        <div data-ns-game-ui />
      </div>
    </div>
  )
}
