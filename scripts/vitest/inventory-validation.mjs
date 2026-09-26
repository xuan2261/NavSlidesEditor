import { hashBytes } from './baseline-support.mjs'

function sorted(values) {
  return [...new Set(values)].sort()
}

export function validateLaneUnion(entries, lanePaths) {
  const discoveredCounts = new Map()
  const expectedLane = new Map()
  for (const entry of entries) {
    discoveredCounts.set(entry.path, (discoveredCounts.get(entry.path) || 0) + 1)
    expectedLane.set(entry.path, entry.lane)
  }

  const memberships = new Map()
  const duplicates = []
  for (const [lane, paths] of Object.entries(lanePaths)) {
    const laneCounts = new Map()
    for (const file of paths) {
      laneCounts.set(file, (laneCounts.get(file) || 0) + 1)
      const lanes = memberships.get(file) || new Set()
      lanes.add(lane)
      memberships.set(file, lanes)
    }
    for (const [file, count] of laneCounts) {
      if (count > 1) duplicates.push(`${lane}:${file}`)
    }
  }
  for (const [file, count] of discoveredCounts) {
    if (count > 1) duplicates.push(`discovery:${file}`)
  }

  const discovered = new Set(discoveredCounts.keys())
  const omitted = [...discovered].filter((file) => !memberships.has(file))
  const unexpected = [...memberships.keys()].filter((file) => !discovered.has(file))
  const overlaps = [...memberships].filter(([, lanes]) => lanes.size > 1).map(([file]) => file)
  const misclassified = []
  for (const [file, lanes] of memberships) {
    if (!discovered.has(file)) continue
    for (const lane of lanes) {
      if (lane !== expectedLane.get(file)) misclassified.push(`${file}:${lane}`)
    }
  }
  const result = {
    valid: false,
    duplicates: sorted(duplicates),
    overlaps: sorted(overlaps),
    omitted: sorted(omitted),
    unexpected: sorted(unexpected),
    misclassified: sorted(misclassified),
  }
  result.valid = Object.entries(result)
    .filter(([key]) => key !== 'valid')
    .every(([, values]) => values.length === 0)
  return result
}

export function buildInventoryReceipt(entries, validation, metadata = {}) {
  const files = [...entries].sort((a, b) => a.path.localeCompare(b.path))
  const identity = files.map(({ path, sourceSha256 }) => ({ path, sourceSha256 }))
  return {
    schemaVersion: 1,
    kind: 'vitest-canonical-lane-inventory',
    capturedAt: new Date().toISOString(),
    ...metadata,
    inventory: {
      algorithm: 'sha256',
      hash: hashBytes(JSON.stringify(identity)),
      fileCount: files.length,
      files,
    },
    validation,
  }
}
