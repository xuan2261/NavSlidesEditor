import { buildSvgGradientData, gradientFallbackColor, resolveColorField, isTokenVar } from 'revealjs-shared'
import { sanitizeRichTextHtml } from '../../../utils/content-safety'

function safeCssColor(value, fallback) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(color)) return color
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(color)) return color
  if (/^var\(--ns-[a-z0-9-]+\)$/.test(color)) return color
  if (['transparent', 'currentColor'].includes(color)) return color
  return fallback
}

function importedTextInsetStyles(element) {
  const insets = element?._pptxImportMeta?.textInsets
  if (!insets) return null
  const unitScale = element._pptxImportMeta.textInsetsUnit === 'px' ? 1 : 96 / 72
  const side = (value, maxDimension) => {
    const raw = Number(value)
    if (!Number.isFinite(raw)) return null
    const max = Math.min(Number.isFinite(maxDimension) && maxDimension >= 0 ? maxDimension / 2 : 96, 96)
    return `${Math.min(Math.round(Math.max(0, raw) * unitScale * 10) / 10, max)}px`
  }
  return {
    paddingLeft: side(insets.left, element.width),
    paddingRight: side(insets.right, element.width),
    paddingTop: side(insets.top, element.height),
    paddingBottom: side(insets.bottom, element.height),
  }
}

function importedTextWrapStyles(element) {
  return element?._pptxImportMeta
    ? { overflowWrap: 'anywhere', wordBreak: 'normal', whiteSpace: 'pre-wrap' }
    : null
}

function importedFontSize(element) {
  const fit = Number(element?._pptxImportMeta?.fitFontSizePx)
  return Number.isFinite(fit) && fit > 0 ? fit : element.fontSize || 16
}

function innerDimension(value, strokeWidth) {
  return Math.max(0, value - strokeWidth)
}

export function ShapeRenderer({ element }) {
  const w = element.width,
    h = element.height
  const gradientData = buildSvgGradientData(element)
  const fill = gradientData
    ? `url(#${gradientData.id})`
    : element.fillGradient
      ? gradientFallbackColor(element)
      : resolveColorField(element.fill, 'shape', 'fill') || '#6366f1'
  const stroke = resolveColorField(element.stroke, 'shape', 'stroke') || 'none'
  const sw = element.strokeWidth || 0
  const shape = element.shape || 'rect'

  // SVG presentation attrs don't resolve CSS vars, so route token vars via
  // `style` and keep literal colors / url(#grad) as attributes (byte-identical
  // to pre-token output and preserves gradient url() handling).
  const paintProps = (fillVal, strokeVal) => {
    const props = {}
    const style = {}
    if (isTokenVar(fillVal)) style.fill = fillVal
    else if (fillVal != null) props.fill = fillVal
    if (isTokenVar(strokeVal)) style.stroke = strokeVal
    else if (strokeVal != null) props.stroke = strokeVal
    if (Object.keys(style).length) props.style = style
    return props
  }

  const renderShape = () => {
    if (shape === 'line') {
      const lw = element.strokeWidth || 3
      return (
        <line
          x1={lw}
          y1={h / 2}
          x2={w - lw}
          y2={h / 2}
          strokeWidth={lw}
          fill="none"
          {...paintProps(undefined, fill)}
        />
      )
    }
    const gProps = { strokeWidth: sw, ...paintProps(fill, stroke) }
    switch (shape) {
      case 'rect':
        return (
          <g {...gProps}>
            <rect
              x={sw / 2}
              y={sw / 2}
              width={innerDimension(w, sw)}
              height={innerDimension(h, sw)}
              rx={element.borderRadius || 0}
            />
          </g>
        )
      case 'rounded-rect':
        return (
          <g {...gProps}>
            <rect x={sw / 2} y={sw / 2} width={innerDimension(w, sw)} height={innerDimension(h, sw)} rx={Math.min(w, h) * 0.15} />
          </g>
        )
      case 'circle':
        return (
          <g {...gProps}>
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={Math.max(0, w / 2 - sw / 2)}
              ry={Math.max(0, h / 2 - sw / 2)}
            />
          </g>
        )
      case 'triangle':
        return (
          <g {...gProps}>
            <polygon points={`${w / 2},${sw} ${w - sw},${h - sw} ${sw},${h - sw}`} />
          </g>
        )
      case 'diamond':
        return (
          <g {...gProps}>
            <polygon
              points={`${w / 2},${sw} ${w - sw},${h / 2} ${w / 2},${h - sw} ${sw},${h / 2}`}
            />
          </g>
        )
      case 'arrow-right':
        return (
          <g {...gProps}>
            <polygon
              points={`${sw},${h * 0.35} ${w * 0.6},${h * 0.35} ${w * 0.6},${sw} ${w - sw},${h / 2} ${w * 0.6},${h - sw} ${w * 0.6},${h * 0.65} ${sw},${h * 0.65}`}
            />
          </g>
        )
      case 'star': {
        const cx = w / 2,
          cy = h / 2,
          outerR = Math.min(w, h) / 2 - sw,
          innerR = outerR * 0.4
        const pts = []
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
        }
        return (
          <g {...gProps}>
            <polygon points={pts.join(' ')} />
          </g>
        )
      }
      default:
        return (
          <g {...gProps}>
            <rect x={sw / 2} y={sw / 2} width={innerDimension(w, sw)} height={innerDimension(h, sw)} />
          </g>
        )
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: element.opacity || 1 }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {gradientData && (
          <defs>
            <linearGradient
              id={gradientData.id}
              x1={gradientData.x1}
              y1={gradientData.y1}
              x2={gradientData.x2}
              y2={gradientData.y2}
            >
              {gradientData.stops.map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor={safeCssColor(stop.color, '#000000')} />
              ))}
            </linearGradient>
          </defs>
        )}
        {renderShape()}
        {element.textHtml ? (
          <foreignObject x={0} y={0} width={w} height={h}>
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: safeCssColor(resolveColorField(element.textColor, 'shape', 'textColor'), '#ffffff'),
                fontSize: importedFontSize(element),
                overflow: 'hidden',
                ...importedTextWrapStyles(element),
                ...importedTextInsetStyles(element),
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(element.textHtml) }}
            />
          </foreignObject>
        ) : element.text && (
          <text
            x={w / 2}
            y={h / 2}
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize={element.fontSize || 16}
            style={{ fill: safeCssColor(resolveColorField(element.textColor, 'shape', 'textColor'), '#ffffff') }}
          >
            {element.text}
          </text>
        )}
      </svg>
    </div>
  )
}
