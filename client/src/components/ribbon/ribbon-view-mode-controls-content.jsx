import { Code2, Film, LayoutGrid, Lightbulb, PanelLeft, PanelRight, Search, StickyNote } from 'lucide-react'
import RibbonSection from './ribbon-section'
import RibbonTabContentRow from './ribbon-tab-content-row'
import { Button } from '../ui'
import CanvasControls from './controls/canvas-controls'
import { useUIStore } from '../../stores/ui-store'
import { useEditorStore } from '../../stores/editor-store'

function keyboardActivate(handler) {
  return (event) => {
    if (event.repeat) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handler?.()
  }
}

export default function ViewTabContent({
  viewMode,
  onTimeline,
  onCssEditor,
  onFindReplace,
  onSpeakerNotes,
  onToggleSlideSorter,
  onUpdatePresentation,
}) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const showDesignIdeas = useUIStore((s) => s.showDesignIdeas)
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)
  const toggleDesignIdeas = useUIStore((s) => s.toggleDesignIdeas)
  const setShowTimeline = useEditorStore((s) => s.setShowTimeline)

  return (
    <RibbonTabContentRow>
      <RibbonSection label="Show" className="border-r border-border">
        <CanvasControls onGridSizeChange={(gridSize) => onUpdatePresentation?.({ gridSize })} />
      </RibbonSection>

      <RibbonSection label="Tools" className="border-r border-border">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ribbon"
            className="h-7"
            title="Find & Replace"
            aria-label="Find & Replace"
            onClick={onFindReplace}
          >
            <Search size={14} />
            <span className="text-[11px] hidden lg:inline">Find</span>
          </Button>
          <Button
            variant="ribbon"
            className="h-7"
            title="Animation Timeline"
            aria-label="Animation Timeline"
            onClick={() => {
              setShowTimeline(true)
              onTimeline?.()
            }}
          >
            <Film size={14} />
            <span className="text-[11px] hidden lg:inline">Timeline</span>
          </Button>
          <Button
            variant="ribbon"
            className="h-7"
            title="Custom CSS"
            aria-label="Custom CSS"
            onClick={onCssEditor}
          >
            <Code2 size={14} />
            <span className="text-[11px] hidden lg:inline">CSS</span>
          </Button>
          <Button
            variant="ribbon"
            className="h-7"
            title="Speaker Notes"
            aria-label="Speaker Notes"
            onClick={onSpeakerNotes}
          >
            <StickyNote size={14} />
            <span className="text-[11px] hidden lg:inline">Notes</span>
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Window">
        <div className="flex items-center gap-0.5">
          <Button variant="ribbon"
            className={`h-7 ${leftPanelOpen ? 'bg-primary-light text-accent' : ''}`}
            title="Toggle slide panel" aria-label="Toggle slide panel" aria-pressed={leftPanelOpen}
            onMouseDown={(e) => { e.preventDefault(); toggleLeftPanel() }}
            onKeyDown={keyboardActivate(toggleLeftPanel)}>
            <PanelLeft size={14} />
            <span className="text-[11px] hidden lg:inline">Slides</span>
          </Button>
          <Button variant="ribbon"
            data-testid="view-toggle-selection-pane"
            className={`h-7 ${rightPanelOpen ? 'bg-primary-light text-accent' : ''}`}
            title="Toggle properties panel" aria-label="Toggle properties panel" aria-pressed={rightPanelOpen}
            onMouseDown={(e) => { e.preventDefault(); toggleRightPanel() }}
            onKeyDown={keyboardActivate(toggleRightPanel)}>
            <PanelRight size={14} />
            <span className="text-[11px] hidden lg:inline">Properties</span>
          </Button>
          <Button variant="ribbon"
            className={`h-7 ${viewMode === 'sorter' ? 'bg-primary-light text-accent' : ''}`}
            title="Slide Sorter" aria-label="Slide Sorter" aria-pressed={viewMode === 'sorter'}
            onMouseDown={(e) => { e.preventDefault(); onToggleSlideSorter?.() }}
            onKeyDown={keyboardActivate(onToggleSlideSorter)}>
            <LayoutGrid size={14} />
            <span className="text-[11px] hidden lg:inline">Sorter</span>
          </Button>
          <Button variant="ribbon"
            className={`h-7 ${showDesignIdeas ? 'bg-primary-light text-accent' : ''}`}
            title="Design Ideas" aria-label="Toggle design ideas panel" aria-pressed={showDesignIdeas}
            onMouseDown={(e) => { e.preventDefault(); toggleDesignIdeas() }}
            onKeyDown={keyboardActivate(toggleDesignIdeas)}>
            <Lightbulb size={14} />
            <span className="text-[11px] hidden lg:inline">Ideas</span>
          </Button>
        </div>
      </RibbonSection>
    </RibbonTabContentRow>
  )
}
