const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

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

function verifyVendor(vendorDir) {
  const manifestPath = path.join(vendorDir, 'vendor-manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error('Vendor manifest missing')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('Vendor manifest is invalid')
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
  return manifest.files.length
}

function verifyRuntimeClosure({
  rootDir,
  requiredServerModules = DEFAULT_SERVER_MODULES,
  requireClientDist = false,
}) {
  const serverDir = path.join(rootDir, 'server')
  for (const moduleName of requiredServerModules) {
    try {
      require.resolve(moduleName, { paths: [serverDir] })
    } catch {
      throw new Error(`Server runtime dependency missing: ${moduleName}`)
    }
  }

  const clientDist = path.join(rootDir, 'client', 'dist', 'index.html')
  if (requireClientDist && !fs.existsSync(clientDist)) {
    throw new Error('Production client artifact missing: client/dist/index.html')
  }

  return {
    vendorFiles: verifyVendor(path.join(rootDir, 'server', 'vendor')),
    serverModules: requiredServerModules.length,
    clientDist: requireClientDist,
  }
}

function parseArguments(args) {
  const options = { rootDir: path.join(__dirname, '..'), requireClientDist: false }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--root') options.rootDir = path.resolve(args[++index])
    else if (args[index] === '--require-client-dist') options.requireClientDist = true
    else throw new Error(`Unknown argument: ${args[index]}`)
  }
  return options
}

if (require.main === module) {
  const result = verifyRuntimeClosure(parseArguments(process.argv.slice(2)))
  console.log(JSON.stringify(result))
}

module.exports = { verifyRuntimeClosure }
