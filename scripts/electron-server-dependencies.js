const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

function sortObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right))
  )
}

function createIsolatedManifest(serverPackage) {
  const dependencies = { ...serverPackage.dependencies }
  delete dependencies['revealjs-shared']
  return {
    name: 'electron-server-deps',
    version: serverPackage.version,
    private: true,
    dependencies: sortObject(dependencies),
    overrides: sortObject(serverPackage.overrides),
  }
}

function validateIsolatedLock(manifest, lock) {
  if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) {
    throw new Error('Electron server lock must use package-lock v3')
  }
  const lockedDependencies = sortObject(lock.packages[''].dependencies)
  if (JSON.stringify(lockedDependencies) !== JSON.stringify(sortObject(manifest.dependencies))) {
    throw new Error('Electron server lock dependencies do not match server/package.json')
  }
  return true
}

function supportsTarget(values, target) {
  if (!Array.isArray(values) || values.length === 0) return true
  if (values.includes(`!${target}`)) return false
  const allowed = values.filter((value) => !value.startsWith('!'))
  return allowed.length === 0 || allowed.includes(target)
}

function treeEntries(lock, { platform = process.platform, arch = process.arch } = {}) {
  return Object.entries(lock.packages || {})
    .filter(([packagePath]) => packagePath.startsWith('node_modules/'))
    .map(([packagePath, metadata]) => ({
      packagePath,
      metadata: metadata.link ? lock.packages?.[metadata.resolved] : metadata,
    }))
    .filter(
      ({ metadata }) =>
        metadata?.version &&
        supportsTarget(metadata.os, platform) &&
        supportsTarget(metadata.cpu, arch)
    )
    .map(({ packagePath, metadata }) => ({ path: packagePath, version: metadata.version }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function hashEntries(entries) {
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex')
}

function canonicalDependencyTree(lock, target) {
  const entries = treeEntries(lock, target)
  return { entries, sha256: hashEntries(entries) }
}

function canonicalInstalledTree(lock, nodeModulesDir, target) {
  const entries = treeEntries(lock, target).map((entry) => {
    const relative = entry.path.replace(/^node_modules[\\/]/, '')
    const packageJsonPath = path.join(nodeModulesDir, relative, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`Installed Electron dependency missing: ${entry.path}`)
    }
    const installed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (installed.version !== entry.version) {
      throw new Error(
        `Installed Electron dependency drift: ${entry.path} expected ${entry.version}, got ${installed.version}`
      )
    }
    return entry
  })
  return { entries, sha256: hashEntries(entries) }
}

module.exports = {
  canonicalDependencyTree,
  canonicalInstalledTree,
  createIsolatedManifest,
  validateIsolatedLock,
}
