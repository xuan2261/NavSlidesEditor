const path = require('node:path')
const fs = require('fs-extra')
const { DATA_DIR } = require('./storage')
const { assertArchivePath } = require('./project-import-archive-validation')
const { PROJECT_IMPORT_LIMITS } = require('./project-import-archive-limits')

function stagingError(cause) {
  return Object.assign(new Error('Project import staging ownership requires recovery. Retain the ledger and staged bytes, inspect the data root, and repair the ownership prerequisite.', { cause }), {
    code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503,
  })
}
function stagingRootFor(sessionId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(sessionId)) {
    throw stagingError()
  }
  return path.join(path.resolve(DATA_DIR), 'project-import-staging', sessionId)
}
function mediaPathFor(root, archivePath, packageBacked = false) {
  assertArchivePath(archivePath, PROJECT_IMPORT_LIMITS, { packageBacked })
  if (!archivePath.startsWith('media/') || /[\\:]/u.test(archivePath) ||
      path.posix.normalize(archivePath) !== archivePath) throw stagingError()
  const candidate = path.resolve(root, ...archivePath.split('/'))
  const relative = path.relative(root, candidate)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw stagingError()
  return candidate
}
function assertStagingShape(record) {
  try {
    const root = stagingRootFor(record.sessionId)
    if (record.stagingRoot !== root) throw stagingError()
    if (record.packageBundlePath !== undefined || record.packageBundleDigest !== undefined) {
      if (record.packageBundlePath !== path.join(root, 'package') || !/^[a-f0-9]{64}$/u.test(record.packageBundleDigest)) throw stagingError()
    }
    for (const item of record.media || []) {
      if (item.stagingPath !== mediaPathFor(root, item.archivePath, record.packageBundlePath !== undefined)) throw stagingError()
    }
  } catch (error) {
    if (error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    throw stagingError(error)
  }
}
function samePath(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right
}
async function inspectPath(candidate, { allowMissing = false, signal } = {}) {
  const resolved = path.resolve(candidate)
  const diskRoot = path.parse(resolved).root
  let current = diskRoot
  const components = resolved.slice(diskRoot.length).split(path.sep).filter(Boolean)
  for (const component of components) {
    signal?.throwIfAborted()
    current = path.join(current, component)
    try {
      const stat = await fs.lstat(current)
      signal?.throwIfAborted()
      if (stat.isSymbolicLink() || !samePath(await fs.realpath(current), current)) throw stagingError()
      signal?.throwIfAborted()
      if (current !== resolved && !stat.isDirectory()) throw stagingError()
      if (current === resolved) return stat
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') return null
      throw error
    }
  }
  throw stagingError()
}
async function assertStagingOwned(record, { signal } = {}) {
  assertStagingShape(record)
  try {
    const root = await inspectPath(record.stagingRoot, { signal })
    if (!root.isDirectory()) throw stagingError()
    for (const item of record.media || []) {
      const stat = await inspectPath(item.stagingPath, { allowMissing: true, signal })
      if (stat && !stat.isFile()) throw stagingError()
    }
    await require('./project-import-package-staging').assertPackageStagingOwned(record, { signal })
  } catch (error) {
    if (signal?.aborted || error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    throw stagingError(error)
  }
}
async function bindProjectImportStaging(sessionId, validated) {
  const stagingRoot = stagingRootFor(sessionId)
  const media = (validated.media || []).map((item) => ({
    ...item, stagingPath: mediaPathFor(stagingRoot, item.archivePath, validated.packageBundlePath !== undefined),
  }))
  await inspectPath(path.dirname(stagingRoot), { allowMissing: true })
  await fs.ensureDir(path.dirname(stagingRoot))
  await inspectPath(path.dirname(stagingRoot))
  await fs.mkdir(stagingRoot, { mode: 0o700 })
  for (let index = 0; index < media.length; index += 1) {
    const source = validated.media[index].stagingPath
    const stat = await inspectPath(source)
    if (!stat.isFile()) throw stagingError()
    await fs.ensureDir(path.dirname(media[index].stagingPath))
    await inspectPath(path.dirname(media[index].stagingPath))
    await fs.move(source, media[index].stagingPath, { overwrite: false })
  }
  const packageFields = await require('./project-import-package-staging').bindPackageStaging(validated, stagingRoot)
  const bound = { sessionId, stagingRoot, media, ...packageFields }
  await assertStagingOwned(bound)
  return { stagingRoot, media, ...packageFields }
}
async function removeProjectImportStaging(record, { signal } = {}) {
  await assertStagingOwned(record, { signal })
  for (const item of record.media || []) {
    await assertStagingOwned({ ...record, media: [item] }, { signal })
    signal?.throwIfAborted()
    try { await fs.unlink(item.stagingPath) } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  await require('./project-import-package-staging').removePackageStaging(record, { signal })
}
module.exports = { assertStagingOwned, assertStagingShape, bindProjectImportStaging, removeProjectImportStaging, inspectPath, stagingError }
