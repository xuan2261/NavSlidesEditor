export function ownerContext(element, inherited = {}) {
  const slide = element.closest('[data-slide-id],[data-ns-slide-id],section[id]')
  const owner = element.closest('[data-element-id],[data-ns-element-id]')
  return {
    ...inherited,
    slideId:
      slide?.getAttribute('data-slide-id') ||
      slide?.getAttribute('data-ns-slide-id') ||
      slide?.id ||
      inherited.slideId,
    elementId:
      owner?.getAttribute('data-element-id') ||
      owner?.getAttribute('data-ns-element-id') ||
      inherited.elementId,
  }
}
export function parseSrcset(value) {
  const rows = []
  let cursor = 0
  while (cursor < value.length) {
    while (/[\s,]/.test(value[cursor] || '') && cursor < value.length) cursor++
    let url = ''
    while (cursor < value.length && !/\s/.test(value[cursor])) url += value[cursor++]
    if (!url) break
    if (url.endsWith(',')) {
      rows.push({ url: url.replace(/,+$/, ''), descriptor: '' })
      continue
    }
    let descriptor = '',
      depth = 0
    while (cursor < value.length) {
      const char = value[cursor++]
      if (char === '(') depth++
      if (char === ')') depth--
      if (char === ',' && depth === 0) break
      descriptor += char
    }
    rows.push({ url, descriptor: descriptor.trim() })
  }
  return rows
}
export async function closeElementMedia(element, base, graph, context) {
  const tag = element.localName
  const attributes = []
  if (['img', 'image', 'input'].includes(tag) && (tag !== 'input' || element.type === 'image'))
    attributes.push(['src', 'image'])
  if (['audio', 'video', 'source', 'track'].includes(tag)) attributes.push(['src', 'media'])
  if (tag === 'source' && element.closest('picture')) attributes[0][1] = 'image'
  if (tag === 'video') attributes.push(['poster', 'image'])
  if (['image', 'use'].includes(tag)) attributes.push(['href', 'image'], ['xlink:href', 'image'])
  attributes.push(
    ['data-background-image', 'image'],
    ['data-background-video', 'media'],
    ['data-background-audio', 'media']
  )
  for (const [attribute, kind] of attributes) {
    const reference = element.getAttribute(attribute)
    if (reference && !reference.startsWith('#'))
      element.setAttribute(attribute, await graph.embed(reference, kind, base, context))
  }
  for (const attribute of ['srcset', 'imagesrcset']) {
    if (!element.hasAttribute(attribute)) continue
    const rows = []
    for (const candidate of parseSrcset(element.getAttribute(attribute)))
      rows.push(
        `${await graph.embed(candidate.url, 'image', base, context)}${candidate.descriptor ? ` ${candidate.descriptor}` : ''}`
      )
    element.setAttribute(attribute, rows.join(', '))
  }
  if (element.hasAttribute('ping'))
    throw graph.error(
      'undeclared',
      element.getAttribute('ping'),
      context,
      'Network hyperlink auditing is not portable'
    )
}
export function portablePolicy(capabilities) {
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    `script-src 'unsafe-inline'${capabilities.scriptBlob ? ' blob:' : ''}${capabilities.tikzWasm ? " 'wasm-unsafe-eval'" : ''}`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data: blob:',
    'media-src data: blob:',
    'frame-src data: blob:',
    `connect-src ${capabilities.connect ? 'data: blob:' : "'none'"}`,
    `worker-src ${capabilities.worker ? 'blob:' : "'none'"}`,
    "manifest-src 'none'",
  ].join('; ')
}
