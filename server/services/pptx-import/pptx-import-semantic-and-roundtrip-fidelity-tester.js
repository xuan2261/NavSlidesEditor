/**
 * pptx-import-semantic-and-roundtrip-fidelity-tester.js — Phase 7
 * Dual-metric fidelity testing for PPTX import:
 *   1. Semantic fidelity: pptxtojson → NavSlides (what we extract)
 *   2. Round-trip stability: NavSlides → PPTX → NavSlides (our data stability)
 */

const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const JSZip = require('jszip')
const pptxgen = require('pptxgenjs')
const { mapPptxOutput, sanitizeHtml } = require('./mapper')
const { UPLOADS_DIR } = require('../storage')

// ---------------------------------------------------------------------------
// Raw pptxtojson parsing (bypasses the full importer to get baseline)
// ---------------------------------------------------------------------------

async function parsePptxWithPptxtojson(filePath) {
  const { fork } = require('child_process')
  const { PARSER_TIMEOUT_MS } = require('./constants')
  const workerPath = path.join(__dirname, 'parse-worker.js')

  return new Promise((resolve) => {
    const child = fork(workerPath, [], { silent: true })
    let settled = false
    let timer = null

    const finish = (result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (!child.killed) child.kill('SIGTERM')
      resolve(result)
    }

    timer = setTimeout(() => {
      finish({ ok: false, error: { message: 'parsePptxWithPptxtojson timed out' } })
    }, PARSER_TIMEOUT_MS)

    child.on('message', (msg) => {
      if (settled) return
      finish(msg)
    })
    child.on('error', (err) => {
      if (!settled) finish({ ok: false, error: { message: String(err) } })
    })

    // Send the filePath so the worker knows what to parse
    child.send({ filePath })
  })
}

// ---------------------------------------------------------------------------
// Import presentation (full NavSlides pipeline)
// ---------------------------------------------------------------------------

async function importPresentation(filePath, uploadsDir) {
  const dir = uploadsDir || UPLOADS_DIR
  const zip = await JSZip.loadAsync(await fs.readFile(filePath), { checkCRC32: false })
  const parsed = await parsePptxWithPptxtojson(filePath)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, stats: {}, warnings: [], presentation: null }
  }
  const mapped = await mapPptxOutput({
    output: parsed.output,
    zip,
    originalName: path.basename(filePath),
    uploadsDir: dir,
  })
  return { ok: true, ...mapped }
}

// ---------------------------------------------------------------------------
// Minimal round-trip export: NavSlides JSON → PPTX → parser
// ---------------------------------------------------------------------------

function pptColor(value, fallback = 'FFFFFF') {
  const raw = String(value || '').trim()
  const hex = raw.match(/^#?([0-9a-f]{6})$/i)
  if (hex) return hex[1].toUpperCase()
  const rgb = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Math.max(0, Math.min(255, Number(part) || 0)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }
  return fallback
}

function stripHtml(html) {
  return sanitizeHtml(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function imageSource(src) {
  if (!src) return null
  if (String(src).startsWith('data:')) return { data: src }
  if (String(src).startsWith('/uploads/')) return { path: path.join(UPLOADS_DIR, path.basename(src)) }
  return { path: src }
}

function elementBounds(element, scaleX, scaleY) {
  return {
    x: ((element.x || 0) * scaleX),
    y: ((element.y || 0) * scaleY),
    w: ((element.width || 0) * scaleX),
    h: ((element.height || 0) * scaleY),
  }
}

async function exportPresentationForRoundTrip(presentation, filePath) {
  const pptx = new pptxgen()
  const resolution = { width: 960, height: 540 }
  const layout = { width: 10, height: 5.625 }
  const scaleX = layout.width / resolution.width
  const scaleY = layout.height / resolution.height

  pptx.defineLayout({ name: 'NAVSLIDES_ROUNDTRIP', width: layout.width, height: layout.height })
  pptx.layout = 'NAVSLIDES_ROUNDTRIP'
  pptx.title = presentation?.title || 'roundtrip'

  for (const sourceSlide of presentation?.slides || []) {
    const slide = pptx.addSlide()
    if (sourceSlide.background?.type === 'color') {
      slide.background = { color: pptColor(sourceSlide.background.color) }
    }

    const elements = [...(sourceSlide.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const element of elements) {
      const bounds = elementBounds(element, scaleX, scaleY)
      try {
        if (element.type === 'text') {
          slide.addText(stripHtml(element.content || ''), {
            ...bounds,
            color: pptColor(element.textColor, '111827'),
            fontSize: Math.max(6, Number(element.fontSize) || 14),
            margin: 0.04,
            fit: 'shrink',
          })
        } else if (element.type === 'image') {
          const source = imageSource(element.src)
          if (source) slide.addImage({ ...source, ...bounds })
        } else if (element.type === 'line') {
          slide.addShape('line', {
            x: bounds.x,
            y: bounds.y + bounds.h / 2,
            w: bounds.w,
            h: 0,
            line: {
              color: pptColor(element.stroke, '111827'),
              width: element.strokeWidth || 1,
            },
          })
        } else if (element.type === 'table') {
          const rows = (element.data || []).map((row) =>
            (row || []).map((cell) => ({
              text: String(cell || ''),
              options: { color: pptColor(element.textColor), fontSize: element.fontSize || 12 },
            }))
          )
          if (rows.length) slide.addTable(rows, bounds)
        } else if (element.type === 'shape') {
          slide.addShape(element.shape === 'circle' ? 'ellipse' : 'rect', {
            ...bounds,
            fill: { color: pptColor(element.fill, 'E5E7EB') },
            line: { color: pptColor(element.stroke, '111827'), width: element.strokeWidth || 0 },
          })
        }
      } catch (err) {
        slide.addText(`Round-trip export skipped ${element.type}: ${err.message}`, {
          ...bounds,
          color: 'B91C1C',
          fontSize: 8,
        })
      }
    }
  }

  await pptx.writeFile({ fileName: filePath })
}

async function exportViaProduction(presentation, filePath, options = {}) {
  const { baseUrl = process.env.NAVSLIDES_API_URL || '', strictRaster = true, allowFallback = false } = options
  const { exportToFile } = require('../../utils/server-export')
  return exportToFile(presentation, filePath, { baseUrl, strictRaster, allowFallback })
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

function shapeNameFromShapType(shapType = '') {
  const s = String(shapType || '').toLowerCase().replace(/[\s_-]/g, '')
  if (s.includes('ellipse') || s.includes('oval') || s.includes('circle')) return 'circle'
  if (s.includes('triangle') || s.includes('isoscelestriangle') || s.includes('righttriangle')) return 'triangle'
  if (s.includes('diamond') || s.includes('rhombus')) return 'diamond'
  if (s.includes('arrow')) return 'arrow-right'
  if (s === 'line' || (s.includes('line') && !s.includes('arrow') && !s.includes('connector') && !s.includes('straight'))) return 'line'
  if (s.includes('straightconnector') || (s.includes('straight') && s.includes('connector'))) return 'line'
  if (s.includes('round') || s.includes('roundedrect') || s.includes('rounded') || s.includes('corner')) return 'rounded-rect'
  if (/star/.test(s) && /\d/.test(s)) return 'star'
  if (s.includes('star4') || s.includes('star5') || s.includes('star6') || s.includes('star7') || s.includes('star8') || s.includes('star10') || s.includes('star12')) return 'star'
  if (s.includes('hexagon')) return 'hexagon'
  if (s.includes('pentagon')) return 'pentagon'
  if (s.includes('cloud')) return 'cloud'
  if (s.includes('cylinder') || s.includes('can')) return 'cylinder'
  if (s.includes('parallelogram')) return 'parallelogram'
  if (s.includes('trapezoid')) return 'trapezoid'
  if (s.includes('bracket') || s.includes('leftbrace') || s.includes('rightbrace') || s.includes('brace')) return 'bracket'
  return 'rect'
}

// ---------------------------------------------------------------------------
// Semantic fidelity: pptxtojson → NavSlides
// ---------------------------------------------------------------------------

function computeSemanticFidelity(pptxtojsonJSON, navslidesJSON) {
  const pptxSlides = (pptxtojsonJSON?.slides || []).map((s) => s.elements || [])
  const navSlides = (navslidesJSON?.slides || []).map((s) => s.elements || [])

  const categories = ['text', 'shape', 'image', 'table', 'chart', 'group', 'diagram', 'line', 'other']
  const categoryScores = {}
  const diffs = []

  for (const cat of categories) categoryScores[cat] = { total: 0, captured: 0 }

  for (let si = 0; si < Math.max(pptxSlides.length, navSlides.length); si++) {
    const pptsRaw = pptxSlides[si] || []
    const navs = navSlides[si] || []
    const usedNavIndices = new Set()

    const flattenRec = (el, cat) => {
      categoryScores[cat].total += 1
      for (const child of (el.elements || [])) {
        const childCat = mapCategory(child.type || (child.content ? 'text' : 'other'))
        flattenRec(child, childCat)
      }
    }

    for (const pptxEl of pptsRaw) {
      if (pptxEl.type === 'group') {
        const cat = mapCategory('group')
        flattenRec(pptxEl, cat)
        continue
      }
      const type = pptxEl.type || (pptxEl.content ? 'text' : 'other')
      const cat = mapCategory(type)
      categoryScores[cat].total += 1

      const navEl = findMatchingNavElement(pptxEl, navs, usedNavIndices)
      if (!navEl) {
        diffs.push({ slide: si, type: 'missing-nav', pptxType: type })
        continue
      }

      const captured = evaluateCapture(pptxEl, navEl)
      categoryScores[cat].captured += captured.score

      if (captured.gaps.length) {
        diffs.push({ slide: si, type: 'partial', pptxType: type, navType: navEl.type, gaps: captured.gaps })
      }
    }
  }

  const scores = {}
  let overallTotal = 0
  let overallCaptured = 0
  for (const [cat, { total, captured }] of Object.entries(categoryScores)) {
    scores[cat] = total > 0 ? Math.round((captured / total) * 100) / 100 : null
    if (total > 0) {
      overallTotal += total
      overallCaptured += captured
    }
  }
  const overall = overallTotal > 0 ? Math.round((overallCaptured / overallTotal) * 100) / 100 : null

  return { overall, scores, diffs, totalElements: overallTotal }
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function normalizeCountType(type) {
  const t = normalizeSemanticType(type)
  if (t === 'svg') return 'shape'
  if (t === 'textbox') return 'text'
  return mapCategory(t)
}

function computeDetailedFidelityMetrics(pptxtojsonJSON, navslidesJSON) {
  const pptxSlides = (pptxtojsonJSON?.slides || []).map((slide) => slide.elements || [])
  const navSlides = (navslidesJSON?.slides || []).map((slide) => slide.elements || [])
  const geometryDrifts = []
  const geometryByType = {}
  const coverageByType = {}
  const sourceByType = {}
  const navByType = {}
  let coverageTotal = 0
  let coverageCaptured = 0

  for (let si = 0; si < Math.max(pptxSlides.length, navSlides.length); si++) {
    const pptsRaw = pptxSlides[si] || []
    const navs = navSlides[si] || []
    const usedNavIndices = new Set()

    for (const navEl of navs) {
      const navType = normalizeCountType(navEl?.type || 'other')
      navByType[navType] = (navByType[navType] || 0) + 1
    }

    const ppts = []
    for (const el of pptsRaw) {
      if (el.type === 'group') {
        const recurse = (g) => {
          for (const c of (g.elements || [])) {
            if (c.type === 'group') recurse(c)
            else ppts.push(c)
          }
        }
        recurse(el)
      } else {
        ppts.push(el)
      }
    }

    for (const pptxEl of ppts) {
      const type = mapCategory(pptxEl.type || (pptxEl.content ? 'text' : 'other'))
      sourceByType[type] = (sourceByType[type] || 0) + 1
      if (!coverageByType[type]) coverageByType[type] = { captured: 0, total: 0 }

      const navEl = findMatchingNavElement(pptxEl, navs, usedNavIndices)
      if (!navEl) {
        coverageByType[type].total += 1
        coverageTotal += 1
        continue
      }

      const capture = evaluateCapture(pptxEl, navEl)
      coverageByType[type].captured += capture.score
      coverageByType[type].total += 1
      coverageCaptured += capture.score
      coverageTotal += 1

      const source = semanticBounds(pptxEl)
      const target = semanticBounds(navEl)
      const drift = Math.max(
        Math.abs(source.x - target.x),
        Math.abs(source.y - target.y),
        Math.abs(source.width - target.width),
        Math.abs(source.height - target.height)
      )
      geometryDrifts.push(drift)
      if (!geometryByType[type]) geometryByType[type] = []
      geometryByType[type].push(drift)
    }
  }

  const geometryDrift = {
    maxPx: geometryDrifts.length ? Math.max(...geometryDrifts) : 0,
    medianPx: median(geometryDrifts),
    byType: Object.fromEntries(
      Object.entries(geometryByType).map(([type, values]) => [
        type,
        {
          maxPx: values.length ? Math.max(...values) : 0,
          medianPx: median(values),
          count: values.length,
        },
      ])
    ),
  }

  const propertyCoverage = {
    overall: coverageTotal > 0 ? Math.round((coverageCaptured / coverageTotal) * 100) / 100 : 1,
    byType: Object.fromEntries(
      Object.entries(coverageByType).map(([type, stats]) => [
        type,
        stats.total > 0 ? Math.round((stats.captured / stats.total) * 100) / 100 : null,
      ])
    ),
  }

  return {
    geometryDrift,
    propertyCoverage,
    elementCount: {
      sourceByType,
      navByType,
    },
  }
}

function strictGeometryThreshold(type) {
  if (type === 'group') return 5
  if (['text', 'shape', 'line', 'image', 'table'].includes(type)) return 3
  return null
}

function applyStrictPerTypeGates(result) {
  const errors = []
  const name = String(result.file || '').toLowerCase()
  const isGeneratedFixture = name.includes('generated') || name.includes('fixture')
  if (!isGeneratedFixture) return errors

  for (const [type, stats] of Object.entries(result.geometryDrift?.byType || {})) {
    const threshold = strictGeometryThreshold(type)
    if (threshold == null) continue
    if (stats.maxPx > threshold) {
      errors.push(
        `Strict per-type geometry gate failed for ${type}: max drift ${stats.maxPx}px > ${threshold}px`
      )
    }
  }

  const coverage = result.propertyCoverage?.byType || {}
  for (const type of ['table', 'chart']) {
    const value = coverage[type]
    if (value != null && value < 0.8) {
      errors.push(`Strict per-type property gate failed for ${type}: coverage ${value} < 0.8`)
    }
  }

  return errors
}

function mapCategory(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'text' || t === 'textbox') return 'text'
  if (t === 'image') return 'image'
  if (t === 'table') return 'table'
  if (t === 'chart') return 'chart'
  if (t === 'group') return 'group'
  if (t === 'diagram') return 'diagram'
  if (t === 'line') return 'line'
  if (t === 'shape') return 'shape'
  return 'other'
}

function normalizeSemanticType(type) {
  const t = String(type || 'other').toLowerCase()
  if (t === 'textbox') return 'text'
  return t
}

function semanticBounds(element) {
  return {
    x: Number(element?.x ?? element?.left ?? 0) || 0,
    y: Number(element?.y ?? element?.top ?? 0) || 0,
    width: Number(element?.width ?? element?.w ?? 0) || 0,
    height: Number(element?.height ?? element?.h ?? 0) || 0,
  }
}

function semanticText(element) {
  return stripHtml(element?.content || '').toLowerCase()
}

function semanticTypePreferences(type) {
  switch (type) {
    case 'text':
      return ['text']
    case 'image':
      return ['image']
    case 'table':
      return ['table']
    case 'chart':
      return ['chart', 'svg', 'image']
    case 'line':
      return ['line', 'svg']
    case 'shape':
      return ['shape', 'svg', 'line']
    case 'diagram':
      return ['diagram', 'svg', 'image']
    default:
      return [type]
  }
}

function semanticCandidateScore(pptxEl, navEl) {
  const source = semanticBounds(pptxEl)
  const target = semanticBounds(navEl)
  const distance =
    Math.abs(source.x - target.x) +
    Math.abs(source.y - target.y) +
    Math.abs(source.width - target.width) +
    Math.abs(source.height - target.height)

  let score = 100 - distance / 25

  const sourceText = semanticText(pptxEl)
  const targetText = semanticText(navEl)
  if (sourceText && targetText) {
    if (sourceText === targetText) score += 20
    else if (sourceText.includes(targetText) || targetText.includes(sourceText)) score += 10
  }

  return score
}

function findMatchingNavElement(pptxEl, navEls, usedIndices = new Set()) {
  if (!navEls.length) return null
  const inferredType = normalizeSemanticType(pptxEl.type || (pptxEl.content ? 'text' : 'other'))
  const preferredTypes = semanticTypePreferences(inferredType)

  if (inferredType === 'group') {
    const groupIndex = navEls.findIndex(
      (element, index) =>
        !usedIndices.has(index) &&
        (normalizeSemanticType(element?.type) === 'group' || Boolean(element?.importPlaceholderType))
    )
    if (groupIndex >= 0) {
      usedIndices.add(groupIndex)
      return navEls[groupIndex]
    }
  }

  for (const preferredType of preferredTypes) {
    const candidates = navEls
      .map((element, index) => ({ element, index }))
      .filter(
        ({ element, index }) =>
          !usedIndices.has(index) && normalizeSemanticType(element?.type) === preferredType
      )

    if (!candidates.length) continue

    let best = candidates[0]
    let bestScore = semanticCandidateScore(pptxEl, best.element)
    for (const candidate of candidates.slice(1)) {
      const score = semanticCandidateScore(pptxEl, candidate.element)
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
    }

    usedIndices.add(best.index)
    return best.element
  }

  if (inferredType === 'group' || inferredType === 'other') {
    const fallbackIndex = navEls.findIndex((_, i) => !usedIndices.has(i))
    if (fallbackIndex >= 0) {
      usedIndices.add(fallbackIndex)
      return navEls[fallbackIndex]
    }
  }

  return null
}

function evaluateCapture(pptxEl, navEl) {
  const gaps = []
  const type = normalizeSemanticType(pptxEl.type || (pptxEl.content ? 'text' : 'other'))
  const navType = normalizeSemanticType(navEl?.type)

  if (type === 'text') {
    const hasContent = Boolean(navEl.content)
    const hasPosition = navEl.x != null && navEl.y != null
    const hasSize = navEl.width != null && navEl.height != null
    const score = (hasContent ? 0.4 : 0) + (hasPosition ? 0.2 : 0) + (hasSize ? 0.2 : 0) + 0.2
    if (!hasContent) gaps.push('missing-text-content')
    if (!hasPosition) gaps.push('missing-position')
    if (!hasSize) gaps.push('missing-size')
    return { score: Math.min(1, score), gaps }
  }

  if (type === 'image') {
    const score = navEl.src ? 1 : 0.1
    if (!navEl.src) gaps.push('missing-image-src')
    return { score, gaps }
  }

  if (type === 'table') {
    const hasData = Array.isArray(navEl.data) && navEl.data.length > 0
    const hasMergedCells = navEl.mergedCells && navEl.mergedCells.length > 0
    const hasCellStyles = navEl.cellStyles && Object.keys(navEl.cellStyles).length > 0
    const score = (hasData ? 0.8 : 0.1) + (hasMergedCells ? 0.1 : 0) + (hasCellStyles ? 0.1 : 0)
    if (!hasData) gaps.push('missing-table-data')
    if (!hasMergedCells) gaps.push('missing-merged-cells')
    if (!hasCellStyles) gaps.push('missing-cell-styles')
    return { score: Math.min(1, score), gaps }
  }

  if (type === 'chart') {
    const hasChartType = Boolean(navEl.chartType)
    const hasData = navEl.chartData && navEl.chartData.datasets && navEl.chartData.datasets.length > 0
    const score = (hasChartType ? 0.3 : 0) + (hasData ? 0.5 : 0) + 0.2
    if (!hasChartType) gaps.push('missing-chart-type')
    if (!hasData) gaps.push('missing-chart-data')
    return { score: Math.min(1, score), gaps }
  }

  if (type === 'shape' || type === 'diagram' || type === 'line' || type === 'other' || type === 'math') {
    if (navEl.importPlaceholderType === 'math') return { score: 0.8, gaps: ['math-rasterized'] }
    if (type === 'shape' && navType === 'svg') return { score: 1.0, gaps }
    if (type === 'diagram' && navType === 'svg') return { score: 0.9, gaps }
    if (type === 'line' && navType === 'svg') return { score: 0.9, gaps }

    const hasPosition = navEl.x != null && navEl.y != null
    const hasFill = navEl.fill != null
    const hasStroke = navEl.stroke !== undefined && navEl.stroke !== null
    const expectedShape = type === 'shape' ? shapeNameFromShapType(pptxEl.shapType) : null
    const shapeMatches = !expectedShape || navEl.type === 'line' || navEl.shape === expectedShape
    const score = (hasPosition ? 0.25 : 0) + (hasFill ? 0.2 : 0) + (hasStroke ? 0.2 : 0) + (shapeMatches ? 0.35 : 0)
    if (!hasPosition) gaps.push('missing-position')
    if (!hasFill) gaps.push('missing-fill')
    if (!hasStroke) gaps.push('missing-stroke')
    if (!shapeMatches) gaps.push(`shape-mismatch:${expectedShape}->${navEl.shape || navEl.type}`)
    return { score: Math.min(1, score), gaps }
  }

  gaps.push('unknown-type')
  return { score: 0.5, gaps }
}

// ---------------------------------------------------------------------------
// Round-trip stability (fingerprint-based matching)
// ---------------------------------------------------------------------------

const POSITION_BUCKET = 20
const SIZE_BUCKET = 10
const PROXIMITY_TOLERANCE = 20

function normalizeType(type) {
  return String(type || 'other').toLowerCase()
}

function isStableTypePair(sourceType, targetType) {
  const src = normalizeType(sourceType)
  const dst = normalizeType(targetType)
  if (src === dst) return true

  const allowed = {
    callout: new Set(['svg', 'image']),
    chart: new Set(['svg', 'image']),
    code: new Set(['svg', 'image']),
    drawing: new Set(['svg', 'image']),
    html: new Set(['svg', 'image']),
    icon: new Set(['svg', 'image']),
    latex: new Set(['svg', 'image']),
    line: new Set(['svg']),
    markdown: new Set(['svg', 'image']),
    qrcode: new Set(['svg', 'image']),
    shape: new Set(['svg']),
    svg: new Set(['image']),
    text: new Set(['svg', 'image']),
  }

  return allowed[src]?.has(dst) || false
}

function buildFingerprint(element) {
  const pos = [
    Math.round((element?.x || 0) / POSITION_BUCKET),
    Math.round((element?.y || 0) / POSITION_BUCKET),
  ]
  const size = [
    Math.round((element?.width || 0) / SIZE_BUCKET),
    Math.round((element?.height || 0) / SIZE_BUCKET),
  ]
  const parts = [normalizeType(element?.type), ...pos, ...size]

  if (normalizeType(element?.type) === 'text') {
    const text = stripHtml(element?.content || '').slice(0, 50).trim()
    parts.push(text)
  }

  return parts.join('|')
}

function isCloseWithinTolerance(source, target, tolerance = PROXIMITY_TOLERANCE) {
  return (
    Math.abs((source?.x || 0) - (target?.x || 0)) <= tolerance &&
    Math.abs((source?.y || 0) - (target?.y || 0)) <= tolerance &&
    Math.abs((source?.width || 0) - (target?.width || 0)) <= tolerance &&
    Math.abs((source?.height || 0) - (target?.height || 0)) <= tolerance
  )
}

function matchElements(sourceElements, roundTripElements) {
  const sources = (sourceElements || []).map((element, index) => ({
    element,
    index,
    fp: buildFingerprint(element),
  }))

  const targets = (roundTripElements || []).map((element, index) => ({
    element,
    index,
    fp: buildFingerprint(element),
    used: false,
  }))

  const matches = []

  for (const source of sources) {
    let target = targets.find((candidate) => !candidate.used && candidate.fp === source.fp)
    let method = target ? 'exact' : null

    if (!target) {
      target = targets.find(
        (candidate) =>
          !candidate.used &&
          isStableTypePair(source.element?.type, candidate.element?.type) &&
          isCloseWithinTolerance(source.element, candidate.element)
      )
      method = target ? 'proximity' : null
    }

    if (!target) {
      target = targets.find(
        (candidate) =>
          !candidate.used &&
          isStableTypePair(source.element?.type, candidate.element?.type)
      )
      method = target ? 'type-only' : null
    }

    if (target) {
      if (method === 'exact' || method === 'proximity') {
        target.used = true
      }
      matches.push({
        source: source.element,
        sourceIndex: source.index,
        roundTrip: target.element,
        roundTripIndex: target.index,
        method,
        stable: method === 'exact' || method === 'proximity',
      })
    } else {
      matches.push({
        source: source.element,
        sourceIndex: source.index,
        roundTrip: null,
        roundTripIndex: -1,
        method: 'unmatched',
        stable: false,
      })
    }
  }

  return {
    matches,
    unmatchedTargets: targets
      .filter((candidate) => !candidate.used)
      .map((candidate) => ({ element: candidate.element, index: candidate.index })),
  }
}

async function computeRoundTripStability(navslidesJSON, reimportedJSON) {
  if (!reimportedJSON) {
    return {
      available: false,
      reason: 'round-trip reimport data was not provided',
      overall: null,
      scores: {},
      diffs: [],
      byType: {},
      slideBreakdown: [],
    }
  }

  const diffs = []
  const byType = {}
  const slideBreakdown = []
  const sourceSlides = navslidesJSON?.slides || []
  const roundTripSlides = reimportedJSON?.slides || []
  const slideTotal = Math.max(sourceSlides.length, roundTripSlides.length)

  let stableMatched = 0
  let partialMatched = 0
  let totalSource = 0
  let extraUnmatchedTargets = 0

  for (let slideIndex = 0; slideIndex < slideTotal; slideIndex++) {
    const sourceElements = sourceSlides[slideIndex]?.elements || []
    const roundTripElements = roundTripSlides[slideIndex]?.elements || []
    const { matches, unmatchedTargets } = matchElements(sourceElements, roundTripElements)

    const slideSummary = {
      slide: slideIndex,
      sourceTotal: sourceElements.length,
      roundTripTotal: roundTripElements.length,
      stable: 0,
      partial: 0,
      unmatched: 0,
    }

    totalSource += sourceElements.length

    for (const match of matches) {
      const type = String(match.source?.type || 'other')
      if (!byType[type]) byType[type] = { total: 0, stable: 0, partial: 0, unmatched: 0 }
      byType[type].total += 1

      if (match.method === 'exact' || match.method === 'proximity') {
        stableMatched += 1
        slideSummary.stable += 1
        byType[type].stable += 1
      } else if (match.method === 'type-only') {
        partialMatched += 1
        slideSummary.partial += 1
        byType[type].partial += 1
        diffs.push({
          slide: slideIndex,
          type: 'element-drift',
          sourceIndex: match.sourceIndex,
          roundTripIndex: match.roundTripIndex,
          method: match.method,
        })
      } else {
        slideSummary.unmatched += 1
        byType[type].unmatched += 1
        diffs.push({
          slide: slideIndex,
          type: 'source-unmatched',
          sourceIndex: match.sourceIndex,
          method: match.method,
        })
      }
    }

    for (const unmatched of unmatchedTargets) {
      extraUnmatchedTargets += 1
      diffs.push({
        slide: slideIndex,
        type: 'roundtrip-unmatched',
        roundTripIndex: unmatched.index,
        roundTripType: unmatched.element?.type || 'other',
      })
    }

    slideBreakdown.push(slideSummary)
  }

  const denominator = totalSource + extraUnmatchedTargets
  const overall = denominator > 0 ? Math.round((stableMatched / denominator) * 100) / 100 : 1

  return {
    available: true,
    reason: null,
    overall,
    scores: { structure: overall },
    diffs,
    byType,
    slideBreakdown,
    stableMatched,
    partialMatched,
    totalSource,
    extraUnmatchedTargets,
  }
}

// ---------------------------------------------------------------------------
// Test a single corpus file
// ---------------------------------------------------------------------------

async function testCorpusFile(filePath, options = {}) {
  const {
    skipRoundTrip = true,
    allowFallback = false,
    strict = false,
    baseUrl = process.env.NAVSLIDES_API_URL || '',
  } = options
  const effectiveSkipRoundTrip = strict ? false : skipRoundTrip
  const fileName = path.basename(filePath)
  const started = Date.now()

  const result = {
    file: fileName,
    path: filePath,
    durationMs: 0,
    semantic: null,
    geometryDrift: null,
    propertyCoverage: null,
    elementCount: null,
    roundTrip: null,
    errors: [],
    warnings: [],
    stats: null,
    semanticFidelity: null,
    roundTripExportMethod: null,
  }

  try {
    const parsed = await parsePptxWithPptxtojson(filePath)
    if (!parsed.ok) {
      result.errors.push(`parse failed: ${parsed.error?.message}`)
      return result
    }

    const imported = await importPresentation(filePath)
    if (!imported.ok) {
      result.errors.push(`import failed: ${imported.error?.message}`)
      return result
    }

    result.warnings = imported.warnings || []
    result.stats = imported.stats || {}

    result.semantic = computeSemanticFidelity(parsed.output, imported.presentation)
    const detail = computeDetailedFidelityMetrics(parsed.output, imported.presentation)
    result.geometryDrift = detail.geometryDrift
    result.propertyCoverage = detail.propertyCoverage
    result.elementCount = detail.elementCount
    result.semanticFidelity = result.semantic.overall

    if (!effectiveSkipRoundTrip) {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-roundtrip-'))
      try {
        const roundTripPath = path.join(tempDir, `${path.basename(filePath, '.pptx')}-roundtrip.pptx`)
        const roundTripUploads = path.join(tempDir, 'uploads')
        await fs.ensureDir(roundTripUploads)
        let exportMethod = 'production'

        try {
          await exportViaProduction(imported.presentation, roundTripPath, {
            baseUrl,
            strictRaster: true,
            allowFallback: false,
          })
        } catch (error) {
          if (strict || !allowFallback) throw error
          exportMethod = 'minimal'
          await exportPresentationForRoundTrip(imported.presentation, roundTripPath)
          result.warnings.push(`Production export failed, fallback to minimal: ${error.message}`)
        }

        result.roundTripExportMethod = exportMethod
        if (strict && exportMethod !== 'production') {
          throw new Error('Production export required in strict mode')
        }

        const reimported = await importPresentation(roundTripPath, roundTripUploads)
        if (!reimported.ok) {
          result.roundTrip = { available: false, reason: `round-trip import failed: ${reimported.error?.message}` }
        } else {
          result.roundTrip = await computeRoundTripStability(imported.presentation, reimported.presentation)
        }
      } catch (err) {
        result.roundTrip = { available: false, reason: String(err.message) }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    }
  } catch (err) {
    result.errors.push(String(err.message))
  }

  result.durationMs = Date.now() - started
  return result
}

// ---------------------------------------------------------------------------
// Run full corpus
// ---------------------------------------------------------------------------

async function runCorpusTests(corpusDir, options = {}) {
  const {
    skipRoundTrip = true,
    allowFallback = false,
    strict = false,
    baseUrl = process.env.NAVSLIDES_API_URL || '',
  } = options
  const effectiveSkipRoundTrip = strict ? false : skipRoundTrip
  const effectiveCorpusDir = await resolveCorpusDir(corpusDir)
  const results = []
  let totalFiles = 0
  let passedFiles = 0
  let semanticTotal = 0
  let semanticCount = 0
  let roundTripTotal = 0
  let roundTripCount = 0

  const entries = await fs.readdir(effectiveCorpusDir)
  const pptxFiles = entries.filter((f) => f.toLowerCase().endsWith('.pptx'))

  for (const file of pptxFiles) {
    totalFiles++
    const filePath = path.join(effectiveCorpusDir, file)
    const stat = await fs.stat(filePath)
    const testResult = await testCorpusFile(filePath, {
      skipRoundTrip: effectiveSkipRoundTrip,
      allowFallback,
      strict,
      baseUrl,
    })
    testResult.fileSizeBytes = stat.size

    if (!effectiveSkipRoundTrip && !testResult.roundTrip?.available) {
      testResult.errors.push(`Round-trip unavailable: ${testResult.roundTrip?.reason || 'missing'}`)
    }

    if (strict) {
      if (testResult.roundTripExportMethod !== 'production') {
        testResult.errors.push('Strict mode requires production export method')
      }
      if (!testResult.roundTrip?.available) {
        testResult.errors.push(`Strict mode requires round-trip result: ${testResult.roundTrip?.reason || 'missing'}`)
      }
      testResult.errors.push(...applyStrictPerTypeGates(testResult))
    }

    results.push(testResult)

    if (testResult.errors.length === 0 && testResult.semanticFidelity != null) {
      passedFiles++
      semanticTotal += testResult.semanticFidelity
      semanticCount++
      if (!effectiveSkipRoundTrip && testResult.roundTrip?.available && testResult.roundTrip.overall != null) {
        roundTripTotal += testResult.roundTrip.overall
        roundTripCount++
      }
    }
  }

  const avgSemantic = semanticCount > 0 ? Math.round((semanticTotal / semanticCount) * 100) / 100 : null
  const avgRoundTrip = roundTripCount > 0 ? Math.round((roundTripTotal / roundTripCount) * 100) / 100 : null

  const summary = {
    corpusDir: effectiveCorpusDir,
    totalFiles,
    passedFiles,
    failedFiles: totalFiles - passedFiles,
    avgSemanticFidelity: avgSemantic,
    avgRoundTripStability: avgRoundTrip,
    strict,
    runAt: new Date().toISOString(),
  }

  return { results, summary }
}

async function resolveCorpusDir(corpusDir) {
  const entries = await fs.readdir(corpusDir)
  if (entries.some((file) => file.toLowerCase().endsWith('.pptx'))) return corpusDir

  const fallback = path.resolve(__dirname, '..', '..', '..', 'PPTX')
  try {
    const fallbackEntries = await fs.readdir(fallback)
    if (fallbackEntries.some((file) => file.toLowerCase().endsWith('.pptx'))) return fallback
  } catch {
    // Keep the requested corpus directory; the report will show zero files.
  }

  return corpusDir
}

// ---------------------------------------------------------------------------
// CLI reporter
// ---------------------------------------------------------------------------

function reportResults({ results, summary }) {
  const lines = []
  lines.push(`\n=== PPTX Fidelity Test Report ===`)
  lines.push(`Corpus: ${summary.corpusDir}`)
  lines.push(`Run: ${summary.runAt}`)
  lines.push(`Files: ${summary.totalFiles} total, ${summary.passedFiles} passed, ${summary.failedFiles} failed`)
  lines.push(`Avg Semantic Fidelity: ${summary.avgSemanticFidelity != null ? (summary.avgSemanticFidelity * 100).toFixed(1) + '%' : 'N/A'}`)
  lines.push(`Avg Round-trip Stability: ${summary.avgRoundTripStability != null ? (summary.avgRoundTripStability * 100).toFixed(1) + '%' : 'N/A'}`)
  lines.push('')

  for (const r of results) {
    lines.push(`--- ${r.file} (${r.fileSizeBytes} bytes, ${r.durationMs}ms) ---`)
    if (r.errors.length > 0) {
      lines.push(`  ERROR: ${r.errors.join('; ')}`)
    } else {
      const fidelity = r.semanticFidelity != null ? (r.semanticFidelity * 100).toFixed(1) + '%' : 'N/A'
      lines.push(`  Semantic Fidelity: ${fidelity}`)
      if (r.geometryDrift) {
        lines.push(
          `  Geometry Drift: max ${Number(r.geometryDrift.maxPx).toFixed(1)}px, median ${Number(
            r.geometryDrift.medianPx
          ).toFixed(1)}px`
        )
        lines.push('  Geometry per-type breakdown:')
        for (const [type, drift] of Object.entries(r.geometryDrift.byType || {})) {
          lines.push(
            `    ${type}: max ${Number(drift.maxPx).toFixed(1)}px, median ${Number(drift.medianPx).toFixed(1)}px, count ${drift.count}`
          )
        }
      }
      if (r.propertyCoverage) {
        const overall = r.propertyCoverage.overall != null ? `${(r.propertyCoverage.overall * 100).toFixed(1)}%` : 'N/A'
        lines.push(`  Property Coverage: ${overall}`)
        lines.push('  Property per-type breakdown:')
        for (const [type, value] of Object.entries(r.propertyCoverage.byType || {})) {
          const percent = value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`
          lines.push(`    ${type}: ${percent}`)
        }
      }
      if (r.elementCount?.sourceByType || r.elementCount?.navByType) {
        lines.push('  Element counts (source -> nav):')
        const types = new Set([
          ...Object.keys(r.elementCount?.sourceByType || {}),
          ...Object.keys(r.elementCount?.navByType || {}),
        ])
        for (const type of [...types].sort()) {
          const src = r.elementCount?.sourceByType?.[type] || 0
          const nav = r.elementCount?.navByType?.[type] || 0
          lines.push(`    ${type}: ${src} -> ${nav}`)
        }
      }
      if (r.semantic?.scores) {
        for (const [cat, score] of Object.entries(r.semantic.scores)) {
          if (score != null) lines.push(`    ${cat}: ${(score * 100).toFixed(0)}%`)
        }
      }
      if (r.roundTrip) {
        if (r.roundTrip.available) {
          lines.push(`  Round-trip Stability: ${(r.roundTrip.overall * 100).toFixed(1)}%`)
          if (r.roundTrip.byType) {
            lines.push('  Round-trip per-type breakdown:')
            for (const [type, stats] of Object.entries(r.roundTrip.byType)) {
              lines.push(
                `    ${type}: stable ${stats.stable}/${stats.total}, partial ${stats.partial}, unmatched ${stats.unmatched}`
              )
            }
          }
        } else {
          lines.push(`  Round-trip Stability: unavailable (${r.roundTrip.reason || 'no reason provided'})`)
        }
        lines.push(`  Export Method: ${r.roundTripExportMethod || 'N/A'}`)
      }
      if (r.warnings && r.warnings.length > 0) {
        lines.push(`  Warnings: ${r.warnings.length}`)
      }
    }
    lines.push('')
  }

  console.log(lines.join('\n'))
  return { text: lines.join('\n') }
}

module.exports = {
  buildFingerprint,
  parsePptxWithPptxtojson,
  importPresentation,
  matchElements,
  computeSemanticFidelity,
  computeDetailedFidelityMetrics,
  computeRoundTripStability,
  applyStrictPerTypeGates,
  testCorpusFile,
  runCorpusTests,
  reportResults,
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const DEFAULT_CORPUS = path.join(__dirname, '..', '..', 'data', 'test-corpus')
  const args = process.argv.slice(2)
  const corpusDir = args.find((arg) => !arg.startsWith('--')) || DEFAULT_CORPUS
  const roundTripRequested = args.includes('--roundtrip')
  const allowFallback = args.includes('--allow-fallback')
  const strict = args.includes('--strict')
  const skipRoundTrip = strict ? false : !roundTripRequested

  if (strict && !roundTripRequested) {
    console.warn('Strict mode implies --roundtrip; enabling round-trip validation automatically.')
  }

  fs.access(corpusDir).then(() => {
    return runCorpusTests(corpusDir, { skipRoundTrip, allowFallback, strict })
  }).then(({ results, summary }) => {
    reportResults({ results, summary })
    if (summary.failedFiles > 0) process.exit(1)

    if (strict && !skipRoundTrip) {
      if (summary.avgSemanticFidelity == null || summary.avgSemanticFidelity < 0.95) {
        console.error('Strict mode failed: average semantic fidelity is below 95%')
        process.exit(1)
      }
      if (summary.avgRoundTripStability == null || summary.avgRoundTripStability < 0.98) {
        console.error('Strict mode failed: average round-trip stability is below 98%')
        process.exit(1)
      }
      const nonProduction = results.filter((result) => result.roundTripExportMethod !== 'production')
      if (nonProduction.length > 0) {
        console.error('Strict mode failed: non-production export method detected')
        process.exit(1)
      }
    }
  }).catch((err) => {
    console.error(`Error running corpus tests: ${err.message}`)
    process.exit(1)
  })
}
