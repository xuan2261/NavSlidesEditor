import { escapePlainText } from 'revealjs-shared'

/**
 * Build element-based slides from an AI-generated outline, client-side.
 *
 * Every interpolated field (title, bullets) is HTML-escaped — matching the
 * server's /generate-slides escaping — so a user-controllable outline (the
 * AIGenerator "Edit JSON" textarea) cannot inject executable HTML into the
 * text element content sink.
 *
 * @param {Array<{title?:string, layout?:string, bulletPoints?:string[],
 *   notes?:string, speakerNotes?:string}>} outline
 * @returns {Array<{id:string, elements:Array, notes:string}>}
 */
export function buildSlidesFromOutline(outline) {
  if (!Array.isArray(outline)) return []

  return outline.map((item) => {
    const safeTitle = escapePlainText(item.title || '')
    const bullets = Array.isArray(item.bulletPoints) ? item.bulletPoints : []

    let content
    if (item.layout === 'title') {
      const bulletLine = bullets.length
        ? `<p style="text-align:center">${bullets.map((bp) => escapePlainText(bp)).join(' | ')}</p>`
        : ''
      content = `<h1 style="text-align:center">${safeTitle}</h1>${bulletLine}`
    } else {
      const items = bullets.map((bp) => `<li>${escapePlainText(bp)}</li>`).join('')
      content = `<h2>${safeTitle}</h2><ul>${items}</ul>`
    }

    return {
      id: crypto.randomUUID(),
      elements: [
        {
          id: crypto.randomUUID(),
          type: 'text',
          x: 40,
          y: 40,
          width: 880,
          height: 460,
          zIndex: 1,
          content,
        },
      ],
      notes: item.notes ?? item.speakerNotes ?? '',
    }
  })
}
