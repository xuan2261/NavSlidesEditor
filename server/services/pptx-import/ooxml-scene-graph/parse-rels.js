const { normalizeZipPath, resolveRelationshipTarget, parseRelationshipTargets } = (() => {
  // Local copies keep this module pure and under LOC budget without circular deps.
  function normalizeZipPath(value) {
    const parts = []
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue
      if (part === '..') parts.pop()
      else parts.push(part)
    }
    return parts.join('/')
  }

  function resolveRelationshipTarget(relPath, target) {
    if (!target || /^[a-z]+:/i.test(target)) return ''
    // Reject absolute escapes that leave package after normalize
    const match = String(relPath || '').match(/^(.*)\/_rels\/([^/]+)\.rels$/i)
    if (!match) return ''
    const sourceDir = match[1]
    const joined = normalizeZipPath(target.startsWith('/') ? target.slice(1) : `${sourceDir}/${target}`)
    if (joined.includes('..')) return ''
    return joined
  }

  function parseRelationshipTargets(relXml, relPath) {
    const targets = []
    for (const tag of String(relXml || '').matchAll(/<Relationship\b[^>]*>/gi)) {
      const attrs = {}
      for (const attr of tag[0].matchAll(/([A-Za-z_:][\w:.-]*)=(["'])(.*?)\2/g)) {
        attrs[attr[1].toLowerCase()] = attr[3]
      }
      const target = resolveRelationshipTarget(relPath, attrs.target)
      if (!target) continue
      targets.push({
        id: attrs.id || null,
        type: attrs.type || null,
        target,
      })
    }
    return targets
  }

  return { normalizeZipPath, resolveRelationshipTarget, parseRelationshipTargets }
})()

function rejectTraversalTarget(target) {
  const raw = String(target || '')
  if (raw.includes('..') || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) {
    return null
  }
  return normalizeZipPath(raw)
}

module.exports = {
  normalizeZipPath,
  resolveRelationshipTarget,
  parseRelationshipTargets,
  rejectTraversalTarget,
}
