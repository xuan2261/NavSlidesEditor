function listZipEntries(zip) {
  return Object.keys(zip?.files || {})
    .map((entry) => entry.replace(/\\/g, '/'))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

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
  const match = String(relPath || '').match(/^(.*)\/_rels\/([^/]+)\.rels$/i)
  if (!match || !target || /^[a-z]+:/i.test(target)) return ''
  const sourceDir = match[1]
  return normalizeZipPath(target.startsWith('/') ? target.slice(1) : `${sourceDir}/${target}`)
}

function slideIndexFromRelPath(relPath) {
  const match = String(relPath || '').match(/^ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/i)
  return match ? Number(match[1]) - 1 : null
}

function parseRelationshipTargets(relXml, relPath) {
  const targets = []
  for (const tag of String(relXml || '').matchAll(/<Relationship\b[^>]*>/gi)) {
    const attrs = {}
    for (const attr of tag[0].matchAll(/([A-Za-z_:][\w:.-]*)=(["'])(.*?)\2/g)) {
      attrs[attr[1].toLowerCase()] = attr[3]
    }
    const target = resolveRelationshipTarget(relPath, attrs.target)
    if (target) targets.push(target)
  }
  return targets
}

async function readZipText(zip, entry) {
  const file = zip?.file?.(entry)
  if (!file) return ''
  try {
    return await file.async('string')
  } catch {
    return ''
  }
}

async function inspectOoxmlCoverage(zip) {
  const entries = listZipEntries(zip)
  const packageChartEntries = entries.filter((entry) => /^ppt\/charts\/chart\d+\.xml$/i.test(entry))
  const packageSmartArtEntries = entries.filter((entry) => /^ppt\/diagrams\/data\d+\.xml$/i.test(entry))
  const smartArtSupportEntries = entries.filter((entry) =>
    /^ppt\/diagrams\/(?:drawing|layout|colors|quickStyle)\d+\.xml$/i.test(entry)
  )
  const slideEvidence = []
  const slideRelEntries = entries.filter((entry) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/i.test(entry))

  for (const relEntry of slideRelEntries) {
    const slideIndex = slideIndexFromRelPath(relEntry)
    if (slideIndex == null) continue

    const chartEntries = new Set()
    const smartArtEntries = new Set()
    const targets = parseRelationshipTargets(await readZipText(zip, relEntry), relEntry)
    for (const target of targets) {
      if (/^ppt\/charts\/chart\d+\.xml$/i.test(target)) chartEntries.add(target)
      if (/^ppt\/diagrams\/data\d+\.xml$/i.test(target)) smartArtEntries.add(target)
    }

    if (chartEntries.size || smartArtEntries.size) {
      slideEvidence.push({
        slideIndex,
        chartEntries: [...chartEntries].sort((a, b) => a.localeCompare(b)),
        smartArtEntries: [...smartArtEntries].sort((a, b) => a.localeCompare(b)),
      })
    }
  }

  const chartEntries = slideEvidence.flatMap((slide) => slide.chartEntries)
  const smartArtEntries = slideEvidence.flatMap((slide) => slide.smartArtEntries)

  return {
    nativeChartCount: chartEntries.length,
    nativeSmartArtCount: smartArtEntries.length,
    chartEntries,
    smartArtEntries,
    packageChartEntries,
    packageSmartArtEntries,
    smartArtSupportEntries,
    slideEvidence,
    slidesByIndex: Object.fromEntries(slideEvidence.map((slide) => [slide.slideIndex, slide])),
    hasNativeCharts: chartEntries.length > 0,
    hasNativeSmartArt: smartArtEntries.length > 0,
  }
}

module.exports = {
  inspectOoxmlCoverage,
}
