import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import gate from './pptx-package-claim-gate.js'

const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('package no-OfficeCLI claim gate', () => {
  it('passes a package without OfficeCLI', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'package-gate-'))
    roots.push(root)
    fs.writeFileSync(path.join(root, 'app.txt'), 'app')
    expect(gate.verifyNoOfficeCli([root])).toEqual({
      passed: true, reasons: [], executableInventory: [],
    })
  })

  it('does not flag an OfficeCLI implementation directory without a payload', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'package-gate-source-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'officecli'))
    fs.writeFileSync(path.join(root, 'officecli', 'gateway.js'), 'module.exports = {}')
    expect(gate.verifyNoOfficeCli([root])).toEqual({
      passed: true, reasons: [], executableInventory: [],
    })
  })

  it('fails closed for missing packages and bundled OfficeCLI', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'package-gate-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'tools'))
    fs.writeFileSync(path.join(root, 'tools', 'officecli.exe'), 'binary')
    expect(gate.verifyNoOfficeCli([root]).reasons[0]).toContain('officecli-bundled')
    expect(gate.verifyNoOfficeCli([path.join(root, 'missing')]).reasons[0])
      .toContain('package-target-unavailable')
  })

  it('uses repository package roots when no targets are provided', () => {
    expect(gate.run([])).toBe(0)
  })
})
