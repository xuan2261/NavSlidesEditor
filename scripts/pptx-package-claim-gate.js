#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { parseRawEntries } =
  require('../server/services/pptx-import/package-store/raw-zip')

const FORBIDDEN = /(?:^|[\\/])officecli(?:\.exe)?(?:$|[\\/])/i
const EXECUTABLE = /\.(?:exe|com|bat|cmd|ps1|dll|so|dylib|appimage)$/i

function isForbiddenPayload(candidate) {
  const normalized = candidate.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const officeIndex = parts.findIndex((part) => part.toLowerCase() === 'officecli')
  if (officeIndex >= 0) {
    return officeIndex === parts.length - 1 || parts.slice(officeIndex + 1).some((part) => EXECUTABLE.test(part))
  }
  return /(?:^|\/)officecli\.exe$/i.test(normalized)
}

function walk(root, relative = '', matches = [], inventory = []) {
  const directory = path.join(root, relative)
  if (!fs.existsSync(directory)) return matches
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(relative, entry.name)
    if ((entry.isFile() || entry.isSymbolicLink()) && isForbiddenPayload(child)) matches.push(child)
    if (entry.isFile() && EXECUTABLE.test(child)) inventory.push(child)
    if (entry.isDirectory()) walk(root, child, matches, inventory)
  }
  return matches
}

function verifyNoOfficeCli(paths) {
  const reasons = []
  const inventory = []
  for (const candidate of paths) {
    const resolved = path.resolve(candidate)
    if (!fs.existsSync(resolved)) {
      reasons.push(`package-target-unavailable:${candidate}`)
      continue
    }
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      if (walk(resolved, '', [], inventory).length > 0) reasons.push(`officecli-bundled:${candidate}`)
    } else if (stat.isFile()) {
      const extension = path.extname(resolved).toLowerCase()
      if (extension === '.zip') {
        try {
          const names = parseRawEntries(fs.readFileSync(resolved)).map((entry) => entry.name)
          inventory.push(...names.filter((name) => EXECUTABLE.test(name)))
          if (names.some((name) => isForbiddenPayload(name))) {
            reasons.push(`officecli-bundled:${candidate}`)
          }
        } catch {
          reasons.push(`archive-inspection-failed:${candidate}`)
        }
      } else if (extension === '.asar') {
        reasons.push(`unsupported-archive-format:${candidate}`)
      } else if (FORBIDDEN.test(path.basename(resolved))) {
        reasons.push(`officecli-bundled:${candidate}`)
      } else {
        inventory.push(path.basename(resolved))
      }
    }
  }
  return { passed: reasons.length === 0, reasons, executableInventory: inventory.sort() }
}

function run(argv = process.argv.slice(2)) {
  const targets = argv.filter((arg) => !arg.startsWith('--'))
  const selectedTargets = targets.length ? targets : ['client', 'server', 'electron', 'scripts']
  const report = verifyNoOfficeCli(selectedTargets)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  return report.passed ? 0 : 1
}

if (require.main === module) process.exitCode = run()

module.exports = { FORBIDDEN, run, verifyNoOfficeCli, walk }
