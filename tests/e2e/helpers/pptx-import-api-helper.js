export async function postPptxImportWhenAvailable(request, multipart, options = {}) {
  const {
    maxAttempts = 24,
    retryDelayMs = 5000,
  } = options

  let lastStatus = 0
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response
    try {
      response = await request.post('/api/pptx/import', { multipart })
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      continue
    }
    lastStatus = response.status()
    if ([502, 503, 504].includes(lastStatus)) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      continue
    }
    if (lastStatus !== 429) return response
    const body = await response.json().catch(() => ({}))
    if (body?.error !== 'import-in-progress') return response
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
  }

  throw new Error(
    `PPTX import endpoint remained unavailable after ${maxAttempts} attempts; last status ${lastStatus || 'request-error'}${lastError ? `; last error ${lastError.message}` : ''}`
  )
}
