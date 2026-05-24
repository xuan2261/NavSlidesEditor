import { readFileSync } from 'node:fs'
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
  const fixtureImportTimeoutMs = 20000

  const mockRequest = () => ({
    post: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({ id: 'x' }) }),
    put: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({}) }),
    delete: vi.fn().mockResolvedValue({ status: () => 200 }),
    get: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({}) }),
  })

  it('allows 127.0.0.1 baseURL', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('http://127.0.0.1:4173')
    await expect(apiCreatePresentation(mockRequest(), 'ok')).resolves.toBeTruthy()
  }, fixtureImportTimeoutMs)

  it('allows localhost baseURL', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('http://localhost:4173')
    await expect(apiCreatePresentation(mockRequest(), 'ok')).resolves.toBeTruthy()
  }, fixtureImportTimeoutMs)

  it('rejects production-like URLs', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('https://navslides.example.com')
    await expect(apiCreatePresentation(mockRequest(), 'evil')).rejects.toThrow(
      /not a loopback/
    )
  }, fixtureImportTimeoutMs)

  it('rejects private network URLs', async () => {
    const { apiCreatePresentation } = await loadFixturesWithEnv('http://10.0.0.5')
    await expect(apiCreatePresentation(mockRequest(), 'evil')).rejects.toThrow(
      /not a loopback/
    )
  }, fixtureImportTimeoutMs)

  it('rejects baseURL on update/share/snapshot/delete', async () => {
    const { apiUpdatePresentation, apiDeletePresentation, apiCreateShareLink, apiCreateSnapshot } =
      await loadFixturesWithEnv('https://prod.example')
    const req = mockRequest()
    await expect(apiUpdatePresentation(req, 'id', {})).rejects.toThrow(/not a loopback/)
    await expect(apiDeletePresentation(req, 'id')).rejects.toThrow(/not a loopback/)
    await expect(apiCreateShareLink(req, 'id')).rejects.toThrow(/not a loopback/)
    await expect(apiCreateSnapshot(req, 'id', 'snap')).rejects.toThrow(/not a loopback/)
  }, fixtureImportTimeoutMs)

  it('rejects baseURL on get presentation', async () => {
    const { apiGetPresentation } = await loadFixturesWithEnv('https://prod.example')
    await expect(apiGetPresentation(mockRequest(), 'id')).rejects.toThrow(/not a loopback/)
  }, fixtureImportTimeoutMs)

  it('does not contain identity-replace dead code', () => {
    const src = readFileSync('tests/e2e/fixtures/test-fixtures.js', 'utf8')
    expect(src).not.toMatch(/API_BASE\.replace\(['"]\/api['"],\s*['"]\/api['"]\)/)
  })

  it('testPresentation fixture does not swallow cleanup failures', () => {
    const src = readFileSync('tests/e2e/fixtures/test-fixtures.js', 'utf8')
    const fixture = src.match(/testPresentation: async[\s\S]*?\n {2}\},/)[0]

    expect(fixture).toContain('await apiDeletePresentation')
    expect(fixture).not.toMatch(/catch\s*\(/)
    expect(fixture).not.toMatch(/catch\s*\{/)
  })
})
