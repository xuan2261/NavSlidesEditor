const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { replaceDurable, writeDurable, writeHashedCandidate, validateExistingCandidate, syncDirectory } = require('./durable-fs')
const {
  createEmptyState,
  validateState,
} = require('./schemas')
const { loadStateIndex } = require('./state-index-loader')
const { StateRecordStore } = require('./state-record-store')
const { encodeStateManifest } = require('./state-manifest')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { refreshCompatibilityHeads } = require('./authority-publication')

const { prepareStreamingPublication, attachStorageManifest } = require('./prepared-publication')

class StateStore {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.recordStore = new StateRecordStore(rootDir)
    this.indexDir = path.join(rootDir, 'indexes')
    this.walDir = path.join(rootDir, 'wal')
    this.quarantineDir = path.join(rootDir, 'quarantine')
    this.rootPath = path.join(rootDir, 'state-root.json')
    this.matrixAuthorityHighWaterPath = path.join(rootDir, 'matrix-authority-epoch-high-water.json')
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
    const highWater = await this.readMatrixAuthorityHighWater()
    return loadStateIndex(this.rootDir, root, { recordStore: this.recordStore, highWater })
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
      if (
        record?.schemaVersion !== 1 ||
        !Number.isSafeInteger(record.matrixAuthorityEpoch) ||
        record.matrixAuthorityEpoch < 1
      ) {
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
    await writeDurable(
      this.matrixAuthorityHighWaterPath,
      JSON.stringify({
        schemaVersion: 1,
        matrixAuthorityEpoch,
      }),
      undefined,
      { signal }
    )
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
        await writeDurable(
          path.join(this.walDir, `${recovery.transactionId}.completed`),
          'completed'
        )
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

  async publish(
    nextState,
    {
      assertWriter,
      signal,
      faultAfterIndex = false,
      faultAfterPrepare = false,
      faultAfterRoot = false,
      faultAfterCompletion = false,
    } = {}
  ) {
    signal?.throwIfAborted()
    await assertWriter()
    signal?.throwIfAborted()
    let publication = prepareStreamingPublication(nextState, this.root)
    const { state } = publication
    const { manifest } = await encodeStateManifest(state, this.recordStore, { signal, assertWriter })
    publication = attachStorageManifest(publication, manifest)
    await assertWriter()
    signal?.throwIfAborted()
    await this.persistMatrixAuthorityHighWater(state.matrixAuthorityEpoch, { signal })
    signal?.throwIfAborted()
    await assertWriter()
    signal?.throwIfAborted()
    const streaming = Boolean(publication.chunks)
    if (streaming) {
      // A crash can strand only an unreferenced .tmp candidate, never a root or
      // WAL reference to a partial index. No recovery scan treats .tmp as JSON.
      const candidate = path.join(this.indexDir, `.candidate-${crypto.randomUUID()}.tmp`)
      let ownsCandidate = false
      try {
        const digest = await writeHashedCandidate(candidate, publication.chunks, {
          signal, onOwned: () => { ownsCandidate = true },
        })
        publication = publication.complete(digest)
        await assertWriter()
        signal?.throwIfAborted()
        const target = path.join(this.rootDir, publication.root.stateFile)
        if (await validateExistingCandidate(target, candidate, digest, { signal })) {
          // A previous rename may have succeeded but failed its directory sync.
          // Reuse must establish durability anew before the prepared WAL exists.
          await syncDirectory(this.indexDir)
        } else {
          await replaceDurable(candidate, target, { signal })
        }
      } finally {
        if (ownsCandidate) await fs.rm(candidate, { force: true })
      }
    }
    const { root: nextRoot, stateBytes, rootBytes } = publication
    const { transactionId } = nextRoot
    const statePath = path.join(this.rootDir, nextRoot.stateFile)
    const prepared = path.join(this.walDir, `${transactionId}.prepared.json`)
    const tempRoot = `${this.rootPath}.${transactionId}.tmp`
    let published = false
    try {
      if (!streaming) {
        try {
          await fs.access(statePath)
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
          signal?.throwIfAborted()
          await assertWriter()
          signal?.throwIfAborted()
          await writeDurable(statePath, stateBytes, undefined, { signal })
        }
      }
      signal?.throwIfAborted()
      if (faultAfterIndex) throw new Error('Injected fault after index')
      await assertWriter()
      signal?.throwIfAborted()
      await writeDurable(prepared, rootBytes, undefined, { signal })
      signal?.throwIfAborted()
      if (faultAfterPrepare) throw new Error('Injected fault after prepare')
      await assertWriter()
      signal?.throwIfAborted()
      await writeDurable(tempRoot, rootBytes, undefined, { signal })
      await assertWriter()
      signal?.throwIfAborted()
      await replaceDurable(tempRoot, this.rootPath, {
        signal,
        onReplaced: () => {
          // Native rename success is authoritative, even if cancellation or sync fails later.
          published = true
          this.root = nextRoot
          this.state = state
          this.pendingMigration = null
          this.pendingRootRecovery = false
          this.pendingHighWaterPersist = false
        },
      })
      if (faultAfterRoot) throw new Error('Injected fault after root')
      await writeDurable(path.join(this.walDir, `${transactionId}.completed`), 'completed')
      if (faultAfterCompletion) throw new Error('Injected fault after completion')
    } catch (error) {
      if (!published) {
        // Unpublished root candidates are never recovery evidence. Retain the
        // prepared WAL and index for recovery/audit on ordinary failures.
        await fs.rm(tempRoot, { force: true })
        if (signal?.aborted) await fs.rm(prepared, { force: true })
      }
      throw error
    }
  }
}

module.exports = { StateStore }
