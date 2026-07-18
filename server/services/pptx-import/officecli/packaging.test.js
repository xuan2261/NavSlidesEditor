import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const PACKAGING_FILES = ['Dockerfile', 'electron-builder.yml', 'scripts/prepare-electron.js']
const PAYLOAD_PATTERN = /officecli(?:\.exe|\.msi|[-_.].*\.(?:zip|tar|gz|exe|msi))$/i
const DOWNLOAD_PATTERN = /(?:curl|wget|invoke-webrequest|start-bitstransfer).*officecli/i

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'data', 'uploads'].includes(entry.name)) return []
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? walkFiles(absolute) : [absolute]
  })
}

describe('OfficeCLI first-release packaging guards', () => {
  it('does not bundle an OfficeCLI binary payload in packaged roots', () => {
    const packagedRoots = ['server', 'electron', 'build', 'scripts']
    const payloads = packagedRoots
      .flatMap((entry) => walkFiles(path.join(ROOT, entry)))
      .filter((file) => PAYLOAD_PATTERN.test(path.basename(file)))
    expect(payloads).toEqual([])
  })

  it.each(PACKAGING_FILES)('%s contains no OfficeCLI download command', (relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
    expect(content).not.toMatch(DOWNLOAD_PATTERN)
  })

  it('Electron resources do not declare an OfficeCLI payload', () => {
    const config = fs.readFileSync(path.join(ROOT, 'electron-builder.yml'), 'utf8')
    expect(config).not.toMatch(/(?:from|to|filter):\s*['"]?.*officecli/i)
  })

  it('Docker never copies an OfficeCLI payload from the build context', () => {
    const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8')
    expect(dockerfile).not.toMatch(/^(?:ADD|COPY)\s+.*officecli/im)
  })
})
