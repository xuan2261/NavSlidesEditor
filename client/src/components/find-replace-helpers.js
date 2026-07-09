export function stripHtml(html) {
  if (typeof DOMParser === 'undefined') return String(html || '').replace(/<[^>]*>/g, '')
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return doc.body.textContent || ''
}

export function createSearchRegex(searchTerm, matchCase, global = true) {
  const flags = `${global ? 'g' : ''}${matchCase ? '' : 'i'}`
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, flags)
}

function replaceTextOutsideTags(html, regex, replaceTerm, global = true) {
  const source = String(html || '')
  const lowerSource = source.toLowerCase()
  let result = ''
  let textBuffer = ''
  let index = 0
  let didReplace = false

  const flushText = () => {
    if (!textBuffer) return
    if (global) {
      result += textBuffer.replace(regex, replaceTerm)
    } else if (didReplace) {
      result += textBuffer
    } else {
      const replaced = textBuffer.replace(regex, replaceTerm)
      didReplace = replaced !== textBuffer
      result += replaced
    }
    textBuffer = ''
  }

  while (index < source.length) {
    const nextTagIndex = source.indexOf('<', index)

    if (nextTagIndex === -1) {
      textBuffer += source.slice(index)
      break
    }

    textBuffer += source.slice(index, nextTagIndex)
    flushText()

    if (lowerSource.startsWith('<script', nextTagIndex) || lowerSource.startsWith('<style', nextTagIndex)) {
      const closingTag = lowerSource.startsWith('<script', nextTagIndex) ? '</script>' : '</style>'
      const closingIndex = lowerSource.indexOf(closingTag, nextTagIndex)

      if (closingIndex === -1) {
        result += source.slice(nextTagIndex)
        return result
      }

      const closingEnd = closingIndex + closingTag.length
      result += source.slice(nextTagIndex, closingEnd)
      index = closingEnd
      continue
    }

    const tagEnd = source.indexOf('>', nextTagIndex)
    if (tagEnd === -1) {
      result += source.slice(nextTagIndex)
      return result
    }

    result += source.slice(nextTagIndex, tagEnd + 1)
    index = tagEnd + 1
  }

  flushText()
  return result
}

function hasDocumentWrapper(html) {
  return /<!doctype|<html[\s>]|<head[\s>]/i.test(String(html || ''))
}

function serializeDocument(doc, originalHtml) {
  if (!hasDocumentWrapper(originalHtml)) {
    return doc.body.innerHTML
  }

  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ''}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ''}>`
    : ''

  return `${doctype}${doc.documentElement.outerHTML}`
}

export function replaceInHtml(html, searchTerm, replaceTerm, matchCase, global = true) {
  const regex = createSearchRegex(searchTerm, matchCase, global)
  if (typeof DOMParser === 'undefined') {
    return replaceTextOutsideTags(html, regex, replaceTerm, global)
  }

  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  let didReplace = false
  function walkTextNodes(node) {
    if (!global && didReplace) {
      return
    }
    if (node.nodeType === 1 && ['SCRIPT', 'STYLE'].includes(node.nodeName)) {
      return
    }
    if (node.nodeType === 3) {
      const replaced = node.textContent.replace(regex, replaceTerm)
      didReplace = didReplace || replaced !== node.textContent
      node.textContent = replaced
      return
    }
    node.childNodes.forEach(walkTextNodes)
  }
  walkTextNodes(doc.body)
  return serializeDocument(doc, html)
}

function replaceInTableData(data, regex, replaceTerm, global = true) {
  let didReplace = false
  const next = (data || []).map((row) =>
    (row || []).map((cell) => {
      const text = cell == null ? '' : String(cell)
      if (!global && didReplace) return cell
      const replaced = text.replace(regex, replaceTerm)
      if (replaced !== text) {
        didReplace = true
        return replaced
      }
      return cell
    })
  )
  return next
}

/**
 * Replace a single occurrence inside one table cell (pos is index within that cell).
 */
export function replaceOnceInTableCell(element, searchTerm, replaceTerm, matchCase, tableRow, tableCol, pos = 0) {
  if (element?.type !== 'table' || !Array.isArray(element.data)) return element
  const regex = createSearchRegex(searchTerm, matchCase, false)
  const data = element.data.map((row, ri) =>
    (row || []).map((cell, ci) => {
      if (ri !== tableRow || ci !== tableCol) return cell
      const text = cell == null ? '' : String(cell)
      const start = Math.max(0, Number(pos) || 0)
      const before = text.slice(0, start)
      const from = text.slice(start)
      const replacedFrom = from.replace(regex, replaceTerm)
      return before + replacedFrom
    })
  )
  return { ...element, data }
}

function replaceInElement(element, searchTerm, replaceTerm, matchCase, regex) {
  if (element.type === 'text') {
    return {
      ...element,
      content: replaceInHtml(element.content, searchTerm, replaceTerm, matchCase),
    }
  }
  if (element.type === 'code' || element.type === 'markdown' || element.type === 'latex') {
    return { ...element, content: (element.content || '').replace(regex, replaceTerm) }
  }
  if (element.type === 'html') {
    return {
      ...element,
      content: replaceInHtml(element.content || '', searchTerm, replaceTerm, matchCase),
    }
  }
  if (element.type === 'shape' && element.text) {
    return { ...element, text: element.text.replace(regex, replaceTerm) }
  }
  if (element.type === 'table' && Array.isArray(element.data)) {
    return {
      ...element,
      data: replaceInTableData(element.data, regex, replaceTerm, true),
      // mergedCells / styles untouched
    }
  }
  return element
}

/** Collect searchable plain segments for match counting (keeps Find UI in sync with replace). */
export function collectElementSearchMatches(el, searchTerm, matchCase) {
  if (!searchTerm || !el) return []
  const term = matchCase ? searchTerm : searchTerm.toLowerCase()
  const hits = []
  const pushFromText = (text, extra = {}) => {
    const compare = matchCase ? text : text.toLowerCase()
    let pos = 0
    while ((pos = compare.indexOf(term, pos)) !== -1) {
      hits.push({ elementId: el.id, elementType: el.type, pos, ...extra })
      pos += term.length
    }
  }
  if (el.type === 'text') pushFromText(stripHtml(el.content))
  else if (el.type === 'code' || el.type === 'markdown' || el.type === 'latex')
    pushFromText(el.content || '')
  else if (el.type === 'html') pushFromText(stripHtml(el.content || ''))
  else if (el.type === 'shape' && el.text) pushFromText(el.text)
  else if (el.type === 'table' && Array.isArray(el.data)) {
    el.data.forEach((row, ri) => {
      ;(row || []).forEach((cell, ci) => {
        pushFromText(cell == null ? '' : String(cell), { tableRow: ri, tableCol: ci })
      })
    })
  }
  return hits
}

export function replaceAllInSlides(slides, searchTerm, replaceTerm, matchCase) {
  const regex = createSearchRegex(searchTerm, matchCase)
  const mapElements = (elements) =>
    (elements || []).map((element) =>
      replaceInElement(element, searchTerm, replaceTerm, matchCase, regex)
    )
  return slides.map((slide) => ({
    ...slide,
    elements: mapElements(slide.elements),
    // Vertical child slides carry their own elements — replace there too so a
    // Replace All on a deck with vertical stacks is not silently partial.
    ...(slide.children
      ? {
          children: slide.children.map((child) => ({
            ...child,
            elements: mapElements(child.elements),
          })),
        }
      : {}),
  }))
}
