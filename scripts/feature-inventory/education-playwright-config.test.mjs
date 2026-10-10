import { describe, expect, it } from 'vitest'
import configuration from '../../tests/e2e/education/desktop-runtime-config.cjs'

const { desktopLane, desktopProjects, qualificationReporters } = configuration

describe('explicit education qualification configuration', () => {
  it('preserves ordinary browser reporters without requiring desktop environment', () => {
    expect(
      qualificationReporters([['html', { open: 'never' }]], {}, ['node', 'playwright', 'test'])
    ).toEqual([['html', { open: 'never' }]])
  })
  it('registers frozen evidence for the ordinary supported scoped invocation', () => {
    const reporters = qualificationReporters(
      [['html']],
      { NAVSLIDES_EDUCATION_CONTEXT: 'frozen.json' },
      ['node', 'playwright', 'test', 'tests/e2e/education/static-exports-release.spec.js']
    )
    expect(reporters.some(([name]) => name.endsWith('release-evidence-reporter.js'))).toBe(true)
  })
  it.each([['--reporter=line'], ['--reporter', 'line']])(
    'refuses frozen reporter override %s rather than suppressing evidence',
    (...args) => {
      expect(() =>
        qualificationReporters([['html']], { NAVSLIDES_EDUCATION_CONTEXT: 'frozen.json' }, [
          'node',
          'playwright',
          'test',
          ...args,
        ])
      ).toThrow(/reporter.*override|override.*reporter/i)
    }
  )
  it('gives each desktop project its own required lane and excludes browser suites', () => {
    const projects = desktopProjects()
    expect(projects.map((project) => project.name)).toEqual(['electron-dev', 'windows-packaged'])
    for (const project of projects) {
      expect(desktopLane(project)).toBe(project.name)
      expect(project.testMatch.test('tests/e2e/education/desktop-runtime-release.spec.js')).toBe(
        true
      )
      expect(project.testMatch.test('tests/e2e/education/static-exports-release.spec.js')).toBe(
        false
      )
      expect(project.workers).toBe(1)
    }
  })
  it.each([
    {},
    { name: 'chromium' },
    { name: 'electron-dev', metadata: { educationDesktopLane: 'unsupported' } },
  ])('fails a non-desktop project instead of downgrading or skipping its runtime', (project) => {
    expect(() => desktopLane(project)).toThrow(/desktop|lane/i)
  })
})
