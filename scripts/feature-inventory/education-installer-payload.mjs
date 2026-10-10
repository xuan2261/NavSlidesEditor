import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, lstatSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { collectFiles } from '../ci/create-client-dist-manifest.mjs'
import { digest, fileHash } from './education-evidence-files.mjs'

const require = createRequire(import.meta.url)
const LIMITS = Object.freeze({ maxBytes: 500 * 1024 * 1024, maxFiles: 50000 })
function invoke(tool, args) {
  return execFileSync(tool, args, {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  })
}
export function assertPlainPath(target) {
  for (let current = resolve(target); ; current = dirname(current)) {
    if (lstatSync(current).isSymbolicLink())
      throw new Error(`Refusing symbolic link or reparse point: ${current}`)
    if (dirname(current) === current) break
  }
}
function nsisArchiveTool() {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('NSIS qualification requires native Windows x64 tooling')
  const packagePath = require.resolve('electron-winstaller/package.json')
  if (JSON.parse(readFileSync(packagePath, 'utf8')).version !== '5.4.0')
    throw new Error('NSIS archive dependency differs from the locked tool contract')
  // This obsolete native parser is limited to locally built NSIS wrappers, not installer uploads.
  const tool = join(dirname(packagePath), 'vendor', '7z-x64.exe')
  for (const path of [tool, join(dirname(tool), '7z-x64.dll')]) {
    assertPlainPath(path)
    if (!lstatSync(path).isFile()) throw new Error('Missing package-owned NSIS archive tool')
  }
  return tool
}
function listArchive(tool, archive, limits = LIMITS, format = null) {
  assertPlainPath(archive)
  if (!lstatSync(archive).isFile() || lstatSync(archive).size > LIMITS.maxBytes)
    throw new Error('Installer archive exceeds file bound')
  const output = invoke(tool, [
    'l',
    ...(format ? [`-t${format}`] : []),
    '-slt',
    '-sccUTF-8',
    archive,
  ])
  const sections = output.replaceAll('\r\n', '\n').split(/^----------$/m)
  if (sections.length !== 2) throw new Error('Unrecognized installer archive listing')
  const entries = [],
    paths = new Set()
  let bytes = 0
  for (const block of sections[1].trim().split(/\n\s*\n/)) {
    const fields = Object.create(null)
    for (const row of block.split('\n')) {
      const at = row.indexOf(' = ')
      if (at < 1 || Object.hasOwn(fields, row.slice(0, at)))
        throw new Error('Invalid installer archive entry')
      fields[row.slice(0, at)] = row.slice(at + 3)
    }
    const raw = fields.Path,
      path = raw?.replaceAll('\\', '/')
    if (
      !path ||
      path !== path.normalize('NFC') ||
      /[\x00-\x1f\x7f:*?]/.test(path) ||
      path.startsWith('/') ||
      path
        .split('/')
        .some(
          (part) =>
            !part ||
            part === '.' ||
            part === '..' ||
            /[. ]$/.test(part) ||
            /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
        )
    )
      throw new Error('Unsafe installer archive path')
    if (paths.has(path.toLowerCase())) throw new Error('Duplicate installer archive path')
    paths.add(path.toLowerCase())
    if (
      Object.keys(fields).some((key) => /link|reparse/i.test(key)) ||
      /(?:^|\s)l[rwx-]{9}|reparse/i.test(fields.Attributes || '')
    )
      throw new Error('Installer archive contains a link')
    const directory = fields.Folder === '+' || /^D|\sD/.test(fields.Attributes || '')
    const unknown =
      !directory && format === 'Nsis' && fields.Size === '' && fields.Method === 'Deflate'
    const size = directory ? 0 : unknown ? null : Number(fields.Size)
    if (size !== null && (!Number.isSafeInteger(size) || size < 0))
      throw new Error('Invalid installer expanded size')
    if (!directory && !unknown && !/^\d+$/.test(fields.Size || ''))
      throw new Error('Invalid installer expanded size')
    bytes += size ?? 0
    entries.push({ raw, path, size, directory, method: fields.Method })
    if (bytes > limits.maxBytes || entries.length > limits.maxFiles)
      throw new Error('Installer expanded payload exceeds extraction limit')
  }
  if (!entries.length) throw new Error('Installer archive has no payload')
  const byPath = new Map(entries.map((entry) => [entry.path.toLowerCase(), entry]))
  for (const entry of entries) {
    const parts = entry.path.split('/')
    for (let index = 1; index < parts.length; index++) {
      const parent = parts.slice(0, index).join('/').toLowerCase()
      if (byPath.get(parent)?.directory === false)
        throw new Error('Installer archive file/directory collision')
    }
  }
  return { entries, header: sections[0] }
}
export async function verifyPayloadArchive(tool, archive, unpacked, limits = LIMITS) {
  const bounded = { ...LIMITS, ...limits }
  for (const [key, value] of Object.entries(bounded))
    if (
      !Object.hasOwn(LIMITS, key) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > LIMITS[key]
    )
      throw new Error('Invalid extraction limit')
  assertPlainPath(unpacked)
  const expected = collectFiles(unpacked)
  const listing = listArchive(tool, archive, bounded)
  if (!/^Type = 7z\s*$/im.test(listing.header))
    throw new Error('NSIS payload must be a real 7z archive')
  const declared = listing.entries.filter((entry) => !entry.directory)
  const expectedByPath = new Map(expected.map((file) => [file.path, file]))
  if (
    declared.length !== expected.length ||
    declared.some((entry) => expectedByPath.get(entry.path)?.bytes !== entry.size)
  )
    throw new Error('Installer payload differs from the exercised unpacked app')
  const before = fileHash(archive),
    scratch = mkdtempSync(join(tmpdir(), 'navslides-payload-'))
  try {
    invoke(tool, ['x', '-bd', '-y', `-o${scratch}`, archive])
    const actual = collectFiles(scratch)
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error('Installer payload bytes differ from the exercised unpacked app')
    if (
      fileHash(archive) !== before ||
      JSON.stringify(collectFiles(unpacked)) !== JSON.stringify(expected)
    )
      throw new Error('Installer payload changed during extraction')
    return { payloadHash: digest(actual) }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
export async function verifyInstallerPayload({ installer, exe, resources }) {
  assertPlainPath(installer)
  assertPlainPath(exe)
  assertPlainPath(resources)
  const unpacked = dirname(resolve(exe))
  if (resolve(resources) !== join(unpacked, 'resources'))
    throw new Error('Installer resources must belong to the exercised unpacked executable')
  // No PATH/system/environment fallback. Standalone builder 7za cannot read the outer NSIS format.
  if (process.env.ELECTRON_BUILDER_7ZIP_PATH)
    throw new Error('Unverified 7zip tool override is not admissible')
  const { getPath7za } = require('app-builder-lib/out/toolsets/7zip.js')
  const tool = nsisArchiveTool(),
    innerTool = await getPath7za()
  const installerHash = fileHash(installer),
    listing = listArchive(tool, resolve(installer), LIMITS, 'Nsis')
  if (!/^Type = Nsis\s*$/im.test(listing.header))
    throw new Error('Installer must be an actual NSIS payload archive')
  const payloads = listing.entries.filter((entry) =>
    /(?:^|\/)app-(?:32|64|arm64)\.(?:7z|zip)$/i.test(entry.path)
  )
  if (
    payloads.length !== 1 ||
    payloads[0].path !== '$PLUGINSDIR/app-64.7z' ||
    payloads[0].directory
  )
    throw new Error('Installer must contain one unambiguous x64 NSIS payload')
  if (
    payloads[0].method !== 'Copy' ||
    !Number.isSafeInteger(payloads[0].size) ||
    payloads[0].size < 1 ||
    payloads[0].size > LIMITS.maxBytes
  )
    throw new Error('NSIS selected payload requires a bounded exact Copy size')
  const scratch = mkdtempSync(join(tmpdir(), 'navslides-installer-'))
  try {
    invoke(tool, [
      'x',
      '-tNsis',
      '-bd',
      '-y',
      '-spd',
      `-o${scratch}`,
      resolve(installer),
      payloads[0].raw,
    ])
    const archive = join(scratch, '$PLUGINSDIR', 'app-64.7z')
    assertPlainPath(archive)
    if (!lstatSync(archive).isFile() || lstatSync(archive).size !== payloads[0].size)
      throw new Error('Installer payload archive size mismatch')
    const result = await verifyPayloadArchive(innerTool, archive, unpacked)
    if (fileHash(installer) !== installerHash)
      throw new Error('Installer changed during payload verification')
    return { installerHash, ...result }
  } catch (error) {
    throw new Error(`Installer payload verification failed: ${error.message}`, { cause: error })
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
