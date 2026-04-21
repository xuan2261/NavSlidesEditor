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

/**
 * Type-specific property panel router.
 * Renders the correct sub-panel based on element.type.
 */
function ElementTypeProperties({ element, onUpdate, onEditHtml, onEditCode, onEditLatex }) {
  switch (element.type) {
    case 'shape':
    case 'line':
      return <ShapeProperties element={element} onUpdate={onUpdate} />
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
    case 'text':
      return null // Text editing is handled by TipTap directly
    default:
      return (
        <MiscProperties
          element={element}
          onUpdate={onUpdate}
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
      <div className="properties-panel tour-step-properties">
        <div className="prop-section">
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No slide selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="properties-panel tour-step-properties">
      {/* Element Section */}
      {selectedElement && (
        <div className="prop-section">
          <h3>Element</h3>

          {/* Multi-select badge */}
          {selectedElementIds && selectedElementIds.length > 1 && (
            <div
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                📌 {selectedElementIds.length} elements selected
              </span>
              <button
                className="btn btn-danger"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={onDeleteSelectedElements}
              >
                Delete All
              </button>
            </div>
          )}

          {/* Common controls: position, lock */}
          <CommonElementControls
            element={selectedElement}
            onUpdate={onUpdateElement}
            onBringForward={onBringForward}
            onSendBackward={onSendBackward}
            onDelete={onDeleteElement}
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
                const el = (slide?.elements || []).find(e => e.id === id)
                if (el) onUpdateElement(id, { hidden: !el.hidden })
              }}
              onToggleLock={(id) => {
                const el = (slide?.elements || []).find(e => e.id === id)
                if (el) onUpdateElement(id, { locked: !el.locked })
              }}
              onRename={(id, name) => onUpdateElement(id, { name })}
              onReorder={(fromIdx, toIdx) => {
                const els = [...(slide?.elements || [])]
                const [moved] = els.splice(fromIdx, 1)
                els.splice(toIdx, 0, moved)
                const updates = els.map((el, i) => ({ id: el.id, zIndex: i }))
                if (typeof onUpdateElements === 'function') {
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
            onEditHtml={onEditHtml}
            onEditCode={onEditCode}
            onEditLatex={onEditLatex}
          />
        </div>
      )}

      {/* Presentation Settings */}
      {!selectedElement && presentation && onUpdatePresentation && (
        <CollapsibleSection title="Presentation Settings" defaultOpen={true}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Auto-slide (s)</div>
              <input
                className="prop-input" type="number" min="0" step="1"
                value={presentation.autoSlide ? presentation.autoSlide / 1000 : 0}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0
                  onUpdatePresentation({ autoSlide: val * 1000 })
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Loop</div>
              <label style={{ display: 'flex', alignItems: 'center', height: 28, gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={presentation.autoSlideLoop || false}
                  onChange={(e) => onUpdatePresentation({ autoSlideLoop: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Enable loop</span>
              </label>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Navigation Mode</div>
            <select
              className="prop-input"
              value={presentation.navigationMode || 'default'}
              onChange={(e) => onUpdatePresentation({ navigationMode: e.target.value })}
            >
              <option value="default">Default (2D)</option>
              <option value="linear">Linear (Flat)</option>
            </select>
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
      <CollapsibleSection title="Speaker Notes">
        <textarea
          className="notes-textarea"
          value={slide.notes || ''}
          onChange={(e) => onUpdateSlide({ notes: e.target.value })}
          placeholder="Add speaker notes here..."
        />
      </CollapsibleSection>

      {/* Custom CSS — template editor only */}
      {isTemplate && presentation && onUpdatePresentation && (
        <CollapsibleSection title="Custom CSS">
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            CSS applied to all slides in presentations created from this template.
          </p>
          <textarea
            value={presentation.customCSS || ''}
            onChange={(e) => onUpdatePresentation({ customCSS: e.target.value })}
            placeholder={`/* Example */\n.reveal .slides section h1 {\n  color: #6366f1;\n  text-transform: uppercase;\n}`}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 140,
              background: '#0d0d1a',
              color: '#e2e8f0',
              fontFamily: "'Fira Code','JetBrains Mono',monospace",
              fontSize: 11,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              outline: 'none',
              resize: 'vertical',
              lineHeight: 1.5,
              tabSize: 2,
              boxSizing: 'border-box',
            }}
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
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', marginBottom: 8, userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={slide.showPageNumber !== false}
            onChange={(e) => onUpdateSlide({ showPageNumber: e.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Show page number on this slide
          </span>
        </label>
      )}

      {/* Basic mode: section name */}
      {(presentation?.footerMode || 'basic') === 'basic' && (
        <input
          className="prop-input"
          type="text"
          value={slide.section || ''}
          onChange={(e) => onUpdateSlide({ section: e.target.value })}
          placeholder="Section name (shown in footer)"
          style={{ marginBottom: 10 }}
        />
      )}

      {/* Sequence mode: active section picker */}
      {presentation?.footerMode === 'sequence' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Active Section
          </div>
          {(presentation.sequenceSections || []).length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              No sections defined. Add them in Footer Style below.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <button
                style={{
                  padding: '4px 8px', fontSize: 11, textAlign: 'left', cursor: 'pointer',
                  background: slide.activeSection == null ? 'var(--accent)' : 'var(--bg-hover)',
                  border: '1px solid var(--border)', borderRadius: 4,
                  color: slide.activeSection == null ? 'white' : 'var(--text-secondary)',
                }}
                onClick={() => onUpdateSlide({ activeSection: null })}
              >
                None
              </button>
              {(presentation.sequenceSections || []).map((sec, i) => (
                <button
                  key={i}
                  style={{
                    padding: '4px 8px', fontSize: 11, textAlign: 'left', cursor: 'pointer',
                    background: slide.activeSection === i ? 'var(--accent)' : 'var(--bg-hover)',
                    border: '1px solid var(--border)', borderRadius: 4,
                    color: slide.activeSection === i ? 'white' : 'var(--text-secondary)',
                  }}
                  onClick={() => onUpdateSlide({ activeSection: i })}
                >
                  {sec || `Section ${i + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer style controls */}
      {(presentation?.showFooter || presentation?.showPageNumbers) &&
        presentation && onUpdatePresentation && (
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, marginTop: 6 }}>
        Footer Style
      </div>

      {/* Footer mode selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[['basic', 'Basic'], ['sequence', 'Sequence']].map(([mode, label]) => (
          <button
            key={mode}
            className={`bg-type-tab ${(presentation.footerMode || 'basic') === mode ? 'active' : ''}`}
            onClick={() => onUpdatePresentation({ footerMode: mode })}
            style={{ flex: 1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sequence section titles */}
      {presentation.footerMode === 'sequence' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Section Titles
          </div>
          {(presentation.sequenceSections || []).map((sec, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
              <input
                className="prop-input" type="text" value={sec}
                onChange={(e) => {
                  const sections = [...(presentation.sequenceSections || [])]
                  sections[i] = e.target.value
                  onUpdatePresentation({ sequenceSections: sections })
                }}
                placeholder={`Section ${i + 1}`}
                style={{ flex: 1, fontSize: 11, padding: '3px 6px' }}
              />
              <button
                className="btn-icon"
                style={{ width: 22, height: 22, fontSize: 12, flexShrink: 0 }}
                title="Remove section"
                onClick={() => {
                  const sections = [...(presentation.sequenceSections || [])]
                  sections.splice(i, 1)
                  onUpdatePresentation({ sequenceSections: sections })
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '3px 8px', marginTop: 2 }}
            onClick={() => {
              const sections = [...(presentation.sequenceSections || []), '']
              onUpdatePresentation({ sequenceSections: sections })
            }}
          >
            + Add Section
          </button>
        </div>
      )}

      {/* Font / Size / Active color */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 28px', gap: 6, alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Font</div>
          <select
            className="prop-input"
            style={{ padding: '3px 4px', fontSize: 11 }}
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
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Size</div>
          <input
            className="prop-input" type="number" min="8" max="32" step="1"
            value={presentation.footerFontSize || 14}
            onChange={(e) =>
              onUpdatePresentation({ footerFontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)) })
            }
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Active</div>
          <input
            type="color"
            value={presentation.footerColor || '#a8b4c8'}
            onChange={(e) => onUpdatePresentation({ footerColor: e.target.value })}
            style={{
              width: 28, height: 28, padding: 2,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 4, cursor: 'pointer',
            }}
          />
        </div>
      </div>
      {presentation.footerMode === 'sequence' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Inactive color</div>
          <input
            type="color"
            value={presentation.footerInactiveColor || '#404060'}
            onChange={(e) => onUpdatePresentation({ footerInactiveColor: e.target.value })}
            style={{
              width: 28, height: 28, padding: 2,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 4, cursor: 'pointer',
            }}
          />
        </div>
      )}
    </>
  )
}
