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
const { assertPresentationAcceptance } = require('./acceptance-criteria')
const { fitBoxWithinBounds, identityMatrix, mapBoxByMatrix, multiply, readCoord, readNumber, rotateAround, scaleAround, translate } = require('./geometry')
const { UPLOADS_DIR } = require('../storage')

const DEFAULT_CORPUS = path.join(__dirname, '..', '..', 'data', 'test-corpus')
const FALLBACK_CORPUS = path.resolve(__dirname, '..', '..', '..', 'PPTX')
const DEFAULT_PER_DECK_MIN_SEMANTIC = 0.95
const DEFAULT_MAX_CLASS_DROP = 0.15
const STRICT_AVG_MIN_SEMANTIC = 0.98
const STRICT_AVG_MIN_ROUND_TRIP = 0.5
const STRICT_MIN_CORPUS_FILES = 10
const STRICT_CLASS_DROP_TYPES = ['image', 'shape', 'table', 'text', 'chart', 'group', 'diagram', 'line', 'other']
const formatStrictPercent = (value) => `${(value * 100).toFixed(Number.isInteger(value * 100) ? 0 : 1)}%`
const STRICT_CORPUS_GATES = Object.freeze({
  minCorpusFiles: STRICT_MIN_CORPUS_FILES,
  avgSemanticFidelity: {
    min: STRICT_AVG_MIN_SEMANTIC,
    label: formatStrictPercent(STRICT_AVG_MIN_SEMANTIC),
  },
  avgRoundTripStability: {
    min: STRICT_AVG_MIN_ROUND_TRIP,
    label: formatStrictPercent(STRICT_AVG_MIN_ROUND_TRIP),
  },
  perDeckSemantic: {
    min: DEFAULT_PER_DECK_MIN_SEMANTIC,
    label: formatStrictPercent(DEFAULT_PER_DECK_MIN_SEMANTIC),
  },
  maxClassDrop: {
    max: DEFAULT_MAX_CLASS_DROP,
    label: formatStrictPercent(DEFAULT_MAX_CLASS_DROP),
  },
  classDropTypes: STRICT_CLASS_DROP_TYPES,
})

// ---------------------------------------------------------------------------
// Raw pptxtojson parsing (bypasses the full importer to get baseline)
// ---------------------------------------------------------------------------

async function parsePptxWithPptxtojson(filePath) {
  const { runParserWorker } = require('./worker-runner')
  return runParserWorker(filePath)
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

    const ppts = []
    const flattenSource = (el) => {
      if (el?.type === 'group' && Array.isArray(el.elements) && el.elements.length > 0) {
        for (const child of el.elements) flattenSource(child)
        return
      }
      ppts.push(el)
    }
    for (const el of pptsRaw) flattenSource(el)

    for (const pptxEl of ppts) {
      const type = sourceSemanticType(pptxEl)
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

function buildSourceGroupMatrix(group, parentMatrix = identityMatrix()) {
  const left = readCoord(group?.left, group?.x, 0)
  const top = readCoord(group?.top, group?.y, 0)
  const width = Math.max(1, readNumber(group?.width, 80, 0))
  const height = Math.max(1, readNumber(group?.height, 40, 0))
  const cx = left + width / 2
  const cy = top + height / 2

  let matrix = translate(left, top)
  const rotation = readNumber(group?.rotate, 0)
  if (rotation !== 0) matrix = multiply(rotateAround(rotation, cx, cy), matrix)
  if (group?.isFlipH) matrix = multiply(scaleAround(-1, 1, cx, cy), matrix)
  if (group?.isFlipV) matrix = multiply(scaleAround(1, -1, cx, cy), matrix)

  return multiply(parentMatrix, matrix)
}

function transformSourceChild(child, matrix) {
  const box = {
    x: readCoord(child?.left, child?.x, 0),
    y: readCoord(child?.top, child?.y, 0),
    width: Math.max(1, readNumber(child?.width, 80, 0)),
    height: Math.max(1, readNumber(child?.height, 40, 0)),
  }
  const mappedBox = mapBoxByMatrix(box, matrix)
  return {
    ...child,
    left: mappedBox.x,
    top: mappedBox.y,
    width: mappedBox.width,
    height: mappedBox.height,
  }
}

function sourceToNavScale(source, nav) {
  const sourceWidth = Number(source?.size?.width)
  const sourceHeight = Number(source?.size?.height)
  const navWidth = Number(nav?.resolution?.width)
  const navHeight = Number(nav?.resolution?.height)
  return {
    x:
      Number.isFinite(sourceWidth) && sourceWidth > 0 && Number.isFinite(navWidth) && navWidth > 0
        ? navWidth / sourceWidth
        : 1,
    y:
      Number.isFinite(sourceHeight) && sourceHeight > 0 && Number.isFinite(navHeight) && navHeight > 0
        ? navHeight / sourceHeight
        : 1,
  }
}

function normalizeSourceElementGeometry(element, scale) {
  const bounds = semanticBounds(element)
  const scaled = {
    x: bounds.x * scale.x,
    y: bounds.y * scale.y,
    width: bounds.width * scale.x,
    height: bounds.height * scale.y,
  }
  const type = sourceSemanticType(element)
  const expected = type === 'image' || type === 'text' ? fitBoxWithinBounds(scaled) : scaled
  return {
    ...element,
    left: expected.x,
    top: expected.y,
    x: expected.x,
    y: expected.y,
    width: expected.width,
    height: expected.height,
  }
}

function globallyMatchSourceEntries(sourceEntries, navElements) {
  const candidates = []
  for (const [sourceIndex, entry] of sourceEntries.entries()) {
    const preferred = semanticTypePreferences(sourceSemanticType(entry.element))
    for (const [navIndex, nav] of navElements.entries()) {
      if (!preferred.includes(normalizeSemanticType(nav?.type))) continue
      candidates.push({
        sourceIndex,
        navIndex,
        score: semanticCandidateScore(entry.element, nav),
      })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  const usedSources = new Set()
  const usedNavs = new Set()
  const matches = new Map()
  for (const candidate of candidates) {
    if (usedSources.has(candidate.sourceIndex) || usedNavs.has(candidate.navIndex)) continue
    usedSources.add(candidate.sourceIndex)
    usedNavs.add(candidate.navIndex)
    matches.set(candidate.sourceIndex, navElements[candidate.navIndex])
  }
  return matches
}

function computeDetailedFidelityMetrics(pptxtojsonJSON, navslidesJSON) {
  const pptxSlides = (pptxtojsonJSON?.slides || []).map((slide) => slide.elements || [])
  const navSlides = (navslidesJSON?.slides || []).map((slide) => slide.elements || [])
  const geometryDrifts = []
  const geometryByType = {}
  const shapeDriftDetails = []
  const coverageByType = {}
  const sourceByType = {}
  const navByType = {}
  let coverageTotal = 0
  let coverageCaptured = 0
  const sourceScale = sourceToNavScale(pptxtojsonJSON, navslidesJSON)

  for (let si = 0; si < Math.max(pptxSlides.length, navSlides.length); si++) {
    const pptsRaw = pptxSlides[si] || []
    const navs = navSlides[si] || []

    for (const navEl of navs) {
      // An unsupported-image placeholder still represents the source image (the
      // element is reclassified to a shape, not dropped), so count it toward the
      // image class. Genuinely dropped images produce no nav element and still
      // register as a class drop; image→generic-shape bugs lack this marker.
      const navType = navEl?.importPlaceholderType === 'unsupported-image'
        ? 'image'
        : normalizeCountType(navEl?.type || 'other')
      navByType[navType] = (navByType[navType] || 0) + 1
    }

    const ppts = []
    for (let sourceIndex = 0; sourceIndex < pptsRaw.length; sourceIndex++) {
      const el = pptsRaw[sourceIndex]
      if (el.type === 'group') {
        const recurse = (g, pathParts, parentMatrix = identityMatrix()) => {
          const groupMatrix = buildSourceGroupMatrix(g, parentMatrix)
          const children = g.elements || []
          for (let childIndex = 0; childIndex < children.length; childIndex++) {
            const c = children[childIndex]
            const childPath = [...pathParts, childIndex]
            if (c.type === 'group') recurse(c, childPath, groupMatrix)
            else ppts.push({
              element: normalizeSourceElementGeometry(
                transformSourceChild(c, groupMatrix),
                sourceScale
              ),
              sourceIndex,
              sourcePath: childPath.join('.'),
            })
          }
        }
        recurse(el, [sourceIndex])
      } else {
        ppts.push({
          element: normalizeSourceElementGeometry(el, sourceScale),
          sourceIndex,
          sourcePath: String(sourceIndex),
        })
      }
    }

    const matchedNavs = globallyMatchSourceEntries(ppts, navs)
    for (let flattenedIndex = 0; flattenedIndex < ppts.length; flattenedIndex++) {
      const pptxEntry = ppts[flattenedIndex]
      const pptxEl = pptxEntry.element
      const type = mapCategory(sourceSemanticType(pptxEl))
      sourceByType[type] = (sourceByType[type] || 0) + 1
      if (!coverageByType[type]) coverageByType[type] = { captured: 0, total: 0 }

      const navEl = matchedNavs.get(flattenedIndex)
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
      if (type === 'shape') {
        shapeDriftDetails.push({
          slideIdx: si,
          sourceIdx: pptxEntry.sourceIndex,
          flattenedIdx: flattenedIndex,
          sourcePath: pptxEntry.sourcePath,
          kind: pptxEl.shapType || pptxEl.shape || pptxEl.type || 'shape',
          origin: source,
          mapped: target,
          deltaPx: {
            x: Math.round((target.x - source.x) * 100) / 100,
            y: Math.round((target.y - source.y) * 100) / 100,
            width: Math.round((target.width - source.width) * 100) / 100,
            height: Math.round((target.height - source.height) * 100) / 100,
            max: Math.round(drift * 100) / 100,
          },
        })
      }
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
    shapeDriftDetails,
  }
}

function strictGeometryThreshold(type) {
  if (type === 'group') return 5
  if (['text', 'shape', 'line', 'image', 'table'].includes(type)) return 3
  return null
}

function applyStrictPerTypeGates(result, options = {}) {
  const {
    perDeckMin = STRICT_CORPUS_GATES.perDeckSemantic.min,
    maxClassDrop = STRICT_CORPUS_GATES.maxClassDrop.max,
    excludeClassDrop = [],
  } = options
  const errors = []
  const semantic = Number(result.semanticFidelity)
  if (Number.isFinite(semantic) && semantic < perDeckMin) {
    errors.push(
      `Strict semantic gate failed for ${result.file}: ${(semantic * 100).toFixed(1)}% < ${(perDeckMin * 100).toFixed(1)}%`
    )
  }

  const excluded = new Set(excludeClassDrop.map((type) => String(type).toLowerCase()))
  const sourceByType = result.elementCount?.sourceByType || {}
  const navByType = result.elementCount?.navByType || {}
  for (const type of STRICT_CORPUS_GATES.classDropTypes) {
    if (excluded.has(type)) continue
    const sourceCount = sourceByType[type] || 0
    if (sourceCount <= 0) continue
    const navCount = navByType[type] || 0
    const drop = Math.max(0, sourceCount - navCount) / sourceCount
    if (drop > maxClassDrop) {
      errors.push(
        `Strict element-count gate failed for ${type}: drop ${(drop * 100).toFixed(1)}% > ${(maxClassDrop * 100).toFixed(1)}%`
      )
    }
  }

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
  if (t === 'math' || t === 'latex') return 'other'
  return 'other'
}

function normalizeSemanticType(type) {
  const t = String(type || 'other').toLowerCase()
  if (t === 'textbox') return 'text'
  return t
}

function sourceSemanticType(element) {
  const type = normalizeSemanticType(element?.type || (element?.content ? 'text' : 'other'))
  if (type === 'shape' && shapeNameFromShapType(element?.shapType) === 'line') return 'line'
  return type
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
    case 'math':
    case 'latex':
      return ['latex', 'image', 'svg']
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
  const inferredType = sourceSemanticType(pptxEl)
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
  const type = sourceSemanticType(pptxEl)
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
    const sourceCells = (pptxEl.data || []).flatMap((row) => row || [])
    const expectsMergedCells = sourceCells.some((cell) => cell?.rowSpan > 1 || cell?.colSpan > 1)
    const hasMergedCells = navEl.mergedCells && navEl.mergedCells.length > 0
    const hasCellStyles = navEl.cellStyles && Object.keys(navEl.cellStyles).length > 0
    const hasBorders = Boolean(navEl.cellStyles?.borders?.length)
    const expectsCellFonts = sourceCells.some((cell) =>
      cell?.fontSize != null || cell?.fontSz != null || cell?.fontFace || cell?.fontFamily || cell?.fontName
    )
    const hasCellFonts =
      !expectsCellFonts ||
      Boolean(navEl.cellStyles?.fontSizes?.length || navEl.cellStyles?.fontFamilies?.length)
    const hasExpectedMerges = !expectsMergedCells || hasMergedCells
    const score =
      (hasData ? 0.65 : 0.1) +
      (hasExpectedMerges ? 0.1 : 0) +
      (hasCellStyles ? 0.1 : 0) +
      (hasBorders ? 0.05 : 0) +
      (hasCellFonts ? 0.1 : 0)
    if (!hasData) gaps.push('missing-table-data')
    if (!hasExpectedMerges) gaps.push('missing-merged-cells')
    if (!hasCellStyles) gaps.push('missing-cell-styles')
    if (!hasBorders) gaps.push('missing-cell-borders')
    if (!hasCellFonts) gaps.push('missing-cell-fonts')
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

  if (type === 'math' || type === 'latex' || (type === 'other' && (pptxEl.latex || navEl.latex))) {
    if (navEl.importPlaceholderType === 'math') return { score: 0.8, gaps: ['math-rasterized'] }
    if (navType === 'image' || navType === 'svg') return { score: 0.8, gaps: ['math-rasterized'] }

    const hasLatex = Boolean(navEl.latex || navEl.content)
    const hasPosition = navEl.x != null && navEl.y != null
    const hasFontSize = navEl.fontSize != null || pptxEl.fontSize == null
    const score = (hasLatex ? 0.5 : 0) + (hasPosition ? 0.25 : 0) + (hasFontSize ? 0.25 : 0)
    if (!hasLatex) gaps.push('missing-latex')
    if (!hasPosition) gaps.push('missing-position')
    if (!hasFontSize) gaps.push('missing-font-size')
    return { score: Math.min(1, score), gaps }
  }

  if (type === 'group') {
    const hasChildren = Array.isArray(navEl.children) ? navEl.children.length > 0 : true
    const hasPosition = navEl.x != null && navEl.y != null
    const hasSize = navEl.width != null && navEl.height != null
    const score = (hasChildren ? 0.4 : 0) + (hasPosition ? 0.3 : 0) + (hasSize ? 0.3 : 0)
    if (!hasChildren) gaps.push('missing-group-children')
    if (!hasPosition) gaps.push('missing-position')
    if (!hasSize) gaps.push('missing-size')
    return { score: Math.min(1, score), gaps }
  }

  if (type === 'line') {
    if (navType === 'svg') return { score: 0.9, gaps }
    const hasPosition = navEl.x != null && navEl.y != null
    const hasSize = navEl.width != null && navEl.height != null
    const hasStroke = navEl.stroke !== undefined && navEl.stroke !== null
    const score = (hasPosition ? 0.4 : 0) + (hasSize ? 0.2 : 0) + (hasStroke ? 0.4 : 0)
    if (!hasPosition) gaps.push('missing-position')
    if (!hasSize) gaps.push('missing-size')
    if (!hasStroke) gaps.push('missing-stroke')
    return { score: Math.min(1, score), gaps }
  }

  if (type === 'shape' || type === 'diagram' || type === 'other') {
    if (navEl.importPlaceholderType === 'math') return { score: 0.8, gaps: ['math-rasterized'] }
    if (type === 'shape' && navType === 'svg') return { score: 1.0, gaps }
    if (type === 'diagram' && navType === 'svg') return { score: 0.9, gaps }

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

function normalizeTextForRoundTrip(text) {
  return stripHtml(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRoundTripText(element) {
  return normalizeTextForRoundTrip(element?.content || element?.textHtml || element?.text || '')
}

function isTextBoxShape(element) {
  const type = normalizeType(element?.type)
  const shape = normalizeType(element?.shape || element?.shapType)
  return type === 'shape' && (!shape || shape === 'rect' || shape === 'rectangle') && Boolean(getRoundTripText(element))
}

function roundTripMatchType(element) {
  if (isTextBoxShape(element)) return 'text'
  return normalizeType(element?.type)
}

function isStableElementPair(source, target) {
  const src = roundTripMatchType(source)
  const dst = roundTripMatchType(target)
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
  const matchType = roundTripMatchType(element)
  const parts = [matchType, ...pos, ...size]

  if (matchType === 'text') {
    const text = getRoundTripText(element).slice(0, 50)
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
          isStableElementPair(source.element, candidate.element) &&
          isCloseWithinTolerance(source.element, candidate.element)
      )
      method = target ? 'proximity' : null
    }

    if (!target) {
      target = targets.find(
        (candidate) =>
          !candidate.used &&
          isStableElementPair(source.element, candidate.element)
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
    try {
      assertPresentationAcceptance(imported.presentation, undefined, parsed.output)
    } catch (error) {
      result.errors.push(error.message)
    }

    result.semantic = computeSemanticFidelity(parsed.output, imported.presentation)
    const detail = computeDetailedFidelityMetrics(parsed.output, imported.presentation)
    result.geometryDrift = detail.geometryDrift
    result.propertyCoverage = detail.propertyCoverage
    result.elementCount = detail.elementCount
    result.shapeDriftDetails = detail.shapeDriftDetails
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

async function runCorpusTests(corpusDir = DEFAULT_CORPUS, options = {}) {
  const {
    skipRoundTrip = true,
    allowFallback = false,
    strict = false,
    baseUrl = process.env.NAVSLIDES_API_URL || '',
    perDeckMin = STRICT_CORPUS_GATES.perDeckSemantic.min,
    maxClassDrop = STRICT_CORPUS_GATES.maxClassDrop.max,
    excludeClassDrop = [],
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
  const pptxFiles = entries.filter((f) => f.toLowerCase().endsWith('.pptx')).sort((a, b) => a.localeCompare(b))

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
      testResult.errors.push(...applyStrictPerTypeGates(testResult, { perDeckMin, maxClassDrop, excludeClassDrop }))
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
  const requested = corpusDir || DEFAULT_CORPUS
  try {
    const entries = await fs.readdir(requested)
    if (entries.some((file) => file.toLowerCase().endsWith('.pptx'))) return requested
  } catch {
    // Fall back below.
  }

  try {
    const fallbackEntries = await fs.readdir(FALLBACK_CORPUS)
    if (fallbackEntries.some((file) => file.toLowerCase().endsWith('.pptx'))) return FALLBACK_CORPUS
  } catch {
    // Keep the requested corpus directory; the report will show zero files.
  }

  return requested
}

function parsePercentFlag(value, fallback) {
  if (value == null || value === '') return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? (numeric > 1 ? numeric / 100 : numeric) : fallback
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

function buildDriftRows(results) {
  return results.flatMap((result) =>
    (result.shapeDriftDetails || []).map((row) => ({ deckName: result.file, ...row }))
  )
}

async function writeDriftRows(outputPath, results) {
  await fs.outputJson(outputPath, buildDriftRows(results), { spaces: 2 })
}

module.exports = {
  buildFingerprint,
  buildDriftRows,
  parsePptxWithPptxtojson,
  importPresentation,
  matchElements,
  computeSemanticFidelity,
  computeDetailedFidelityMetrics,
  computeRoundTripStability,
  evaluateCapture,
  applyStrictPerTypeGates,
  testCorpusFile,
  runCorpusTests,
  reportResults,
  writeDriftRows,
  DEFAULT_CORPUS, DEFAULT_MAX_CLASS_DROP, DEFAULT_PER_DECK_MIN_SEMANTIC,
  STRICT_CORPUS_GATES,
  STRICT_AVG_MIN_ROUND_TRIP, STRICT_AVG_MIN_SEMANTIC, STRICT_MIN_CORPUS_FILES,
  parsePercentFlag,
}

if (require.main === module) {
  require('./pptx-import-corpus-cli').runFromCli(process.argv.slice(2))
}
