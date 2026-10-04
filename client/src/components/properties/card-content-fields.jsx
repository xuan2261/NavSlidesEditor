import React from 'react'
import AuthoringMedia from './game-authoring-media'
import { SelectField, TextField } from './game-authoring-fields'

export default function CardContentFields({ label, value, onChange }) {
  const type = value?.type || 'text'
  return (
    <div className="space-y-1">
      <SelectField
        label={`${label} content type`}
        value={type}
        options={['text', 'image']}
        onChange={(next) =>
          onChange(
            next === 'text' ? { type: 'text', text: '' } : { type: 'image', src: '', alt: '' }
          )
        }
      />
      {type === 'text' ? (
        <TextField
          label={`${label} text`}
          multiline
          value={value?.text || ''}
          onChange={(text) => onChange({ type: 'text', text })}
        />
      ) : (
        <AuthoringMedia
          label={label}
          value={value}
          onChange={(media) =>
            onChange({ type: 'image', src: media?.src || '', alt: media?.alt ?? value?.alt ?? '' })
          }
        />
      )}
    </div>
  )
}
