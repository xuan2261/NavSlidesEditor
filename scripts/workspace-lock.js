const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { writeLockVersionMetadata } = require('./lock-version-metadata')

const workspacePaths = ['client', 'server', 'shared', 'website']
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]

function readWorkspaceManifests(root) {
  return Object.fromEntries(
    ['', ...workspacePaths].map((packagePath) => {
      const manifestPath = path.join(root, packagePath, 'package.json')
      return [packagePath, JSON.parse(fs.readFileSync(manifestPath, 'utf8'))]
    })
  )
}

function sortedMap(value) {
  return Object.fromEntries(
    Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right))
  )
}

function validateWorkspaceLock(manifests, lock) {
  if (lock?.lockfileVersion !== 3 || !lock.packages) {
    throw new Error('Workspace lock must use package-lock v3')
  }
  if (lock.name !== manifests[''].name || lock.version !== manifests[''].version) {
    throw new Error('Workspace lock root identity/version mismatch')
  }
  for (const [packagePath, manifest] of Object.entries(manifests)) {
    const entry = lock.packages[packagePath]
    if (!entry) throw new Error(`Workspace lock missing package entry: ${packagePath || '<root>'}`)
    if (entry.name !== manifest.name) {
      throw new Error(`Workspace lock identity mismatch: ${packagePath || '<root>'}`)
    }
    if (entry.version !== manifest.version) {
      throw new Error(`Workspace lock version mismatch: ${packagePath || '<root>'}`)
    }
    for (const field of dependencyFields) {
      const expected = sortedMap(manifest[field])
      const actual = sortedMap(entry[field])
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Workspace lock ${packagePath || '<root>'} ${field} drift`)
      }
    }
  }
  return true
}

function assertManifestVersions(manifests) {
  const version = manifests[''].version
  for (const [packagePath, manifest] of Object.entries(manifests)) {
    if (manifest.version !== version) {
      throw new Error(
        `${packagePath || 'root'}/package.json version ${manifest.version} does not match ${version}`
      )
    }
  }
  return version
}

function syncWorkspaceLock(root) {
  const manifests = readWorkspaceManifests(root)
  const version = assertManifestVersions(manifests)
  const result = writeLockVersionMetadata({
    lockPath: path.join(root, 'package-lock.json'),
    version,
    identities: Object.fromEntries(
      Object.entries(manifests).map(([packagePath, manifest]) => [packagePath, manifest.name])
    ),
    validate: (lock) => validateWorkspaceLock(manifests, lock),
  })
  return result
}

function defaultRunInstall(temporaryRoot) {
  const args = ['install', '--package-lock-only', '--ignore-scripts']
  if (process.platform === 'win32') {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], {
      cwd: temporaryRoot,
      stdio: 'inherit',
    })
  } else {
    execFileSync('npm', args, { cwd: temporaryRoot, stdio: 'inherit' })
  }
}

function resolveWorkspaceLock(root, { runInstall = defaultRunInstall } = {}) {
  const manifests = readWorkspaceManifests(root)
  assertManifestVersions(manifests)
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'navslides-workspace-lock-'))
  try {
    for (const packagePath of Object.keys(manifests)) {
      const destination = path.join(temporaryRoot, packagePath)
      fs.mkdirSync(destination, { recursive: true })
      fs.copyFileSync(
        path.join(root, packagePath, 'package.json'),
        path.join(destination, 'package.json')
      )
    }
    const vendorSource = path.join(root, 'vendor-overrides')
    if (fs.existsSync(vendorSource)) {
      fs.cpSync(vendorSource, path.join(temporaryRoot, 'vendor-overrides'), {
        recursive: true,
      })
    }
    runInstall(temporaryRoot)
    const generatedPath = path.join(temporaryRoot, 'package-lock.json')
    const lock = JSON.parse(fs.readFileSync(generatedPath, 'utf8'))
    validateWorkspaceLock(manifests, lock)
    fs.copyFileSync(generatedPath, path.join(root, 'package-lock.json'))
    return lock
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

module.exports = {
  readWorkspaceManifests,
  resolveWorkspaceLock,
  syncWorkspaceLock,
  validateWorkspaceLock,
}
