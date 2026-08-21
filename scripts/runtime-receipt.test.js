import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import receiptModule from './runtime-receipt.js'

const { collectArtifacts, createRuntimeReceipt } = receiptModule

const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true })
})

describe('runtime receipt', () => {
  it('records deterministic lock, tree, vendor and artifact hashes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'navslides-receipt-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'electron'), { recursive: true })
    fs.mkdirSync(path.join(root, 'server', 'node_modules', 'express'), { recursive: true })
    fs.mkdirSync(path.join(root, 'server', 'vendor'), { recursive: true })
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}')
    fs.writeFileSync(path.join(root, 'electron', 'server-package-lock.json'), '{"lockfileVersion":3}')
    fs.writeFileSync(
      path.join(root, 'server', 'node_modules', 'express', 'package.json'),
      '{"name":"express","version":"4.22.2"}'
    )
    fs.writeFileSync(path.join(root, 'server', 'vendor', 'vendor-manifest.json'), '{"files":[]}')
    fs.writeFileSync(path.join(root, 'artifact.bin'), 'artifact')

    const receipt = createRuntimeReceipt({
      rootDir: root,
      versions: { node: '22.22.0' },
      baseImage: 'node@sha256:test',
      artifacts: ['artifact.bin'],
      environment: { node: 'v22.22.0', npm: '10.2.4', os: 'win32', arch: 'x64' },
    })

    expect(receipt.schemaVersion).toBe(1)
    expect(receipt.environment).toEqual({
      node: 'v22.22.0',
      npm: '10.2.4',
      os: 'win32',
      arch: 'x64',
    })
    expect(receipt.baseImage).toBe('node@sha256:test')
    expect(receipt.hashes.rootLock).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.hashes.electronServerLock).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.hashes.productionTree).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.hashes.vendorManifest).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.artifacts).toEqual([
      { path: 'artifact.bin', bytes: 8, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ])
  })

  it('excludes stale and builder-debug artifacts from release receipts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'navslides-artifacts-'))
    roots.push(root)
    const output = path.join(root, 'dist-electron')
    fs.mkdirSync(output)
    for (const name of [
      'NavSlides Editor 1.15.7.exe',
      'NavSlides Editor 1.14.2.exe',
      'latest.yml',
      'builder-debug.yml',
    ]) {
      fs.writeFileSync(path.join(output, name), name)
    }

    expect(collectArtifacts(root, 'dist-electron', '1.15.7')).toEqual([
      'dist-electron/NavSlides Editor 1.15.7.exe',
      'dist-electron/latest.yml',
    ])
  })
})
