import { sanitizeRichTextHtml } from '../../utils/content-safety'

const SAFE_TYPES = new Set(['text', 'image', 'code', 'table', 'latex', 'markdown', 'chart', 'callout', 'icon', 'drawing', 'line', 'svg', 'shape'])
const PLACEHOLDERS = { html: 'HTML', video: 'Video', audio: 'Audio', game: 'Game', embed: 'Embed' }

function backgroundStyle(background) {
  if (background?.type === 'color') return { backgroundColor: background.color || '#fff' }
  if (background?.type === 'gradient') return { background: background.gradient || '#fff' }
  if (background?.type === 'image' && background.image) {
    return { backgroundImage: `url(${background.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (background?.type === 'fx') return { backgroundColor: background.fx?.fallbackColor || '#0d0221' }
  return { backgroundColor: 'var(--bg-canvas-default, #fff)' }
}

function elementStyle(element, width, height) {
  return {
    position: 'absolute',
    left: `${((element.x || 0) / width) * 100}%`,
    top: `${((element.y || 0) / height) * 100}%`,
    width: `${((element.width || 0) / width) * 100}%`,
    height: `${((element.height || 0) / height) * 100}%`,
    overflow: 'hidden',
  }
}

function applyStyles(node, styles) {
  if (node) Object.assign(node.style, styles)
}

function SafeElement({ element }) {
  if (!SAFE_TYPES.has(element.type)) {
    return <span className="flex h-full items-center justify-center bg-black/20 text-[6px] text-white/70">{PLACEHOLDERS[element.type] || 'Content'}</span>
  }
  if (element.type === 'text') {
    return <div className="h-full overflow-hidden text-[5px]" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(element.content || '') }} />
  }
  if (element.type === 'image') return <img src={element.src} alt="" draggable={false} className="block h-full w-full object-cover" />
  if (element.type === 'table') {
    return <table className="h-full w-full table-fixed text-[4px]"><tbody>{(element.data || []).map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}</tbody></table>
  }
  const label = { code: element.language || 'Code', latex: 'TeX', markdown: 'MD', chart: 'Chart', callout: element.calloutNumber || '1', icon: '★', drawing: '✏', line: '↗', svg: 'SVG', shape: 'Shape' }[element.type]
  return <span className="flex h-full items-center justify-center text-[6px] text-white/70">{label}</span>
}

export function SlideThumbnailPreview({ slide, width = 960, height = 540, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${className}`}
      ref={(node) => applyStyles(node, {
        ...backgroundStyle(slide?.background),
        aspectRatio: `${width} / ${height}`,
      })}
    >
      {(slide?.elements || []).map((element) => (
        <div key={element.id} ref={(node) => applyStyles(node, elementStyle(element, width, height))}>
          <SafeElement element={element} />
        </div>
      ))}
    </div>
  )
}
