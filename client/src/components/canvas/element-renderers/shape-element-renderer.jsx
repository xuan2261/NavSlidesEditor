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
      case 'hexagon':
        return (
          <g {...gProps}>
            <polygon
              points={`${w / 4},${sw} ${w * 0.75},${sw} ${w - sw},${h / 2} ${w * 0.75},${h - sw} ${w / 4},${h - sw} ${sw},${h / 2}`}
            />
          </g>
        )
      case 'pentagon':
        return (
          <g {...gProps}>
            <polygon
              points={`${w / 2},${sw} ${w - sw},${h * 0.38} ${w * 0.81},${h - sw} ${w * 0.19},${h - sw} ${sw},${h * 0.38}`}
            />
          </g>
        )
      case 'cloud':
        return (
          <g {...gProps}>
            <path
              d={`M ${w * 0.25} ${h * 0.65} A ${w * 0.2} ${h * 0.2} 0 0 1 ${w * 0.2} ${h * 0.35} A ${w * 0.25} ${h * 0.25} 0 0 1 ${w * 0.6} ${h * 0.15} A ${w * 0.2} ${h * 0.2} 0 0 1 ${w * 0.85} ${h * 0.35} A ${w * 0.2} ${h * 0.2} 0 0 1 ${w * 0.8} ${h * 0.7} Z`}
            />
          </g>
        )
      case 'cylinder':
        return (
          <g {...gProps}>
            <path
              d={`M ${sw} ${h * 0.15} A ${w / 2 - sw} ${h * 0.15} 0 0 0 ${w - sw} ${h * 0.15} A ${w / 2 - sw} ${h * 0.15} 0 0 0 ${sw} ${h * 0.15} L ${sw} ${h * 0.85} A ${w / 2 - sw} ${h * 0.15} 0 0 0 ${w - sw} ${h * 0.85} Z`}
            />
          </g>
        )
      case 'parallelogram':
        return (
          <g {...gProps}>
            <polygon points={`${w * 0.2},${sw} ${w - sw},${sw} ${w * 0.8},${h - sw} ${sw},${h - sw}`} />
          </g>
        )
      case 'trapezoid':
        return (
          <g {...gProps}>
            <polygon points={`${w * 0.2},${sw} ${w * 0.8},${sw} ${w - sw},${h - sw} ${sw},${h - sw}`} />
          </g>
        )
      case 'bracket': {
        // Bracket is stroke-only (no fill); mirror shapeUtils: fall back to fill
        // color when stroke is 'none', and thicken thin strokes to stay visible.
        const strkVal = stroke === 'none' ? fill : stroke
        const swThick = Math.max(3, sw)
        return (
          <g {...paintProps(undefined, strkVal)} strokeWidth={swThick}>
            <path
              d={`M ${w * 0.8} ${swThick} Q ${w * 0.4} ${swThick} ${w * 0.4} ${h * 0.25} T ${swThick} ${h * 0.5} Q ${w * 0.4} ${h * 0.5} ${w * 0.4} ${h * 0.75} T ${w * 0.8} ${h - swThick}`}
              fill="none"
            />
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
    <div style={{ position: 'absolute', inset: 0 }}>
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
