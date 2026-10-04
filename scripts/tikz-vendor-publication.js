const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const {
  TIKZ_RUNTIME_VERSION,
  TIKZ_RUNTIME_REVISION,
  TIKZ_UPSTREAM_HASHES,
  TIKZ_PUBLISHED_HASHES,
  TIKZ_RESOURCE_INVENTORY_SHA256,
  patchTikzEntry,
  patchTikzWorker,
} = require('../shared/src/tikz-runtime-contract')
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
function prepareTikzVendor(source, destination) {
  if (!source) throw new Error('Required TikZ package distribution is missing')
  const pkg = JSON.parse(fs.readFileSync(path.join(source, '..', 'package.json'), 'utf8'))
  if (pkg.name !== '@drgrice1/tikzjax' || pkg.version !== TIKZ_RUNTIME_VERSION)
    throw new Error('Unsupported TikZ compiler package version')
  const files = [
    'core.dump.gz',
    'tex.wasm.gz',
    'fonts.css',
    ...fs.readdirSync(path.join(source, 'tex_files')).map((file) => `tex_files/${file}`),
    ...fs.readdirSync(path.join(source, 'fonts')).map((file) => `fonts/${file}`),
  ].sort()
  const resources = files.map((file) => ({
    path: file,
    sha256: digest(fs.readFileSync(path.join(source, file))),
  }))
  if (digest(JSON.stringify(resources)) !== TIKZ_RESOURCE_INVENTORY_SHA256)
    throw new Error('TikZ compiler resource inventory has changed')
  const patched = {}
  for (const [file, patch] of [
    ['tikzjax.js', patchTikzEntry],
    ['run-tex.js', patchTikzWorker],
  ]) {
    const bytes = fs.readFileSync(path.join(source, file))
    if (digest(bytes) !== TIKZ_UPSTREAM_HASHES[file])
      throw new Error(`Unsupported TikZ compiler source: ${file}`)
    patched[file] = patch(bytes.toString('utf8'))
    if (digest(patched[file]) !== TIKZ_PUBLISHED_HASHES[file])
      throw new Error(`TikZ publication patch fingerprint mismatch: ${file}`)
  }
  fs.mkdirSync(destination, { recursive: true })
  fs.cpSync(source, destination, { recursive: true })
  for (const [file, code] of Object.entries(patched))
    fs.writeFileSync(path.join(destination, file), code)
  fs.writeFileSync(
    path.join(destination, 'runtime-manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      package: pkg.name,
      version: TIKZ_RUNTIME_VERSION,
      revision: TIKZ_RUNTIME_REVISION,
      scripts: TIKZ_PUBLISHED_HASHES,
      resources,
    })
  )
  return {
    source: destination,
    sourceLabel: `patched @drgrice1/tikzjax@${TIKZ_RUNTIME_VERSION}`,
    destination: 'tikzjax',
  }
}
module.exports = { prepareTikzVendor }
