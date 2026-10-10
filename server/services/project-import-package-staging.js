const path = require('node:path')
const crypto = require('node:crypto')
const fs = require('fs-extra')
const { inspectPath, stagingError } = require('./project-import-staging-ownership')
const { PROJECT_IMPORT_LIMITS: limits } = require('./project-import-archive-limits')
const { validatePortableBundle } = require('./pptx-import/package-store/portable')
const { syncDirectory } = require('./pptx-import/package-store/durable-fs')
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const HASH = /^[a-f0-9]{64}$/u

async function assertPackageStagingOwned(record, { signal } = {}) {
  if (record.packageBundlePath === undefined) return
  try {
    const directory = record.packageBundlePath
    if (directory !== path.join(record.stagingRoot, 'package') || !HASH.test(record.packageBundleDigest)) throw stagingError()
    const root = await inspectPath(directory, { allowMissing: true, signal })
    if (!root) return // Cleanup can precede the terminal ledger checkpoint.
    if (!root.isDirectory()) throw stagingError()
    const entries = await fs.readdir(directory)
    if (entries.some((name) => !['manifest.json', 'blobs'].includes(name))) throw stagingError()
    const manifestPath = path.join(directory, 'manifest.json')
    const manifest = await inspectPath(manifestPath, { allowMissing: true, signal })
    if (manifest) {
      if (!manifest.isFile() || manifest.size > limits.maxJsonBytes) throw stagingError()
      const bytes = await fs.readFile(manifestPath)
      signal?.throwIfAborted()
      if (sha(bytes) !== record.packageBundleDigest) throw stagingError()
    }
    const blobDirectory = path.join(directory, 'blobs')
    const blobs = await inspectPath(blobDirectory, { allowMissing: true, signal })
    if (!blobs) return
    if (!blobs.isDirectory()) throw stagingError()
    const names = await fs.readdir(blobDirectory)
    if (names.length > limits.maxEntries) throw stagingError()
    for (const name of names) {
      if (!HASH.test(name)) throw stagingError()
      const stat = await inspectPath(path.join(blobDirectory, name), { signal })
      if (!stat.isFile() || stat.size > limits.maxEntryBytes) throw stagingError()
    }
  } catch (error) {
    if (signal?.aborted || error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    throw stagingError(error)
  }
}

async function bindPackageStaging(validated, stagingRoot) {
  if (validated.packageBundlePath === undefined && validated.packageBundleDigest === undefined) return {}
  const source = { stagingRoot: path.dirname(validated.packageBundlePath || ''),
    packageBundlePath: validated.packageBundlePath, packageBundleDigest: validated.packageBundleDigest }
  if (!source.packageBundlePath || !HASH.test(source.packageBundleDigest)) throw stagingError()
  await assertPackageStagingOwned(source)
  const packageBundlePath = path.join(stagingRoot, 'package')
  if (await inspectPath(packageBundlePath, { allowMissing: true })) throw stagingError()
  await fs.rename(source.packageBundlePath, packageBundlePath)
  await syncDirectory(source.stagingRoot)
  await syncDirectory(stagingRoot)
  return { packageBundlePath, packageBundleDigest: source.packageBundleDigest }
}

async function readStagedPackage(record, { signal } = {}) {
  try {
    await assertPackageStagingOwned(record, { signal })
    const manifestBytes = await fs.readFile(path.join(record.packageBundlePath, 'manifest.json'))
    signal?.throwIfAborted()
    if (sha(manifestBytes) !== record.packageBundleDigest) throw stagingError()
    const manifest = JSON.parse(manifestBytes.toString('utf8'))
    if (!Array.isArray(manifest.blobs) || manifest.blobs.length > limits.maxEntries) throw stagingError()
    const names = await fs.readdir(path.join(record.packageBundlePath, 'blobs'))
    const expected = new Set(manifest.blobs.map((blob) => blob.sha256))
    if (names.length !== expected.size || names.some((name) => !expected.has(name))) throw stagingError()
    const blobs = []
    let total = manifestBytes.length
    for (const descriptor of manifest.blobs) {
      signal?.throwIfAborted()
      if (!HASH.test(descriptor.sha256) || !Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 0 ||
          descriptor.byteLength > limits.maxEntryBytes || (total += descriptor.byteLength) > limits.maxExpandedBytes) throw stagingError()
      const filename = path.join(record.packageBundlePath, 'blobs', descriptor.sha256)
      const stat = await inspectPath(filename, { signal })
      if (!stat.isFile() || stat.size !== descriptor.byteLength) throw stagingError()
      const bytes = await fs.readFile(filename)
      signal?.throwIfAborted()
      blobs.push({ sha256: descriptor.sha256, byteLength: bytes.length, bytes })
    }
    const bundle = { manifest, blobs }
    validatePortableBundle(bundle)
    return bundle
  } catch (error) {
    if (signal?.aborted || error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    throw stagingError(error)
  }
}

async function removePackageStaging(record, { signal } = {}) {
  if (record.packageBundlePath === undefined) return
  await assertPackageStagingOwned(record, { signal })
  const directory = record.packageBundlePath
  if (!await inspectPath(directory, { allowMissing: true, signal })) return
  const blobs = path.join(directory, 'blobs')
  if (await inspectPath(blobs, { allowMissing: true, signal })) {
    for (const name of await fs.readdir(blobs)) {
      await assertPackageStagingOwned(record, { signal })
      signal?.throwIfAborted()
      await fs.unlink(path.join(blobs, name))
    }
    signal?.throwIfAborted()
    await fs.rmdir(blobs)
  }
  signal?.throwIfAborted()
  try { await fs.unlink(path.join(directory, 'manifest.json')) } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  signal?.throwIfAborted()
  await fs.rmdir(directory)
  await syncDirectory(record.stagingRoot)
}

module.exports = { assertPackageStagingOwned, bindPackageStaging, readStagedPackage, removePackageStaging }
