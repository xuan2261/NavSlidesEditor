import EditorNavigator from './editor-navigator'
import EditorCanvasWorkspace from './editor-canvas-workspace'
import EditorInspector from './editor-inspector'
import EditorRibbon from './editor-ribbon'

export default function EditorWorkspace({
  workspaceRef,
  workspaceTier,
  leftPanelOpen,
  inspectorRequested,
  navigatorDocked,
  inspectorDocked,
  compactOverlay,
  setActiveWorkspaceOverlay,
  c,
}) {
  return (
    <div
      ref={workspaceRef}
      data-workspace-tier={workspaceTier}
      onKeyDown={(event) => {
        if (!compactOverlay || event.key !== 'Escape') return
        setActiveWorkspaceOverlay(null)
        event.preventDefault()
        event.stopPropagation()
      }}
      className="relative flex flex-1 min-h-0 flex-col overflow-hidden"
    >
      <EditorRibbon c={c} />
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {workspaceTier !== 'wide' && (
          <div className="absolute inset-x-2 top-2 z-30 flex justify-between pointer-events-none">
            {leftPanelOpen && (
              <button
                type="button"
                aria-label="Open slide navigator"
                className="pointer-events-auto rounded bg-panel px-2 py-1 text-xs shadow"
                onClick={() => setActiveWorkspaceOverlay('navigator')}
              >
                Slides
              </button>
            )}
            {inspectorRequested && (
              <button
                type="button"
                aria-label="Open inspector"
                className="pointer-events-auto ml-auto rounded bg-panel px-2 py-1 text-xs shadow"
                onClick={() => setActiveWorkspaceOverlay('inspector')}
              >
                Inspector
              </button>
            )}
          </div>
        )}
        {compactOverlay && (
          <button
            type="button"
            aria-label="Close workspace overlay"
            className="absolute inset-0 z-20 cursor-default bg-black/20"
            onClick={() => setActiveWorkspaceOverlay(null)}
          />
        )}
        <EditorNavigator
          visible={navigatorDocked || compactOverlay === 'navigator'}
          overlay={compactOverlay === 'navigator'}
          onCloseOverlay={() => setActiveWorkspaceOverlay(null)}
          c={c}
        />
        <EditorCanvasWorkspace overlayOpen={Boolean(compactOverlay)} c={c} />
        <EditorInspector
          visible={inspectorDocked || compactOverlay === 'inspector'}
          overlay={compactOverlay === 'inspector'}
          onCloseOverlay={() => setActiveWorkspaceOverlay(null)}
          c={c}
        />
      </div>
    </div>
  )
}
