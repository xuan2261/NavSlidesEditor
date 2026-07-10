import CollapsibleSection from './CollapsibleSection'
import SelectionPane from './SelectionPane'
import CommonElementControls from './properties/common-element-controls'
import ShapeProperties from './properties/shape-properties'
import ImageProperties from './properties/image-properties'
import ChartProperties from './properties/chart-properties'
import CodeProperties from './properties/code-properties'
import MediaProperties from './properties/media-properties'
import TableProperties from './properties/table-properties'
import MiscProperties from './properties/misc-properties'
import TimelineProperties from './properties/timeline-properties'
import { Button, Input, Select, ColorPicker } from '../components/ui'
import { MousePointer2 } from 'lucide-react'

/**
 * Type-specific property panel router.
 * Renders the correct sub-panel based on element.type.
 */
function ElementTypeProperties({ element, onUpdate, onDelete, onEditHtml, onEditCode, onEditLatex, elements, selectedElementIds }) {
  switch (element.type) {
    case 'shape':
    case 'line':
      return <ShapeProperties element={element} onUpdate={onUpdate} elements={elements} selectedElementIds={selectedElementIds} />
    case 'image':
      return <ImageProperties element={element} onUpdate={onUpdate} />
    case 'chart':
      return <ChartProperties element={element} onUpdate={onUpdate} />
    case 'code':
      return <CodeProperties element={element} onUpdate={onUpdate} onEditCode={onEditCode} />
    case 'video':
    case 'audio':
      return <MediaProperties element={element} onUpdate={onUpdate} />
    case 'table':
      return <TableProperties element={element} onUpdate={onUpdate} />
    case 'timeline':
      return <TimelineProperties element={element} onUpdate={onUpdate} />
    case 'text':
      return (
        <CollapsibleSection title="Text Formatting" defaultOpen={true}>
          <div className="rounded-md border border-border bg-card p-3 text-[11px] leading-5 text-text-secondary">
            <p className="m-0">
              Use direct text editing on the slide or the Home and Format ribbon controls to
              change font, size, color, alignment, lists, and spacing.
            </p>
          </div>
        </CollapsibleSection>
      )
    default:
      return (
        <MiscProperties
          element={element}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onEditHtml={onEditHtml}
          onEditLatex={onEditLatex}
        />
      )
  }
}

export default function PropertiesPanel({
  slide,
  selectedElement,
  onUpdateSlide,
  onUpdateElement,
  onUpdateElements,
  onReorderElements,
  onDeleteElement,
  onBringForward,
  onSendBackward,
  onEditHtml,
  onEditCode,
  onEditLatex,
  presentation,
  onUpdatePresentation,
  selectedElementIds,
  onDeleteSelectedElements,
  onSelectElement,
  isTemplate = false,
}) {
  if (!slide) {
    return (
      <div
        className="properties-panel w-60 shrink-0 bg-panel text-text-primary border-l border-border overflow-y-auto flex flex-col tour-step-properties"
        role="complementary"
        aria-label="Properties panel"
      >
        <div className="prop-section">
          <p className="text-text-muted text-xs">No slide selected</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="properties-panel w-60 shrink-0 bg-panel text-text-primary border-l border-border overflow-y-auto flex flex-col tour-step-properties"
      role="complementary"
      aria-label="Properties panel"
    >
      {/* Element Section */}
      {selectedElement && (
        <div className="p-4 border-b border-border">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em] mb-3">
            Element
          </h3>

          {/* Multi-select badge */}
          {selectedElementIds && selectedElementIds.length > 1 && (
            <div className="bg-hover border border-border rounded-md px-2.5 py-2 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <MousePointer2 size={13} />
                {selectedElementIds.length} elements selected
              </span>
              <Button
                variant="danger"
                className="text-[11px] px-2 py-0.5"
                onClick={onDeleteSelectedElements}
              >
                Delete All
              </Button>
            </div>
          )}

          {/* Common controls: position, lock */}
          <CommonElementControls
            element={selectedElement}
            onUpdate={onUpdateElement}
            onBringForward={onBringForward}
            onSendBackward={onSendBackward}
            onDelete={onDeleteElement}
            elements={slide?.elements || []}
            selectedElementIds={selectedElementIds || []}
          />

          {/* Selection Pane (layer list) */}
          <CollapsibleSection title="Selection Pane" defaultOpen={false}>
            <SelectionPane
              elements={slide?.elements || []}
              selectedIds={selectedElementIds || []}
              onSelect={(id, additive) => {
                if (typeof onSelectElement === 'function') onSelectElement(id, additive)
              }}
              onToggleVisibility={(id) => {
                const el = (slide?.elements || []).find((e) => e.id === id)
                if (el) onUpdateElement(id, { hidden: !el.hidden })
              }}
              onToggleLock={(id) => {
                const el = (slide?.elements || []).find((e) => e.id === id)
                if (el) onUpdateElement(id, { locked: !el.locked })
              }}
              onRename={(id, name) => onUpdateElement(id, { name })}
              onReorder={(fromIdx, toIdx) => {
                const els = [...(slide?.elements || [])]
                const [moved] = els.splice(fromIdx, 1)
                els.splice(toIdx, 0, moved)
                const updates = els.map((el, i) => ({ id: el.id, zIndex: i }))
                if (typeof onReorderElements === 'function') {
                  onReorderElements(updates)
                } else if (typeof onUpdateElements === 'function') {
                  onUpdateElements(updates)
                } else {
                  updates.forEach(({ id, zIndex }) => onUpdateElement(id, { zIndex }))
                }
              }}
            />
          </CollapsibleSection>

          {/* Type-specific properties */}
          <ElementTypeProperties
            element={selectedElement}
            onUpdate={onUpdateElement}
            onDelete={onDeleteElement}
            onEditHtml={onEditHtml}
            onEditCode={onEditCode}
            onEditLatex={onEditLatex}
            elements={slide?.elements || []}
            selectedElementIds={selectedElementIds || []}
          />
        </div>
      )}

      {/* Presentation Settings */}
      {!selectedElement && presentation && onUpdatePresentation && (
        <CollapsibleSection title="Presentation Settings" defaultOpen={true}>
          <div className="flex flex-col gap-2.5">
            <div>
              <div className="text-[10px] text-text-muted mb-0.5">Auto-slide (s)</div>
              <Input
                className="w-full px-2.5 py-1.5 text-xs"
                type="number"
                min="0"
                step="1"
                value={presentation.autoSlide ? presentation.autoSlide / 1000 : 0}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0
                  onUpdatePresentation({ autoSlide: val * 1000 })
                }}
              />
            </div>
            <div>
              <label className="flex items-center h-7 gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={presentation.autoSlideLoop || false}
                  onChange={(e) => onUpdatePresentation({ autoSlideLoop: e.target.checked })}
                  className="accent-accent shrink-0"
                />
                <span className="text-[11px] text-text-secondary">Enable loop (auto-slide)</span>
              </label>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-[10px] text-text-muted mb-0.5">Navigation Mode</div>
            <Select
              className="w-full px-2.5 py-1.5 text-xs"
              value={presentation.navigationMode || 'default'}
              onChange={(e) => onUpdatePresentation({ navigationMode: e.target.value })}
            >
              <option value="default">Default (2D)</option>
              <option value="linear">Linear (Flat)</option>
            </Select>
          </div>
        </CollapsibleSection>
      )}

      {/* Slide Footer */}
      <SlideFooterSection
        slide={slide}
        presentation={presentation}
        onUpdateSlide={onUpdateSlide}
        onUpdatePresentation={onUpdatePresentation}
      />

      {/* Speaker Notes */}
      <div className="mt-6 border-t border-border pt-2">
        <CollapsibleSection title="Speaker Notes">
          <textarea
            className="w-full bg-card border border-border text-text-primary px-2.5 py-2 rounded-sm text-xs resize-y min-h-[80px] focus:outline-none focus:border-accent placeholder:text-text-muted"
            value={slide.notes || ''}
            onChange={(e) => onUpdateSlide({ notes: e.target.value })}
            placeholder="Add speaker notes here..."
          />
        </CollapsibleSection>
      </div>

      {/* Custom CSS — template editor only */}
      {isTemplate && presentation && onUpdatePresentation && (
        <CollapsibleSection title="Custom CSS">
          <p className="text-[11px] text-text-muted mb-1.5">
            CSS applied to all slides in presentations created from this template.
          </p>
          <textarea
            value={presentation.customCSS || ''}
            onChange={(e) => onUpdatePresentation({ customCSS: e.target.value })}
            placeholder={`/* Example */\n.reveal .slides section h1 {\n  color: #6366f1;\n  text-transform: uppercase;\n}`}
            spellCheck={false}
            className="css-editor-textarea w-full min-h-[140px] rounded border font-mono resize-y outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault()
                const { selectionStart: s, selectionEnd: end, value } = e.target
                const next = value.substring(0, s) + '  ' + value.substring(end)
                e.target.value = next
                onUpdatePresentation({ customCSS: next })
                requestAnimationFrame(() => {
                  e.target.selectionStart = e.target.selectionEnd = s + 2
                })
              }
            }}
          />
        </CollapsibleSection>
      )}
    </div>
  )
}

/**
 * Slide footer configuration section (basic/sequence mode).
 */
function SlideFooterSection({ slide, presentation, onUpdateSlide, onUpdatePresentation }) {
  return (
    <CollapsibleSection title="Slide Footer">
      {/* Per-slide page number toggle */}
      {presentation?.showPageNumbers && (
        <label className="flex items-center gap-2 cursor-pointer mb-2 select-none">
          <input
            type="checkbox"
            checked={slide.showPageNumber !== false}
            onChange={(e) => onUpdateSlide({ showPageNumber: e.target.checked })}
            className="accent-accent"
          />
          <span className="text-xs text-text-secondary">Show page number on this slide</span>
        </label>
      )}

      {/* Basic mode: section name */}
      {(presentation?.footerMode || 'basic') === 'basic' && (
        <div className="w-full mb-2.5 flex flex-col">
          <Input
            className="w-full flex-1 px-2.5 py-1.5 text-xs"
            type="text"
            value={slide.section || ''}
            onChange={(e) => onUpdateSlide({ section: e.target.value })}
            placeholder="Section name (footer)"
          />
        </div>
      )}

      {/* Sequence mode: active section picker */}
      {presentation?.footerMode === 'sequence' && (
        <div className="mb-2.5">
          <div className="text-[11px] text-text-muted mb-1">Active Section</div>
          {(presentation.sequenceSections || []).length === 0 ? (
            <p className="text-[11px] text-text-muted">
              No sections defined. Add them in Footer Style below.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className={`py-1 px-2 text-[11px] text-left cursor-pointer border rounded text-text-secondary ${slide.activeSection == null ? 'bg-accent text-white border-accent' : 'bg-hover border-border'}`}
                onClick={() => onUpdateSlide({ activeSection: null })}
              >
                None
              </Button>
              {(presentation.sequenceSections || []).map((sec, i) => (
                <Button
                  variant="ghost"
                  key={i}
                  className={`py-1 px-2 text-[11px] text-left cursor-pointer border rounded text-text-secondary ${slide.activeSection === i ? 'bg-accent text-white border-accent' : 'bg-hover border-border'}`}
                  onClick={() => onUpdateSlide({ activeSection: i })}
                >
                  {sec || `Section ${i + 1}`}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer style controls */}
      {(presentation?.showFooter || presentation?.showPageNumbers) &&
        presentation &&
        onUpdatePresentation && (
          <FooterStyleControls
            presentation={presentation}
            onUpdatePresentation={onUpdatePresentation}
          />
        )}
    </CollapsibleSection>
  )
}

/**
 * Footer style controls: mode selector, font, size, colors, sequence sections.
 */
function FooterStyleControls({ presentation, onUpdatePresentation }) {
  return (
    <>
      <div className="text-[11px] text-text-muted mb-1 mt-1.5">Footer Style</div>

      {/* Footer mode selector */}
      <div className="flex gap-1 mb-2">
        {[
          ['basic', 'Basic'],
          ['sequence', 'Sequence'],
        ].map(([mode, label]) => (
          <Button
            variant="ghost"
            key={mode}
            className={`flex-1 py-1 px-1 rounded text-[11px] text-center cursor-pointer border-none transition-all ${(presentation.footerMode || 'basic') === mode ? 'bg-accent text-white' : 'text-text-muted bg-transparent'}`}
            onClick={() => onUpdatePresentation({ footerMode: mode })}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Sequence section titles */}
      {presentation.footerMode === 'sequence' && (
        <div className="mb-2">
          <div className="text-[10px] text-text-muted mb-1">Section Titles</div>
          {(presentation.sequenceSections || []).map((sec, i) => (
            <div key={i} className="flex gap-1 mb-0.5">
              <Input
                type="text"
                value={sec}
                onChange={(e) => {
                  const sections = [...(presentation.sequenceSections || [])]
                  sections[i] = e.target.value
                  onUpdatePresentation({ sequenceSections: sections })
                }}
                placeholder={`Section ${i + 1}`}
                className="px-2.5 py-1.5 text-xs flex-1"
              />
              <Button
                variant="icon"
                className="w-[22px] h-[22px] text-xs shrink-0"
                title="Remove section"
                onClick={() => {
                  const sections = [...(presentation.sequenceSections || [])]
                  sections.splice(i, 1)
                  onUpdatePresentation({ sequenceSections: sections })
                }}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            className="w-full justify-center text-[11px] px-2 py-0.5 mt-0.5"
            onClick={() => {
              const sections = [...(presentation.sequenceSections || []), '']
              onUpdatePresentation({ sequenceSections: sections })
            }}
          >
            + Add Section
          </Button>
        </div>
      )}

      {/* Font / Size / Active color */}
      <div className="grid grid-cols-[1fr_48px_28px] gap-1.5 items-end">
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-text-muted">Font</div>
          <Select
            className="px-1 py-0.5 text-[11px]"
            value={presentation.footerFontFamily || '-apple-system,sans-serif'}
            onChange={(e) => onUpdatePresentation({ footerFontFamily: e.target.value })}
          >
            <optgroup label="Sans-serif">
              <option value="-apple-system,sans-serif">System</option>
              <option value="Inter,sans-serif">Inter</option>
              <option value="Roboto,sans-serif">Roboto</option>
              <option value="'Open Sans',sans-serif">Open Sans</option>
              <option value="'Source Sans Pro',sans-serif">Source Sans Pro</option>
            </optgroup>
            <optgroup label="Serif">
              <option value="'Playfair Display',serif">Playfair Display</option>
              <option value="Merriweather,serif">Merriweather</option>
              <option value="'Computer Modern Serif',serif">Computer Modern</option>
              <option value="'Computer Modern Sans',sans-serif">Computer Modern Sans</option>
              <option value="'Latin Modern Roman',serif">Latin Modern Roman</option>
            </optgroup>
            <optgroup label="Monospace">
              <option value="'Fira Code',monospace">Fira Code</option>
              <option value="'JetBrains Mono',monospace">JetBrains Mono</option>
            </optgroup>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-text-muted">Size</div>
          <Input
            type="number"
            min="8"
            max="32"
            step="1"
            className="px-2.5 py-1.5 text-xs w-full"
            value={presentation.footerFontSize || 14}
            onChange={(e) =>
              onUpdatePresentation({
                footerFontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)),
              })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-text-muted">Active</div>
          <ColorPicker
            value={presentation.footerColor || '#a8b4c8'}
            onChange={(e) => onUpdatePresentation({ footerColor: e.target.value })}
            className="w-7 h-7 p-[2px] bg-card border border-border rounded cursor-pointer"
          />
        </div>
      </div>
      {presentation.footerMode === 'sequence' && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="text-[10px] text-text-muted">Inactive color</div>
          <ColorPicker
            value={presentation.footerInactiveColor || '#404060'}
            onChange={(e) => onUpdatePresentation({ footerInactiveColor: e.target.value })}
            className="w-7 h-7 p-[2px] bg-card border border-border rounded cursor-pointer"
          />
        </div>
      )}
    </>
  )
}
