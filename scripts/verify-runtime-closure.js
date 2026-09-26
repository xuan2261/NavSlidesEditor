const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  REVEAL_REQUIRED_VENDOR_PATHS,
  REVEAL_RUNTIME_VERSION,
} = require('../shared/src/reveal-runtime-assets')
const { verifyClientArtifact } = require('./ci/artifact-manifest-runtime.cjs')

const DEFAULT_SERVER_MODULES = [
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

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function verifyVendor(vendorDir, { requiredVendorPaths, expectedRevealVersion }) {
  const manifestPath = path.join(vendorDir, 'vendor-manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error('Vendor manifest missing')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('Vendor manifest is invalid')
  }
  if (expectedRevealVersion !== null && manifest.runtimes?.revealJs !== expectedRevealVersion) {
    throw new Error(`Reveal runtime version mismatch: expected ${expectedRevealVersion}`)
  }
  const manifestPaths = new Set(manifest.files.map((entry) => entry.path))
  for (const requiredPath of requiredVendorPaths) {
    if (!manifestPaths.has(requiredPath))
      throw new Error(`Required vendor asset missing: ${requiredPath}`)
  }
  for (const assetPath of manifestPaths) {
    if (assetPath.startsWith('reveal.js/plugin/')) {
      throw new Error(`Legacy Reveal vendor asset is not allowed: ${assetPath}`)
    }
  }
  for (const entry of manifest.files) {
    const assetPath = path.resolve(vendorDir, entry.path)
    const relative = path.relative(vendorDir, assetPath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Vendor manifest path escapes root: ${entry.path}`)
    }
    if (!fs.existsSync(assetPath)) throw new Error(`Vendor asset missing: ${entry.path}`)
    const stat = fs.statSync(assetPath)
    if (stat.size !== entry.bytes) throw new Error(`Vendor asset size mismatch: ${entry.path}`)
    if (hashFile(assetPath) !== entry.sha256) {
      throw new Error(`Vendor asset hash mismatch: ${entry.path}`)
    }
  }
  return { files: manifest.files.length, revealJs: manifest.runtimes?.revealJs || null }
}

function listJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      listJsFiles(entryPath, out)
    } else if (entry.name.endsWith('.js')) {
      out.push(entryPath)
    }
  }
  return out
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function verifyLocalRequireClosure(serverDir, rootDir) {
  const requirePattern = /\brequire\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g
  const rootPrefix = path.resolve(rootDir) + path.sep
  const failures = []
  for (const file of listJsFiles(serverDir)) {
    const source = stripComments(fs.readFileSync(file, 'utf8'))
    const relativeFile = path.relative(rootDir, file)
    for (const match of source.matchAll(requirePattern)) {
      const specifier = match[2]
      let resolved
      try {
        resolved = require.resolve(specifier, { paths: [path.dirname(file)] })
      } catch {
        failures.push(`${relativeFile}: unresolved require '${specifier}'`)
        continue
      }
      if (!resolved.startsWith(rootPrefix)) {
        failures.push(
          `${relativeFile}: require '${specifier}' escapes packaged root -> ${resolved}`
        )
      }
    }
  }
  if (failures.length) {
    throw new Error(`Packaged server requires escape the runtime closure:\n${failures.join('\n')}`)
  }
}

function verifyRuntimeClosure({
  rootDir,
  requiredServerModules = DEFAULT_SERVER_MODULES,
  requireClientDist = false,
  clientManifestPath = null,
  clientSubject = null,
  requiredVendorPaths = REVEAL_REQUIRED_VENDOR_PATHS,
  expectedRevealVersion = REVEAL_RUNTIME_VERSION,
}) {
  const serverDir = path.join(rootDir, 'server')
  for (const moduleName of requiredServerModules) {
    try {
      require.resolve(moduleName, { paths: [serverDir] })
    } catch {
      throw new Error(`Server runtime dependency missing: ${moduleName}`)
    }
  }
  verifyLocalRequireClosure(serverDir, rootDir)

  const clientDist = path.join(rootDir, 'client', 'dist', 'index.html')
  if (requireClientDist && !fs.existsSync(clientDist)) {
    throw new Error('Production client artifact missing: client/dist/index.html')
  }
  let clientArtifact = null
  if (requireClientDist) {
    const manifestPath = clientManifestPath || path.join(rootDir, 'client-dist-manifest.json')
    if (!fs.existsSync(manifestPath)) throw new Error('Client artifact manifest missing')
    clientArtifact = verifyClientArtifact({
      rootDir: path.join(rootDir, 'client', 'dist'),
      manifestPath,
      expectedSubject: clientSubject,
    })
  }

  const vendor = verifyVendor(path.join(rootDir, 'server', 'vendor'), {
    requiredVendorPaths,
    expectedRevealVersion,
  })
  const result = {
    vendorFiles: vendor.files,
    revealJs: vendor.revealJs,
    serverModules: requiredServerModules.length,
    clientDist: requireClientDist,
  }
  if (clientArtifact) {
    result.clientArtifactIdentity = clientArtifact.identity
    result.clientSubject = clientArtifact.subject
  }
  return result
}

function parseArguments(args) {
  const options = { rootDir: path.join(__dirname, '..'), requireClientDist: false }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--root') options.rootDir = path.resolve(args[++index])
    else if (args[index] === '--require-client-dist') options.requireClientDist = true
    else if (args[index] === '--client-manifest') {
      options.clientManifestPath = path.resolve(args[++index])
    } else if (args[index] === '--client-subject') options.clientSubject = args[++index]
    else throw new Error(`Unknown argument: ${args[index]}`)
  }
  return options
}

if (require.main === module) {
  const result = verifyRuntimeClosure(parseArguments(process.argv.slice(2)))
  console.log(JSON.stringify(result))
}

function verifyElectronBeforePack() {
  return verifyRuntimeClosure({
    rootDir: path.join(__dirname, '..'),
    requireClientDist: true,
  })
}

module.exports = verifyElectronBeforePack
module.exports.verifyRuntimeClosure = verifyRuntimeClosure
module.exports.verifyLocalRequireClosure = verifyLocalRequireClosure
