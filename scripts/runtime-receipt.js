const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { canonicalInstalledTree } = require('./electron-server-dependencies')

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function artifactEntry(rootDir, relativePath) {
  const absolutePath = path.resolve(rootDir, relativePath)
  const stat = fs.statSync(absolutePath)
  return {
    path: path.relative(rootDir, absolutePath).split(path.sep).join('/'),
    bytes: stat.size,
    sha256: hashFile(absolutePath),
  }
}

function createRuntimeReceipt({ rootDir, versions, baseImage, artifacts, environment }) {
  const rootLock = path.join(rootDir, 'package-lock.json')
  const electronLockPath = path.join(rootDir, 'electron', 'server-package-lock.json')
  const vendorManifest = path.join(rootDir, 'server', 'vendor', 'vendor-manifest.json')
  const electronLock = JSON.parse(fs.readFileSync(electronLockPath, 'utf8'))
  const productionTree = canonicalInstalledTree(
    electronLock,
    path.join(rootDir, 'server', 'node_modules')
  )

  return {
    schemaVersion: 1,
    versions,
    environment,
    baseImage,
    hashes: {
      rootLock: hashFile(rootLock),
      electronServerLock: hashFile(electronLockPath),
      productionTree: productionTree.sha256,
      vendorManifest: hashFile(vendorManifest),
    },
    artifacts: artifacts
      .map((artifact) => artifactEntry(rootDir, artifact))
      .sort((left, right) => left.path.localeCompare(right.path)),
  }
}

function collectArtifacts(rootDir, artifactsDir, releaseVersion) {
  const directory = path.resolve(rootDir, artifactsDir)
  if (!fs.existsSync(directory)) return []
  const accepted = new Set(['.AppImage', '.deb', '.exe', '.yaml', '.yml', '.zip'])
  const releaseMetadata = /^latest(?:-[^.]+)?\.ya?ml$/
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        accepted.has(path.extname(entry.name)) &&
        (entry.name.includes(releaseVersion) || releaseMetadata.test(entry.name))
    )
    .map((entry) => path.relative(rootDir, path.join(directory, entry.name)).split(path.sep).join('/'))
    .sort()
}

function npmVersion() {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm'
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm', '--version'] : ['--version']
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

function parseArguments(args) {
  const result = { artifactsDir: 'dist-electron', output: 'dist-electron/runtime-receipt.json' }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--artifacts-dir') result.artifactsDir = args[++index]
    else if (args[index] === '--output') result.output = args[++index]
    else throw new Error(`Unknown argument: ${args[index]}`)
  }
  return result
}

function runCli() {
  const rootDir = path.join(__dirname, '..')
  const options = parseArguments(process.argv.slice(2))
  const versions = JSON.parse(fs.readFileSync(path.join(rootDir, 'runtime-versions.json'), 'utf8'))
  const releaseVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version
  const receipt = createRuntimeReceipt({
    rootDir,
    versions,
    baseImage: versions.nodeImage,
    artifacts: collectArtifacts(rootDir, options.artifactsDir, releaseVersion),
    environment: {
      node: process.version,
      npm: npmVersion(),
      os: os.platform(),
      arch: os.arch(),
    },
  })
  const output = path.resolve(rootDir, options.output)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(`Runtime receipt written: ${path.relative(rootDir, output)}`)
}

if (require.main === module) runCli()

module.exports = { collectArtifacts, createRuntimeReceipt }
