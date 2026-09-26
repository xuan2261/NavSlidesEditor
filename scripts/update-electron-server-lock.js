const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createIsolatedManifest, validateIsolatedLock } = require('./electron-server-dependencies')
const { writeLockVersionMetadata } = require('./lock-version-metadata')

const root = path.join(__dirname, '..')
const serverPackage = JSON.parse(fs.readFileSync(path.join(root, 'server', 'package.json'), 'utf8'))
const manifest = createIsolatedManifest(serverPackage)
const lockPath = path.join(root, 'electron', 'server-package-lock.json')

function resolveLock() {
  const temporaryDir = path.join(root, '.electron-lock-tmp')
  const npm =
    process.platform === 'win32'
      ? {
          command: process.env.ComSpec || 'cmd.exe',
          args: ['/d', '/s', '/c', 'npm', 'install', '--package-lock-only', '--ignore-scripts'],
        }
      : {
          command: 'npm',
          args: ['install', '--package-lock-only', '--ignore-scripts'],
        }

  fs.rmSync(temporaryDir, { force: true, recursive: true })
  fs.mkdirSync(temporaryDir, { recursive: true })
  try {
    fs.writeFileSync(
      path.join(temporaryDir, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    )
    execFileSync(npm.command, npm.args, { cwd: temporaryDir, stdio: 'inherit' })
    const generatedPath = path.join(temporaryDir, 'package-lock.json')
    const lock = JSON.parse(fs.readFileSync(generatedPath, 'utf8'))
    validateIsolatedLock(manifest, lock)
    fs.copyFileSync(generatedPath, lockPath)
    console.log(
      `Electron server lock dependency graph regenerated: ${path.relative(root, lockPath)}`
    )
  } finally {
    fs.rmSync(temporaryDir, { force: true, recursive: true })
  }
}

function syncVersionMetadata() {
  const result = writeLockVersionMetadata({
    lockPath,
    version: manifest.version,
    identities: { '': manifest.name },
    validate: (lock) => validateIsolatedLock(manifest, lock),
  })
  console.log(
    result.changedFields.length > 0
      ? `Electron server lock version metadata updated: ${result.changedFields.join(', ')}`
      : 'Electron server lock version metadata already current'
  )
}

if (process.argv.includes('--resolve')) resolveLock()
else syncVersionMetadata()
