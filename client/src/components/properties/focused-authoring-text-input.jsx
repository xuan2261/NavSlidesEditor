import { useState } from 'react'
import { Input } from '../ui'

export default function FocusedAuthoringTextInput({
  value,
  onChange,
  multiline = false,
  primitive = Input,
  ...props
}) {
  const [draft, setDraft] = useState(null)
  const Component = multiline ? 'textarea' : primitive
  return (
    <Component
      {...props}
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value)
        onChange(event)
      }}
    />
  )
}
