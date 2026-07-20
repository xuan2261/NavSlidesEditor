import PropertiesPanel from '../PropertiesPanel'
import DesignIdeasPanel from '../design-ideas-panel'
import { SLIDE_TEMPLATES } from '../../data/slide-templates'
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
          className="flex-1 rounded px-2 py-1 text-xs"
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
          className="flex-1 rounded px-2 py-1 text-xs"
          onClick={() => c.setShowDesignIdeas(true)}
        >
          Design Ideas
        </button>
      </div>
      {!c.showDesignIdeas && (
        <PropertiesPanel
          slide={c.activeSlide}
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
          onApplyLayout={(templateId) => {
            const template = SLIDE_TEMPLATES[templateId]
            if (!template) return
            const slots = (template.elements || []).filter((e) => e.type === 'text')
            c.setPresentation((prev) =>
              c.mapActive(prev, (s) => {
                let slotIdx = 0
                return {
                  ...s,
                  elements: (s.elements || []).map((el) => {
                    if (el.type !== 'text' || slotIdx >= slots.length) return el
                    const slot = slots[slotIdx++]
                    return {
                      ...el,
                      x: slot.x,
                      y: slot.y,
                      width: slot.width,
                      height: slot.height,
                      zIndex: slot.zIndex ?? el.zIndex,
                    }
                  }),
                }
              })
            )
          }}
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
