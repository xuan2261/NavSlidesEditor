import { isSafeHref } from './url-safety'

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Convert a Markdown document into an array of slide objects.
 * Splits by `---` (horizontal rule) or `## ` headings.
 */
export function markdownToSlides(md) {
  return markdownToSlidesWithWarnings(md).slides
}

export function markdownToSlidesWithWarnings(md) {
  if (!md || !md.trim()) return { slides: [], warnings: [] }
  const warnings = []

  // Split by --- or ## headings (keep heading in the section)
  const sections = md.split(/\n---\n|\n(?=## )/).filter((s) => s.trim())

  const slides = sections.map((section) => {
    let trimmed = section.trim()
    let background = { type: 'none' }

    // Parse <!-- .slide: ... --> comments
    const slideConfigMatch = trimmed.match(/<!--\s*\.slide:\s*(.+?)\s*-->/)
    if (slideConfigMatch) {
      const configStr = slideConfigMatch[1]

      const bgColorMatch = configStr.match(/data-background-color="([^"]+)"/)
      if (bgColorMatch) {
        background = { type: 'color', color: bgColorMatch[1] }
      }

      const bgImageMatch = configStr.match(/data-background-image="([^"]+)"/)
      if (bgImageMatch) {
        background = { type: 'image', image: bgImageMatch[1] }
      }

      // Remove the comment from content
      trimmed = trimmed.replace(/<!--\s*\.slide:\s*.+?\s*-->\n?/, '').trim()
    }

    // Detect if this section is a title-only slide (just h1 or h2)
    const isTitle = /^#{1,2}\s/.test(trimmed) && !trimmed.includes('\n\n')

    // Convert markdown to simple HTML
    const html = simpleMarkdownToHtml(trimmed, warnings)

    return {
      id: crypto.randomUUID(),
      elements: [
        {
          id: crypto.randomUUID(),
          type: 'text',
          x: isTitle ? 80 : 60,
          y: isTitle ? 180 : 40,
          width: isTitle ? 800 : 840,
          height: isTitle ? 180 : 460,
          zIndex: 1,
          textColor: 'auto',
          content: html,
        },
      ],
      background,
    }
  })
  return { slides, warnings }
}

/**
 * Simple markdown → HTML converter (no external deps).
 * Handles: headings, bold, italic, code, lists, links, paragraphs.
 */

function simpleMarkdownToHtml(md, warnings = []) {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background:color-mix(in srgb, currentColor 12%, transparent);padding:12px;border-radius:6px;overflow:auto;font-size:14px;"><code>${code.trim()}</code></pre>`
  })

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:color-mix(in srgb, currentColor 12%, transparent);padding:2px 6px;border-radius:3px;font-size:0.9em;">$1</code>'
  )

  // Headings
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 style="margin:0 0 8px;font-size:24px;">$1</h3>'
  )
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 style="margin:0 0 12px;font-size:32px;">$1</h2>'
  )
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 style="margin:0 0 16px;font-size:42px;">$1</h1>'
  )

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    if (!isSafeHref(href)) {
      warnings.push(`Blocked unsafe markdown link: ${href}`)
      return `<span>${text}</span>`
    }
    // Belt-and-suspenders: escape attribute-significant characters before
    // interpolating into href="..." even though isSafeHref already rejects them.
    const safeHref = escapeHtmlAttr(href)
    return `<a href="${safeHref}" style="color:currentColor;text-decoration:underline;">${text}</a>`
  })

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
  html = html.replace(
    /(<li[^>]*>.*<\/li>\n?)+/g,
    (match) => `<ul style="margin:8px 0;padding-left:20px;">${match}</ul>`
  )

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
  html = html.replace(
    /(<li[^>]*>.*<\/li>\n?)+/g,
    (match) => `<ol style="margin:8px 0;padding-left:20px;list-style:decimal;">${match}</ol>`
  )

  // Paragraphs (lines that aren't already wrapped)
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (/^<[huplo]/.test(trimmed)) return trimmed
      return `<p style="margin:0 0 8px;line-height:1.6;">${trimmed}</p>`
    })
    .join('\n')

  return html
}
