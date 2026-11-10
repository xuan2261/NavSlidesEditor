import { createRequire } from 'node:module'
import { constants, copyFileSync, mkdtempSync, rmSync, lstatSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'

const require = createRequire(import.meta.url)

export function assertPlainPath(target) {
  for (let current = resolve(target); ; current = dirname(current)) {
    if (lstatSync(current).isSymbolicLink())
      throw new Error(`Refusing symbolic link or reparse point: ${current}`)
    if (dirname(current) === current) break
  }
}

export async function withNsisArchiveTool(action) {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('NSIS qualification requires native Windows x64 tooling')
  const packagePath = require.resolve('electron-winstaller/package.json')
  assertPlainPath(packagePath)
  if (!lstatSync(packagePath).isFile())
    throw new Error('Missing package-owned NSIS archive manifest')
  if (JSON.parse(readFileSync(packagePath, 'utf8')).version !== '5.4.0')
    throw new Error('NSIS archive dependency differs from the locked tool contract')
  // This obsolete native parser is limited to locally built NSIS wrappers, not installer uploads.
  const vendor = join(dirname(packagePath), 'vendor')
  const sources = ['7z-x64.exe', '7z-x64.dll'].map((name) => join(vendor, name))
  for (const source of sources) {
    assertPlainPath(source)
    if (!lstatSync(source).isFile()) throw new Error('Missing package-owned NSIS archive tool')
  }
  assertPlainPath(tmpdir())
  const scratch = mkdtempSync(join(tmpdir(), 'navslides-nsis-tool-'))
  try {
    assertPlainPath(scratch)
    const tool = join(scratch, '7z-x64.exe')
    copyFileSync(sources[0], tool, constants.COPYFILE_EXCL)
    // The locked engine loads 7z.dll, while ignore-scripts installs retain its architecture name.
    copyFileSync(sources[1], join(scratch, '7z.dll'), constants.COPYFILE_EXCL)
    return await action(tool)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
