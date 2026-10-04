import { describe, expect, it } from 'vitest'
import * as identities from './education-artifact-identities.mjs'
describe('explicit production qualification origins', () => {
  it('matches the production base and API defaults without admitting undeclared origins', () => {
    const origins = identities.defaultLaneOrigins('production-browser', {})
    expect(origins).toEqual(['http://127.0.0.1:3202', 'null'])
    expect(origins).not.toContain('http://127.0.0.1:3002')
    expect(origins).not.toContain('https://undeclared.invalid')
  })
  it('binds selected production base and API origins instead of broadening localhost aliases', () => {
    const origins = identities.defaultLaneOrigins('production-browser', {
      PLAYWRIGHT_TEST_BASE_URL: 'https://chosen.example/editor',
      PLAYWRIGHT_API_BASE_URL: 'https://api.example/api',
    })
    expect(origins).toEqual(['https://chosen.example', 'https://api.example', 'null'])
    expect(origins).not.toContain('http://localhost:3202')
  })
  it('keeps native Electron origin distinct from the browser production runner', () => {
    expect(identities.defaultLaneOrigins('electron-dev', {})).toEqual(['http://127.0.0.1:3002'])
  })
})
