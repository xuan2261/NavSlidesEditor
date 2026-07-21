const crypto = require('node:crypto')
const { isValidIdempotencyKey } = require('../services/pptx-import/request-limits')

function safeError(res, status, code, message, details, authority) {
  return res.status(status).json({
    error: message,
    code,
    ...(details ? { details } : {}),
    ...(authority?.reasonCode ? {
      reasonCode: authority.reasonCode,
      reasonCodes: authority.reasonCodes,
      reasonCodeSubject: authority.reasonCodeSubject,
    } : {}),
  })
}

function createEditedExportHandler({
  findPresentation,
  getAvailability,
  getReplay = async () => false,
  execute,
  drainCompatibility = async () => 0,
  reportCompatibilityDrainFailure = (error) => {
    console.error('Validated edited PPTX compatibility drain failed:', error)
  },
}) {
  return async function editedExport(req, res) {
    try {
      const idempotencyKey = req.get('Idempotency-Key')
      const generationHeader = req.get('If-Pptx-Generation')
      const expectedGeneration = Number(generationHeader)
      if (!idempotencyKey || !/^[1-9]\d*$/u.test(generationHeader || '') ||
          !Number.isSafeInteger(expectedGeneration)) {
        return safeError(res, 400, 'INVALID_EXPORT_REQUEST',
          'Idempotency-Key and If-Pptx-Generation headers are required')
      }
      if (!isValidIdempotencyKey(idempotencyKey)) {
        return safeError(res, 400, 'INVALID_IDEMPOTENCY_KEY',
          'Idempotency-Key must be printable ASCII and no more than 128 bytes')
      }
      const presentation = await findPresentation(req.params.id)
      if (!presentation) return safeError(res, 404, 'PRESENTATION_NOT_FOUND', 'Not found')
      const replay = await getReplay({
        presentationId: presentation.id,
        expectedGeneration,
        idempotencyKey,
      })
      const availability = replay
        ? { available: true, replay: true }
        : await getAvailability(presentation)
      if (!availability.available) {
        return safeError(
          res, 422, availability.reasonCode || 'EDITED_EXPORT_UNAVAILABLE',
          'Validated edited export is unavailable', undefined, availability
        )
      }
      const result = await execute({
        presentationId: presentation.id,
        expectedGeneration,
        idempotencyKey,
        cancelled: req.get('X-Pptx-Cancel') === '1',
        requireOfficeCli: availability.requireOfficeCli === true,
      })
      if (!result.ok) {
        if (result.conflict) return safeError(res, 409, result.reasonCode || result.conflict.type,
          'Package generation is stale', result.conflict, result)
        if (result.cancellation) return safeError(res, 409, result.reasonCode || 'CANCELLED',
          'Export was cancelled', { state: result.cancellation }, result)
        return safeError(res, result.status || 422, result.reasonCode || 'EDITED_EXPORT_BLOCKED',
          'Validated edited export was blocked', { reason: result.blockReason }, result)
      }
      let compatibilitySyncPending = false
      try {
        await drainCompatibility()
      } catch (error) {
        compatibilitySyncPending = true
        try { reportCompatibilityDrainFailure(error) } catch {}
      }
      const bytes = Buffer.from(result.bytes)
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
      const title = String(presentation.title || 'presentation').replace(/[^a-z0-9._-]+/gi, '_')
      res.setHeader('Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation')
      res.setHeader('Content-Disposition', `attachment; filename="${title}.pptx"`)
      res.setHeader('Content-Length', String(bytes.length))
      res.setHeader('X-Pptx-Package-Sha256', sha256)
      res.setHeader('X-Pptx-Generation', String(result.generation))
      res.setHeader('X-Pptx-Export-Mode', 'validated-edited')
      if (compatibilitySyncPending) res.setHeader('X-Pptx-Compatibility-Sync', 'pending')
      if (result.idempotent) res.setHeader('X-Idempotent-Replay', '1')
      return res.send(bytes)
    } catch (error) {
      return safeError(res, error.status || 422, error.code || 'EDITED_EXPORT_FAILED',
        'Validated edited export failed safely')
    }
  }
}

module.exports = { createEditedExportHandler }
