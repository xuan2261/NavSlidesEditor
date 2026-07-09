/**
 * Animation / timing inventory from slide XML (Phase 08b MVP).
 * Maps known entrance presets; classifies unknown as debt.
 */

const ENTRANCE_PRESET_MAP = Object.freeze({
  1: 'appear',
  2: 'fade',
  3: 'fly-in',
  4: 'float',
  5: 'split',
  6: 'wipe',
  7: 'shape',
  8: 'wheel',
  9: 'random-bars',
  10: 'grow-turn',
  11: 'zoom',
  12: 'swivel',
  13: 'bounce',
})

/**
 * @param {string} slideXml
 * @returns {{ animations: object[], unsupported: object[], fragmentHints: string[] }}
 */
function parseSlideAnimations(slideXml) {
  const xml = String(slideXml || '')
  const animations = []
  const unsupported = []
  const fragmentHints = []

  // Common timing: <p:animEffect transition="in" filter="..."/> or presetClass
  const presetRe =
    /<(?:[a-z0-9]+:)?(?:animEffect|anim|animMotion|animScale|animRot|set)\b([^>]*)\/?>/gi
  let m
  while ((m = presetRe.exec(xml))) {
    const attrs = {}
    for (const a of m[1].matchAll(/([A-Za-z_:][\w:.-]*)=(["'])(.*?)\2/g)) {
      const key = a[1].includes(':') ? a[1].split(':').pop() : a[1]
      attrs[key.toLowerCase()] = a[3]
    }
    const tag = m[0].match(/([A-Za-z]+)\b/)?.[1]?.toLowerCase() || 'anim'
    const presetId = attrs.presetid ? Number(attrs.presetid) : null
    const presetClass = String(attrs.presetclass || attrs.presetClass || '').toLowerCase()
    const filter = String(attrs.filter || attrs.transition || '').toLowerCase()

    let mapped = null
    if (presetId != null && ENTRANCE_PRESET_MAP[presetId]) mapped = ENTRANCE_PRESET_MAP[presetId]
    else if (filter.includes('fade') || tag.includes('fade')) mapped = 'fade'
    else if (filter.includes('fly') || filter.includes('wipe')) mapped = 'slide'
    else if (presetClass === 'entr' || presetClass === 'entrance') mapped = 'appear'

    const entry = {
      tag,
      presetId,
      presetClass: presetClass || null,
      filter: filter || null,
      mapped,
    }
    if (mapped) {
      animations.push(entry)
      fragmentHints.push(mapped)
    } else {
      unsupported.push({ ...entry, classification: 'unsupported-animation' })
    }
  }

  // Explicit timing tree presence without mapped nodes
  if (!animations.length && !unsupported.length && /<(?:[a-z0-9]+:)?timing\b/i.test(xml)) {
    unsupported.push({
      tag: 'timing',
      classification: 'unsupported-animation',
      message: 'Slide has timing tree but no recognized entrance presets',
    })
  }

  return {
    animations,
    unsupported,
    fragmentHints: [...new Set(fragmentHints)],
  }
}

/**
 * Classify macros/OLE/ActiveX as unsupported product features (T8.6).
 */
function classifyUnsupportedPackageFeatures(zipEntries = []) {
  const features = []
  for (const entry of zipEntries) {
    const e = String(entry).replace(/\\/g, '/')
    if (/vbaProject/i.test(e) || /\.bin$/i.test(e) && /vba/i.test(e)) {
      features.push({ type: 'unsupported-feature', feature: 'macros', entry: e })
    }
    if (/activeX/i.test(e) || /embeddings\/oleObject/i.test(e)) {
      features.push({
        type: 'unsupported-feature',
        feature: /activeX/i.test(e) ? 'activex' : 'ole',
        entry: e,
      })
    }
  }
  // dedupe by feature+entry
  const seen = new Set()
  return features.filter((f) => {
    const k = `${f.feature}:${f.entry}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

module.exports = {
  ENTRANCE_PRESET_MAP,
  parseSlideAnimations,
  classifyUnsupportedPackageFeatures,
}
