const { validText } = require('./ooxml-text-run-xml')
const { INVALID, hasOnlyOwnFields, isPlainRecord, ownData } = require('./own-plain-data')

const PRODUCTION_TRANSPORT_SCHEMA_VERSION = 1

function verdict(ok, fields) { return Object.freeze({ ok, ...fields }) }
function reject(code) { return verdict(false, { code }) }
function value(record, field) {
  const result = ownData(record, field)
  if (result === INVALID) throw new TypeError('Invalid transport field')
  return result
}

function validPlainText(text) {
  if (/\r|\n/u.test(text)) return 'TIPTAP_HARD_BREAK_NOT_ALLOWED'
  if (/\t/u.test(text)) return 'TIPTAP_TAB_NOT_ALLOWED'
  return validText(text) ? null : 'TIPTAP_XML_CHARACTER_INVALID'
}

function inlineCode(node) {
  if (!isPlainRecord(node)) return 'TIPTAP_INLINE_NODE_NOT_ALLOWED'
  const type = value(node, 'type')
  if (type === 'hardBreak') return 'TIPTAP_HARD_BREAK_NOT_ALLOWED'
  if (type === 'field') return 'TIPTAP_FIELD_NOT_ALLOWED'
  if (type === 'tab') return 'TIPTAP_TAB_NOT_ALLOWED'
  return type === 'text' ? null : 'TIPTAP_INLINE_NODE_NOT_ALLOWED'
}

function normalizeJsonTransport(transport) {
  if (!hasOnlyOwnFields(transport, ['format', 'schemaVersion', 'document'], ['format', 'schemaVersion', 'document']) ||
      value(transport, 'schemaVersion') !== PRODUCTION_TRANSPORT_SCHEMA_VERSION) return reject('TIPTAP_TRANSPORT_SCHEMA_INVALID')
  const document = value(transport, 'document')
  if (!isPlainRecord(document)) return reject('TIPTAP_DOCUMENT_INVALID')
  if (ownData(document, 'attrs') !== INVALID) return reject('TIPTAP_STYLE_NOT_ALLOWED')
  if (!hasOnlyOwnFields(document, ['type', 'content'], ['type', 'content']) || value(document, 'type') !== 'doc' ||
      !Array.isArray(value(document, 'content'))) return reject('TIPTAP_DOCUMENT_INVALID')
  const blocks = value(document, 'content')
  if (blocks.length !== 1) return reject('TIPTAP_DOCUMENT_PARAGRAPH_COUNT_INVALID')
  const paragraph = blocks[0]
  if (!isPlainRecord(paragraph)) return reject('TIPTAP_BLOCK_NOT_PARAGRAPH')
  if (value(paragraph, 'type') === 'bulletList' || value(paragraph, 'type') === 'orderedList' || value(paragraph, 'type') === 'listItem') return reject('TIPTAP_LIST_NOT_ALLOWED')
  if (ownData(paragraph, 'attrs') !== INVALID) return reject('TIPTAP_STYLE_NOT_ALLOWED')
  if (!hasOnlyOwnFields(paragraph, ['type', 'content'], ['type', 'content']) || value(paragraph, 'type') !== 'paragraph' ||
      !Array.isArray(value(paragraph, 'content'))) return reject('TIPTAP_BLOCK_NOT_PARAGRAPH')
  const runs = value(paragraph, 'content')
  for (const node of runs) { const code = inlineCode(node); if (code) return reject(code) }
  if (runs.length !== 1) return reject('TIPTAP_PARAGRAPH_RUN_COUNT_INVALID')
  const run = runs[0]
  if (ownData(run, 'attrs') !== INVALID || !hasOnlyOwnFields(run, ['type', 'text', 'marks'], ['type', 'text'])) return reject('TIPTAP_STYLE_NOT_ALLOWED')
  const text = value(run, 'text')
  if (typeof text !== 'string') return reject('TIPTAP_STYLE_NOT_ALLOWED')
  const marks = ownData(run, 'marks')
  if (marks !== INVALID) {
    if (!Array.isArray(marks)) return reject('TIPTAP_RUN_MARKS_NOT_ALLOWED')
    for (const mark of marks) {
      if (isPlainRecord(mark) && ownData(mark, 'type') === 'link') return reject('TIPTAP_LINK_NOT_ALLOWED')
    }
    if (marks.length > 0) return reject('TIPTAP_RUN_MARKS_NOT_ALLOWED')
  }
  const code = validPlainText(text)
  return code ? reject(code) : verdict(true, { format: value(transport, 'format'), normalizedText: text })
}

function decodeHtml(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  let output = ''
  let cursor = 0
  const matcher = /&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);/g
  for (const match of value.matchAll(matcher)) {
    if (value.slice(cursor, match.index).includes('&')) return null
    output += value.slice(cursor, match.index)
    const token = match[0].slice(1, -1)
    if (Object.prototype.hasOwnProperty.call(entities, token)) output += entities[token]
    else {
      const point = Number.parseInt(token.slice(token.startsWith('#x') ? 2 : 1), token.startsWith('#x') ? 16 : 10)
      if (!Number.isInteger(point) || point < 0 || point > 0x10ffff) return null
      output += String.fromCodePoint(point)
    }
    cursor = match.index + match[0].length
  }
  return value.slice(cursor).includes('&') ? null : output + value.slice(cursor)
}

function normalizeHtmlTransport(transport) {
  if (!hasOnlyOwnFields(transport, ['format', 'schemaVersion', 'html'], ['format', 'schemaVersion', 'html']) ||
      value(transport, 'schemaVersion') !== PRODUCTION_TRANSPORT_SCHEMA_VERSION || typeof value(transport, 'html') !== 'string') return reject('TIPTAP_TRANSPORT_SCHEMA_INVALID')
  const match = /^<p>([^<]*)<\/p>$/u.exec(value(transport, 'html'))
  if (!match) return reject('TIPTAP_HTML_NOT_SINGLE_PLAIN_PARAGRAPH')
  const text = decodeHtml(match[1])
  if (text === null) return reject('TIPTAP_HTML_ENTITY_INVALID')
  const code = validPlainText(text)
  return code ? reject(code) : verdict(true, { format: value(transport, 'format'), normalizedText: text })
}

function normalizeTipTapSinglePlainRun(transport) {
  try {
    if (typeof transport === 'string') return reject('TIPTAP_LEGACY_PLAIN_STRING_NOT_ALLOWED')
    if (!isPlainRecord(transport)) return reject('TIPTAP_TRANSPORT_INVALID')
    const format = ownData(transport, 'format')
    if (format === 'tiptap-json') return normalizeJsonTransport(transport)
    if (format === 'tiptap-html') return normalizeHtmlTransport(transport)
    return reject('TIPTAP_TRANSPORT_FORMAT_UNSUPPORTED')
  } catch {
    return reject('TIPTAP_TRANSPORT_INVALID')
  }
}

function transportFromTipTapContent(content) {
  const representation = typeof content === 'string'
    ? { kind: 'html', value: content }
    : { kind: 'json', value: content }
  if (representation.kind === 'html') {
    return { format: 'tiptap-html', schemaVersion: PRODUCTION_TRANSPORT_SCHEMA_VERSION, html: representation.value }
  }
  return { format: 'tiptap-json', schemaVersion: PRODUCTION_TRANSPORT_SCHEMA_VERSION, document: representation.value }
}

module.exports = {
  PRODUCTION_TRANSPORT_SCHEMA_VERSION,
  normalizeTipTapSinglePlainRun,
  transportFromTipTapContent,
}
