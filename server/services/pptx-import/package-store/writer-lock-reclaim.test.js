const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { WriterLock } = require('./writer-lock')

const roots = []

async function createRoot() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-writer-lock-'))
  roots.push(rootDir)
  return rootDir
}

/** A PID that is guaranteed not to be running, without guessing at a free one. */
async function deadPid() {
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
  await new Promise((resolve) => child.on('exit', resolve))
  return child.pid
}

async function writeLock(rootDir, record) {
  await fs.writeFile(path.join(rootDir, 'writer.lock'), JSON.stringify(record))
}

function heldRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    nonce: 'held-nonce',
    host: os.hostname(),
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    epoch: 7,
    ...overrides,
  }
}

afterAll(async () => {
  await Promise.all(roots.map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('writer lock reclaim', () => {
  it('reclaims a lock whose owner died without releasing it', async () => {
    const rootDir = await createRoot()
    await writeLock(rootDir, heldRecord({ pid: await deadPid() }))

    const lock = new WriterLock(rootDir)
    const record = await lock.acquire()

    expect(record.pid).toBe(process.pid)
    expect(lock.reclaimedFrom).not.toBeNull()
    await expect(lock.assertOwned()).resolves.toBeUndefined()
  })

  it('advances the fencing epoch past the abandoned owner', async () => {
    const rootDir = await createRoot()
    await fs.writeFile(
      path.join(rootDir, 'fencing-epoch.json'),
      JSON.stringify({ schemaVersion: 1, epoch: 7 })
    )
    await writeLock(rootDir, heldRecord({ pid: await deadPid() }))

    const record = await new WriterLock(rootDir).acquire()

    expect(record.epoch).toBe(8)
    const persisted = JSON.parse(
      await fs.readFile(path.join(rootDir, 'fencing-epoch.json'), 'utf8')
    )
    expect(persisted.epoch).toBe(8)
  })

  it('refuses a lock whose owner is still running', async () => {
    const rootDir = await createRoot()
    await writeLock(rootDir, heldRecord())

    await expect(new WriterLock(rootDir).acquire()).rejects.toThrow(/writer lock is held/)
  })

  it('refuses a lock taken by another host, whose owner cannot be probed', async () => {
    const rootDir = await createRoot()
    await writeLock(rootDir, heldRecord({ host: `${os.hostname()}-elsewhere`, pid: await deadPid() }))

    await expect(new WriterLock(rootDir).acquire()).rejects.toThrow(/writer lock is held/)
  })

  it('refuses a lock whose record cannot be read, proving nothing', async () => {
    const rootDir = await createRoot()
    await fs.writeFile(path.join(rootDir, 'writer.lock'), 'not json')

    await expect(new WriterLock(rootDir).acquire()).rejects.toThrow(/writer lock is held/)
  })

  it('leaves an uncontested acquire unmarked as a reclaim', async () => {
    const lock = new WriterLock(await createRoot())
    await lock.acquire()

    expect(lock.reclaimedFrom).toBeNull()
    await lock.release()
  })
})
