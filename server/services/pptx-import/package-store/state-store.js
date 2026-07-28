const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { replaceDurable, writeDurable } = require('./durable-fs')
const { createEmptyState, hashRecord, validateState, validateStateRoot } = require('./schemas')

/**
 * Each root embeds its predecessor, so an unbounded chain makes state-root.json
 * grow by one full root per publish and rewrites the whole thing every time.
 * Keeping a few generations is what recovery can actually use; older roots only
 * reference index files that retention is free to collect.
 */
const MAX_PREDECESSOR_DEPTH = 3

function boundPredecessors(root, depth = MAX_PREDECESSOR_DEPTH) {
  if (!root || depth <= 0) return null
  return { ...root, predecessor: boundPredecessors(root.predecessor, depth - 1) }
}

class StateStore {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.indexDir = path.join(rootDir, 'indexes')
    this.walDir = path.join(rootDir, 'wal')
    this.quarantineDir = path.join(rootDir, 'quarantine')
    this.rootPath = path.join(rootDir, 'state-root.json')
    this.matrixAuthorityHighWaterPath = path.join(
      rootDir, 'matrix-authority-epoch-high-water.json'
    )
    this.state = createEmptyState()
    this.root = null
    this.recoveryActions = []
  }

  async init() {
    await Promise.all([
      fs.mkdir(this.indexDir, { recursive: true }),
      fs.mkdir(this.walDir, { recursive: true }),
      fs.mkdir(this.quarantineDir, { recursive: true }),
    ])
    await this.recover()
  }

  async reload() {
    this.state = createEmptyState()
    this.root = null
    this.recoveryActions = []
    await this.recover()
  }

  async readValidatedRoot(root) {
    validateStateRoot(root)
    if (!root.stateFile) throw new Error('Invalid state root file')
    const state = JSON.parse(await fs.readFile(path.join(this.rootDir, root.stateFile), 'utf8'))
    if (hashRecord(state) !== root.stateHash) throw new Error('State index hash mismatch')
    return validateState(state)
  }

  /**
   * Fall back through the retained roots until one validates. The chain is
   * bounded at publish time, so the walk terminates.
   */
  async restoreFromPredecessor(root) {
    let candidate = root?.predecessor
    while (candidate) {
      try {
        return { root: candidate, state: await this.readValidatedRoot(candidate) }
      } catch {
        candidate = candidate.predecessor
      }
    }
    return null
  }

  async recover() {
    let serialized
    try {
      serialized = await fs.readFile(this.rootPath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.recoverMatrixAuthorityHighWater()
        return
      }
      throw error
    }
    this.root = JSON.parse(serialized)
    try {
      this.state = await this.readValidatedRoot(this.root)
    } catch (error) {
      const restored = await this.restoreFromPredecessor(this.root)
      if (!restored) throw error
      this.state = restored.state
      this.root = restored.root
      await writeDurable(this.rootPath, JSON.stringify(this.root))
      this.recoveryActions.push('restored-verified-predecessor')
    }
    const names = await fs.readdir(this.walDir)
    for (const name of names.filter((entry) => entry.endsWith('.prepared.json'))) {
      const txId = name.slice(0, -'.prepared.json'.length)
      const completed = path.join(this.walDir, `${txId}.completed`)
      if (this.root?.transactionId === txId) {
        await writeDurable(completed, 'completed')
        this.recoveryActions.push('completed-published-wal')
      } else {
        await fs.rename(path.join(this.walDir, name), path.join(this.quarantineDir, name))
        this.recoveryActions.push('quarantined-unpublished-prepared-wal')
      }
    }
    await this.recoverMatrixAuthorityHighWater()
  }

  async readMatrixAuthorityHighWater() {
    try {
      const record = JSON.parse(await fs.readFile(this.matrixAuthorityHighWaterPath, 'utf8'))
      if (record?.schemaVersion !== 1 ||
        !Number.isSafeInteger(record.matrixAuthorityEpoch) ||
        record.matrixAuthorityEpoch < 1) {
        throw new TypeError('Invalid matrix authority high-water record')
      }
      return record.matrixAuthorityEpoch
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  async persistMatrixAuthorityHighWater(matrixAuthorityEpoch) {
    const current = await this.readMatrixAuthorityHighWater()
    if (current !== null && current > matrixAuthorityEpoch) {
      throw new TypeError('Matrix authority epoch regression')
    }
    if (current === matrixAuthorityEpoch) return
    await writeDurable(this.matrixAuthorityHighWaterPath, JSON.stringify({
      schemaVersion: 1,
      matrixAuthorityEpoch,
    }))
  }

  async recoverMatrixAuthorityHighWater() {
    const highWater = await this.readMatrixAuthorityHighWater()
    if (highWater === null) {
      await this.persistMatrixAuthorityHighWater(this.state.matrixAuthorityEpoch)
      return
    }
    if (this.state.matrixAuthorityEpoch > highWater) {
      await this.persistMatrixAuthorityHighWater(this.state.matrixAuthorityEpoch)
      return
    }
    if (this.state.matrixAuthorityEpoch >= highWater) return
    this.state.matrixAuthorityEpoch = highWater
    this.recoveryActions.push('advanced-matrix-authority-high-water')
  }

  async publish(nextState, {
    assertWriter,
    faultAfterIndex = false,
    faultAfterPrepare = false,
    faultAfterRoot = false,
    faultAfterCompletion = false,
  } = {}) {
    await assertWriter()
    validateState(nextState)
    await this.persistMatrixAuthorityHighWater(nextState.matrixAuthorityEpoch)
    const transactionId = crypto.randomUUID()
    const stateHash = hashRecord(nextState)
    const relativeStateFile = path.join('indexes', `${stateHash}.json`)
    const statePath = path.join(this.rootDir, relativeStateFile)
    try {
      await fs.access(statePath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await writeDurable(statePath, JSON.stringify(nextState))
    }
    if (faultAfterIndex) throw new Error('Injected fault after index')
    const nextRoot = {
      schemaVersion: 1,
      transactionId,
      stateHash,
      stateFile: relativeStateFile,
      storeGeneration: nextState.generation,
      fencingEpoch: nextState.fencingEpoch,
      predecessor: boundPredecessors(this.root),
    }
    validateStateRoot(nextRoot)
    const prepared = path.join(this.walDir, `${transactionId}.prepared.json`)
    await writeDurable(prepared, JSON.stringify(nextRoot))
    if (faultAfterPrepare) throw new Error('Injected fault after prepare')
    await assertWriter()
    const tempRoot = `${this.rootPath}.${transactionId}.tmp`
    await writeDurable(tempRoot, JSON.stringify(nextRoot))
    await replaceDurable(tempRoot, this.rootPath)
    this.root = nextRoot
    this.state = nextState
    if (faultAfterRoot) throw new Error('Injected fault after root')
    await writeDurable(path.join(this.walDir, `${transactionId}.completed`), 'completed')
    if (faultAfterCompletion) throw new Error('Injected fault after completion')
  }
}

module.exports = { StateStore }
