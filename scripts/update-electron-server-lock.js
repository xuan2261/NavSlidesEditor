const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const {
  createIsolatedManifest,
  validateIsolatedLock,
} = require('./electron-server-dependencies')

const root = path.join(__dirname, '..')
const serverPackage = JSON.parse(fs.readFileSync(path.join(root, 'server', 'package.json'), 'utf8'))
const manifest = createIsolatedManifest(serverPackage)
const temporaryDir = path.join(root, '.electron-lock-tmp')
const lockPath = path.join(root, 'electron', 'server-package-lock.json')
const npmInvocation = (args) =>
  process.platform === 'win32'
    ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] }
    : { command: 'npm', args }

fs.rmSync(temporaryDir, { force: true, recursive: true })
fs.mkdirSync(temporaryDir, { recursive: true })

try {
  fs.writeFileSync(
    path.join(temporaryDir, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  const npm = npmInvocation(['install', '--package-lock-only', '--ignore-scripts'])
  execFileSync(npm.command, npm.args, {
    cwd: temporaryDir,
    stdio: 'inherit',
  })
  const lock = JSON.parse(fs.readFileSync(path.join(temporaryDir, 'package-lock.json'), 'utf8'))
  validateIsolatedLock(manifest, lock)
  fs.copyFileSync(path.join(temporaryDir, 'package-lock.json'), lockPath)
  console.log(`Electron server lock updated: ${path.relative(root, lockPath)}`)
} finally {
  fs.rmSync(temporaryDir, { force: true, recursive: true })
}
