import * as Tabs from '@radix-ui/react-tabs'
import { useUIStore } from '../../stores/ui-store'
import HomeTabContent from './home-tab-content'
import InsertTabContent from './ribbon-insert-tab-element-galleries-panel'
import DesignTabContent from './design-tab-content'
import FormatTabContent from './ribbon-format-tab-element-position-size-rotation-controls'
import TransitionsTabContent from './transitions-tab-content'
import AnimationsTabContent from './ribbon-element-animation-effect-controls-tab-content'
import ViewTabContent from './ribbon-view-mode-controls-content'

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

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
      <div className="tour-step-ribbon h-[80px] flex items-center overflow-x-auto bg-background border-b border-border">
        {Object.entries(TAB_PANELS).map(([id, Content]) => (
          <Tabs.Content
            key={id}
            value={id}
            id={`ribbon-panel-${id}`}
            aria-labelledby={`ribbon-tab-${id}`}
            className="flex items-center h-full w-full outline-none"
          >
            <Content {...props} slideElements={props.slide?.elements || []} />
          </Tabs.Content>
        ))}
      </div>
    </Tabs.Root>
  )
}
