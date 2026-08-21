const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const {
  canonicalDependencyTree,
  canonicalInstalledTree,
  createIsolatedManifest,
  validateIsolatedLock,
} = require('./electron-server-dependencies')

const root = path.join(__dirname, '..')
const serverDir = path.join(root, 'server')
const serverNodeModules = path.join(serverDir, 'node_modules')
const sharedDir = path.join(root, 'shared')
const temporaryDir = path.join(root, '.electron-tmp')
const backupDir = path.join(serverDir, `node-modules-backup-${process.pid}`)
const lockPath = path.join(root, 'electron', 'server-package-lock.json')
const npmInvocation = (args) =>
  process.platform === 'win32'
    ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] }
    : { command: 'npm', args }
const criticalModules = [
  'cors',
  'express',
  'fs-extra',
  'jszip',
  'multer',
  'pptxtojson',
  'revealjs-shared',
  'socket.io-client',
  'undici',
]

function removePath(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { force: true, recursive: true })
}

function copyShared(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (entry) => {
      const relative = path.relative(source, entry)
      return !relative.split(path.sep).some((part) => part === 'node_modules' || part === '.git')
    },
  })
}

function verifyCriticalModules(nodeModulesDir) {
  const missing = criticalModules.filter(
    (moduleName) => !fs.existsSync(path.join(nodeModulesDir, moduleName, 'package.json'))
  )
  if (missing.length) throw new Error(`Missing critical Electron server modules: ${missing.join(', ')}`)
}

function publishNodeModules(stagedNodeModules) {
  removePath(backupDir)
  if (fs.existsSync(serverNodeModules)) fs.renameSync(serverNodeModules, backupDir)
  try {
    fs.renameSync(stagedNodeModules, serverNodeModules)
  } catch (error) {
    if (fs.existsSync(backupDir) && !fs.existsSync(serverNodeModules)) {
      fs.renameSync(backupDir, serverNodeModules)
    }
    throw error
  }
  try {
    removePath(backupDir)
  } catch (error) {
    console.warn(`Installed server dependencies but could not remove backup: ${error.message}`)
  }
}

function prepareElectronDependencies() {
  const serverPackage = JSON.parse(fs.readFileSync(path.join(serverDir, 'package.json'), 'utf8'))
  const isolatedManifest = createIsolatedManifest(serverPackage)
  const isolatedLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  validateIsolatedLock(isolatedManifest, isolatedLock)

  removePath(temporaryDir)
  fs.mkdirSync(temporaryDir, { recursive: true })

  try {
    fs.writeFileSync(
      path.join(temporaryDir, 'package.json'),
      `${JSON.stringify(isolatedManifest, null, 2)}\n`
    )
    fs.copyFileSync(lockPath, path.join(temporaryDir, 'package-lock.json'))
    console.log('Installing locked Electron server production dependencies...')
    const npm = npmInvocation(['ci', '--omit=dev', '--ignore-scripts'])
    execFileSync(npm.command, npm.args, {
      cwd: temporaryDir,
      stdio: 'inherit',
    })

    const stagedNodeModules = path.join(temporaryDir, 'node_modules')
    const targetShared = path.join(stagedNodeModules, 'revealjs-shared')
    removePath(targetShared)
    copyShared(sharedDir, targetShared)
    verifyCriticalModules(stagedNodeModules)

    const lockedTree = canonicalDependencyTree(isolatedLock)
    const installedTree = canonicalInstalledTree(isolatedLock, stagedNodeModules)
    if (lockedTree.sha256 !== installedTree.sha256) {
      throw new Error('Installed Electron server dependency tree does not match lock')
    }

    publishNodeModules(stagedNodeModules)
    console.log(`Electron server dependency tree: ${installedTree.sha256}`)
    console.log(`Electron server dependencies ready: ${criticalModules.length} critical modules`)
    return installedTree
  } finally {
    removePath(temporaryDir)
  }
}

if (require.main === module) {
  try {
    prepareElectronDependencies()
  } catch (error) {
    console.error(`Failed to prepare Electron dependencies: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { prepareElectronDependencies }
