import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'

function canonicalPath(path) {
  const absolute = resolve(path)
  mkdirSync(dirname(absolute), { recursive: true })
  return existsSync(absolute)
    ? realpathSync(absolute)
    : join(realpathSync(dirname(absolute)), basename(absolute))
}
const pathKey = (path) => (process.platform === 'win32' ? path.toLowerCase() : path)

// Locks are never reclaimed automatically: absent or unknown owners require intervention.
// All readers/importers use the same ownership protocol for their entire transaction.
export function acquireEvidenceOwnership(paths) {
  const targets = new Map(
    paths.filter(Boolean).map((path) => {
      const canonical = canonicalPath(path)
      return [pathKey(canonical), canonical]
    })
  )
  const owner = { token: randomUUID(), pid: process.pid }
  const locks = new Map()
  function assertOwned(path) {
    const target = canonicalPath(path),
      lock = locks.get(pathKey(target))
    if (!lock) throw new Error(`Evidence ownership was not acquired: ${target}`)
    let current
    try {
      current = JSON.parse(readFileSync(lock, 'utf8'))
    } catch {
      throw new Error(`Evidence lock owner is missing or malformed: ${lock}`)
    }
    if (current.token !== owner.token || current.pid !== owner.pid)
      throw new Error(`Evidence lock ownership changed: ${lock}`)
    return target
  }
  function release() {
    let error
    for (const [key, lock] of [...locks].reverse()) {
      try {
        assertOwned(targets.get(key))
        unlinkSync(lock)
        locks.delete(key)
      } catch (failure) {
        error ||= failure
      }
    }
    if (error) throw error
  }
  try {
    for (const [key, target] of [...targets].sort(([left], [right]) => left.localeCompare(right))) {
      const lock = `${target}.lock`
      let descriptor
      try {
        descriptor = openSync(lock, 'wx')
      } catch (error) {
        throw new Error(
          `Evidence exclusive ownership denied; lock owner must be resolved: ${lock}`,
          { cause: error }
        )
      }
      try {
        writeFileSync(descriptor, JSON.stringify(owner) + '\n')
        fsyncSync(descriptor)
      } finally {
        closeSync(descriptor)
      }
      locks.set(key, lock)
    }
  } catch (error) {
    try {
      release()
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        'Evidence ownership acquisition and cleanup failed.'
      )
    }
    throw error
  }
  return {
    read(path, context) {
      const target = assertOwned(path)
      if (!existsSync(target))
        return {
          schemaVersion: context.schemaVersion,
          runId: context.runId,
          subjectHash: context.subjectHash,
          policyHash: context.policyHash,
          records: [],
          executionFailures: [],
        }
      const manifest = JSON.parse(readFileSync(target, 'utf8'))
      for (const key of ['schemaVersion', 'runId', 'subjectHash', 'policyHash']) {
        if (manifest[key] !== context[key]) throw new Error(`Evidence manifest ${key} mismatch.`)
      }
      if (
        !Array.isArray(manifest.records) ||
        (manifest.executionFailures !== undefined && !Array.isArray(manifest.executionFailures))
      ) {
        throw new Error('Evidence records or executionFailures are malformed.')
      }
      return manifest
    },
    write(path, value) {
      const target = assertOwned(path),
        stage = `${target}.${owner.token}.tmp`
      let descriptor
      try {
        descriptor = openSync(stage, 'wx')
        writeFileSync(descriptor, JSON.stringify(value, null, 2) + '\n')
        fsyncSync(descriptor)
        closeSync(descriptor)
        descriptor = undefined
        assertOwned(path)
        renameSync(stage, target)
      } finally {
        if (descriptor !== undefined) closeSync(descriptor)
        if (existsSync(stage)) unlinkSync(stage)
      }
    },
    release,
  }
}
