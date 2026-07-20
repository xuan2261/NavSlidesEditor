const crypto = require('node:crypto')
const { createInventory } = require('./inventory')
const { emuRectToUnits, pixelsToEmu, pointsToEmu } = require('./units')

function driftError() {
  const error = new Error('OfficeCLI shadow read changed the guarded package revision')
  error.code = 'SHADOW_READ_DRIFT'
  return error
}

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function assertRevision(bytes, revision) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== revision.byteLength ||
      hash(bytes) !== revision.sha256) throw driftError()
}

function rectFrom(value) {
  const box = value?.transform || value?.geometry || value?.bounds
  if (!box) return null
  const raw = {
    x: box.x ?? box.left,
    y: box.y ?? box.top,
    width: box.width ?? box.cx,
    height: box.height ?? box.cy,
  }
  if (Object.values(raw).some((number) => !Number.isFinite(Number(number)))) return null
  const convert = box.unit === 'pt' || box.unit === 'point'
    ? pointsToEmu
    : box.unit === 'px' || box.unit === 'pixel'
      ? pixelsToEmu
      : Number
  return Object.fromEntries(Object.entries(raw).map(([key, number]) => [key, convert(number)]))
}

function officeObjects(data) {
  if (Array.isArray(data)) return data
  for (const key of ['objects', 'shapes', 'items', 'children']) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  return []
}

function adaptObject(value, index, slide, canvas) {
  const rect = rectFrom(value)
  return {
    kind: value.kind || value.type || 'unknown',
    nativeId: value.nativeId != null ? String(value.nativeId) :
      value.id != null ? String(value.id) : null,
    name: value.name || null,
    ancestry: (value.ancestry || value.groupAncestry || []).map(String),
    zOrder: Number.isSafeInteger(value.zOrder) ? value.zOrder : index,
    transform: rect ? emuRectToUnits(rect, canvas) : null,
    rawTransform: value.transform || value.geometry || value.bounds || null,
    text: value.text || null,
    style: value.style || null,
    placeholder: value.placeholder || null,
    relationships: value.relationships || [],
    dependentParts: value.dependentParts || [],
    unknown: value.unknown || (value.kind || value.type ? null : { classification: 'unknown' }),
    editabilityTier: value.editabilityTier || 'diagnostic',
    lineage: {
      method: 'typed-gateway-inventory',
      confidence: value.confidence ?? 1,
      warnings: value.warnings || [],
      evidence: [slide.part],
    },
  }
}

async function readOfficeCliInventory(options) {
  const { gateway, revision, readRevision, signal } = options
  if (!gateway || typeof gateway.inventoryObjects !== 'function') {
    throw new TypeError('Typed OfficeCLI inventory gateway is required')
  }
  signal?.throwIfAborted?.()
  const before = await readRevision(revision)
  assertRevision(before, revision)
  const slides = []
  const maxObjects = options.maxObjects || 10000
  let objectCount = 0
  try {
    for (const slide of options.slides || []) {
      signal?.throwIfAborted?.()
      const response = await gateway.inventoryObjects(
        revision,
        { slide: slide.index + 1 },
        { signal }
      )
      const values = officeObjects(response?.data)
      objectCount += values.length
      if (objectCount > maxObjects) {
        const error = new Error('OfficeCLI shadow inventory object limit exceeded')
        error.code = 'SHADOW_OUTPUT_LIMIT'
        throw error
      }
      slides.push({
        part: slide.part,
        index: slide.index,
        objects: values.map((value, index) =>
          adaptObject(value, index, slide, options.canvas)
        ),
      })
    }
  } finally {
    const after = await readRevision(revision)
    assertRevision(after, revision)
  }
  return createInventory({
    source: 'officecli',
    revisionId: revision.id,
    slides,
    capability: { inspection: true, mutation: false },
  })
}

module.exports = { readOfficeCliInventory }
