import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const SAVED_ENV = process.env.PLAYWRIGHT_TEST_BASE_URL

async function loadFixturesWithEnv(url) {
  process.env.PLAYWRIGHT_TEST_BASE_URL = url
  vi.resetModules()
  return import('../e2e/fixtures/test-fixtures.js')
}

beforeEach(() => {
  delete process.env.PLAYWRIGHT_TEST_BASE_URL
})

afterEach(() => {
  if (SAVED_ENV) {
    process.env.PLAYWRIGHT_TEST_BASE_URL = SAVED_ENV
  } else {
    delete process.env.PLAYWRIGHT_TEST_BASE_URL
  }
})

describe('test-fixtures loopback guard', () => {
  const mockRequest = () => ({
    post: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({ id: 'x' }) }),
    put: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({}) }),
    delete: vi.fn().mockResolvedValue({ status: () => 200 }),
    get: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({}) }),
  })

  it('allows 127.0.0.1 baseURL', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('http://127.0.0.1:4173')
    await expect(apiCreatePresentation(mockRequest(), 'ok')).resolves.toBeTruthy()
  })

  it('allows localhost baseURL', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('http://localhost:4173')
    await expect(apiCreatePresentation(mockRequest(), 'ok')).resolves.toBeTruthy()
  })

  it('rejects production-like URLs', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('https://navslides.example.com')
    await expect(apiCreatePresentation(mockRequest(), 'evil')).rejects.toThrow(
      /not a loopback/
    )
  })

  it('rejects private network URLs', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('http://10.0.0.5')
    await expect(apiCreatePresentation(mockRequest(), 'evil')).rejects.toThrow(
      /not a loopback/
    )
  })

  it('rejects baseURL on update/share/snapshot/delete', async () => {
    const { apiUpdatePresentation, apiDeletePresentation, apiCreateShareLink, apiCreateSnapshot } =
      await loadFixturesWithEnv('https://prod.example')
    const req = mockRequest()
    await expect(apiUpdatePresentation(req, 'id', {})).rejects.toThrow(/not a loopback/)
    await expect(apiDeletePresentation(req, 'id')).rejects.toThrow(/not a loopback/)
    await expect(apiCreateShareLink(req, 'id')).rejects.toThrow(/not a loopback/)
    await expect(apiCreateSnapshot(req, 'id', 'snap')).rejects.toThrow(/not a loopback/)
  })
})
