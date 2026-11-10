import { NativeTextChoice, NativeTextNumber, nativeTextControlClass, withTextProperties } from './native-text-fields'
import NativeTextColorControls from './native-text-color-controls'

const underlines = ['none', 'words', 'sng', 'dbl', 'heavy', 'dotted', 'dottedHeavy', 'dash',
  'dashHeavy', 'dashLong', 'dashLongHeavy', 'dotDash', 'dotDashHeavy', 'dotDotDash',
  'dotDotDashHeavy', 'wavy', 'wavyHeavy', 'wavyDbl']

export default function NativeTextRunControls({ run, paragraphIndex, runIndex, onChange }) {
  const label = `PPTX paragraph ${paragraphIndex + 1} run ${runIndex + 1}`
  const properties = run.properties ?? {}
  const set = (key, value) => onChange(withTextProperties(run, 'properties', key, value))
  return <fieldset className="flex min-w-0 flex-col gap-2 border border-border p-2">
    <legend className="text-xs">Paragraph {paragraphIndex + 1}, text run {runIndex + 1}</legend>
    {run.kind === 'text' && <label className="text-xs text-text-secondary">Text
      <textarea aria-label={`PPTX text paragraph ${paragraphIndex + 1} run ${runIndex + 1}`}
        className={nativeTextControlClass} value={run.text}
        onChange={(event) => onChange({ ...run, text: event.target.value })} />
    </label>}
    <NativeTextNumber label={`${label} font size (pt)`} value={properties.fontSizePt}
      min={1} max={4000} integer={false} onValue={(value) => set('fontSizePt', value)} />
    {['bold', 'italic'].map((key) => <NativeTextChoice key={key} label={`${label} ${key}`}
      value={properties[key] === undefined ? undefined : String(properties[key])}
      options={[["true", 'On'], ["false", 'Off']]}
      onValue={(value) => set(key, value === undefined ? undefined : value === 'true')} />)}
    <NativeTextChoice label={`${label} underline`} value={properties.underline}
      options={underlines} onValue={(value) => set('underline', value)} />
    <NativeTextColorControls label={`${label} color`} color={properties.color}
      onValue={(value) => set('color', value)} />
  </fieldset>
}
