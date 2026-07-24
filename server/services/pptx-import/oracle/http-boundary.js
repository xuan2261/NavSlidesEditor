const coded = (code) => Object.assign(new Error(code), { code })

function withSignal(init, signal) {
  return signal ? { ...(init || {}), signal } : init || {}
}

function safeServerReasonCode(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/.test(value) ? value : null
}

async function httpRequestFailed(response) {
  const error = coded('http-request-failed')
  try {
    const reasonCode = safeServerReasonCode((await response?.json())?.reasonCode)
    if (reasonCode) error.reasonCode = reasonCode
  } catch {
    // Error responses remain generic when their JSON body is unavailable or malformed.
  }
  return error
}

async function requestJson(fetchImpl, url, init = {}) {
  let response
  try {
    response = await fetchImpl(url, init)
  } catch {
    throw coded(init?.signal?.aborted ? 'http-request-timeout' : 'http-request-failed')
  }
  if (!response?.ok) throw await httpRequestFailed(response)
  try { return await response.json() } catch { throw coded('invalid-http-json') }
}

async function requestBytes(fetchImpl, url, init = {}) {
  let response
  try {
    response = await fetchImpl(url, init)
  } catch {
    throw coded(init?.signal?.aborted ? 'http-request-timeout' : 'http-request-failed')
  }
  if (!response?.ok) throw coded('http-request-failed')
  try { return Buffer.from(await response.arrayBuffer()) } catch { throw coded('invalid-http-bytes') }
}

function createDeadline(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0 || typeof AbortController !== 'function') {
    throw coded('invalid-http-deadline')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function waitWithSignal(sleep, milliseconds, signal) {
  if (!signal) return sleep(milliseconds)
  if (signal.aborted) throw coded('http-request-timeout')
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(coded('http-request-timeout'))
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve().then(() => {
      if (signal.aborted) throw coded('http-request-timeout')
      return sleep(milliseconds)
    }).then(
      () => { signal.removeEventListener('abort', onAbort); resolve() },
      (error) => { signal.removeEventListener('abort', onAbort); reject(error) }
    )
  })
}

module.exports = {
  coded,
  createDeadline,
  requestBytes,
  requestJson,
  safeServerReasonCode,
  waitWithSignal,
  withSignal,
}
