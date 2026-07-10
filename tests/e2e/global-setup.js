const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3202/api'

async function waitForApiReady(timeoutMs = 30000) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE}/presentations`)
      if (res.ok) return
      lastError = new Error(`API readiness returned ${res.status}`)
    } catch (err) {
      lastError = err
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for Playwright API server at ${API_BASE}: ${lastError?.message}`)
}

module.exports = async () => {
  await waitForApiReady()
}
