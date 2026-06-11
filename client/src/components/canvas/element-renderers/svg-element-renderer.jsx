import { sanitizeSvgContent } from '../../../utils/content-safety'

// Override values are interpolated into fill="…"/stroke="…" BEFORE sanitize, so
// a hostile value (e.g. `red" onload="…`) could break out of the attribute.
// Constrain to a strict color allowlist; reject anything else (no interpolation).
function safeOverrideColor(value) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(color)) return color
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(color)) return color
  if (['transparent', 'currentColor', 'none'].includes(color)) return color
  return null
}

export function SvgElementRenderer({ element }) {
  const content = element.content || ''
  let modifiedContent = content
  const fillOverride = safeOverrideColor(element.fillOverride)
  const strokeOverride = safeOverrideColor(element.strokeOverride)
  if (fillOverride) {
    modifiedContent = modifiedContent.replace(/fill="[^"]*"/g, `fill="${fillOverride}"`)
  }
  if (strokeOverride) {
    modifiedContent = modifiedContent.replace(/stroke="[^"]*"/g, `stroke="${strokeOverride}"`)
  }
  const svgElementStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  return <div style={svgElementStyle} dangerouslySetInnerHTML={{ __html: sanitizeSvgContent(modifiedContent) }} />
}
