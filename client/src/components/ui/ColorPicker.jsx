import React, { useMemo } from 'react'
import { cn } from '../../lib/utils'

function parseColorToHex(color, fallback = '#000000') {
  if (!color || color === 'none' || color === 'transparent') return fallback

  // 1. If it's already a 6-digit hex
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color

  // 2. If it's a 3-digit hex
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  }

  // 3. If it's an 8-digit hex
  if (/^#[0-9a-fA-F]{8}$/.test(color)) {
    return color.substring(0, 7)
  }

  // 4. If it's rgb or rgba
  const rgbMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0')
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0')
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }

  // 5. Native canvas fallback for named colors (like 'red')
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.fillStyle = color
    const computed = ctx.fillStyle
    if (/^#[0-9a-fA-F]{6}$/.test(computed)) return computed
  } catch {
    // Ignore canvas errors
  }

  return fallback
}

export const ColorPicker = React.forwardRef(
  ({ className, value, onChange, fallback = '#000000', style, ...props }, ref) => {
    const hexValue = useMemo(() => parseColorToHex(value, fallback), [value, fallback])

    // Strip background from caller style to prevent overriding the swatch display
    const { background: _background, backgroundColor: _backgroundColor, ...safeStyle } = style || {}

    return (
      <input
        type="color"
        className={cn(
          'color-picker-swatch cursor-pointer shrink-0 rounded border border-border p-0 transition-[border-color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-secondary disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={safeStyle}
        value={hexValue}
        onChange={onChange}
        ref={ref}
        {...props}
      />
    )
  }
)

ColorPicker.displayName = 'ColorPicker'
