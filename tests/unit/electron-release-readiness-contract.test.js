import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')

const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')
const readJson = (...parts) => JSON.parse(readText(...parts))
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('Electron release readiness contract', () => {
  it('keeps README current release aligned with the root package version', () => {
    const { version } = readJson('package.json')
    const readme = readText('README.md')

    expect(readme).toContain(`Current release: **v${version}**`)
  })

  it('keeps release-facing docs aligned with the root package version', () => {
    const { version } = readJson('package.json')
    const summary = readText('docs', 'codebase-summary.md')
    const deployment = readText('docs', 'deployment-guide.md')

    expect(summary).toMatch(new RegExp(`Current release is\\s+\`v${escapeRegExp(version)}\``))
    expect(summary).toContain(`Root package version is \`${version}\`.`)
    expect(deployment).toContain('current GitHub release workflow publishes Windows packages only')
  })

  it('keeps the GitHub release workflow scoped to Windows Electron packages', () => {
    const workflow = readText('.github', 'workflows', 'release.yml')

    expect(workflow).toContain('name: Build & Release Electron')
    expect(workflow).toContain('build-windows:')
    expect(workflow).toContain('runs-on: windows-latest')
    expect(workflow).toContain('npm run electron:builder -- --win --publish never')
    expect(workflow).toContain('name: electron-win')
    expect(workflow).toContain('dist-electron/*.exe')
    expect(workflow).toContain(
      'softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65'
    )

    expect(workflow).not.toContain('electron-builder --linux')
    expect(workflow).not.toContain('electron-builder --mac')
  })
})
