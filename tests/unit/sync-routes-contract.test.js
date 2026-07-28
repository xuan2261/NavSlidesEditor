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

  it('serializes authoritative normalized DTOs with a generation-fenced package bundle', () => {
    expect(src).toMatch(/await\s+readAuthoritativePresentations\s*\(\s*presentations\b/)
    expect(src).toMatch(/readAuthoritativePresentations\s*\(\s*\[\s*storedPresentation\s*\]\s*,/)
    expect(src).toMatch(/toExternalPresentationDto\s*\(\s*normalizePptxImportedPresentationForRead\s*\(\s*resolved\.presentation\s*\)\s*\)/)
    expect(src).toMatch(/JSON\.stringify\s*\(\s*presentation\s*,\s*null,\s*2\s*\)/)
    expect(src).toMatch(/const\s+expectedHead\s*=\s*resolved\.presentation\.pptxAggregateHead/)
    expect(src).toMatch(/store\.exportPresentationPackage\s*\(\s*resolved\.presentation\.id\s*,\s*\{\s*expectedHead\s*\}\s*\)/)
    expect(src).toMatch(/hashRecord\s*\(\s*bundle\.manifest\.head\s*\)\s*!==\s*hashRecord\s*\(\s*expectedHead\s*\)/)
  })
})
