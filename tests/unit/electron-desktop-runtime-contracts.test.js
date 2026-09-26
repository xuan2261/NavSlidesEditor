import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import navigationPolicy from '../../electron/navigation-policy.js'

const { isTrustedAppUrl, isExternalHttpUrl } = navigationPolicy
const APP_ORIGIN = 'http://127.0.0.1:3002'
const root = resolve(__dirname, '..', '..')

const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')

describe('Electron desktop runtime & packaging contracts', () => {
  it('permits Reveal presentation tabs launched via F5 and Shift+F5', () => {
    // F5: From beginning
    const f5Url = `${APP_ORIGIN}/api/presentations/deck-123/present`
    expect(isTrustedAppUrl(f5Url, APP_ORIGIN)).toBe(true)

    // Shift+F5: From current coordinates
    const shiftF5Url = `${APP_ORIGIN}/api/presentations/deck-123/present#/2/1`
    expect(isTrustedAppUrl(shiftF5Url, APP_ORIGIN)).toBe(true)

    // Fallback blob URL for unsaved/offline presentations
    const blobUrl = `blob:${APP_ORIGIN}/b952c1e4-8c82-4f3a-939e-4c59a34d7d11#/1/0`
    expect(isTrustedAppUrl(blobUrl, APP_ORIGIN)).toBe(true)
  })

  it('rejects untrusted or lookalike origins from opening in the Electron shell', () => {
    const maliciousUrls = [
      'http://127.0.0.1:3002@attacker.com/exploit',
      'http://127.0.0.1:3003/api/presentations/deck-123/present',
      'https://attacker.com/fake-login',
      'file:///C:/Windows/System32/cmd.exe',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'blob:https://attacker.com/evil-blob',
    ]

    for (const url of maliciousUrls) {
      expect(isTrustedAppUrl(url, APP_ORIGIN)).toBe(false)
    }
  })

  it('routes valid external documentation and web links to shell.openExternal', () => {
    expect(isExternalHttpUrl('https://revealjs.com', APP_ORIGIN)).toBe(true)
    expect(isExternalHttpUrl('https://github.com/xuan2261/NavSlidesEditor', APP_ORIGIN)).toBe(true)
    expect(isExternalHttpUrl(`${APP_ORIGIN}/editor/deck-123`, APP_ORIGIN)).toBe(false)
  })

  it('verifies confirmation dialogs use non-blocking themed UI without native dialog traps', () => {
    const nativeDialogAudit = readText('client', 'src', 'utils', 'native-dialog-audit.test.js')
    expect(nativeDialogAudit).toContain("keeps production UI flows on themed feedback surfaces")
    expect(nativeDialogAudit).toContain("prompt|confirm|alert")

    // The editor uses themed modal components instead of blocking modal loops
    const editorPage = readText('client', 'src', 'pages', 'EditorPage.jsx')
    expect(editorPage).not.toMatch(/\bwindow\.(alert|confirm|prompt)\s*\(/)
  })

  it('verifies CSP isolation protects media uploads while leaving Reveal HTML unconstrained', () => {
    const serverIndex = readText('server', 'index.js')

    // SVG uploads are sandboxed with restrictive CSP to prevent XSS
    expect(serverIndex).toContain(
      "Content-Security-Policy': \"sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'\""
    )

    // Rate limiter is bypassed during test automation to prevent 429 cascades
    expect(serverIndex).toContain('isRateLimitSkipped')
  })

  it('enforces Electron security confinement: sandbox, contextIsolation, and no IPC bridge', () => {
    const main = readText('electron', 'main.js')

    expect(main).toContain('nodeIntegration: false')
    expect(main).toContain('contextIsolation: true')
    expect(main).toContain('sandbox: true')
    expect(main).not.toContain('preload:')
    expect(main).not.toContain('ipcMain')
  })
})
