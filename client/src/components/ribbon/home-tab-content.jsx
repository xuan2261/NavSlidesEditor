import RibbonSection from './ribbon-section'
import ClipboardButtons from './controls/clipboard-buttons'
import FontControls from './controls/ribbon-text-formatting-controls'
import ParagraphCompactControls from './controls/paragraph-compact-dropdown-controls'
import CanvasControls from './controls/canvas-controls'
import ArrangeControls from './controls/arrange-controls'
import { useSelectionPreservation } from '../../hooks/use-selection-preservation'

export default function HomeTabContent({
  editor,
  onPaste,
  onCut,
  onCopy,
  onDuplicate,
  selectedCount,
  onGroup,
  onUngroup,
  onAlignElements,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onUpdatePresentation,
}) {
  const { rememberSelection, runTextCommand, handleTextCommandMouseDown } = useSelectionPreservation(editor)

  return (
    <div className="flex items-stretch gap-0 h-full overflow-x-auto">
      <RibbonSection label="Clipboard" className="border-r border-border">
        <ClipboardButtons
          onPaste={onPaste}
          onCut={onCut}
          onCopy={onCopy}
          onDuplicate={onDuplicate}
        />
      </RibbonSection>

      {editor && (
        <RibbonSection label="Font" className="border-r border-border">
          <FontControls
            editor={editor}
            rememberSelection={rememberSelection}
            runTextCommand={runTextCommand}
            handleTextCommandMouseDown={handleTextCommandMouseDown}
          />
        </RibbonSection>
      )}

      {!editor && (
        <RibbonSection label="Text" className="border-r border-border">
          <span className="text-[11px] text-text-muted whitespace-nowrap">
            Double-click a text box to edit
          </span>
        </RibbonSection>
      )}

      {editor && (
        <RibbonSection label="Paragraph" className="border-r border-border">
          <ParagraphCompactControls
            editor={editor}
            rememberSelection={rememberSelection}
            runTextCommand={runTextCommand}
            handleTextCommandMouseDown={handleTextCommandMouseDown}
          />
        </RibbonSection>
      )}

      <RibbonSection label="Canvas" className="border-r border-border">
        <CanvasControls onGridSizeChange={(gridSize) => onUpdatePresentation?.({ gridSize })} />
      </RibbonSection>

      <RibbonSection label="Arrange" className="border-r border-border">
        <ArrangeControls
          selectedCount={selectedCount}
          onGroup={onGroup}
          onUngroup={onUngroup}
          onAlignElements={onAlignElements}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
        />
      </RibbonSection>
    </div>
  )
}
