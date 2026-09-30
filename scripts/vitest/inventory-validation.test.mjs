import { describe, expect, it } from 'vitest'
import { buildInventoryReceipt, validateLaneUnion } from './inventory-validation.mjs'

const entries = [
  {
    path: 'client/example.test.jsx',
    lane: 'client-jsdom',
    reason: 'client browser test',
    environment: 'jsdom',
    serialReason: null,
    sourceSha256: 'a'.repeat(64),
  },
  {
    path: 'server/example.test.js',
    lane: 'node-parallel',
    reason: 'node test root',
    environment: 'node',
    serialReason: null,
    sourceSha256: 'b'.repeat(64),
  },
]

describe('Vitest inventory validation', () => {
  it('accepts an exact disjoint project union and records required metadata', () => {
    const validation = validateLaneUnion(entries, {
      'client-jsdom': ['client/example.test.jsx'],
      'node-parallel': ['server/example.test.js'],
      'node-serial': [],
    })
    expect(validation).toMatchObject({
      valid: true,
      duplicates: [],
      overlaps: [],
      omitted: [],
      unexpected: [],
      misclassified: [],
    })
    const receipt = buildInventoryReceipt(entries, validation, {
      configSha256: 'c'.repeat(64),
    })
    expect(receipt.inventory.files[0]).toEqual(entries[0])
    expect(receipt.inventory.fileCount).toBe(2)
    expect(receipt.inventory.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.validation.valid).toBe(true)
  })

  it('reports duplicates, overlap, omission, unexpected files, and wrong lanes', () => {
    const validation = validateLaneUnion(entries, {
      'client-jsdom': [
        'client/example.test.jsx',
        'client/example.test.jsx',
        'server/example.test.js',
        'scripts/unexpected.test.js',
      ],
      'node-parallel': ['client/example.test.jsx'],
      'node-serial': [],
    })
    expect(validation.valid).toBe(false)
    expect(validation.duplicates).toEqual(['client-jsdom:client/example.test.jsx'])
    expect(validation.overlaps).toEqual(['client/example.test.jsx'])
    expect(validation.omitted).toEqual([])
    expect(validation.unexpected).toEqual(['scripts/unexpected.test.js'])
    expect(validation.misclassified).toEqual([
      'client/example.test.jsx:node-parallel',
      'server/example.test.js:client-jsdom',
    ])
  })

  it('reports a discovered file omitted from every project', () => {
    const validation = validateLaneUnion(entries, {
      'client-jsdom': ['client/example.test.jsx'],
      'node-parallel': [],
      'node-serial': [],
    })
    expect(validation.valid).toBe(false)
    expect(validation.omitted).toEqual(['server/example.test.js'])
  })
})
