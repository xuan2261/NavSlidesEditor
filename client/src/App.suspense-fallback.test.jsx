import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const APP_SOURCE = fs.readFileSync(path.join(REPO_ROOT, 'src', 'App.jsx'), 'utf8')

describe('App lazy route fallback', () => {
  it('renders accessible loading feedback instead of a blank Suspense fallback', () => {
    expect(APP_SOURCE).not.toContain('fallback={null}')
    expect(APP_SOURCE).toContain('role="status"')
    expect(APP_SOURCE).toContain('Loading NavSlides')
  })
})
