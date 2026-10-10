const path = require('node:path')
const fs = require('fs-extra')
const { validatePortableBundle } = require('./pptx-import/package-store/portable')
const { hashRecord } = require('./pptx-import/package-store/schemas')
const { stripAuthority } = require('./pptx-import/package-store/dto')
const { writeDurable, syncDirectory } = require('./pptx-import/package-store/durable-fs')
const { digest, importError } = require('./project-import-archive-validation')

async function readPortableArchive(read, entries, presentation, limits) {
  const manifestBytes = await read('package/manifest.json', limits.maxJsonBytes)
  let manifest
  try { manifest = JSON.parse(manifestBytes.toString('utf8')) } catch {
    throw importError('PROJECT_JSON_INVALID', 'Portable package manifest JSON is invalid')
  }
  const paths = entries.filter((entry) => entry.name.startsWith('package/blobs/')).map((entry) => entry.name)
  const expected = new Set((Array.isArray(manifest?.blobs) ? manifest.blobs : []).map((blob) => `package/blobs/${blob?.sha256}`))
  if (paths.length !== expected.size || paths.some((name) => !expected.has(name))) {
    throw importError('PROJECT_PACKAGE_INVENTORY_MISMATCH', 'Portable package blob inventory does not match archive')
  }
  const blobs = []
  for (const name of paths) {
    const bytes = await read(name)
    blobs.push({ sha256: name.slice('package/blobs/'.length), byteLength: bytes.length, bytes })
  }
  const packageBundle = { manifest, blobs }
  let verified
  try { verified = validatePortableBundle(packageBundle) } catch (error) {
    throw importError(error.code || 'PROJECT_PACKAGE_INVALID', 'Portable package authority or closure is invalid')
  }
  if (verified.projection && hashRecord(verified.projection) !== hashRecord(presentation)) {
    throw importError('PROJECT_PACKAGE_PROJECTION_MISMATCH', 'Project projection does not match canonical package authority')
  }
  return {
    packageBundle, manifestBytes,
    presentation: verified.projection || stripAuthority(presentation),
    mediaProjections: verified.mediaProjections || [],
  }
}

async function stagePortableArchive(portable, stagingDir) {
  const packageBundlePath = path.join(stagingDir, 'package')
  if (await fs.pathExists(packageBundlePath)) throw importError('PROJECT_PACKAGE_STAGING_CONFLICT', 'Package staging already exists', 409)
  const blobsDir = path.join(packageBundlePath, 'blobs')
  await fs.ensureDir(blobsDir)
  for (const blob of portable.packageBundle.blobs) {
    await writeDurable(path.join(blobsDir, blob.sha256), blob.bytes, { flag: 'wx', mode: 0o600 })
  }
  await writeDurable(path.join(packageBundlePath, 'manifest.json'), portable.manifestBytes, { flag: 'wx', mode: 0o600 })
  await syncDirectory(blobsDir)
  await syncDirectory(packageBundlePath)
  await syncDirectory(stagingDir)
  return { packageBundle: portable.packageBundle, packageBundlePath, packageBundleDigest: digest(portable.manifestBytes) }
}

module.exports = { readPortableArchive, stagePortableArchive }
