import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Storage atomic writes (I-005)', () => {
  let tmpDir
  let originalDataDir

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-atomic-'))
    originalDataDir = process.env.SLIDES_DATA_DIR
    process.env.SLIDES_DATA_DIR = tmpDir
    // Reset module graph so storage.js re-evaluates DATA_DIR against the new env var.
    vi.resetModules()
  })

  afterEach(async () => {
    if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = originalDataDir
    await fs.remove(tmpDir).catch(() => {})
  })

  async function freshStorage() {
    // ESM-safe re-import: cache-bust via query string on a file:// URL so
    // DATA_DIR re-evaluates against the per-test SLIDES_DATA_DIR. Using
    // pathToFileURL avoids Vite's http:// dev-server URLs in Vitest.
    const storagePath = path.join(__dirname, 'storage.js')
    const cacheBust = `?t=${Date.now()}-${Math.random().toString(36).slice(2)}`
    const url = pathToFileURL(storagePath).href + cacheBust
    const mod = await import(/* @vite-ignore */ url)
    const storage = mod.default || mod
    storage.initDataFiles()
    return storage
  }

  it('concurrent reads never observe truncated JSON during many writes', async () => {
    const storage = await freshStorage()
    const dataFile = path.join(tmpDir, 'presentations.json')

    // Seed
    await storage.writePresentations([{ id: 'pres-0', title: 'Seed', slides: [] }])

    // Interleave 25 writes with 100 reads
    const errors = []
    const writes = Array.from({ length: 25 }, (_, i) =>
      storage.writePresentations([{ id: `pres-${i}`, title: `W${i}`, slides: [] }])
    )
    const reads = Array.from({ length: 100 }, async () => {
      try {
        const data = await fs.readJson(dataFile)
        if (!Array.isArray(data)) errors.push('not-array')
      } catch (err) {
        errors.push(err.message)
      }
    })
    await Promise.all([...writes, ...reads])

    expect(
      errors,
      `no read should observe a truncated/invalid JSON state: ${errors.join(', ')}`
    ).toEqual([])
  })

  it('SIGKILL mid-write leaves valid JSON on disk', async () => {
    // Child spawns a process that writes in a tight loop. Parent SIGKILLs after a delay.
    const childScript = path.join(__dirname, '__storage-crash-child.cjs')

    // Write the child driver inline so the test is self-contained.
    await fs.writeFile(
      childScript,
      `const path = require('path')
process.env.SLIDES_DATA_DIR = ${JSON.stringify(tmpDir)}
const storage = require(path.join(${JSON.stringify(__dirname)}, 'storage.js'))
storage.initDataFiles()
;(async () => {
  let i = 0
  while (true) {
    await storage.writePresentations([{ id: 'p-' + (i++), title: 'crash-' + i, slides: [] }])
  }
})().catch((e) => { console.error(e); process.exit(2) })
`
    )

    const child = spawn(process.execPath, [childScript], { stdio: ['ignore', 'ignore', 'pipe'] })
    await new Promise((resolve) => setTimeout(resolve, 250)) // let it write many times
    child.kill('SIGKILL')
    await new Promise((resolve) => child.on('exit', resolve))

    const dataFile = path.join(tmpDir, 'presentations.json')
    // Either the file is the seed (initDataFiles created []), or a fully-written valid JSON.
    // What it must NOT be: a partial / unparseable JSON.
    const raw = await fs.readFile(dataFile, 'utf8').catch(() => '[]')
    expect(() => JSON.parse(raw), 'presentations.json must parse as valid JSON after SIGKILL').not.toThrow()
    const parsed = JSON.parse(raw)
    expect(Array.isArray(parsed)).toBe(true)

    await fs.remove(childScript).catch(() => {})
  })
})
