const fs = require('node:fs')
const path = require('node:path')
const { collectFiles } = require('./ci/artifact-manifest-runtime.cjs')

function ordinaryAncestry(target) {
  for (let current = path.resolve(target); ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink())
      throw new Error(`Local dependency ancestry is a link: ${current}`)
    if (path.dirname(current) === current) break
  }
}

function materializeImageSize(root, manifest, lock) {
  const spec = 'file:../vendor-overrides/image-size-disabled'
  const locked = lock.packages?.['node_modules/image-size']
  const version = lock.packages?.['../vendor-overrides/image-size-disabled']?.version
  if (
    manifest.dependencies?.['image-size'] !== spec ||
    lock.packages?.['']?.dependencies?.['image-size'] !== spec ||
    locked?.link !== true ||
    locked.resolved !== spec.slice(5) ||
    !version
  ) {
    throw new Error('Local image-size dependency differs from the declared isolated lock')
  }
  const source = path.resolve(root, 'vendor-overrides/image-size-disabled')
  const parent = path.resolve(root, '.electron-tmp/node_modules')
  const target = path.join(parent, 'image-size')
  ordinaryAncestry(source)
  ordinaryAncestry(parent)
  const files = collectFiles(source)
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
  if (pkg.name !== 'image-size' || pkg.version !== version)
    throw new Error('Local image-size source identity differs from the lock')
  if (
    !fs.lstatSync(target).isSymbolicLink() ||
    fs.realpathSync(target) !== fs.realpathSync(source)
  ) {
    throw new Error('Installed image-size must link only to the declared local source')
  }
  const scratch = fs.mkdtempSync(path.resolve(root, '.electron-tmp/image-size-'))
  const identical = (inventory) => JSON.stringify(inventory) === JSON.stringify(files)
  try {
    fs.cpSync(source, scratch, {
      recursive: true,
      dereference: false,
      errorOnExist: true,
      force: false,
    })
    if (!identical(collectFiles(scratch)) || !identical(collectFiles(source))) {
      throw new Error('Local image-size bytes changed during materialization')
    }
    // rm removes the admitted junction itself; it must never recurse into its vendor target.
    fs.rmSync(target, { recursive: true, force: false })
    fs.renameSync(scratch, target)
    ordinaryAncestry(target)
    if (!identical(collectFiles(target)))
      throw new Error('Installed local image-size file inventory differs from its source')
    return files
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
}

module.exports = { materializeImageSize }
