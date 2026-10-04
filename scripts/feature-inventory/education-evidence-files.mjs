import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

export const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex')
export const fileHash = (path) => digest(readFileSync(path))
export function inside(root, path) {
  const rel = relative(resolve(root), resolve(path))
  return (
    rel !== '..' &&
    !rel.startsWith(`..${sep}`) &&
    !resolve(path).startsWith('\\\\') &&
    !rel.includes(':')
  )
}
export function treeFiles(root, accept = () => true, base = root) {
  const entries = []
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name),
      rel = relative(base, path).split(sep).join('/')
    const stat = lstatSync(path)
    if (!accept(rel, stat.isDirectory())) continue
    if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${path}`)
    if (stat.isDirectory()) entries.push(...treeFiles(path, accept, base))
    else if (stat.isFile()) entries.push({ path: rel, hash: fileHash(path) })
    else throw new Error(`Unsupported input file: ${path}`)
  }
  return entries
}
export function treeHash(root) {
  const files = treeFiles(root)
  if (!files.length) throw new Error(`Artifact directory is empty: ${root}`)
  return digest(files)
}
export function verifyObservationArtifacts(record) {
  try {
    return (
      Array.isArray(record.artifactPaths) &&
      record.artifactPaths.length > 0 &&
      record.artifactPaths.every((path) => fileHash(path) === record.artifactFileHashes?.[path])
    )
  } catch {
    return false
  }
}
