import { describe, expect, it } from 'vitest'
import { buildStemSimulationEmbed, STEM_SIMULATION_PROVIDERS } from './stem-embed-presets'

describe('stem simulation embed presets', () => {
  it('exposes the four supported providers', () => {
    expect(STEM_SIMULATION_PROVIDERS.map((provider) => provider.id)).toEqual([
      'phet',
      'geogebra',
      'desmos',
      'circuitjs',
    ])
  })

  it.each([
    [
      'phet',
      'states-of-matter',
      'https://phet.colorado.edu/sims/html/states-of-matter/latest/states-of-matter_en.html',
    ],
    ['geogebra', 'abc123', 'https://www.geogebra.org/material/iframe/id/abc123'],
    ['desmos', 'calc123', 'https://www.desmos.com/calculator/calc123'],
    [
      'circuitjs',
      'example-circuit',
      'https://www.falstad.com/circuit/circuitjs.html?ctz=example-circuit',
    ],
  ])('builds a safe iframe for %s IDs', (provider, input, expectedUrl) => {
    const embed = buildStemSimulationEmbed(provider, input)

    expect(embed.type).toBe('html')
    expect(embed.embedKind).toBe('stem-simulation')
    expect(embed.provider).toBe(provider)
    expect(embed.sourceUrl).toBe(expectedUrl)
    expect(embed.content).toContain(`src="${expectedUrl}"`)
    expect(embed.content).toContain(
      'sandbox="allow-scripts allow-same-origin allow-forms allow-popups"'
    )
    expect(embed.content).toContain('referrerpolicy="no-referrer"')
    expect(embed.content).toContain('loading="lazy"')
  })

  it('accepts allowed provider URLs', () => {
    const embed = buildStemSimulationEmbed(
      'geogebra',
      'https://www.geogebra.org/material/iframe/id/mabcd'
    )

    expect(embed.sourceUrl).toBe('https://www.geogebra.org/material/iframe/id/mabcd')
  })

  it.each([
    ['desmos', 'javascript:alert(1)'],
    ['desmos', 'data:text/html,boom'],
    ['phet', 'http://phet.colorado.edu/sims/html/demo/latest/demo_en.html'],
    ['phet', 'https://localhost/sim'],
    ['phet', 'https://127.0.0.1/sim'],
    ['phet', 'https://evil.example/sim'],
    ['unknown', 'demo'],
  ])('rejects unsafe provider input %s %s', (provider, input) => {
    expect(() => buildStemSimulationEmbed(provider, input)).toThrow()
  })
})
