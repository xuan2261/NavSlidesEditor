import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('rclone routes contract', () => {
  const src = readFileSync('server/routes/sync.js', 'utf8')

  it('exposes GET /status', () => {
    expect(src).toMatch(/router\.get\s*\(\s*['"]\/status['"]/)
  })

  it('exposes POST /config', () => {
    expect(src).toMatch(/router\.post\s*\(\s*['"]\/config['"]/)
  })

  it('exposes POST /sync', () => {
    expect(src).toMatch(/router\.post\s*\(\s*['"]\/sync['"]/)
  })

  it('exposes POST /sync-single', () => {
    expect(src).toMatch(/router\.post\s*\(\s*['"]\/sync-single['"]/)
  })

  it('does not expose legacy /push or /pull routes', () => {
    expect(src).not.toMatch(/router\.(get|post|put|delete|patch)\s*\(\s*['"]\/push['"]/)
    expect(src).not.toMatch(/router\.(get|post|put|delete|patch)\s*\(\s*['"]\/pull['"]/)
  })
})
