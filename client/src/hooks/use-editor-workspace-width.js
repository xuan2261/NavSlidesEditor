import { useCallback, useRef, useState } from 'react'

// Observe the host's lifetime, not the loading state of its React owner.
export function useEditorWorkspaceWidth() {
  const [workspaceWidth, setWorkspaceWidth] = useState(1440)
  const observation = useRef(null)
  const workspaceRef = useCallback((node) => {
    const previous = observation.current
    // Invalidate before disconnect: queued deliveries may outlive the old host.
    observation.current = null
    previous?.observer.disconnect()
    if (!node || typeof ResizeObserver === 'undefined') return

    const current = { node, observer: null }
    const observer = new ResizeObserver((entries) => {
      if (observation.current !== current) return
      const entry = entries.find((entry) => entry.target === current.node)
      if (entry) setWorkspaceWidth(entry.contentRect.width)
    })
    current.observer = observer
    observation.current = current
    observer.observe(node)
  }, [])

  return { workspaceRef, workspaceWidth }
}
