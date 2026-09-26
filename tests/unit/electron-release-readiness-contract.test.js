import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')

const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')
const readJson = (...parts) => JSON.parse(readText(...parts))
describe('Electron release readiness contract', () => {
  it('distinguishes the published release from the root candidate version', () => {
    const { version } = readJson('package.json')
    const readme = readText('README.md')

    expect(readme).toContain('current published release is **v1.16.2**')
    expect(readme).toContain(`next release candidate is the untagged\n**v${version}**`)
  })

  it('keeps release-facing docs aligned with the root package version', () => {
    const { version } = readJson('package.json')
    const summary = readText('docs', 'codebase-summary.md')
    const deployment = readText('docs', 'deployment-guide.md')

    expect(summary).toContain('current published\nrelease is `v1.16.2`')
    expect(summary).toContain(`Root package version is \`${version}\`, the next release candidate.`)
    expect(deployment).toContain('current GitHub release workflow publishes Windows packages only')
  })

  it('keeps the GitHub release workflow scoped to Windows Electron packages', () => {
    const release = readText('.github', 'workflows', 'release.yml')
    const windows = readText('.github', 'workflows', 'reusable-windows-qualification.yml')

    expect(release).toContain('name: Build & Release Electron')
    expect(release).toContain('uses: ./.github/workflows/reusable-green-sha-verification.yml')
    expect(windows).toContain('runs-on: windows-latest')
    expect(windows).toContain('npm run electron:builder -- --win nsis portable --publish never')
    expect(windows).toContain('electron-windows-v1-${{ inputs.subject_sha }}')
    expect(windows).toContain('dist-electron/*.exe')
    expect(release).toContain(
      'softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65'
    )

    expect(`${release}\n${windows}`).not.toContain('electron-builder --linux')
    expect(`${release}\n${windows}`).not.toContain('electron-builder --mac')
  })
})
