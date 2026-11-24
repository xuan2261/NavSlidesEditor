import { useState } from 'react'
import { normalizeTextProperties } from 'revealjs-shared/src/pptx-text-document.js'
import { NativeTextChoice, NativeTextValue } from './native-text-fields'

export default function NativeTextColorControls({ label, color, onValue }) {
  const [kind, setKind] = useState(color?.kind)
  const current = color?.kind === kind ? color : undefined
  return <div className="flex min-w-0 flex-col gap-2">
    <NativeTextChoice label={`${label} kind`} value={kind} options={['srgb', 'scheme', 'preset']}
      onValue={(next) => {
        setKind(next)
        if (next === undefined) onValue(undefined)
      }} />
    {kind && <NativeTextValue key={kind} label={`${label} value`} value={current?.value} required
      hint="Enter a canonical six-digit RGB, theme scheme, or preset color value for the selected kind."
      parse={(value) => normalizeTextProperties({ color: { ...color, kind, value } }, 'run').color}
      onValue={(value) => { if (value !== undefined) onValue(value) }} />}
    {current?.transforms && <p className="break-words text-xs text-text-secondary">
      Ordered source color transforms are retained: {JSON.stringify(current.transforms)}
    </p>}
  </div>
}
