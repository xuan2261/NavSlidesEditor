import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ResponsiveEditorWorkspaceContext = createContext(null)

export function deriveResponsiveWorkspace(width, preferences, activeOverlay = null) {
  const tier = width >= 1280 ? 'wide' : width >= 1024 ? 'standard' : 'compact'
  const navigatorRequested = !!preferences.leftPanelOpen
  const inspectorTab = preferences.showDesignIdeas ? 'ideas' : 'properties'
  const inspectorRequested = !!preferences.rightPanelOpen || !!preferences.showDesignIdeas

  return {
    tier,
    navigatorDocked: navigatorRequested && tier !== 'compact',
    inspectorDocked: inspectorRequested && tier === 'wide',
    inspectorTab,
    activeOverlay: tier === 'wide' ? null : activeOverlay,
  }
}

export function ResponsiveEditorWorkspaceProvider({ width, preferences, children }) {
  const containerRef = useRef(null)
  const [measuredWidth, setMeasuredWidth] = useState(width ?? 1280)
  const [activeOverlay, setActiveOverlay] = useState(null)

  const observeContainer = useCallback(
    (node) => {
      containerRef.current?.disconnect()
      if (!node || typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver(([entry]) => setMeasuredWidth(entry.contentRect.width))
      observer.observe(node)
      containerRef.current = observer
    },
    []
  )

  const workspace = useMemo(
    () => ({
      ...deriveResponsiveWorkspace(width ?? measuredWidth, preferences, activeOverlay),
      observeContainer,
      openNavigator: () => setActiveOverlay('navigator'),
      openInspector: () => setActiveOverlay('inspector'),
      closeOverlay: () => setActiveOverlay(null),
    }),
    [activeOverlay, measuredWidth, observeContainer, preferences, width]
  )

  return (
    <ResponsiveEditorWorkspaceContext.Provider value={workspace}>
      {children}
    </ResponsiveEditorWorkspaceContext.Provider>
  )
}

export function useResponsiveEditorWorkspace() {
  const workspace = useContext(ResponsiveEditorWorkspaceContext)
  if (!workspace) throw new Error('Responsive editor workspace provider is missing')
  return workspace
}
