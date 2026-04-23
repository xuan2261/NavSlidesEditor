import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const CLIENT_SRC_ROOT = path.join(REPO_ROOT, 'client', 'src')
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
const GUARDED_STYLE_PROP_BUDGETS = {
  'client/src/components/dashboard/TemplateGallery.jsx': 1,
  'client/src/components/dashboard/TemplatePreview.jsx': 4,
}
const REMOVED_FILES = ['client/src/pages/dashboard/TemplatePreview.jsx']

const INLINE_STYLE_BUDGETS = {
  'client/src/pages/SpeakerViewPage.jsx': 0,
  'client/src/pages/LiveViewPage.jsx': 3,
  'client/src/components/Toolbar.jsx': 0,
  'client/src/components/SlidePanel.jsx': 0,
  'client/src/components/SlideSorterView.jsx': 0,
  'client/src/components/SelectionPane.jsx': 0,
  'client/src/pages/HomePage.jsx': 0,
  'client/src/components/QuickAccessToolbar.jsx': 0,
  'client/src/components/LivePresentationModal.jsx': 0,
  'client/src/components/FindReplaceBar.jsx': 0,
  'client/src/components/EditorMenuBar.jsx': 0,
  'client/src/components/DropdownMenu.jsx': 0,
  'client/src/pages/ExplorePage.jsx': 0,
  'client/src/components/TemplatePickerModal.jsx': 0,
  'client/src/components/MiniToolbar.jsx': 0,
  'client/src/pages/EditorPage.jsx': 0,
  'client/src/pages/SettingsPage.jsx': 0,
  'client/src/components/SlideCanvas.jsx': 13,
}

const EXEMPT_FILES = new Set([
  'client/src/components/TransitionPreview.jsx',
  'client/src/data/slide-templates.js',
  'client/src/data/element-defaults.js',
  'client/src/utils/markdown-import.js',
  'client/src/utils/markdown-import.test.js',
  'client/src/utils/exportPptx.js',
  'client/src/extensions/MathExtension.js',
  'client/src/components/CSSEditorModal.jsx',
  'client/src/components/CodeEditorModal.jsx',
  'client/src/components/LatexEditorModal.jsx',
  'client/src/components/HtmlEditorModal.jsx',
  'client/src/components/AnalyticsModal.jsx',
  'client/src/components/PropertiesPanel.jsx',
  'client/src/components/AnimationTimeline.jsx',
  'client/src/components/SlideThumbnail.jsx',
])

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(fullPath)
    if (!/\.(js|jsx)$/.test(entry.name)) return []
    return [fullPath]
  })
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length
}

describe('tailwind inline-style audit', () => {
  it('keeps migrated-scope inline styles within budget', () => {
    const actualCounts = Object.fromEntries(
      collectFiles(CLIENT_SRC_ROOT).map((fullPath) => {
        const relativePath = path.relative(REPO_ROOT, fullPath).replaceAll('\\', '/')
        const source = fs.readFileSync(fullPath, 'utf8')
        return [relativePath, countMatches(source, /style=\{\{/g)]
      })
    )

    for (const [relativePath, budget] of Object.entries(INLINE_STYLE_BUDGETS)) {
      expect(actualCounts[relativePath] || 0, relativePath).toBeLessThanOrEqual(budget)
    }

    const remainingNonExempt = Object.entries(actualCounts)
      .filter(([, count]) => count > 0)
      .filter(([relativePath]) => !EXEMPT_FILES.has(relativePath))
      .filter(([relativePath]) => !(relativePath in INLINE_STYLE_BUDGETS))

    expect(remainingNonExempt, 'unexpected non-exempt inline styles').toEqual([])

    const repoWideInlineStyleCount = Object.entries(actualCounts)
      .filter(([relativePath]) => !EXEMPT_FILES.has(relativePath))
      .reduce((total, [, count]) => total + count, 0)

    expect(repoWideInlineStyleCount).toBeLessThanOrEqual(30)
  })

  it('limits general style props on guarded dashboard and template surfaces', () => {
    for (const [relativePath, budget] of Object.entries(GUARDED_STYLE_PROP_BUDGETS)) {
      const fullPath = path.join(REPO_ROOT, relativePath)
      expect(fs.existsSync(fullPath), `${relativePath} should exist`).toBe(true)

      const source = fs.readFileSync(fullPath, 'utf8')
      expect(countMatches(source, /style=\{/g), relativePath).toBeLessThanOrEqual(budget)
    }
  })

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
      const matches = [
        ...source.matchAll(/\b(qat-dot|anim-fade-in|anim-zoom-in)\b/g),
      ].map((match) => `${relativePath}:${match[1]}`)
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
