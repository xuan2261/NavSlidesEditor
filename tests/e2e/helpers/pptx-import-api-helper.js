import { createHash } from 'node:crypto'
import { expect } from '@playwright/test'

const TRANSIENT_STATUSES = new Set([502, 503, 504])

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function describeResponse(response) {
  const body = await response.text().catch(() => '')
  return `${response.status()}${body ? ` ${body}` : ''}`
}

export async function expectOriginalPptxHash(request, presentationId, expectedHash, pptxMime) {
  const response = await request.get(`/api/presentations/${presentationId}/pptx-original`)
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['content-type']).toContain(pptxMime)
  const hash = createHash('sha256')
    .update(await response.body())
    .digest('hex')
  expect(response.headers()['x-pptx-original-sha256']).toBe(hash)
  expect(hash).toBe(expectedHash)
  return hash
}

export async function getPptxFidelity(request, presentationId) {
  const response = await request.get(`/api/presentations/${presentationId}/pptx-fidelity`)
  expect(response.ok()).toBeTruthy()
  const fidelity = await response.json()
  expect(fidelity.presentationId).toBe(presentationId)
  return fidelity
}

export async function postPptxImportWhenAvailable(request, multipart, options = {}) {
  const { maxAttempts = 24, retryDelayMs = 5000 } = options
  let lastStatus = 0
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response
    try {
      response = await request.post('/api/pptx/import', { multipart })
    } catch (error) {
      lastError = error
      await delay(retryDelayMs)
      continue
    }
    lastStatus = response.status()
    if (TRANSIENT_STATUSES.has(lastStatus)) {
      await delay(retryDelayMs)
      continue
    }
    if (lastStatus !== 429) return response
    const body = await response.json().catch(() => ({}))
    if (body?.error !== 'import-in-progress') return response
    await delay(retryDelayMs)
  }

  throw new Error(
    `PPTX import endpoint remained unavailable after ${maxAttempts} attempts; last status ${
      lastStatus || 'request-error'
    }${lastError ? `; last error ${lastError.message}` : ''}`
  )
}

export async function waitForPptxImport(request, jobId, options = {}) {
  const { timeout = 120000, capability } = options
  if (typeof jobId !== 'string' || !jobId) throw new Error('PPTX import jobId is required')
  if (typeof capability !== 'string' || !capability) {
    throw new Error('PPTX import job capability is required')
  }

  let result
  await expect
    .poll(
      async () => {
        const response = await request.get(`/api/pptx/jobs/${jobId}`, {
          headers: { 'X-Pptx-Job-Capability': capability },
        })
        if (!response.ok()) {
          throw new Error(
            `PPTX import job ${jobId} read failed: ${await describeResponse(response)}`
          )
        }
        const job = await response.json()
        if (job.status === 'done') {
          result = job.result
          return 'done'
        }
        if (job.status === 'failed' || job.status === 'cancelled') {
          throw new Error(job.error || `PPTX import ${job.status}`)
        }
        return job.status
      },
      { timeout, intervals: [250, 500, 1000, 2000] }
    )
    .toBe('done')

  if (!result || typeof result.presentationId !== 'string' || !result.presentationId) {
    throw new Error(`PPTX import ${jobId} completed without a presentationId`)
  }
  return result
}

export async function importPptxWhenAvailable(request, multipart, options = {}) {
  const response = await postPptxImportWhenAvailable(request, multipart, options)
  if (response.status() !== 202) {
    throw new Error(`PPTX import admission failed: ${await describeResponse(response)}`)
  }

  const { jobId, capability } = await response.json()
  if (typeof jobId !== 'string' || !jobId) {
    throw new Error('PPTX import admission did not return a jobId')
  }
  if (typeof capability !== 'string' || !capability) {
    throw new Error('PPTX import admission did not return a capability')
  }
  const result = await waitForPptxImport(request, jobId, { ...options, capability })
  return { jobId, capability, presentationId: result.presentationId, result }
}
