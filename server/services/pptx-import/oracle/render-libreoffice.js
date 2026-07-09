const { spawnSync } = require('node:child_process')
const fs = require('fs-extra')
const path = require('node:path')
const os = require('node:os')

const CANDIDATES = ['soffice', 'libreoffice', 'soffice.exe']

function findLibreOfficeBinary() {
  for (const name of CANDIDATES) {
    const probe = spawnSync(name, ['--version'], { encoding: 'utf8', windowsHide: true })
    if (!probe.error && probe.status === 0) return name
  }
  return null
}

/**
 * Convert PPTX to PNG via LibreOffice headless (maintainer / optional path).
 * Not required for CI golden mode.
 * @returns {Promise<{ ok: boolean, outDir?: string, files?: string[], error?: string }>}
 */
async function renderPptxWithLibreOffice(pptxPath, options = {}) {
  const binary = options.binary || findLibreOfficeBinary()
  if (!binary) {
    return { ok: false, error: 'libreoffice-missing', code: 'LO_MISSING' }
  }
  const outDir = options.outDir || (await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-lo-')))
  await fs.ensureDir(outDir)
  const args = [
    '--headless',
    '--nologo',
    '--nolockcheck',
    '--nodefault',
    '--norestore',
    '--convert-to',
    'png',
    '--outdir',
    outDir,
    path.resolve(pptxPath),
  ]
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeoutMs || 120_000,
  })
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      error: result.error?.message || result.stderr || 'libreoffice-convert-failed',
      code: 'LO_FAILED',
      outDir,
    }
  }
  const files = (await fs.readdir(outDir))
    .filter((n) => n.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b))
    .map((n) => path.join(outDir, n))
  return { ok: true, outDir, files }
}

module.exports = {
  findLibreOfficeBinary,
  renderPptxWithLibreOffice,
}
