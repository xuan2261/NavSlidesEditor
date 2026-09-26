import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')
const policy = JSON.parse(read('config/release-target-policy.json'))

describe('multi-host release receipt contract', () => {
  it('selects Windows and explicitly declines unqualified desktop targets', () => {
    expect(policy.targets.windows.selected).toBe(true)
    expect(policy.targets['linux-desktop']).toMatchObject({
      selected: false,
      unselectedReceiptStatus: 'not-selected',
    })
    expect(policy.targets['macos-desktop']).toMatchObject({
      selected: false,
      unselectedReceiptStatus: 'not-selected',
    })
  })

  it('requires selected physical Windows gates and a non-circular root DAG', () => {
    const windows = read('.github/workflows/reusable-windows-qualification.yml')
    const linux = read('.github/workflows/reusable-green-sha-verification.yml')
    for (const gate of ['officecli', 'fidelity', 'authenticode', 'attestation']) {
      expect(policy.targets.windows.requiredGates.join(' ')).toContain(gate)
      expect(windows.toLowerCase()).toContain(gate)
    }
    expect(windows).toContain('linux_receipt_hash')
    expect(linux).toContain('create-root')
    expect(linux).toContain('not-selected')
  })
})
