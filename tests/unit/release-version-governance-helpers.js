import { createHash } from 'node:crypto'

export function compareCoreVersions(left, right) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value)
    if (!match) throw new Error(`Invalid release core version: ${value}`)
    return match.slice(1).map(Number)
  }
  const leftParts = parse(left)
  const rightParts = parse(right)
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return Math.sign(leftParts[index] - rightParts[index])
    }
  }
  return 0
}

export function parseReleaseTag(tag, packageVersion) {
  const match = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-rc\.([1-9]\d*))?$/.exec(tag)
  if (!match || match[1] !== packageVersion) return null
  return match[2]
    ? { coreVersion: match[1], kind: 'rc', rcNumber: Number(match[2]) }
    : { coreVersion: match[1], kind: 'final' }
}

export function semanticLockHash(lock, packagePaths) {
  const clone = structuredClone(lock)
  delete clone.version
  for (const packagePath of packagePaths) delete clone.packages[packagePath].version
  return createHash('sha256').update(JSON.stringify(clone)).digest('hex')
}
