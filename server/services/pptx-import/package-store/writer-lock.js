const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { writeDurable } = require('./durable-fs')

const HELD_MESSAGE = 'Package store writer lock is held; stale reclaim requires proven owner absence'

/**
 * A lock keeps its claim while its owner could still be running. Only ESRCH
 * proves the owner is gone: EPERM means it is alive under another user, and a
 * record written by a different host cannot be probed at all. Anything short of
 * proof — including an unreadable record — leaves the lock in place.
 */
function ownerIsProvablyGone(record) {
  if (!record || record.host !== os.hostname()) return false
  const pid = Number(record.pid)
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return false
  } catch (error) {
    return error.code === 'ESRCH'
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
      schemaVersion: 1,
      nonce: crypto.randomUUID(),
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
    if (!ownerIsProvablyGone(record)) return null
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
      console.warn(
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
