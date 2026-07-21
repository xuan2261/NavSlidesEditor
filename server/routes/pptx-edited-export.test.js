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
    await handler(request({ 'Idempotency-Key': 'key-1', 'If-Pptx-Generation': '2' }), res)
    expect(res.statusCode).toBe(422)
    expect(res.body.code).toBe('VALIDATOR_UNAVAILABLE')
    expect(execute).not.toHaveBeenCalled()
  })

  it('executes a durable replay even when current validators are unavailable', async () => {
    const execute = vi.fn(async () => ({
      ok: true, bytes: Buffer.from('committed-r1'), generation: 3, idempotent: true,
    }))
    const getAvailability = vi.fn(async () => ({
      available: false, reasonCode: 'VALIDATOR_UNAVAILABLE',
    }))
    const handler = createEditedExportHandler({
      findPresentation: async () => ({ id: 'p1', title: 'Deck' }),
      getReplay: async () => true,
      getAvailability,
      execute,
    })
    const res = response()

    await handler(request({ 'Idempotency-Key': 'replay-key', 'If-Pptx-Generation': '2' }), res)

    expect(res.statusCode).toBe(200)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(getAvailability).not.toHaveBeenCalled()
    expect(res.headers['X-Idempotent-Replay']).toBe('1')
    expect(res.body).toEqual(Buffer.from('committed-r1'))
  })

  it('passes only the export envelope and streams hash-labelled bytes', async () => {
    const execute = vi.fn(async () => ({
      ok: true, bytes: Buffer.from('pptx'), generation: 3, idempotent: true,
    }))
    const drainCompatibility = vi.fn(async () => 1)
    const deck = { id: 'p1', title: 'Deck', slides: [] }
    const handler = createEditedExportHandler({
      findPresentation: async () => deck,
      getAvailability: async () => ({ available: true }),
      execute,
      drainCompatibility,
    })
    const res = response()
    await handler(request({ 'Idempotency-Key': 'key-1', 'If-Pptx-Generation': '2' }), res)
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      presentationId: 'p1', expectedGeneration: 2, idempotencyKey: 'key-1',
    }))
    expect(execute.mock.calls[0][0]).not.toHaveProperty('after')
    expect(execute.mock.calls[0][0]).not.toHaveProperty('textTransports')
    expect(drainCompatibility).toHaveBeenCalledTimes(1)
    expect(res.headers['X-Pptx-Export-Mode']).toBe('validated-edited')
    expect(res.headers['X-Idempotent-Replay']).toBe('1')
    expect(res.headers['X-Pptx-Package-Sha256']).toMatch(/^[a-f0-9]{64}$/)
    expect(res.body.equals(Buffer.from('pptx'))).toBe(true)
  })

  it('returns committed bytes when compatibility draining remains queued', async () => {
    const reportCompatibilityDrainFailure = vi.fn()
    const handler = createEditedExportHandler({
      findPresentation: async () => ({ id: 'p1', title: 'Deck' }),
      getAvailability: async () => ({ available: true }),
      execute: async () => ({
        ok: true, bytes: Buffer.from('pptx'), generation: 3, idempotent: false,
      }),
      drainCompatibility: async () => { throw new Error('storage temporarily unavailable') },
      reportCompatibilityDrainFailure,
    })
    const res = response()

    await handler(request({ 'Idempotency-Key': 'key-1', 'If-Pptx-Generation': '2' }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(Buffer.from('pptx'))
    expect(res.headers['X-Pptx-Generation']).toBe('3')
    expect(res.headers['X-Pptx-Compatibility-Sync']).toBe('pending')
    expect(reportCompatibilityDrainFailure).toHaveBeenCalledWith(expect.any(Error))
  })

  it('rejects zero generation before presentation and availability work', async () => {
    const execute = vi.fn()
    const findPresentation = vi.fn(async () => ({ id: 'p1' }))
    const getAvailability = vi.fn(async () => ({ available: true }))
    const handler = createEditedExportHandler({ findPresentation, getAvailability, execute })
    const res = response()

    await handler(request({
      'Idempotency-Key': 'key-1',
      'If-Pptx-Generation': '0',
    }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ code: 'INVALID_EXPORT_REQUEST' })
    expect(findPresentation).not.toHaveBeenCalled()
    expect(getAvailability).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects oversized idempotency keys before presentation and availability work', async () => {
    const execute = vi.fn()
    const findPresentation = vi.fn(async () => ({ id: 'p1' }))
    const getAvailability = vi.fn(async () => ({ available: true }))
    const handler = createEditedExportHandler({
      findPresentation,
      getAvailability,
      execute,
    })
    const res = response()
    await handler(request({
      'Idempotency-Key': 'x'.repeat(201),
      'If-Pptx-Generation': '2',
    }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ code: 'INVALID_IDEMPOTENCY_KEY' })
    expect(findPresentation).not.toHaveBeenCalled()
    expect(getAvailability).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
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
