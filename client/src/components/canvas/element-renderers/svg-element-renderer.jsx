import { applySvgPaintOverrides } from 'revealjs-shared'
import { sanitizeSvgContent } from '../../../utils/content-safety'

export function SvgElementRenderer({ element }) {
  const content = element.content || ''
  const modifiedContent = applySvgPaintOverrides(content, {
    fillOverride: element.fillOverride,
    strokeOverride: element.strokeOverride,
  })
  const svgElementStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  return (
    <div
      className="svg-element-content"
      style={svgElementStyle}
      dangerouslySetInnerHTML={{ __html: sanitizeSvgContent(modifiedContent) }}
    />
  )
}
