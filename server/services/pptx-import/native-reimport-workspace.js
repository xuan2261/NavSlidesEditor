const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const WORKSPACE_UNSAFE = 'NATIVE_REIMPORT_WORKSPACE_UNSAFE'
const QUARANTINE_UNSAFE = 'NATIVE_REIMPORT_QUARANTINE_UNSAFE'

function failure(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function samePath(left, right) {
  const normalize = (value) => {
    const resolved = path.resolve(value)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return normalize(left) === normalize(right)
}

function isContained(root, candidate) {
  const relative = path.relative(root, path.resolve(candidate))
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
}

async function assertNoReparseComponents(candidate, code) {
  const resolved = path.resolve(candidate)
  const parsed = path.parse(resolved)
  let current = parsed.root
  const components = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)
  for (const component of components) {
    current = path.join(current, component)
    try {
      const stat = await fs.lstat(current)
      if (stat.isSymbolicLink()) throw failure(code, 'Native re-import workspace path is unsafe')
      const real = await fs.realpath(current)
      await assertCanonicalEntry(current, real, code)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      break
    }
  }
}

async function assertCanonicalEntry(candidate, real, code) {
  const realParent = await fs.realpath(path.dirname(candidate))
  if (!samePath(path.dirname(real), realParent)) {
    throw failure(code, 'Native re-import workspace path is unsafe')
  }
}

async function canonicalExistingPath(candidate, code) {
  await assertNoReparseComponents(candidate, code)
  let probe = path.resolve(candidate)
  while (true) {
    try {
      const stat = await fs.lstat(probe)
      if (stat.isSymbolicLink()) throw failure(code, 'Native re-import workspace path is unsafe')
      const real = await fs.realpath(probe)
      await assertCanonicalEntry(probe, real, code)
      return real
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const parent = path.dirname(probe)
      if (parent === probe) throw failure(code, 'Native re-import workspace path is unsafe')
      probe = parent
    }
  }
}

async function assertContained(root, candidate, code) {
  const resolved = path.resolve(candidate)
  await assertNoReparseComponents(resolved, code)
  let probe = resolved
  while (true) {
    try {
      const stat = await fs.lstat(probe)
      if (stat.isSymbolicLink()) throw failure(code, 'Native re-import workspace path is unsafe')
      const real = await fs.realpath(probe)
      await assertCanonicalEntry(probe, real, code)
      const suffix = path.relative(probe, resolved)
      const canonicalCandidate = path.resolve(real, suffix)
      if (!isContained(root, canonicalCandidate)) {
        throw failure(code, 'Native re-import workspace path escaped its boundary')
      }
      return canonicalCandidate
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const parent = path.dirname(probe)
      if (parent === probe) throw failure(code, 'Native re-import workspace path is unsafe')
      probe = parent
    }
  }
}

async function prepareWorkspace(workspaceRoot, quarantineRoot) {
  if (typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot)) {
    throw failure(WORKSPACE_UNSAFE, 'Native re-import workspace path is unsafe')
  }
  await canonicalExistingPath(workspaceRoot, WORKSPACE_UNSAFE)
  await fs.mkdir(workspaceRoot, { recursive: true, mode: 0o700 })
  const stat = await fs.lstat(workspaceRoot)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw failure(WORKSPACE_UNSAFE, 'Native re-import workspace path is unsafe')
  }
  const canonicalRoot = await fs.realpath(workspaceRoot)
  await assertCanonicalEntry(workspaceRoot, canonicalRoot, WORKSPACE_UNSAFE)
  const configuredQuarantine = quarantineRoot || path.join(canonicalRoot, 'quarantine')
  const safeQuarantineRoot = await assertContained(canonicalRoot, configuredQuarantine, QUARANTINE_UNSAFE)
  return { workspaceRoot: canonicalRoot, quarantineRoot: safeQuarantineRoot }
}

async function cleanupJobRoot(jobRoot, workspace) {
  try {
    await fs.rm(jobRoot, { recursive: true, force: true })
    return null
  } catch (cleanupError) {
    try {
      await assertContained(workspace.workspaceRoot, jobRoot, WORKSPACE_UNSAFE)
      await assertContained(workspace.workspaceRoot, workspace.quarantineRoot, QUARANTINE_UNSAFE)
      await fs.mkdir(workspace.quarantineRoot, { recursive: true, mode: 0o700 })
      await assertContained(workspace.workspaceRoot, workspace.quarantineRoot, QUARANTINE_UNSAFE)
      const quarantinePath = path.join(workspace.quarantineRoot, `job-${crypto.randomUUID()}`)
      await assertContained(workspace.workspaceRoot, quarantinePath, QUARANTINE_UNSAFE)
      await fs.rename(jobRoot, quarantinePath)
      await assertContained(workspace.workspaceRoot, quarantinePath, QUARANTINE_UNSAFE)

      const error = failure(
        'NATIVE_REIMPORT_CLEANUP_QUARANTINED',
        'Native re-import staging cleanup failed; staged package quarantined',
      )
      error.quarantinePath = quarantinePath
      error.cause = cleanupError
      return error
    } catch (quarantineError) {
      const error = failure(
        'NATIVE_REIMPORT_CLEANUP_FAILED',
        'Native re-import staging cleanup and quarantine failed',
      )
      error.cause = quarantineError
      error.cleanupCause = cleanupError
      return error
    }
  }
}

module.exports = { cleanupJobRoot, prepareWorkspace }
