function attrs(body) {
  const result = Object.create(null)
  for (const match of body.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) result[match[1]] = match[2] || match[3]
  return result
}
function tagEnd(xml, start) {
  let quote = null
  for (let index = start + 1; index < xml.length; index += 1) {
    const char = xml[index]
    if (quote) { if (char === quote) quote = null } else if (char === '"' || char === "'") quote = char
    else if (char === '>') return index
  }
  return -1
}
function relationshipElements(xml) {
  if (typeof xml !== 'string' || /<!DOCTYPE|<!ENTITY/iu.test(xml)) return []
  const result = []
  for (let index = 0; index < xml.length;) {
    const start = xml.indexOf('<', index); if (start < 0) break
    if (xml.startsWith('<!--', start)) { const end = xml.indexOf('-->', start + 4); if (end < 0) return []; index = end + 3; continue }
    if (xml.startsWith('<![CDATA[', start)) { const end = xml.indexOf(']]>', start + 9); if (end < 0) return []; index = end + 3; continue }
    if (xml.startsWith('<?', start)) { const end = xml.indexOf('?>', start + 2); if (end < 0) return []; index = end + 2; continue }
    const end = tagEnd(xml, start); if (end < 0) return []
    const body = xml.slice(start + 1, end).trim().replace(/\/$/u, '').trim()
    if (/^Relationship(?:\s|$)/u.test(body)) result.push(attrs(body.slice('Relationship'.length)))
    index = end + 1
  }
  return result
}
module.exports = { relationshipElements }
