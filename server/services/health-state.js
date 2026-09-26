const HEALTH_SCHEMA_VERSION = 1

const READY_REASON_CODES = Object.freeze({
  STARTING: 'STARTING',
  SHUTTING_DOWN: 'SHUTTING_DOWN',
  PACKAGE_STORE_UNAVAILABLE: 'PACKAGE_STORE_UNAVAILABLE',
  PACKAGE_STORE_WRITER_UNAVAILABLE: 'PACKAGE_STORE_WRITER_UNAVAILABLE',
  DATA_ROOT_NOT_WRITABLE: 'DATA_ROOT_NOT_WRITABLE',
  UPLOADS_ROOT_NOT_WRITABLE: 'UPLOADS_ROOT_NOT_WRITABLE',
  DURABLE_RECOVERY_REQUIRED: 'DURABLE_RECOVERY_REQUIRED',
  READINESS_DEGRADED: 'READINESS_DEGRADED',
})

const ALLOWED_REASONS = new Set(Object.values(READY_REASON_CODES))

function boundedReason(reason) {
  return ALLOWED_REASONS.has(reason) ? reason : READY_REASON_CODES.READINESS_DEGRADED
}

function createHealthState({ now = Date.now } = {}) {
  const startedAt = now()
  let status = 'not-ready'
  let reason = READY_REASON_CODES.STARTING

  const response = (nextStatus, reasons) => ({
    status: nextStatus,
    schemaVersion: HEALTH_SCHEMA_VERSION,
    reasons,
    uptimeSeconds: Math.max(0, Math.floor((now() - startedAt) / 1000)),
  })

  return {
    live: () => response('live', []),
    ready: () => response(status, status === 'ready' ? [] : [reason]),
    beginStartup() {
      status = 'not-ready'
      reason = READY_REASON_CODES.STARTING
    },
    markReady() {
      status = 'ready'
      reason = null
    },
    markDegraded(nextReason) {
      status = 'not-ready'
      reason = boundedReason(nextReason)
    },
    markStopping() {
      status = 'not-ready'
      reason = READY_REASON_CODES.SHUTTING_DOWN
    },
  }
}

module.exports = {
  HEALTH_SCHEMA_VERSION,
  READY_REASON_CODES,
  createHealthState,
}
