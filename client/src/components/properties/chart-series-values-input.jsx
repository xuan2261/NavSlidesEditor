import { useState } from 'react'
import { Input } from '../ui'

export default function ChartSeriesValuesInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(null)
  return <Input
    {...props}
    value={draft ?? value}
    onFocus={() => setDraft(value)}
    onBlur={() => setDraft(null)}
    onChange={(event) => {
      setDraft(event.target.value)
      onChange(event)
    }}
  />
}
