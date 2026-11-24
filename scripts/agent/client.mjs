import { AgentError } from './contracts.mjs'

export function createApi({ url = process.env.NAVSLIDES_URL || 'http://127.0.0.1:3002', readOnly = process.env.NAVSLIDES_READ_ONLY === 'true' } = {}) {
  let base
  try { base = new URL(url) } catch { throw new AgentError('INVALID_URL', 'NAVSLIDES_URL must be an HTTP origin.', 'Use http://127.0.0.1:3002.') }
  if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new AgentError('INVALID_URL', 'Only credential-free loopback HTTP origins are supported.', 'Run the local NavSlides app or use a loopback port forward. Remote MCP hosting is not enabled.')
  }
  async function request(route, { method = 'GET', body, headers = {}, binary = false, timeout = 30000, signal } = {}) {
    if (!/^\/(api\/|health\/|uploads\/)/.test(route) || route.includes('\\') || route.includes('..')) throw new AgentError('INVALID_ROUTE', 'Invalid API route.', 'Use a registered operation.')
    if (readOnly && method !== 'GET') throw new AgentError('READ_ONLY', 'This agent is configured read-only.', 'Restart with NAVSLIDES_READ_ONLY=false only if mutations are authorized.')
    let response
    try {
      response = await fetch(new URL(route, base), {
        method, redirect: 'error',
        headers: { Origin: base.origin, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
      })
    } catch (error) {
      if (signal?.aborted) throw new AgentError('CANCELLED', 'The consumer cancelled this request.', 'Check job status before retrying an admitted import.')
      if (error.name === 'TimeoutError') throw new AgentError('TIMEOUT', 'The NavSlides request timed out.', 'Check server readiness and operation status before retrying.')
      throw new AgentError('SERVER_UNREACHABLE', `Cannot connect to NavSlides at ${base.origin}.`, 'Open NavSlides Electron, or run npm run dev in the repository. Set NAVSLIDES_URL for a different local port.')
    }
    if (!response.ok) {
      const value = await response.json().catch(() => ({}))
      const status = response.status
      const hints = { 400: 'Correct the input fields using the tool schema.', 401: 'Supply the job capability returned when the job was admitted.', 403: 'Check local allowed hosts/origins; do not disable the ingress policy.', 404: 'List the current objects and use an existing ID.', 409: 'Read current state again; resolve the conflict before retrying.', 413: 'Reduce file or snapshot size.', 422: 'Inspect PPTX fidelity; the requested export or edit is not supported.', 429: `Wait before retrying. Retry-After: ${response.headers.get('retry-after') || 'not supplied'}.`, 503: 'Check /health/ready and the server recovery log.' }
      // Never forward raw upstream errors: provider errors may contain credentials or local paths.
      const code = typeof value.code === 'string' && /^[A-Z0-9_-]{1,100}$/i.test(value.code) ? value.code : `HTTP_${status}`
      throw new AgentError(code, `NavSlides rejected the operation (HTTP ${status}).`, hints[status] || 'Inspect the server log for details.', status)
    }
    if (response.status === 204) return { success: true }
    if (binary) return Buffer.from(await response.arrayBuffer())
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new AgentError('UNEXPECTED_RESPONSE', 'The endpoint did not return a NavSlides JSON response.', 'Point NAVSLIDES_URL at the backend port, not Vite or another local service.')
    }
    return response.json()
  }
  return { baseUrl: base.origin, readOnly, request }
}
