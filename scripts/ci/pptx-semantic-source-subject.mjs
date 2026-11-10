import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './pptx-semantic-manifest.mjs'

const roots = [
  'client/src',
  'client/public',
  'server/services',
  'server/routes',
  'shared/src',
  'scripts/ci',
  'tests',
  'config',
]

export async function implementationDigest(root) {
  const entries = []
  async function visit(relative) {
    const children = await readdir(path.resolve(root, relative), { withFileTypes: true })
    children.sort((left, right) => left.name.localeCompare(right.name))
    for (const child of children) {
      const next = `${relative}/${child.name}`
      if (child.isDirectory()) await visit(next)
      else if (
        child.isFile() &&
        /\.(?:[cm]?js|jsx|tsx?|json|css|scss|html|svg|woff2?|ttf|otf)$/.test(child.name)
      ) {
        entries.push([next, sha256(await readFile(path.resolve(root, next)))])
      }
    }
  }
  for (const directory of roots) await visit(directory)
  for (const file of [
    'package.json',
    'package-lock.json',
    'runtime-versions.json',
    'client/vite.config.js',
    'server/middleware/schemas.js',
  ]) {
    entries.push([file, sha256(await readFile(path.resolve(root, file)))])
  }
  entries.sort(([left], [right]) => left.localeCompare(right))
  return sha256(JSON.stringify(entries))
}
