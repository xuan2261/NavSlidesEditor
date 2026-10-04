import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { verifyInstallerPayload } from './education-installer-payload.mjs'
import { digest, fileHash } from './education-evidence-files.mjs'
import { collectFiles } from '../ci/create-client-dist-manifest.mjs'

const require = createRequire(import.meta.url)
const { getPath7za } = require('app-builder-lib/out/toolsets/7zip.js')
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows.js')
const JSZip = require('jszip')
const nativeWindowsX64 = process.platform === 'win32' && process.arch === 'x64'
const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

async function fixture(mode = 'valid') {
  const root = mkdtempSync(join(tmpdir(), 'real-nsis-'))
  roots.push(root)
  const unpacked = join(root, 'win-unpacked'),
    resources = join(unpacked, 'resources')
  mkdirSync(resources, { recursive: true })
  const exe = join(unpacked, 'App.exe'),
    installer = join(root, 'Setup.exe')
  writeFileSync(exe, 'fixture executable bytes')
  writeFileSync(join(resources, 'app.asar'), 'fixture shell bytes')
  const archive = join(root, 'app-64.7z'),
    tool = await getPath7za()
  execFileSync(tool, ['a', '-t7z', archive, '.'], { cwd: unpacked, stdio: 'pipe' })
  if (mode === 'traversal') {
    const zip = new JSZip()
    zip.file('../escaped.exe', 'hostile bytes')
    writeFileSync(archive, await zip.generateAsync({ type: 'nodebuffer' }))
  }
  if (mode === 'bare' || mode === 'prefixed') {
    writeFileSync(
      installer,
      Buffer.concat([
        mode === 'prefixed' ? Buffer.from('MZ'.padEnd(512, '\0')) : Buffer.alloc(0),
        readFileSync(archive),
      ])
    )
  } else {
    const bootstrap = join(root, 'bootstrap.dat')
    writeFileSync(bootstrap, 'compressed bootstrap bytes\n'.repeat(1000))
    const payloads =
      mode === 'missing'
        ? []
        : [
            `SetCompress ${mode === 'compressed' ? 'force' : 'off'}`,
            `File /oname=app-64.7z "${archive}"`,
            ...(mode === 'ambiguous' ? [`File /oname=app-32.7z "${archive}"`] : []),
          ]
    const script = join(root, 'fixture.nsi')
    writeFileSync(
      script,
      [
        'Unicode true',
        'Name "Qualification fixture"',
        `OutFile "${installer}"`,
        'SetCompressor zlib',
        'SilentInstall silent',
        'Section',
        'InitPluginsDir',
        'SetOutPath "$PLUGINSDIR"',
        ...payloads,
        'SetCompress force',
        `File /oname=bootstrap.dat "${bootstrap}"`,
        'SectionEnd',
      ].join('\n')
    )
    const compiler = await getMakeNsisPath()
    execFileSync(compiler.path, ['-V2', script], {
      env: { ...process.env, ...compiler.env },
      stdio: 'pipe',
      timeout: 120000,
      windowsHide: true,
    })
  }
  return { installer, exe, resources, unpacked }
}

describe.runIf(nativeWindowsX64)('real NSIS outer container admission', () => {
  it('verifies the complete installed bytes through a Copy payload and compressed bootstrap member', async () => {
    const data = await fixture()
    await expect(verifyInstallerPayload(data)).resolves.toEqual({
      installerHash: fileHash(data.installer),
      payloadHash: digest(collectFiles(data.unpacked)),
    })
  }, 120000)
  it.each(['missing', 'ambiguous', 'compressed'])(
    'rejects a real NSIS %s payload without extracting unselected members',
    async (mode) => {
      await expect(verifyInstallerPayload(await fixture(mode))).rejects.toThrow(
        /payload|archive|size/i
      )
    },
    120000
  )
  it.each(['bare', 'prefixed'])(
    'rejects a %s matching inner archive posing as an installer',
    async (mode) => {
      await expect(verifyInstallerPayload(await fixture(mode))).rejects.toThrow(
        /NSIS|Nsis|archive|Command failed/i
      )
    },
    120000
  )
  it('retains inner traversal rejection after genuine NSIS outer admission', async () => {
    await expect(verifyInstallerPayload(await fixture('traversal'))).rejects.toThrow(/unsafe/i)
  }, 120000)
})
