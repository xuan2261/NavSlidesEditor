import { NativeTextChoice, withTextProperties } from './native-text-fields'
import NativeTextBulletControls from './native-text-bullet-controls'
import NativeTextTabControls from './native-text-tab-controls'
import NativeTextRunControls from './native-text-run-controls'

export default function NativeTextParagraphControls({ paragraph, index, onChange }) {
  const label = `PPTX paragraph ${index + 1}`
  const properties = paragraph.properties ?? {}
  const set = (key, value) => onChange(withTextProperties(paragraph, 'properties', key, value))
  return <fieldset className="flex min-w-0 flex-col gap-2 border border-border p-2">
    <legend className="text-xs">Paragraph {index + 1}</legend>
    <NativeTextChoice label={`${label} alignment`} value={properties.alignment}
      options={['l', 'ctr', 'r', 'just', 'justLow', 'dist', 'thaiDist']}
      onValue={(value) => set('alignment', value)} />
    <NativeTextChoice label={`${label} direction`} value={properties.direction}
      options={['ltr', 'rtl']} onValue={(value) => set('direction', value)} />
    <NativeTextBulletControls label={label} bullet={properties.bullet} onValue={(value) => set('bullet', value)} />
    <NativeTextTabControls label={label} properties={properties} onValue={set} />
    {paragraph.runs.map((run, runIndex) => <NativeTextRunControls key={run.componentId}
      run={run} paragraphIndex={index} runIndex={runIndex}
      onChange={(next) => onChange({ ...paragraph, runs: paragraph.runs.map((current, i) => i === runIndex ? next : current) })} />)}
  </fieldset>
}
