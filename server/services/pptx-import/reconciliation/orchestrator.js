const { reconcileInventories } = require('./diff')
const { adaptNativeSceneGraph } = require('./native-adapter')
const { readOfficeCliInventory } = require('./officecli-adapter')
const { resolvePromotionPolicy } = require('./promotion')

function cancelled() {
  const error = new Error('Shadow reconciliation cancelled')
  error.code = 'CANCELLED'
  return error
}

function assertActive(signal) {
  if (signal?.aborted) throw cancelled()
}

function unavailable(nativeProjection, reason, capability = null) {
  return {
    projection: nativeProjection,
    shadow: { status: 'unavailable', reason, capability },
  }
}

async function runShadowReconciliation(options = {}) {
  assertActive(options.signal)
  if (options.enabled !== true) {
    return {
      projection: options.nativeProjection,
      shadow: { status: 'disabled' },
    }
  }
  if (!options.gateway?.probeCapability) {
    return unavailable(options.nativeProjection, 'typed-gateway-unavailable')
  }

  let capability
  try {
    capability = await options.gateway.probeCapability()
  } catch (error) {
    if (error?.code === 'CANCELLED') throw error
    return unavailable(options.nativeProjection, error?.code || 'capability-probe-failed')
  }
  assertActive(options.signal)
  if (!capability?.inspection) {
    return unavailable(options.nativeProjection, capability?.reason || 'inspection-unavailable', capability)
  }
  if (!options.revision || typeof options.readRevision !== 'function') {
    return unavailable(options.nativeProjection, 'guarded-revision-unavailable', capability)
  }

  const nativeInventory = options.nativeInventory || adaptNativeSceneGraph(
    options.sceneGraph,
    {
      revisionId: options.revision.id,
      packageSize: options.packageSize,
      canvas: options.canvas,
    }
  )
  let release
  try {
    if (options.admission) {
      release = await options.admission.reserve({ weight: 1, signal: options.signal })
    }
    assertActive(options.signal)
    const shadowInventory = await readOfficeCliInventory({
      gateway: options.gateway,
      revision: options.revision,
      readRevision: options.readRevision,
      slides: nativeInventory.slides.map((slide) => ({
        index: slide.index,
        part: slide.part,
      })),
      canvas: options.canvas,
      maxObjects: options.maxObjects,
      signal: options.signal,
    })
    assertActive(options.signal)
    const report = reconcileInventories(nativeInventory, shadowInventory)
    return {
      projection: options.nativeProjection,
      shadow: {
        status: 'complete',
        capability,
        report,
        promotion: resolvePromotionPolicy(options.promotions),
      },
    }
  } catch (error) {
    if (error?.code === 'CAPABILITY_UNAVAILABLE') {
      return unavailable(options.nativeProjection, error.code, capability)
    }
    throw error
  } finally {
    release?.()
  }
}

module.exports = { runShadowReconciliation }
