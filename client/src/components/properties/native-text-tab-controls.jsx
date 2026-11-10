import { Button } from '../ui'
import { NativeTextChoice, NativeTextNumber, withTextValue } from './native-text-fields'

export default function NativeTextTabControls({ label, properties, onValue }) {
  const tabs = properties.tabs
  const update = (index, key, value) => onValue('tabs', tabs.map((tab, i) =>
    i === index ? withTextValue(tab, key, value) : tab))
  return <fieldset className="flex min-w-0 flex-col gap-2">
    <legend className="text-xs">Native tab stops (EMU)</legend>
    <NativeTextNumber label={`${label} default tab size (EMU)`} value={properties.defaultTabSizeEmu}
      min={0} onValue={(value) => onValue('defaultTabSizeEmu', value)} />
    {tabs === undefined && <p className="text-xs text-text-secondary">Tab stops are inherited.</p>}
    {tabs?.map((tab, index) => <div key={index} className="flex min-w-0 flex-col gap-2 border border-border p-2">
      <NativeTextNumber label={`${label} tab ${index + 1} position (EMU)`} value={tab.positionEmu} required
        onValue={(value) => { if (value !== undefined) update(index, 'positionEmu', value) }} />
      <NativeTextChoice label={`${label} tab ${index + 1} alignment`} value={tab.alignment}
        options={['l', 'ctr', 'r', 'dec']} onValue={(value) => update(index, 'alignment', value)} />
      <Button variant="secondary" onClick={() => onValue('tabs', tabs.filter((_, i) => i !== index))}>
        {label} remove tab {index + 1}
      </Button>
    </div>)}
    <Button variant="secondary" disabled={tabs?.length >= 256}
      aria-label={`${label} add tab stop`} onClick={() => onValue('tabs', [...(tabs ?? []), { positionEmu: 0 }])}>
      Add tab stop at 0 EMU
    </Button>
    {tabs !== undefined && <Button variant="secondary" onClick={() => onValue('tabs', undefined)}>
      {label} inherit tab stops
    </Button>}
  </fieldset>
}
