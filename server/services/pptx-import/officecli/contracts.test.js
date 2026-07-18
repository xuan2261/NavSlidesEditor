import { describe, expect, it } from 'vitest'
import policy from './command-policy.js'
import output from './output-parser.js'
import processContract from './process-contract.js'

const { classifyCommand, isCommandAllowed } = policy
const { parseBoundedJson } = output
const { buildOfficeCliEnv, buildSpawnOptions } = processContract

describe('OfficeCLI process and output contracts', () => {
  it('allowlists runtime variables, removes secrets, and forces mandatory flags', () => {
    expect(buildOfficeCliEnv({
      TEMP: 'C:\\Temp',
      LANG: 'en_US.UTF-8',
      OFFICECLI_SKIP_UPDATE: '0',
      API_TOKEN: 'top-secret',
      AWS_SECRET_ACCESS_KEY: 'also-secret',
      PATH: 'C:\\untrusted',
    })).toEqual({
      TEMP: 'C:\\Temp',
      LANG: 'en_US.UTF-8',
      OFFICECLI_NO_AUTO_RESIDENT: '1',
      OFFICECLI_SKIP_UPDATE: '1',
    })
  })

  it('uses direct hidden spawn without a shell', () => {
    expect(buildSpawnOptions({ env: { TEMP: 'C:\\Temp' } })).toMatchObject({
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  })

  it.each(['{"ok":', 'noise before json', ''])(
    'rejects malformed or truncated JSON: %j',
    (text) => {
      expect(() => parseBoundedJson(text, { maxBytes: 64 })).toThrow(/OfficeCLI JSON output/)
    }
  )

  it('rejects output beyond the byte limit before parsing', () => {
    expect(() => parseBoundedJson(`"${'x'.repeat(65)}"`, { maxBytes: 64 })).toThrow(/output limit/)
  })
})

describe('OfficeCLI command policy', () => {
  it.each([
    ['get', 'permitted-read'],
    ['query', 'permitted-read'],
    ['dump', 'permitted-read'],
    ['raw', 'permitted-read'],
    ['view', 'permitted-read'],
    ['validate', 'permitted-validation'],
    ['raw-set', 'permitted-domain-mutation'],
    ['add-part', 'permitted-domain-mutation'],
    ['batch', 'internal-only-escape-hatch'],
    ['set', 'prohibited'],
  ])('classifies %s as %s', (command, classification) => {
    expect(classifyCommand(command)).toBe(classification)
  })

  it('keeps mutation and internal commands disabled by default', () => {
    expect(isCommandAllowed('get')).toBe(true)
    expect(isCommandAllowed('validate')).toBe(true)
    expect(isCommandAllowed('raw-set')).toBe(false)
    expect(isCommandAllowed('batch')).toBe(false)
    expect(isCommandAllowed('set')).toBe(false)
  })
})
