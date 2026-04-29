import { sanitizeSvgContent } from '../../../utils/content-safety'

export function SvgElementRenderer({ element }) {
  const content = element.content || ''
  let modifiedContent = content
  if (element.fillOverride) {
    modifiedContent = modifiedContent.replace(/fill="[^"]*"/g, `fill="${element.fillOverride}"`)
  }
  if (element.strokeOverride) {
    modifiedContent = modifiedContent.replace(
      /stroke="[^"]*"/g,
      `stroke="${element.strokeOverride}"`
    )
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
