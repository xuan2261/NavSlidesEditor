const logger = require('../../logger')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { writeDurable } = require('./durable-fs')

const HELD_MESSAGE =
  'Package store writer lock is held; stale reclaim requires proven owner absence'
const PROCESS_INSTANCE_ID = crypto.randomUUID()

/**
 * A lock keeps its claim while its owner could still be running. ESRCH proves
 * the owner is gone. A live PID is weaker evidence than it looks: a container
 * restart reuses the PID namespace, so the recorded number can belong to an
 * unrelated fresh process — one that started after `acquiredAt` cannot be the
 * owner and is safe to reclaim past. A reused PID is also safe when it is our
 * own PID but the durable process-instance nonce differs: two live processes
 * on one host cannot have the same PID, so the recorded incarnation has ended.
 * EPERM, foreign-host records, legacy same-PID records, and unreadable records
 * prove nothing and therefore keep the lock in place.
 */
async function ownerIsProvablyGone(record) {
  if (!record || record.host !== os.hostname()) return false
  const pid = Number(record.pid)
  if (!Number.isInteger(pid) || pid <= 0) return false
  if (
    pid === process.pid &&
    typeof record.processInstanceId === 'string' &&
    record.processInstanceId.length > 0 &&
    record.processInstanceId !== PROCESS_INSTANCE_ID
  )
    return true
  try {
    process.kill(pid, 0)
  } catch (error) {
    return error.code === 'ESRCH'
  }
  return pidStartedAfterRecord(pid, record)
}

/**
 * True when the live process at `pid` began after the lock record was
 * written — impossible for the real owner, so the recorded process is gone.
 * Compares the /proc entry's creation time on Linux; other platforms and
 * unreadable fields stay conservative. A /proc entry that vanishes between
 * the liveness check and the stat means the owner died mid-check.
 */
async function pidStartedAfterRecord(pid, record) {
  if (process.platform !== 'linux') return false
  const acquiredAt = Date.parse(record.acquiredAt)
  if (!Number.isFinite(acquiredAt)) return false
  try {
    const procStartedAt = (await fs.stat(`/proc/${pid}`)).ctimeMs
    return procStartedAt > acquiredAt
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return true
    return false
  }
}

class WriterLock {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.lockPath = path.join(rootDir, 'writer.lock')
    this.epochPath = path.join(rootDir, 'fencing-epoch.json')
    this.nonce = null
    this.epoch = 0
    this.reclaimedFrom = null
  }

  async readEpoch() {
    try {
      return JSON.parse(await fs.readFile(this.epochPath, 'utf8')).epoch
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      return 0
    }
  }

  /**
   * Exclusive create is the only way to take the lock, so two processes racing
   * to reclaim the same abandoned lock cannot both win. The loser fails to
   * claim; a loser that already believed it held the lock fails assertOwned()
   * against the winner's nonce and epoch.
   */
  async claim() {
    const record = {
      schemaVersion: 2,
      nonce: crypto.randomUUID(),
      processInstanceId: PROCESS_INSTANCE_ID,
      host: os.hostname(),
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
      epoch: (await this.readEpoch()) + 1,
    }
    try {
      await writeDurable(this.lockPath, JSON.stringify(record), { flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') return null
      throw error
    }
    return record
  }

  /**
   * Release a lock left behind by a process that died without unlocking — what
   * Ctrl+C, a container stop, or a power loss produces. Without this the store
   * stays wedged until an operator deletes the file by hand.
   */
  async reclaimAbandoned() {
    let record
    try {
      record = JSON.parse(await fs.readFile(this.lockPath, 'utf8'))
    } catch {
      return null
    }
    if (!(await ownerIsProvablyGone(record))) return null
    try {
      await fs.unlink(this.lockPath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    return record
  }

  async acquire() {
    await fs.mkdir(this.rootDir, { recursive: true })
    let record = await this.claim()
    let reclaimed = null
    if (!record) {
      reclaimed = await this.reclaimAbandoned()
      if (reclaimed) record = await this.claim()
    }
    if (!record) throw new Error(HELD_MESSAGE)
    if (reclaimed) {
      logger.warn(
        `[package-store] reclaimed writer lock abandoned by pid ${reclaimed.pid} ` +
          `at ${reclaimed.acquiredAt}; fencing epoch ${reclaimed.epoch} -> ${record.epoch}`
      )
    }
    await writeDurable(this.epochPath, JSON.stringify({ schemaVersion: 1, epoch: record.epoch }))
    this.nonce = record.nonce
    this.epoch = record.epoch
    this.reclaimedFrom = reclaimed
    return record
  }

  async assertOwned(expectedEpoch = this.epoch) {
    let record
    try {
      record = JSON.parse(await fs.readFile(this.lockPath, 'utf8'))
    } catch {
      throw new Error('Package store writer lock ownership cannot be verified')
    }
    const epoch = JSON.parse(await fs.readFile(this.epochPath, 'utf8')).epoch
    if (record.nonce !== this.nonce || record.epoch !== expectedEpoch || epoch !== expectedEpoch) {
      throw new Error('Package store fencing epoch is stale')
    }
  }

  async release() {
    if (!this.nonce) return
    await this.assertOwned()
    await fs.unlink(this.lockPath)
    this.nonce = null
  }
}

module.exports = { WriterLock }
