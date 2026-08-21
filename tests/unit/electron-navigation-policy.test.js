import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import navigationPolicy from '../../electron/navigation-policy.js'

const { isTrustedAppUrl, isExternalHttpUrl } = navigationPolicy
const APP_ORIGIN = 'http://127.0.0.1:3002'
const root = resolve(__dirname, '..', '..')

describe('Electron navigation policy', () => {
  it('allows only the exact app origin and same-origin blob URLs', () => {
    for (const url of [
      `${APP_ORIGIN}/`,
      `${APP_ORIGIN}/present/deck?slide=2#fragment`,
      `blob:${APP_ORIGIN}/550e8400-e29b-41d4-a716-446655440000`,
    ]) {
      expect(isTrustedAppUrl(url, APP_ORIGIN)).toBe(true)
    }

    for (const url of [
      'http://127.0.0.1:3002@example.com/',
      'http://127.0.0.1.evil:3002/',
      'http://127.0.0.1:30020/',
      'http://127.0.0.1/',
      'blob:https://example.com/550e8400-e29b-41d4-a716-446655440000',
      'file:///C:/Windows/System32/calc.exe',
      'data:text/html,unsafe',
      'not a url',
    ]) {
      expect(isTrustedAppUrl(url, APP_ORIGIN)).toBe(false)
    }
  })

  it('opens only parsed external HTTP(S) targets in the system browser', () => {
    expect(isExternalHttpUrl('https://example.com/path', APP_ORIGIN)).toBe(true)
    expect(isExternalHttpUrl('http://example.com/path', APP_ORIGIN)).toBe(true)
    expect(isExternalHttpUrl(`${APP_ORIGIN}/editor`, APP_ORIGIN)).toBe(false)
    expect(isExternalHttpUrl('blob:https://example.com/id', APP_ORIGIN)).toBe(false)
    expect(isExternalHttpUrl('https:example.com', APP_ORIGIN)).toBe(true)
    expect(isExternalHttpUrl('file:///tmp/a', APP_ORIGIN)).toBe(false)
  })

  it('keeps the packaged renderer sandboxed without a preload bridge', () => {
    const main = readFileSync(resolve(root, 'electron', 'main.js'), 'utf8')
    const builder = readFileSync(resolve(root, 'electron-builder.yml'), 'utf8')

    expect(main).toContain('sandbox: true')
    expect(main).not.toContain('ELECTRON_DISABLE_SANDBOX')
    expect(main).not.toContain("appendSwitch('no-sandbox')")
    expect(main).not.toContain('preload:')
    expect(main).not.toContain('ipcMain')
    expect(builder).not.toContain('--no-sandbox')
  })
})
