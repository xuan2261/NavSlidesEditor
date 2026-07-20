import * as Tabs from '@radix-ui/react-tabs'
import { useUIStore } from '../../stores/ui-store'
import HomeTabContent from './home-tab-content'
import InsertTabContent from './ribbon-insert-tab-element-galleries-panel'
import DesignTabContent from './design-tab-content'
import FormatTabContent from './ribbon-format-tab-element-position-size-rotation-controls'
import TransitionsTabContent from './transitions-tab-content'
import AnimationsTabContent from './ribbon-element-animation-effect-controls-tab-content'
import ViewTabContent from './ribbon-view-mode-controls-content'
import { RibbonDensityProvider } from './ribbon-density-context'

const TAB_PANELS = {
  home: HomeTabContent,
  insert: InsertTabContent,
  design: DesignTabContent,
  format: FormatTabContent,
  transitions: TransitionsTabContent,
  animations: AnimationsTabContent,
  view: ViewTabContent,
}

export default function RibbonPanel(props) {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const formatContext = useUIStore((s) => s.formatContext)

  // Guard against radix showing the Format panel for a persisted activeTab
  // ('format' from localStorage) before a selection exists. Tabs.Root renders
  // whichever Content matches `value` regardless of a matching trigger, so we
  // must coerce the value synchronously rather than rely on an async effect.
  const effectiveTab =
    activeTab === 'format' && !formatContext.hasSelection ? 'home' : activeTab

  return (
    <Tabs.Root value={effectiveTab} onValueChange={setActiveTab}>
      <RibbonDensityProvider
          data-testid="ribbon-panel-container"
          className="tour-step-ribbon relative h-[80px] overflow-hidden bg-panel border-b border-border"
      >
        {Object.entries(TAB_PANELS).map(([id, Content]) => (
          <Tabs.Content
            key={id}
            value={id}
            id={`ribbon-panel-${id}`}
            data-testid={`ribbon-tab-${id}-content`}
            aria-labelledby={`ribbon-tab-${id}`}
            className="absolute inset-0 hidden h-full w-full min-w-0 items-center outline-none data-[state=active]:flex"
          >
            <Content {...props} slideElements={props.slide?.elements || []} />
          </Tabs.Content>
        ))}
      </RibbonDensityProvider>
    </Tabs.Root>
  )
}
