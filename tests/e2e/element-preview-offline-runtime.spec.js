import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test('element previews use local offline runtimes and required vendor assets exist', async ({ page }) => {
  const root = process.cwd()
  const chart = fs.readFileSync(path.join(root, 'client/src/components/canvas/element-renderers/chart-element-renderer.jsx'), 'utf8')
  const latex = fs.readFileSync(path.join(root, 'client/src/components/canvas/element-renderers/latex-element-renderer.jsx'), 'utf8')
  const requiredAssets = [
    'server/vendor/chart.js/dist/chart.umd.js',
    'server/vendor/katex/dist/katex.min.css',
    'server/vendor/katex/dist/katex.min.js',
    'server/vendor/tikzjax/fonts.css',
    'server/vendor/tikzjax/tikzjax.js',
  ]

  for (const asset of requiredAssets) {
    expect(fs.existsSync(path.join(root, asset))).toBe(true)
  }
  expect(chart).toContain('/vendor/chart.js/dist/chart.umd.js')
  expect(latex).toContain('/vendor/katex/dist/katex.min.css')
  expect(latex).toContain('/vendor/katex/dist/katex.min.js')
  expect(latex).toContain('/vendor/tikzjax/fonts.css')
  expect(latex).toContain('/vendor/tikzjax/tikzjax.js')
  expect(`${chart}\n${latex}`).not.toContain('cdn.jsdelivr.net')
  expect(`${chart}\n${latex}`).not.toContain('tikzjax.com')

  const blocked = []
  await page.route(/cdn\.jsdelivr\.net|tikzjax\.com/, (route) => {
    blocked.push(route.request().url())
    return route.abort()
  })
  await page.setContent('<iframe srcdoc="<script src=&quot;/vendor/chart.js/dist/chart.umd.js&quot;></script>"></iframe>')
  expect(blocked).toEqual([])
})
