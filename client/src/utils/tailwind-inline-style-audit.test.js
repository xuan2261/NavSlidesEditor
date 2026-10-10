import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const ROOT_FILES = [
  'client/tailwind.config.js',
  'client/src/index.css',
  'client/src/components/QuickAccessToolbar.jsx',
  'client/src/components/TemplatePickerModal.jsx',
  'client/src/pages/HomePage.jsx',
]
const DASHBOARD_MODAL_FILES = [
  'client/src/components/dashboard/TemplateGallery.jsx',
  'client/src/components/dashboard/TemplatePreview.jsx',
]
const REMOVED_FILES = ['client/src/pages/dashboard/TemplatePreview.jsx']

describe('tailwind inline-style audit', () => {
  it('removes orphaned dashboard preview artifacts', () => {
    const remainingArtifacts = REMOVED_FILES.filter((relativePath) =>
      fs.existsSync(path.join(REPO_ROOT, relativePath))
    )

    expect(remainingArtifacts).toEqual([])
  })

  it('removes legacy animation and save-indicator classes from migrated surfaces', () => {
    const sources = ROOT_FILES.map((relativePath) => [
      relativePath,
      fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'),
    ])

    const offenders = sources.flatMap(([relativePath, source]) => {
      const matches = [...source.matchAll(/\b(qat-dot|anim-fade-in|anim-zoom-in)\b/g)].map(
        (match) => `${relativePath}:${match[1]}`
      )
      return matches
    })

    expect(offenders).toEqual([])
  })

  it('uses only supported dashboard modal animation classes', () => {
    const sources = DASHBOARD_MODAL_FILES.map((relativePath) => [
      relativePath,
      fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'),
    ])

    const invalidClasses = sources.flatMap(([relativePath, source]) => {
      const matches = [...source.matchAll(/\b(?:animate-in|fade-in|zoom-in-95)\b/g)]
      return matches.map((match) => `${relativePath}:${match[0]}`)
    })
    const missingZoomAnimation = sources
      .filter(([, source]) => !source.includes('animate-zoom-in'))
      .map(([relativePath]) => relativePath)

    expect(invalidClasses).toEqual([])
    expect(missingZoomAnimation).toEqual([])
  })
})
