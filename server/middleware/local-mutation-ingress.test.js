const express = require('express')
const request = require('supertest')
const {
  createLocalMutationIngressPolicy,
  LOCAL_MUTATION_INGRESS_DENIAL_CODE,
  MUTATION_ROUTE_FAMILIES,
} = require('./local-mutation-ingress')

function createApp(options) {
  const app = express()
  let mutations = 0
  app.use(createLocalMutationIngressPolicy(options))
  app.use((req, res) => {
    mutations += 1
    res.status(202).json({ accepted: true })
  })
  return { app, mutationCount: () => mutations }
}

function expectSafeDenial(response) {
  expect(response.status).toBe(403)
  expect(response.body).toEqual({
    error: 'Request denied',
    code: LOCAL_MUTATION_INGRESS_DENIAL_CODE,
  })
}

describe('local mutation ingress policy', () => {
  it('allows valid local browser and explicit nonbrowser requests', async () => {
    const { app, mutationCount } = createApp()

    const browser = await request(app)
      .post('/api/pptx/import')
      .set('Host', 'localhost:3002')
      .set('Origin', 'http://localhost:3002')
    const nonbrowser = await request(app)
      .post('/api/pptx/import')
      .set('Host', '127.0.0.1:3002')
    const ipv6Browser = await request(app)
      .post('/api/pptx/import')
      .set('Host', '[::1]:3002')
      .set('Origin', 'http://[::1]:3002')

    expect(browser.status).toBe(202)
    expect(nonbrowser.status).toBe(202)
    expect(ipv6Browser.status).toBe(202)
    expect(mutationCount()).toBe(3)
  })

  it('honors forwarded host and protocol only from a configured proxy', async () => {
    const { app, mutationCount } = createApp({
      allowedHosts: ['slides.local:3002'],
      trustedProxyAddresses: ['127.0.0.1'],
    })

    const response = await request(app)
      .post('/api/pptx/import')
      .set('Host', 'proxy.internal')
      .set('X-Forwarded-Host', 'slides.local:3002')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://slides.local:3002')

    expect(response.status).toBe(202)
    expect(mutationCount()).toBe(1)
  })

  it('uses one safe denial before every named mutation family can run', async () => {
    const { app, mutationCount } = createApp()

    for (const route of MUTATION_ROUTE_FAMILIES) {
      const method = route.method.toLowerCase()
      const response = await request(app)[method](route.path)
        .set('Host', 'attacker.example')
        .set('Origin', 'https://attacker.example')

      expectSafeDenial(response)
    }

    expect(mutationCount()).toBe(0)
  })

  it.each([
    ['untrusted forwarding', {
      Host: 'attacker.example',
      'X-Forwarded-Host': 'localhost:3002',
    }],
    ['cross-site origin', {
      Host: 'localhost:3002',
      Origin: 'https://attacker.example',
    }],
    ['opaque origin', {
      Host: 'localhost:3002',
      Origin: 'null',
    }],
    ['malformed origin', {
      Host: 'localhost:3002',
      Origin: 'http://localhost:3002/unexpected-path',
    }],
    ['noncanonical origin', {
      Host: 'localhost:3002',
      Origin: 'http://localhost:3002/',
    }],
    ['configured origin mismatch', {
      Host: 'localhost:3002',
      Origin: 'http://localhost:3002',
    }],
  ])('rejects %s without a mutation effect', async (_name, headers) => {
    const options = _name === 'configured origin mismatch'
      ? { allowedOrigins: ['https://localhost:3002'] }
      : undefined
    const { app, mutationCount } = createApp(options)
    const response = await request(app).post('/api/pptx/import').set(headers)

    expectSafeDenial(response)
    expect(mutationCount()).toBe(0)
  })
})
