export class PptxRevisionConflict extends Error {
  constructor(payload) {
    super('The PPTX revision changed. Reload and review before trying again.')
    this.name = 'PptxRevisionConflict'
    this.status = 409
    this.code = payload?.code || 'pptx-revision-conflict'
    this.conflict = payload?.conflict || null
  }
}

export function toPptxApiError(error) {
  if (error?.status === 409) return new PptxRevisionConflict(error)
  return error
}

export function createSuccessorQueue(generate) {
  const pending = new Map()
  return ({ presentationId, revision, idempotencyKey }) => {
    const key = `${presentationId}:${revision}:${idempotencyKey}`
    if (!pending.has(key)) {
      const job = Promise.resolve()
        .then(() => generate({ presentationId, revision }))
        .finally(() => pending.delete(key))
      pending.set(key, job)
    }
    return pending.get(key)
  }
}
