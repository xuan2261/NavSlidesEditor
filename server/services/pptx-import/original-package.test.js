import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import originalPackage from './original-package.js'

const {
  persistOriginalPptx,
  verifySha256,
  sha256Buffer,
  deleteOriginalPptx,
  readOriginalPptx,
  resolveOriginalPath,
  getOriginalsDir,
} = originalPackage

describe('original-package (T1.x zero-loss)', () => {
  /** @type {string[]} */
  const tempDirs = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })))
  })

  async function tempBase() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-orig-'))
    tempDirs.push(dir)
    return dir
  }

  it('T1.1 persistOriginalPptx writes file and verifySha256 matches', async () => {
    const baseDir = await tempBase()
    const buf = Buffer.from('PK\x03\x04-fake-pptx-bytes')
    const artifact = await persistOriginalPptx(buf, { baseDir })

    expect(artifact.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(artifact.byteLength).toBe(buf.byteLength)
    expect(artifact.sha256).toBe(sha256Buffer(buf))
    expect(verifySha256(buf, artifact.sha256).ok).toBe(true)

    const onDisk = await fs.readFile(artifact.filePath)
    expect(onDisk.equals(buf)).toBe(true)
    expect(artifact.filePath).toBe(path.join(getOriginalsDir(baseDir), `${artifact.id}.pptx`))
  })

  it('T1.2 path rejects ../ and absolute escape ids', async () => {
    const baseDir = await tempBase()
    await expect(resolveOriginalPath('../etc/passwd', { baseDir })).rejects.toThrow(/Invalid original package id/i)
    await expect(resolveOriginalPath('C:\\\\Windows\\\\evil', { baseDir })).rejects.toThrow(/Invalid original package id/i)
    await expect(resolveOriginalPath('../../outside', { baseDir })).rejects.toThrow(/Invalid original package id/i)
  })

  it('T1.3 oversize buffer rejected with 413 semantics', async () => {
    const baseDir = await tempBase()
    const buf = Buffer.alloc(64)
    await expect(persistOriginalPptx(buf, { baseDir, maxBytes: 16 })).rejects.toMatchObject({
      status: 413,
    })
    const names = await fs.readdir(getOriginalsDir(baseDir)).catch(() => [])
    expect(names.filter((n) => n.endsWith('.pptx'))).toHaveLength(0)
  })

  it('deleteOriginalPptx removes stored file; read returns null after', async () => {
    const baseDir = await tempBase()
    const artifact = await persistOriginalPptx(Buffer.from('x'), { baseDir })
    expect(await deleteOriginalPptx(artifact.id, { baseDir })).toBe(true)
    expect(await readOriginalPptx(artifact.id, { baseDir })).toBeNull()
    expect(await deleteOriginalPptx(artifact.id, { baseDir })).toBe(false)
  })

  it('persist from file path copies bytes with matching sha256', async () => {
    const baseDir = await tempBase()
    const src = path.join(baseDir, 'upload.pptx')
    const buf = Buffer.from(`upload-${crypto.randomUUID()}`)
    await fs.writeFile(src, buf)
    const artifact = await persistOriginalPptx(src, { baseDir })
    expect(artifact.sha256).toBe(sha256Buffer(buf))
    expect((await readOriginalPptx(artifact.id, { baseDir })).equals(buf)).toBe(true)
  })
})
