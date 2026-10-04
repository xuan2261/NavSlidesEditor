import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { createSubject } from './education-qualification-stage.mjs'
import { verifyPackageStage } from './education-package-sources.mjs'
const nativeWindowsX64 = process.platform === 'win32' && process.arch === 'x64'
const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'package-stage-'))
  roots.push(root)
  writeFileSync(join(root, 'package-lock.json'), '{}')
  const context = {
    ...createSubject(root),
    schemaVersion: 1,
    runId: 'run',
    policyHash: 'a'.repeat(64),
    frozenAt: new Date(Date.now() - 10000).toISOString(),
  }
  writeFileSync(join(root, 'education-qualification-context.json'), JSON.stringify(context))
  const resources = join(root, 'dist-electron/win-unpacked/resources')
  mkdirSync(resources, { recursive: true })
  const exe = join(root, 'dist-electron/win-unpacked/App.exe'),
    installer = join(root, 'dist-electron/Setup.exe')
  writeFileSync(exe, 'emitted executable')
  writeFileSync(installer, 'emitted installer')
  return { root, context, resources, exe, installer }
}
describe('exact isolated package provenance', () => {
  if (nativeWindowsX64)
    beforeAll(async () => {
      const require = createRequire(import.meta.url)
      await require('app-builder-lib/out/toolsets/7zip.js').getPath7za()
    }, 120000)
  it.runIf(nativeWindowsX64)(
    'rejects an unrelated installer copied into a valid freshly frozen stage',
    async () => {
      const data = fixture()
      await expect(
        Promise.resolve().then(() => verifyPackageStage(data.context, data))
      ).rejects.toThrow(/installer|payload|archive/i)
    },
    125000
  )
  it('rejects wrong run/source/policy stage provenance', async () => {
    const data = fixture()
    for (const key of ['runId', 'subjectHash', 'policyHash'])
      await expect(
        Promise.resolve().then(() => verifyPackageStage({ ...data.context, [key]: 'wrong' }, data))
      ).rejects.toThrow()
  })
  it('rejects installer or executable outside that stage', async () => {
    const data = fixture(),
      other = fixture()
    await expect(
      Promise.resolve().then(() => verifyPackageStage(data.context, { ...data, exe: other.exe }))
    ).rejects.toThrow()
    await expect(
      Promise.resolve().then(() =>
        verifyPackageStage(data.context, { ...data, installer: other.installer })
      )
    ).rejects.toThrow()
  })
  it('rejects changed frozen source even if package artifacts are newly copied', async () => {
    const data = fixture()
    writeFileSync(join(data.root, 'package-lock.json'), '{"changed":true}')
    await expect(
      Promise.resolve().then(() => verifyPackageStage(data.context, data))
    ).rejects.toThrow(/frozen|changed/i)
  })
})
