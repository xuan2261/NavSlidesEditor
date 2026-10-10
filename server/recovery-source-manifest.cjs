// Recovery evidence identity: complete server/shared source plus locked dependency inputs.
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const repo = path.resolve(__dirname, '..')
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
module.exports = async function sourceIdentity() {
  const names = new Set(['package.json', 'package-lock.json', 'server/package.json', 'shared/package.json'])
  async function visit(relative) {
    for (const entry of await fs.readdir(path.join(repo, relative), { withFileTypes: true })) {
      if (['node_modules', 'uploads', 'data', '__tests__', 'tests', '__snapshots__', 'fixtures'].includes(entry.name)) continue
      const name = `${relative}/${entry.name}`
      const stat = await fs.lstat(path.join(repo, name))
      if (stat.isSymbolicLink()) throw new Error(`Recovery source symlink: ${name}`)
      if (stat.isDirectory()) await visit(name)
      else if (/\.(?:js|cjs|mjs|json|ts)$/.test(name) && !/\.test\./.test(name)) names.add(name)
    }
  }
  await visit('server')
  await visit('shared')
  const files = {}
  for (const file of [...names].sort()) files[file] = hash(await fs.readFile(path.join(repo, file)))
  return { scope: 'server/shared-source-runtime-harness-and-locked-dependencies', files, sha256: hash(JSON.stringify(files)) }
}
