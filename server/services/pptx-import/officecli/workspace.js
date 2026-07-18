const fs = require('node:fs/promises')
const path = require('node:path')
const { gatewayError } = require('./errors')

async function ensureWorkspaceRoot(root) {
  if (!path.isAbsolute(root)) throw new TypeError('Workspace root must be absolute')
  await fs.mkdir(root, { recursive: true, mode: 0o700 })
  const stat = await fs.lstat(root)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw gatewayError('UNSAFE_WORKSPACE', 'Workspace root is not a private directory')
  }
  return fs.realpath(root)
}

async function createPrivateWorkspace(root) {
  const canonicalRoot = await ensureWorkspaceRoot(root)
  const workspace = await fs.mkdtemp(path.join(canonicalRoot, 'job-'))
  await fs.chmod(workspace, 0o700)
  return { root: canonicalRoot, path: workspace }
}

async function assertContained(root, candidate, { allowMissing = false } = {}) {
  const canonicalRoot = await fs.realpath(root)
  const resolved = path.resolve(candidate)
  const relative = path.relative(canonicalRoot, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw gatewayError('PATH_ESCAPE', 'Workspace path escaped its private boundary')
  }
  if (!allowMissing) {
    const stat = await fs.lstat(resolved)
    if (stat.isSymbolicLink()) throw gatewayError('SYMLINK_REJECTED', 'Workspace symlink rejected')
    const real = await fs.realpath(resolved)
    const realRelative = path.relative(canonicalRoot, real)
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw gatewayError('PATH_ESCAPE', 'Workspace path escaped its private boundary')
    }
  }
  return resolved
}

async function removeWorkspace(workspace) {
  await fs.rm(workspace, { recursive: true, force: true })
}

async function sweepStaleWorkspaces(root, { olderThanMs = 24 * 60 * 60 * 1000, now = Date.now() } = {}) {
  const canonicalRoot = await ensureWorkspaceRoot(root)
  const quarantine = path.join(canonicalRoot, '.quarantine')
  await fs.mkdir(quarantine, { mode: 0o700 })
  const swept = []
  for (const entry of await fs.readdir(canonicalRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('job-')) continue
    const target = path.join(canonicalRoot, entry.name)
    const stat = await fs.lstat(target)
    if (stat.isSymbolicLink() || now - stat.mtimeMs < olderThanMs) continue
    const destination = path.join(quarantine, `${entry.name}-${Date.now()}`)
    await fs.rename(target, destination)
    swept.push(destination)
  }
  return swept
}

module.exports = {
  assertContained,
  createPrivateWorkspace,
  removeWorkspace,
  sweepStaleWorkspaces,
}
