import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const require = createRequire(import.meta.url)
const { getPath7za } = require('app-builder-lib/out/toolsets/7zip.js')
const JSZip = require('jszip')
const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'installer-payload-'))
  roots.push(root)
  const unpacked = join(root, 'win-unpacked'),
    resources = join(unpacked, 'resources')
  mkdirSync(resources, { recursive: true })
  writeFileSync(join(unpacked, 'App.exe'), 'actual executable bytes')
  writeFileSync(join(resources, 'app.asar'), 'actual shell bytes')
  writeFileSync(join(resources, 'client-dist-manifest.json'), 'actual client manifest')
  const archive = join(root, 'app-64.7z'),
    tool = await getPath7za()
  execFileSync(tool, ['a', '-t7z', archive, '.'], { cwd: unpacked, stdio: 'pipe' })
  return { root, unpacked, resources, archive, tool }
}
describe('installer inner archive real-byte equality', () => {
  it('accepts actual matching compressed payload and rejects a copied unrelated one', async () => {
    const data = await fixture()
    const { verifyPayloadArchive } = await import('./education-installer-payload.mjs')
    await verifyPayloadArchive(data.tool, data.archive, data.unpacked)
    writeFileSync(join(data.resources, 'app.asar'), 'other revision shell bytes')
    await expect(verifyPayloadArchive(data.tool, data.archive, data.unpacked)).rejects.toThrow(
      /payload|differ/i
    )
  })
  it.each(['missing', 'extra', 'exe'])(
    'rejects %s bytes even with intact matching resource subset',
    async (kind) => {
      const data = await fixture()
      const { verifyPayloadArchive } = await import('./education-installer-payload.mjs')
      if (kind === 'missing') rmSync(join(data.resources, 'app.asar'))
      if (kind === 'extra')
        writeFileSync(join(data.resources, 'extra.js'), 'extra installed behavior')
      if (kind === 'exe') writeFileSync(join(data.unpacked, 'App.exe'), 'wrong executable')
      await expect(verifyPayloadArchive(data.tool, data.archive, data.unpacked)).rejects.toThrow(
        /payload|differ/i
      )
    }
  )
  it('bounds extraction using declared expanded byte limits before writing payload bytes', async () => {
    const data = await fixture()
    const { verifyPayloadArchive } = await import('./education-installer-payload.mjs')
    await expect(
      verifyPayloadArchive(data.tool, data.archive, data.unpacked, { maxBytes: 8 })
    ).rejects.toThrow(/limit|bound/i)
  })
  it.each(['traversal', 'collision', 'link'])(
    'rejects %s archive metadata before extraction',
    async (kind) => {
      const data = await fixture(),
        zip = new JSZip()
      const { verifyPayloadArchive } = await import('./education-installer-payload.mjs')
      if (kind === 'traversal') zip.file('../escaped.exe', 'hostile executable')
      if (kind === 'collision') {
        zip.file('App.exe', 'first')
        zip.file('APP.exe', 'second')
      }
      if (kind === 'link') zip.file('linked', '../outside', { unixPermissions: 0o120777 })
      writeFileSync(data.archive, await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' }))
      await expect(verifyPayloadArchive(data.tool, data.archive, data.unpacked)).rejects.toThrow(
        /unsafe|duplicate|link/i
      )
    }
  )
})

describe('unsupported native installer platform refusal', () => {
  it.each([
    ['linux', 'x64'],
    ['darwin', 'arm64'],
    ['win32', 'arm64'],
  ])('refuses tooling on %s %s with valid ordinary fixture paths', async (platform, arch) => {
    const data = await fixture(),
      installer = join(data.root, 'Setup.exe')
    writeFileSync(installer, 'ordinary installer fixture bytes')
    const code = `
      const assert = await import('node:assert/strict')
      const { verifyInstallerPayload } = await import(process.argv[1])
      Object.defineProperty(process, 'platform', { value: process.argv[2] })
      Object.defineProperty(process, 'arch', { value: process.argv[3] })
      await assert.default.rejects(verifyInstallerPayload(JSON.parse(process.argv[4])), /native Windows x64 tooling/)
    `
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        code,
        new URL('./education-installer-payload.mjs', import.meta.url).href,
        platform,
        arch,
        JSON.stringify({
          installer,
          exe: join(data.unpacked, 'App.exe'),
          resources: data.resources,
        }),
      ],
      {
        stdio: 'pipe',
        timeout: 10000,
        windowsHide: true,
        env: { ...process.env, ELECTRON_BUILDER_7ZIP_PATH: '', NODE_OPTIONS: '' },
      }
    )
  })
})
