import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2000ms (due to large payload)
    http_req_failed: ['rate<0.01'], // Error rate must be less than 1%
  },
}

const BASE_URL = 'http://localhost:3000/api'

// Create a pseudo-large payload (simulating Base64 data)
const largePayload = {
  title: 'Load Test Presentation',
  slides: Array(30).fill({
    content: "<h1>Test Slide</h1><img src='data:image/png;base64," + 'A'.repeat(50000) + "'/>",
  }),
}

export default function () {
  const payload = JSON.stringify(largePayload)

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  }

  const res = http.post(`${BASE_URL}/presentations`, payload, params)

  check(res, {
    'is status 200 or 201': (r) => r.status === 200 || r.status === 201,
  })

  sleep(1)
}
