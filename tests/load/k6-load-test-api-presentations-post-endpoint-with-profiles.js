/* global __ENV */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { buildOptions, getProfile } from './k6-shared-load-test-profile-options-smoke-load-stress.js'

export const options = buildOptions({
  http_req_duration: ['p(95)<2000'],
  http_req_failed: ['rate<0.01'],
  iteration_duration: ['p(95)<5000'],
})

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3002/api'

function assertLoopbackUrl(value, name) {
  if (!/^(https?):\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(value)) {
    throw new Error(`${name} must target loopback only for destructive load tests: ${value}`)
  }
}

const largePayload = {
  title: 'Load Test Presentation',
  slides: Array(30).fill({
    content: "<h1>Test Slide</h1><img src='data:image/png;base64," + 'A'.repeat(50000) + "'/>",
  }),
}

export function setup() {
  assertLoopbackUrl(BASE_URL, 'API_BASE_URL')
  const p = getProfile()
  console.log(`[api-load] profile=${p.name} vus=${p.vus} duration=${p.duration}`)
  return p
}

export default function () {
  const payload = JSON.stringify(largePayload)
  const params = { headers: { 'Content-Type': 'application/json' } }
  const res = http.post(`${BASE_URL}/presentations`, payload, params)

  check(res, {
    'is status 200 or 201': (r) => r.status === 200 || r.status === 201,
  })

  sleep(1)
}
