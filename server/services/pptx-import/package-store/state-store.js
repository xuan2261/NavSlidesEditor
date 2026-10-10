const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { replaceDurable, writeDurable } = require('./durable-fs')
const {
  STATE_ROOT_SCHEMA_VERSION,
  createEmptyState,
  hashRecord,
  validateState,
  validateStateRoot,
} = require('./schemas')
const { loadPackageStoreState, validatePackageStoreRoot } = require('./state-migrations')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { refreshCompatibilityHeads } = require('./authority-publication')

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
    this.pendingMigration = null
    this.pendingRootRecovery = false
    this.pendingHighWaterPersist = false
    this.pendingWalRecovery = []
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
    this.pendingMigration = null
    this.pendingRootRecovery = false
    this.pendingHighWaterPersist = false
    this.pendingWalRecovery = []
    this.recoveryActions = []
    await this.recover()
  }

  async readValidatedRoot(root) {
    validatePackageStoreRoot(root)
    if (!root?.stateFile) throw new Error('Invalid state root file')
    const state = JSON.parse(await fs.readFile(path.join(this.rootDir, root.stateFile), 'utf8'))
    if (hashRecord(state) !== root.stateHash) throw new Error('State index hash mismatch')
    const highWater = await this.readMatrixAuthorityHighWater()
    return loadPackageStoreState(root, state, { highWater })
  }

  /**
   * Fall back through the retained roots until one validates. The chain is
   * bounded at publish time, so the walk terminates.
   */
  async restoreFromPredecessor(root) {
    let candidate = root?.predecessor
    while (candidate) {
      try {
        return await this.readValidatedRoot(candidate)
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
      const loaded = await this.readValidatedRoot(this.root)
      this.root = loaded.root
      this.state = loaded.state
      this.pendingMigration = loaded.migration
      this.recoveryActions.push(...(loaded.migration?.actions || []))
    } catch (error) {
      const restored = await this.restoreFromPredecessor(this.root)
      if (!restored) throw error
      this.state = restored.state
      this.root = restored.root
      this.pendingMigration = restored.migration
      this.pendingRootRecovery = true
      this.recoveryActions.push(...(restored.migration?.actions || []))
      this.recoveryActions.push('restored-verified-predecessor')
    }
    const names = await fs.readdir(this.walDir)
    for (const name of names.filter((entry) => entry.endsWith('.prepared.json'))) {
      const txId = name.slice(0, -'.prepared.json'.length)
      this.pendingWalRecovery.push({
        name,
        transactionId: txId,
        published: this.root?.transactionId === txId,
      })
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

  async persistMatrixAuthorityHighWater(matrixAuthorityEpoch, { signal } = {}) {
    signal?.throwIfAborted()
    const current = await this.readMatrixAuthorityHighWater()
    signal?.throwIfAborted()
    if (current !== null && current > matrixAuthorityEpoch) {
      throw new TypeError('Matrix authority epoch regression')
    }
    if (current === matrixAuthorityEpoch) return
    await writeDurable(this.matrixAuthorityHighWaterPath, JSON.stringify({
      schemaVersion: 1,
      matrixAuthorityEpoch,
    }), undefined, { signal })
  }

  async recoverMatrixAuthorityHighWater() {
    const highWater = await this.readMatrixAuthorityHighWater()
    if (highWater === null || this.state.matrixAuthorityEpoch > highWater) {
      this.pendingHighWaterPersist = true
      return
    }
    if (this.state.matrixAuthorityEpoch >= highWater) return
    this.state.matrixAuthorityEpoch = highWater
    this.state.heads = this.state.heads.map((head) => ({
      ...head,
      matrixAuthorityEpoch: highWater,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, highWater),
    }))
    refreshCompatibilityHeads(this.state)
    validateState(this.state)
    this.pendingRootRecovery = true
    this.recoveryActions.push('advanced-matrix-authority-high-water')
  }

  async finalizeWriterRecovery(assertWriter) {
    await assertWriter()
    if (this.pendingHighWaterPersist) {
      await this.persistMatrixAuthorityHighWater(this.state.matrixAuthorityEpoch)
      this.pendingHighWaterPersist = false
    }
    for (const recovery of this.pendingWalRecovery) {
      await assertWriter()
      if (recovery.published) {
        await writeDurable(path.join(this.walDir, `${recovery.transactionId}.completed`), 'completed')
        this.recoveryActions.push('completed-published-wal')
        continue
      }
      try {
        await fs.rename(
          path.join(this.walDir, recovery.name),
          path.join(this.quarantineDir, recovery.name)
        )
        this.recoveryActions.push('quarantined-unpublished-prepared-wal')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    this.pendingWalRecovery = []
  }

  async publish(nextState, {
    assertWriter,
    signal,
    faultAfterIndex = false,
    faultAfterPrepare = false,
    faultAfterRoot = false,
    faultAfterCompletion = false,
  } = {}) {
    signal?.throwIfAborted()
    await assertWriter()
    signal?.throwIfAborted()
    validateState(nextState)
    await this.persistMatrixAuthorityHighWater(nextState.matrixAuthorityEpoch, { signal })
    signal?.throwIfAborted()
    const transactionId = crypto.randomUUID()
    const stateHash = hashRecord(nextState)
    const relativeStateFile = path.join('indexes', `${stateHash}.json`)
    const statePath = path.join(this.rootDir, relativeStateFile)
    const prepared = path.join(this.walDir, `${transactionId}.prepared.json`)
    const tempRoot = `${this.rootPath}.${transactionId}.tmp`
    let published = false
    try {
      try {
        await fs.access(statePath)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        signal?.throwIfAborted()
        await writeDurable(statePath, JSON.stringify(nextState), undefined, { signal })
      }
      signal?.throwIfAborted()
      if (faultAfterIndex) throw new Error('Injected fault after index')
      const nextRoot = {
        schemaVersion: STATE_ROOT_SCHEMA_VERSION,
        transactionId,
        stateHash,
        stateFile: relativeStateFile,
        storeGeneration: nextState.generation,
        fencingEpoch: nextState.fencingEpoch,
        predecessor: boundPredecessors(this.root),
      }
      validateStateRoot(nextRoot)
      await writeDurable(prepared, JSON.stringify(nextRoot), undefined, { signal })
      signal?.throwIfAborted()
      if (faultAfterPrepare) throw new Error('Injected fault after prepare')
      await assertWriter()
      signal?.throwIfAborted()
      await writeDurable(tempRoot, JSON.stringify(nextRoot), undefined, { signal })
      signal?.throwIfAborted()
      await replaceDurable(tempRoot, this.rootPath, {
        signal,
        onReplaced: () => {
          // Native rename success is authoritative, even if cancellation or sync fails later.
          published = true
          this.root = nextRoot
          this.state = nextState
          this.pendingMigration = null
          this.pendingRootRecovery = false
          this.pendingHighWaterPersist = false
        },
      })
      if (faultAfterRoot) throw new Error('Injected fault after root')
      await writeDurable(path.join(this.walDir, `${transactionId}.completed`), 'completed')
      if (faultAfterCompletion) throw new Error('Injected fault after completion')
    } catch (error) {
      if (!published && signal?.aborted) {
        // Only this unpublished transaction's candidates are removable; indexes remain audit-only.
        await fs.rm(tempRoot, { force: true })
        await fs.rm(prepared, { force: true })
      }
      throw error
    }
  }
}

module.exports = { StateStore }
