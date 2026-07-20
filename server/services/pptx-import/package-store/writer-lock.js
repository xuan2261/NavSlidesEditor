const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { writeDurable } = require('./durable-fs')

class WriterLock {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.lockPath = path.join(rootDir, 'writer.lock')
    this.epochPath = path.join(rootDir, 'fencing-epoch.json')
    this.nonce = null
    this.epoch = 0
  }

  async acquire() {
    await fs.mkdir(this.rootDir, { recursive: true })
    let previous = 0
    try {
      previous = JSON.parse(await fs.readFile(this.epochPath, 'utf8')).epoch
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const record = {
      schemaVersion: 1,
      nonce: crypto.randomUUID(),
      host: os.hostname(),
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
      epoch: previous + 1,
    }
    try {
      await writeDurable(this.lockPath, JSON.stringify(record), { flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new Error('Package store writer lock is held; stale reclaim requires proven owner absence')
      }
      throw error
    }
    await writeDurable(this.epochPath, JSON.stringify({ schemaVersion: 1, epoch: record.epoch }))
    this.nonce = record.nonce
    this.epoch = record.epoch
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
