import pptxgen from 'pptxgenjs'

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return doc.body.textContent || ''
}

// eslint-disable-next-line unused-imports/no-unused-vars
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3)
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

// eslint-disable-next-line unused-imports/no-unused-vars
function pxToInch(px) {
  return px / 96
}

// Convert 960x540 canvas coords to 10"x5.625" slide
const SCALE_X = 10 / 960
const SCALE_Y = 5.625 / 540

export function exportToPptx(presentation) {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE' // 13.33x7.5 — we'll use custom
  pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 })
  pptx.layout = 'CUSTOM'
  pptx.title = presentation.title || 'Presentation'

  for (const slide of presentation.slides || []) {
    const pptSlide = pptx.addSlide()

    // Background
    const bg = slide.background
    if (bg?.type === 'color' && bg.color) {
      pptSlide.background = { color: bg.color.replace('#', '') }
    } else if (!bg || bg.type === 'none') {
      pptSlide.background = { color: '1e1e2e' }
    }

    // Sort elements by zIndex
    const elements = [...(slide.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

    for (const el of elements) {
      const x = el.x * SCALE_X
      const y = el.y * SCALE_Y
      const w = el.width * SCALE_X
      const h = el.height * SCALE_Y
      const rotation = el.rotation || 0

      if (el.type === 'text' || el.type === 'markdown') {
        const text = stripHtml(el.type === 'text' ? el.content : el.content)
        if (text.trim()) {
          pptSlide.addText(text, {
            x,
            y,
            w,
            h,
            fontSize: 14,
            color: 'FFFFFF',
            valign: 'top',
            wrap: true,
            rotate: rotation,
          })
        }
      } else if (el.type === 'image') {
        try {
          const src = el.src
          if (src && (src.startsWith('http') || src.startsWith('data:'))) {
            pptSlide.addImage({ path: src, x, y, w, h, rotate: rotation })
          }
        } catch {}
      } else if (el.type === 'shape') {
        const fill = el.fill || '6366f1'
        pptSlide.addShape(pptx.ShapeType.rect, {
          x,
          y,
          w,
          h,
          fill: { color: fill.replace('#', '') },
          rotate: rotation,
        })
        if (el.text) {
          pptSlide.addText(el.text, {
            x,
            y,
            w,
            h,
            fontSize: el.fontSize || 16,
            color: (el.textColor || '#ffffff').replace('#', ''),
            align: 'center',
            valign: 'middle',
            rotate: rotation,
          })
        }
      } else if (el.type === 'code') {
        pptSlide.addText(el.content || '', {
          x,
          y,
          w,
          h,
          fontSize: el.fontSize || 12,
          fontFace: 'Courier New',
          color: 'E2E8F0',
          fill: { color: '1a1a2e' },
          valign: 'top',
          wrap: true,
          rotate: rotation,
        })
      } else if (el.type === 'callout') {
        const bg = (el.calloutColor || '#ef4444').replace('#', '')
        pptSlide.addShape(pptx.ShapeType.ellipse, {
          x,
          y,
          w,
          h,
          fill: { color: bg },
          rotate: rotation,
        })
        pptSlide.addText(String(el.calloutNumber || 1), {
          x,
          y,
          w,
          h,
          fontSize: el.fontSize || 16,
          color: (el.calloutTextColor || '#ffffff').replace('#', ''),
          bold: true,
          align: 'center',
          valign: 'middle',
          rotate: rotation,
        })
      } else if (el.type === 'table' && el.data) {
        const rows = el.data.map((row, ri) =>
          (row || []).map((cell) => ({
            text: cell || '',
            options: {
              fontSize: el.fontSize || 12,
              color: (el.textColor || '#ffffff').replace('#', ''),
              fill: {
                color: (el.headerRow && ri === 0
                  ? el.headerBgColor || '#6366f1'
                  : el.cellBgColor || '1e1e2e'
                ).replace('#', ''),
              },
              border: {
                pt: el.borderWidth || 1,
                color: (el.borderColor || '555555').replace('#', ''),
              },
            },
          }))
        )
        if (rows.length > 0) {
          pptSlide.addTable(rows, { x, y, w, h })
        }
      }
    }

    // Speaker notes
    if (slide.notes) {
      pptSlide.addNotes(slide.notes)
    }
  }

  pptx.writeFile({
    fileName: `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`,
  })
}
