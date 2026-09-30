import PropertiesPanel from '../PropertiesPanel'
import DesignIdeasPanel from '../design-ideas-panel'
import { getThemePreset } from 'revealjs-shared'

export default function EditorInspector({
  visible,
  overlay,
  onCloseOverlay,
  c,
}) {
  if (!visible) return null

  return (
    <div
      role={overlay ? 'dialog' : undefined}
      aria-label="Inspector"
      onKeyDown={(event) => {
        if (!overlay || event.key !== 'Escape') return
        onCloseOverlay()
        event.stopPropagation()
      }}
      className={
        overlay
          ? 'absolute inset-y-0 right-0 z-40 flex w-60 min-h-0 flex-col bg-panel shadow-xl'
          : 'flex h-full w-60 min-h-0 shrink-0 flex-col bg-panel'
      }
    >
      <div className="flex shrink-0 border-b border-border p-1" role="group" aria-label="Inspector view">
        <button
          type="button"
          aria-pressed={!c.showDesignIdeas}
          className="ui-coarse-target flex-1 rounded px-2 py-1 text-xs"
          onClick={() => {
            c.setRightPanelOpen(true)
            c.setShowDesignIdeas(false)
          }}
        >
          Properties
        </button>
        <button
          type="button"
          aria-pressed={c.showDesignIdeas}
          className="ui-coarse-target flex-1 rounded px-2 py-1 text-xs"
          onClick={() => c.setShowDesignIdeas(true)}
        >
          Design Ideas
        </button>
      </div>
      {!c.showDesignIdeas && (
        <PropertiesPanel
          slide={c.masterEdit ? { id: `master:${c.masterEdit.id}`, elements: c.masterEdit.fixedElements } : c.activeSlide}
          focusRequest={c.inspectorFocus}
          isMaster={Boolean(c.masterEdit)}
          selectedElement={c.selectedElement}
          onUpdateSlide={c.updateCurrentSlide}
          onUpdateElement={(idOrUpdates, maybeUpdates) =>
            maybeUpdates
              ? c.updateElement(idOrUpdates, maybeUpdates)
              : c.updateSelectedElements(idOrUpdates)
          }
          onDeleteElement={() => c.selectedElementId && c.deleteElement(c.selectedElementId)}
          onBringForward={() => c.stepSelectedZOrder('forward')}
          onSendBackward={() => c.stepSelectedZOrder('backward')}
          onEditHtml={() => c.selectedElementId && c.openHtmlEditor(c.selectedElementId)}
          onEditCode={() => c.selectedElementId && c.openCodeEditor(c.selectedElementId)}
          onEditLatex={() => c.selectedElementId && c.openLatexEditor(c.selectedElementId)}
          presentation={c.presentation}
          onUpdatePresentation={(updates) =>
            c.setPresentation((prev) =>
              typeof updates === 'function' ? updates(prev) : { ...prev, ...updates }
            )
          }
          selectedElementIds={c.selectedElementIds}
          onSelectElement={c.toggleElementSelection}
          onUpdateElements={c.updateElements}
          onReorderElements={c.replaceElementZOrder}
          onDeleteSelectedElements={c.deleteSelectedElements}
          isTemplate={c.isTemplate}
        />
      )}
      {c.showDesignIdeas && (
        <DesignIdeasPanel
          slide={c.activeSlide}
          presentation={c.presentation}
          onApplyLayout={(templateId) => c.updateActiveLayout?.(templateId, 'change')}
          onApplyTheme={({ presetId, tokens }) => {
            const preset = presetId ? getThemePreset(presetId) : null
            c.setPresentation((prev) => ({
              ...prev,
              designTokens: preset ? preset.tokens : tokens || prev.designTokens,
              theme: preset ? preset.revealTheme : prev.theme,
            }))
          }}
        />
      )}
    </div>
  )
}
