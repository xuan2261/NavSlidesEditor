const { createEditedExportHandler } = require('./pptx-edited-export')

function response() {
  return {
    headers: {},
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    setHeader(key, value) { this.headers[key] = value },
    send(body) { this.body = body; return this },
  }
}

function request(headers = {}) {
  return {
    params: { id: 'p1' },
    get: (name) => headers[name],
  }
}

describe('validated edited PPTX route helper', () => {
  it('fails closed before execution when prerequisites are unavailable', async () => {
    const execute = vi.fn()
    const handler = createEditedExportHandler({
      findPresentation: async () => ({ id: 'p1' }),
      getAvailability: async () => ({ available: false, reasonCode: 'VALIDATOR_UNAVAILABLE' }),
      execute,
    })
    const res = response()
    await handler(request(), res)
    expect(res.statusCode).toBe(422)
    expect(res.body.code).toBe('VALIDATOR_UNAVAILABLE')
    expect(execute).not.toHaveBeenCalled()
  })

  it('passes only server presentation state and streams hash-labelled bytes', async () => {
    const execute = vi.fn(async () => ({
      ok: true, bytes: Buffer.from('pptx'), generation: 3, idempotent: true,
    }))
    const deck = { id: 'p1', title: 'Deck', slides: [] }
    const handler = createEditedExportHandler({
      findPresentation: async () => deck,
      getAvailability: async () => ({ available: true }),
      execute,
    })
    const res = response()
    await handler(request({ 'Idempotency-Key': 'key-1', 'If-Pptx-Generation': '2' }), res)
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      presentationId: 'p1', expectedGeneration: 2, idempotencyKey: 'key-1', after: deck,
    }))
    expect(res.headers['X-Pptx-Export-Mode']).toBe('validated-edited')
    expect(res.headers['X-Idempotent-Replay']).toBe('1')
    expect(res.headers['X-Pptx-Package-Sha256']).toMatch(/^[a-f0-9]{64}$/)
    expect(res.body.equals(Buffer.from('pptx'))).toBe(true)
  })

  it('returns typed stale and cancellation responses without bytes', async () => {
    for (const result of [
      {
        ok: false,
        conflict: { type: 'BASE_REVISION_MISMATCH', currentGeneration: 4 },
        reasonCode: 'BASE_REVISION_MISMATCH',
        reasonCodes: ['BASE_REVISION_MISMATCH'],
        reasonCodeSubject: { schemaVersion: 1, version: '1.0.0', hash: 'a'.repeat(64) },
      },
      {
        ok: false,
        cancellation: 'cancelled',
        reasonCode: 'CANCELLED',
        reasonCodes: ['CANCELLED'],
        reasonCodeSubject: { schemaVersion: 1, version: '1.0.0', hash: 'a'.repeat(64) },
      },
    ]) {
      const handler = createEditedExportHandler({
        findPresentation: async () => ({ id: 'p1' }),
        getAvailability: async () => ({ available: true }),
        execute: async () => result,
      })
      const res = response()
      await handler(request({ 'Idempotency-Key': 'key', 'If-Pptx-Generation': '2' }), res)
      expect(res.statusCode).toBe(409)
      expect(res.body).toMatchObject({
        code: result.reasonCode,
        reasonCode: result.reasonCode,
        reasonCodes: result.reasonCodes,
        reasonCodeSubject: result.reasonCodeSubject,
      })
    }
  })
})
